import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { appendAudit, archiveAuditBatch, AuditLedger, verifyAuditEvent } from './audit';
import { consumeDailyAllowance, parseDailyLimit, readDailyUsage } from './cost-controls';
import { buildContextualQuestion, buildSearchMessages, loadConversationContext } from './conversation-context';
import { MaintenanceScheduler } from './maintenance';
import { AiGatewayError, generateGroundedAnswer } from './openai';
import { ensureOrinyanEnding, evaluatePolicy, noGroundingDecision, SYSTEM_PROMPT } from './policy';
import { evaluateRentalConsultation } from './rental-consultation';
import { attachMissingSourceMarkers, filterAnswerableChunks, safeSourceUrl, selectAnswerSources, sourceFromChunk } from './sources';
import {
  createSessionToken,
  decryptPII,
  encryptPII,
  redactPII,
  requireAdmin,
  sha256,
  verifySessionToken,
  verifyTurnstile,
} from './security';
import type { AdminIdentity, AuditArchiveEvent, SearchChunk } from './types';

export { AuditLedger, MaintenanceScheduler };

type Variables = { admin: AdminIdentity; requestId: string };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const sessionSchema = z.object({
  sourcePage: z.string().url().max(1000).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

const messageSchema = z.object({
  conversationId: z.string().uuid(),
  sessionToken: z.string().min(20).max(500),
  message: z.string().trim().min(1).max(2000),
});

const leadSchema = z.object({
  conversationId: z.string().uuid(),
  sessionToken: z.string().min(20).max(500),
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().min(8).max(30).optional(),
  marketingConsent: z.literal(true),
}).refine((data) => data.email || data.phone, { message: 'メールアドレスまたは電話番号が必要です' });

const knowledgeReseedSchema = z.object({
  prune: z.boolean().default(false),
});

function allowedOrigins(env: Env) {
  return new Set(env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean));
}

function isAllowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin || allowedOrigins(env).has(origin);
}

app.use('*', async (context, next) => {
  const requestId = context.req.header('CF-Ray') || crypto.randomUUID();
  context.set('requestId', requestId);
  await next();
  context.header('X-Request-ID', requestId);
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  context.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

app.use('/api/*', async (context, next) => {
  if (!isAllowedOrigin(context.req.raw, context.env)) return context.json({ error: 'Origin not allowed' }, 403);
  return cors({
    origin: (origin) => (origin === new URL(context.req.url).origin || allowedOrigins(context.env).has(origin) ? origin : ''),
    allowHeaders: ['Content-Type', 'Cf-Access-Jwt-Assertion', 'X-Dev-Admin'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(context, next);
});

app.onError((error, context) => {
  const status = error instanceof z.ZodError || error instanceof SyntaxError
    ? 400
    : error.message === 'Unauthorized'
      ? 401
      : error.message === 'Forbidden'
        ? 403
        : 500;
  const requestId = context.get('requestId') || crypto.randomUUID();
  console.error(JSON.stringify({
    level: 'error',
    event: 'request.failed',
    requestId,
    method: context.req.method,
    path: context.req.path,
    status,
    errorType: error.name,
    message: error.message,
  }));
  const canSeeInternalDetails = context.req.path === '/api/internal/knowledge/reseed'
    && Boolean(context.env.KNOWLEDGE_SYNC_SECRET)
    && context.req.header('X-Knowledge-Sync-Token') === context.env.KNOWLEDGE_SYNC_SECRET;
  return context.json({
    error: status === 500 ? '処理中にエラーが発生しました' : error.message,
    requestId,
    ...(canSeeInternalDetails ? { details: error.message } : {}),
  }, status);
});

app.get('/health', (context) => context.json({ ok: true, environment: context.env.ENVIRONMENT }));

app.notFound(async (context) => {
  if (context.req.method !== 'GET' && context.req.method !== 'HEAD') return context.json({ error: 'Not found' }, 404);
  const url = new URL(context.req.url);
  if (url.pathname === '/admin') url.pathname = '/admin/index.html';
  if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/widget/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/documents/') || url.pathname.startsWith('/knowledge/')) {
    const response = await context.env.STATIC_ASSETS.fetch(new Request(url, context.req.raw));
    if (response.status !== 404 || !url.pathname.startsWith('/admin/')) return response;
    url.pathname = '/admin/index.html';
    return context.env.STATIC_ASSETS.fetch(new Request(url, context.req.raw));
  }
  return context.json({ error: 'Not found' }, 404);
});

app.post('/api/chat/session', async (context) => {
  const input = sessionSchema.parse(await context.req.json());
  if (!(await verifyTurnstile(input.turnstileToken, context.req.raw, context.env))) {
    return context.json({ error: 'Bot verification failed' }, 403);
  }

  const id = crypto.randomUUID();
  const ip = context.req.header('CF-Connecting-IP') || 'local';
  const visitorHash = await sha256(`${context.env.HASH_SALT}:${ip}:${context.req.header('User-Agent') || ''}`);
  const rate = await context.env.RATE_LIMITER.limit({ key: `session:${visitorHash}` });
  if (!rate.success) return context.json({ error: '少し時間をおいてからお試しください' }, 429);
  const dailySessions = await consumeDailyAllowance(
    context.env.DB,
    'chat_sessions',
    context.env.DAILY_SESSION_LIMIT,
    500,
  );
  if (!dailySessions.allowed) {
    console.warn(JSON.stringify({ level: 'warn', event: 'cost_guard.sessions_exhausted', day: dailySessions.day, limit: dailySessions.limit }));
    return context.json({ error: '本日のチャット受付上限に達しました。お問い合わせフォームをご利用ください。' }, 429);
  }
  await context.env.DB.prepare(
    `INSERT INTO conversations (id, visitor_hash, source_page, operational_consent) VALUES (?, ?, ?, 1)`,
  ).bind(id, visitorHash, input.sourcePage || null).run();
  await appendAudit(context.env, {
    eventType: 'conversation.created',
    actorType: 'visitor',
    actorId: visitorHash,
    subjectType: 'conversation',
    subjectId: id,
    metadata: { sourcePage: input.sourcePage || null },
  });
  return context.json({
    conversationId: id,
    sessionToken: await createSessionToken(id, context.env),
    expiresIn: 86400,
  });
});

function knowledgeCategoryFromFilename(filename: string) {
  const category = filename
    .replace(/\.md$/iu, '')
    .replace(/-part-\d+$/iu, '');
  return /^[a-z0-9_]{1,64}$/u.test(category) ? category : 'general';
}

async function recordTurn(
  env: Env,
  conversationId: string,
  userText: string,
  answer: string,
  policyAction: string,
  model: string | null,
  latencyMs: number,
  chunks: SearchChunk[] = [],
) {
  const userMessageId = crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`INSERT INTO messages (id, conversation_id, role, content_redacted, policy_action) VALUES (?, ?, 'user', ?, ?)`)
      .bind(userMessageId, conversationId, userText, policyAction),
    env.DB.prepare(`INSERT INTO messages (id, conversation_id, role, content_redacted, model, latency_ms, policy_action) VALUES (?, ?, 'assistant', ?, ?, ?, ?)`)
      .bind(assistantMessageId, conversationId, answer, model, latencyMs, policyAction),
    env.DB.prepare(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(conversationId),
  ];
  chunks.slice(0, 5).forEach((chunk, index) => {
    const source = sourceFromChunk(chunk, index);
    statements.push(
      env.DB.prepare(`INSERT INTO citations (id, message_id, source_key, source_title, source_url, score) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), assistantMessageId, source.key, source.title, source.url || null, source.score),
    );
  });
  await env.DB.batch(statements);
  return assistantMessageId;
}

app.post('/api/chat/message', async (context) => {
  const startedAt = Date.now();
  const input = messageSchema.parse(await context.req.json());
  if (!(await verifySessionToken(input.sessionToken, input.conversationId, context.env))) {
    return context.json({ error: 'Session expired' }, 401);
  }
  const conversation = await context.env.DB.prepare(`SELECT id FROM conversations WHERE id = ?`).bind(input.conversationId).first();
  if (!conversation) return context.json({ error: 'Conversation not found' }, 404);

  const rate = await context.env.RATE_LIMITER.limit({ key: input.conversationId });
  if (!rate.success) return context.json({ error: '少し時間をおいてからお試しください' }, 429);

  const redacted = redactPII(input.message);
  const policy = evaluatePolicy(redacted);
  if (!policy.allowed) {
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      policy.response || '',
      policy.code,
      null,
      Date.now() - startedAt,
    );
    await appendAudit(context.env, {
      eventType: 'chat.refused',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { code: policy.code },
    });
    return context.json({ answer: policy.response, sources: [], action: 'escalate', policy: policy.code });
  }

  const conversationHistory = await loadConversationContext(context.env.DB, input.conversationId);
  const rentalConsultation = evaluateRentalConsultation(conversationHistory, redacted);
  if (rentalConsultation.response) {
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      rentalConsultation.response,
      'allow',
      null,
      Date.now() - startedAt,
    );
    await appendAudit(context.env, {
      eventType: 'chat.clarification_requested',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { flow: 'rental_consultation' },
    });
    return context.json({
      answer: rentalConsultation.response,
      sources: [],
      action: 'none',
      policy: 'allow',
      messageId,
    });
  }

  const dailyAi = await consumeDailyAllowance(
    context.env.DB,
    'ai_requests',
    context.env.DAILY_AI_REQUEST_LIMIT,
    500,
  );
  if (!dailyAi.allowed) {
    console.warn(JSON.stringify({ level: 'warn', event: 'cost_guard.ai_exhausted', day: dailyAi.day, limit: dailyAi.limit }));
    return context.json({ error: '本日のAI回答上限に達しました。公式LINEまたはお問い合わせフォームをご利用ください。' }, 429);
  }

  const contextualQuestion = buildContextualQuestion(conversationHistory, redacted, rentalConsultation.active);
  const search = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE);
  const searchResult = await search.search({
    messages: buildSearchMessages(conversationHistory, redacted, rentalConsultation.active),
    ai_search_options: {
      retrieval: {
        retrieval_type: 'hybrid',
        max_num_results: rentalConsultation.active ? 10 : 6,
        match_threshold: rentalConsultation.active ? 0.2 : 0.4,
        context_expansion: rentalConsultation.active ? 2 : 1,
        ...(rentalConsultation.active
          ? { keyword_match_mode: 'or' as const }
          : { boost_by: [{ field: 'timestamp', direction: 'desc' as const }] }),
      },
      query_rewrite: { enabled: true },
      reranking: {
        enabled: true,
        model: '@cf/baai/bge-reranker-base',
        match_threshold: rentalConsultation.active ? 0.2 : 0.4,
      },
      cache: { enabled: true, cache_threshold: 'super_strict_match' },
    },
  });
  const chunks = filterAnswerableChunks(searchResult.chunks || [], contextualQuestion, {
    rentalOnly: rentalConsultation.active,
  });
  const bestScore = Math.max(0, ...chunks.map((chunk) => chunk.score));
  if (chunks.length === 0 || bestScore < 0.48) {
    const refusal = noGroundingDecision();
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      refusal.response || '',
      refusal.code,
      null,
      Date.now() - startedAt,
    );
    await appendAudit(context.env, {
      eventType: 'chat.refused',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { code: refusal.code, bestScore },
    });
    return context.json({ answer: refusal.response, sources: [], action: 'escalate', policy: refusal.code });
  }

  let completion: { answer: string; model: string };
  try {
    completion = await generateGroundedAnswer(context.env, redacted, chunks, SYSTEM_PROMPT, conversationHistory);
  } catch (error) {
    if (error instanceof AiGatewayError && error.status === 429) {
      console.warn(JSON.stringify({ level: 'warn', event: 'cost_guard.gateway_spend_limit', requestId: context.get('requestId') }));
      return context.json({ error: '今月のAI利用上限に達しました。お問い合わせフォームをご利用ください。' }, 429);
    }
    throw error;
  }
  const voicedAnswer = ensureOrinyanEnding(completion.answer);
  const sources = selectAnswerSources(voicedAnswer, chunks, 2, contextualQuestion);
  const answer = attachMissingSourceMarkers(voicedAnswer, sources);
  const messageId = await recordTurn(
    context.env,
    input.conversationId,
    redacted,
    answer,
    'allow',
    completion.model,
    Date.now() - startedAt,
    chunks,
  );
  await appendAudit(context.env, {
    eventType: 'chat.answered',
    actorType: 'visitor',
    subjectType: 'message',
    subjectId: messageId,
    metadata: { model: completion.model, sourceCount: sources.length, bestScore },
  });
  return context.json({ answer, sources, action: 'none', policy: 'allow', messageId });
});

app.post('/api/chat/lead', async (context) => {
  const input = leadSchema.parse(await context.req.json());
  if (!(await verifySessionToken(input.sessionToken, input.conversationId, context.env))) {
    return context.json({ error: 'Session expired' }, 401);
  }
  const conversation = await context.env.DB.prepare(`SELECT id FROM conversations WHERE id = ?`)
    .bind(input.conversationId)
    .first<{ id: string }>();
  if (!conversation) return context.json({ error: 'Conversation not found' }, 404);
  const rate = await context.env.RATE_LIMITER.limit({ key: `lead:${input.conversationId}` });
  if (!rate.success) return context.json({ error: '少し時間をおいてからお試しください' }, 429);

  const customerId = crypto.randomUUID();
  const normalizedEmail = input.email?.toLowerCase();
  const normalizedPhone = input.phone?.replace(/\D/g, '');
  const emailHash = normalizedEmail ? await sha256(`${context.env.HASH_SALT}:${normalizedEmail}`) : null;
  const phoneHash = normalizedPhone ? await sha256(`${context.env.HASH_SALT}:${normalizedPhone}`) : null;
  const matches = await context.env.DB.prepare(
    `SELECT id FROM customers WHERE (? IS NOT NULL AND email_hash = ?) OR (? IS NOT NULL AND phone_hash = ?) LIMIT 2`,
  ).bind(emailHash, emailHash, phoneHash, phoneHash).all<{ id: string }>();
  const matchedIds = [...new Set(matches.results.map((row) => row.id))];
  if (matchedIds.length > 1) return context.json({ error: '連絡先情報を確認できませんでした。お問い合わせフォームをご利用ください。' }, 409);
  const existing = matchedIds[0] ? { id: matchedIds[0] } : null;
  const resolvedId = existing?.id || customerId;
  if (!existing) {
    await context.env.DB.prepare(
      `INSERT INTO customers (id, name_enc, email_enc, phone_enc, email_hash, phone_hash, email_last4, phone_last4, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      resolvedId,
      await encryptPII(input.name, context.env),
      await encryptPII(normalizedEmail, context.env),
      await encryptPII(normalizedPhone, context.env),
      emailHash,
      phoneHash,
      normalizedEmail?.slice(-4) || null,
      normalizedPhone?.slice(-4) || null,
      new Date().toISOString(),
    ).run();
  } else {
    await context.env.DB.prepare(
      `UPDATE customers SET
         name_enc = COALESCE(?, name_enc), email_enc = COALESCE(?, email_enc), phone_enc = COALESCE(?, phone_enc),
         email_hash = COALESCE(?, email_hash), phone_hash = COALESCE(?, phone_hash),
         email_last4 = COALESCE(?, email_last4), phone_last4 = COALESCE(?, phone_last4),
         consent_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(
      await encryptPII(input.name, context.env),
      await encryptPII(normalizedEmail, context.env),
      await encryptPII(normalizedPhone, context.env),
      emailHash,
      phoneHash,
      normalizedEmail?.slice(-4) || null,
      normalizedPhone?.slice(-4) || null,
      new Date().toISOString(),
      resolvedId,
    ).run();
  }
  await context.env.DB.batch([
    context.env.DB.prepare(`INSERT OR IGNORE INTO conversation_customers (conversation_id, customer_id) VALUES (?, ?)`).bind(input.conversationId, resolvedId),
    context.env.DB.prepare(`UPDATE conversations SET marketing_consent = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(input.conversationId),
  ]);
  await appendAudit(context.env, {
    eventType: 'customer.consent_recorded',
    actorType: 'visitor',
    subjectType: 'customer',
    subjectId: resolvedId,
    metadata: { conversationId: input.conversationId, channels: { email: Boolean(input.email), phone: Boolean(input.phone) } },
  });
  return context.json({ ok: true, customerId: resolvedId });
});

app.use('/api/admin/*', async (context, next) => {
  const admin = await requireAdmin(context.req.raw, context.env);
  context.set('admin', admin);
  await next();
});

app.post('/api/admin/knowledge/bootstrap', async (context) => {
  const id = context.env.AI_SEARCH_INSTANCE;
  const existing = await context.env.AI_SEARCH.list({ search: id, per_page: 50 });
  const found = existing.result.find((instance) => instance.id === id);
  if (!found) {
    await context.env.AI_SEARCH.create({
      id,
      rewrite_query: true,
      reranking: true,
      reranking_model: '@cf/baai/bge-reranker-base',
      index_method: { vector: true, keyword: true },
      fusion_method: 'rrf',
      score_threshold: 0.48,
      max_num_results: 6,
      cache: true,
      cache_threshold: 'super_strict_match',
      custom_metadata: [
        { field_name: 'category', data_type: 'text' },
        { field_name: 'language', data_type: 'text' },
        { field_name: 'source_url', data_type: 'text' },
        { field_name: 'title', data_type: 'text' },
      ],
    });
  }
  await appendAudit(context.env, {
    eventType: found ? 'knowledge.instance_verified' : 'knowledge.instance_created',
    actorType: 'admin',
    actorId: context.get('admin').email,
    subjectType: 'ai_search_instance',
    subjectId: id,
  });
  return context.json({ ok: true, instance: id, created: !found });
});

app.post('/api/admin/knowledge/seed', async (context) => {
  const baseUrl = new URL(context.req.url);
  const manifestUrl = new URL('/knowledge/manifest.json', baseUrl);
  const manifestResponse = await context.env.STATIC_ASSETS.fetch(new Request(manifestUrl));
  if (!manifestResponse.ok) return context.json({ error: '初期ナレッジのマニフェストを読み込めません' }, 500);
  const manifest = await manifestResponse.json<{
    files?: Array<{ file?: string; category?: string; bytes?: number; sha256?: string }>;
  }>();
  const files = (manifest.files || []).filter((entry) => entry.file && /^[a-z0-9_-]+\.md$/u.test(entry.file));
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const accepted: Array<{ file: string; id: string }> = [];
  const skipped: string[] = [];

  for (const entry of files) {
    const filename = entry.file!;
    const existing = await items.list({ page: 1, per_page: 50, search: filename });
    if (existing.result.some((item) => item.key === filename)) {
      skipped.push(filename);
      continue;
    }
    const assetUrl = new URL(`/knowledge/${filename}`, baseUrl);
    const assetResponse = await context.env.STATIC_ASSETS.fetch(new Request(assetUrl));
    if (!assetResponse.ok) throw new Error(`初期ナレッジを読み込めません: ${filename}`);
    const body = await assetResponse.arrayBuffer();
    if (body.byteLength > 4 * 1024 * 1024) throw new Error(`初期ナレッジが4MBを超えています: ${filename}`);
    const file = new File([body], filename, { type: 'text/markdown' });
    const result = await items.upload(filename, file, {
      metadata: {
        category: entry.category || knowledgeCategoryFromFilename(filename),
        language: 'ja',
        source_url: 'https://orijyu.com/',
        title: filename,
      },
    });
    accepted.push({ file: filename, id: result.id });
  }

  await appendAudit(context.env, {
    eventType: 'knowledge.initial_seeded',
    actorType: 'admin',
    actorId: context.get('admin').email,
    subjectType: 'ai_search_instance',
    subjectId: context.env.AI_SEARCH_INSTANCE,
    metadata: { accepted: accepted.length, skipped: skipped.length },
  });
  return context.json({ ok: true, accepted, skipped }, 202);
});

app.post('/api/internal/knowledge/reseed', async (context) => {
  const configuredSecret = context.env.KNOWLEDGE_SYNC_SECRET;
  const providedSecret = context.req.header('X-Knowledge-Sync-Token');
  if (!configuredSecret || !providedSecret || providedSecret !== configuredSecret) {
    return context.json({ error: 'Not found' }, 404);
  }
  const input = knowledgeReseedSchema.parse(await context.req.json().catch(() => ({})));
  const baseUrl = new URL(context.req.url);
  const manifestResponse = await context.env.STATIC_ASSETS.fetch(new Request(new URL('/knowledge/manifest.json', baseUrl)));
  if (!manifestResponse.ok) return context.json({ error: '初期ナレッジのマニフェストを読み込めません' }, 500);
  const manifest = await manifestResponse.json<{
    files?: Array<{ file?: string; category?: string; bytes?: number; sha256?: string }>;
  }>();
  const files = (manifest.files || []).filter((entry) => entry.file && entry.sha256 && /^[a-z0-9_-]+\.md$/u.test(entry.file));
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const desiredKeys = new Set(files.map((entry) => `${entry.sha256!.slice(0, 12)}-${entry.file!}`));
  const accepted: Array<{ file: string; key: string; id: string; status: string }> = [];

  for (let offset = 0; offset < files.length; offset += 3) {
    const batch = files.slice(offset, offset + 3);
    const results = await Promise.all(batch.map(async (entry) => {
      const filename = entry.file!;
      const key = `${entry.sha256!.slice(0, 12)}-${filename}`;
      const assetResponse = await context.env.STATIC_ASSETS.fetch(new Request(new URL(`/knowledge/${filename}`, baseUrl)));
      if (!assetResponse.ok) throw new Error(`初期ナレッジを読み込めません: ${filename}`);
      const body = await assetResponse.text();
      if (new TextEncoder().encode(body).byteLength > 4 * 1024 * 1024) throw new Error(`初期ナレッジが4MBを超えています: ${filename}`);
      const result = await items.upload(key, body, {
        metadata: {
          category: entry.category || knowledgeCategoryFromFilename(filename),
          language: 'ja',
          source_url: 'https://orijyu.com/',
          title: filename,
          manifest_sha256: entry.sha256,
        },
      });
      return { file: filename, key, id: result.id, status: result.status };
    }));
    accepted.push(...results);
  }

  const incomplete = accepted.filter((item) => item.status !== 'completed');
  const deleted: string[] = [];
  if (input.prune && incomplete.length === 0) {
    let page = 1;
    let totalPages = 1;
    const existingItems: Array<{ id: string; key: string }> = [];
    do {
      const listed = await items.list({ page, per_page: 50 });
      totalPages = Math.max(1, Math.ceil((listed.result_info?.total_count || listed.result.length) / 50));
      existingItems.push(...listed.result.map((item) => ({ id: item.id, key: item.key })));
      page += 1;
    } while (page <= totalPages);
    for (const item of existingItems) {
      if (desiredKeys.has(item.key)) continue;
      await items.delete(item.id);
      deleted.push(item.key);
    }
  }

  await appendAudit(context.env, {
    eventType: 'knowledge.initial_reseeded',
    actorType: 'system',
    subjectType: 'ai_search_instance',
    subjectId: context.env.AI_SEARCH_INSTANCE,
    metadata: { accepted: accepted.length, incomplete: incomplete.length, deleted: deleted.length },
  });
  return context.json({ ok: incomplete.length === 0, accepted, incomplete, deleted }, incomplete.length ? 202 : 200);
});

app.get('/api/admin/overview', async (context) => {
  const [conversations, customers, unanswered, knowledge, dailyUsage] = await Promise.all([
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM conversations WHERE created_at >= datetime('now','-30 days')`).first<{ count: number }>(),
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM customers`).first<{ count: number }>(),
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM messages WHERE role = 'assistant' AND policy_action != 'allow' AND created_at >= datetime('now','-30 days')`).first<{ count: number }>(),
    context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items.list({ page: 1, per_page: 1 }),
    readDailyUsage(context.env.DB),
  ]);
  return context.json({
    conversations30d: conversations?.count || 0,
    customers: customers?.count || 0,
    refused30d: unanswered?.count || 0,
    knowledgeItems: knowledge.result_info?.total_count || 0,
    costGuard: {
      day: dailyUsage.day,
      sessions: Number(dailyUsage.counts.chat_sessions || 0),
      sessionLimit: parseDailyLimit(context.env.DAILY_SESSION_LIMIT, 500),
      aiRequests: Number(dailyUsage.counts.ai_requests || 0),
      aiRequestLimit: parseDailyLimit(context.env.DAILY_AI_REQUEST_LIMIT, 500),
    },
  });
});

app.get('/api/admin/knowledge', async (context) => {
  const query = context.req.query();
  const status = z.enum(['queued', 'running', 'completed', 'error', 'skipped', 'outdated']).safeParse(query.status);
  const result = await context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items.list({
    page: Number(query.page || 1),
    per_page: Math.min(50, Number(query.perPage || 20)),
    status: status.success ? status.data : undefined,
    search: query.search || undefined,
    sort_by: 'modified_at',
  });
  return context.json(result);
});

app.post('/api/admin/knowledge', async (context) => {
  const form = await context.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return context.json({ error: 'ファイルが必要です' }, 400);
  if (file.size > 4 * 1024 * 1024) return context.json({ error: 'AI Searchの上限は1ファイル4MBです' }, 413);
  const sourceUrl = safeSourceUrl(form.get('sourceUrl'));
  if (form.get('sourceUrl') && !sourceUrl) return context.json({ error: 'ソースURLはorijyu.comのHTTPS URLを指定してください' }, 400);
  const result = await context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items.upload(file.name, file, {
    metadata: {
      category: String(form.get('category') || knowledgeCategoryFromFilename(file.name)),
      language: 'ja',
      source_url: sourceUrl || '',
      title: String(form.get('title') || file.name),
    },
  });
  const admin = context.get('admin');
  await appendAudit(context.env, {
    eventType: 'knowledge.uploaded',
    actorType: 'admin',
    actorId: admin.email,
    subjectType: 'knowledge_item',
    subjectId: result.id,
    metadata: { filename: file.name, size: file.size, type: file.type },
  });
  return context.json(result, 202);
});

app.delete('/api/admin/knowledge/:id', async (context) => {
  const id = context.req.param('id');
  await context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items.delete(id);
  await appendAudit(context.env, {
    eventType: 'knowledge.deleted',
    actorType: 'admin',
    actorId: context.get('admin').email,
    subjectType: 'knowledge_item',
    subjectId: id,
  });
  return context.json({ ok: true });
});

app.post('/api/admin/knowledge/:id/reindex', async (context) => {
  const id = context.req.param('id');
  const result = await context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items.get(id).sync();
  await appendAudit(context.env, {
    eventType: 'knowledge.reindexed',
    actorType: 'admin',
    actorId: context.get('admin').email,
    subjectType: 'knowledge_item',
    subjectId: id,
    metadata: { itemId: id },
  });
  return context.json(result, 202);
});

app.get('/api/admin/conversations', async (context) => {
  const page = Math.max(1, Number(context.req.query('page') || 1));
  const perPage = Math.min(100, Number(context.req.query('perPage') || 30));
  const search = context.req.query('search') || '';
  const result = await context.env.DB.prepare(
    `SELECT c.id, c.source_page, c.status, c.marketing_consent, c.created_at, c.updated_at,
      COUNT(m.id) AS message_count,
      MAX(CASE WHEN m.policy_action != 'allow' THEN 1 ELSE 0 END) AS has_refusal,
      substr(MAX(m.created_at || '|' || m.content_redacted), 21) AS latest_message
     FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE (? = '' OR m.content_redacted LIKE '%' || ? || '%')
     GROUP BY c.id ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`,
  ).bind(search, search, perPage, (page - 1) * perPage).all();
  return context.json({ result: result.results, page, perPage });
});

app.get('/api/admin/conversations/export.csv', async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT m.id AS message_id, m.conversation_id, m.role, m.content_redacted, m.model,
      m.latency_ms, m.policy_action, m.created_at, c.source_page, c.marketing_consent
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     ORDER BY m.created_at DESC LIMIT 10001`,
  ).all();
  const truncated = result.results.length > 10000;
  const header = ['message_id', 'conversation_id', 'role', 'content_redacted', 'model', 'latency_ms', 'policy_action', 'created_at', 'source_page', 'marketing_consent'];
  const rows = result.results.slice(0, 10000).map((row) => header.map((key) => row[key]));
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  await appendAudit(context.env, {
    eventType: 'conversation.exported',
    actorType: 'admin',
    actorId: context.get('admin').email,
    subjectType: 'conversation_export',
    metadata: { count: rows.length, truncated, redactedOnly: true },
  });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orient-conversations-${new Date().toISOString().slice(0, 10)}.csv"`,
      'X-Export-Truncated': String(truncated),
      'Cache-Control': 'private, no-store',
    },
  });
});

app.get('/api/admin/conversations/:id', async (context) => {
  const id = context.req.param('id');
  const [conversation, messages] = await Promise.all([
    context.env.DB.prepare(`SELECT * FROM conversations WHERE id = ?`).bind(id).first(),
    context.env.DB.prepare(
      `SELECT m.*, json_group_array(json_object('title', c.source_title, 'url', c.source_url, 'score', c.score)) AS citations
       FROM messages m LEFT JOIN citations c ON c.message_id = m.id
       WHERE m.conversation_id = ? GROUP BY m.id ORDER BY m.created_at ASC`,
    ).bind(id).all(),
  ]);
  if (!conversation) return context.json({ error: 'Not found' }, 404);
  return context.json({ conversation, messages: messages.results });
});

app.get('/api/admin/customers', async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT c.*, COUNT(cc.conversation_id) AS conversation_count
     FROM customers c LEFT JOIN conversation_customers cc ON cc.customer_id = c.id
     GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 100`,
  ).all<Record<string, unknown> & { name_enc: string | null; email_enc: string | null; phone_enc: string | null }>();
  const customers = await Promise.all(result.results.map(async (row) => ({
    ...row,
    name: await decryptPII(row.name_enc, context.env),
    email: await decryptPII(row.email_enc, context.env),
    phone: await decryptPII(row.phone_enc, context.env),
    name_enc: undefined,
    email_enc: undefined,
    phone_enc: undefined,
  })));
  return context.json({ result: customers });
});

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

app.get('/api/admin/customers/export.csv', async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT c.*, COUNT(cc.conversation_id) AS conversation_count
     FROM customers c LEFT JOIN conversation_customers cc ON cc.customer_id = c.id
     GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 5001`,
  ).all<Record<string, unknown> & { name_enc: string | null; email_enc: string | null; phone_enc: string | null }>();
  const truncated = result.results.length > 5000;
  const rows = await Promise.all(result.results.slice(0, 5000).map(async (row) => [
    row.id,
    await decryptPII(row.name_enc, context.env),
    await decryptPII(row.email_enc, context.env),
    await decryptPII(row.phone_enc, context.env),
    row.status,
    row.tags,
    row.notes,
    row.consent_at,
    row.created_at,
    row.updated_at,
    row.conversation_count,
  ]));
  const header = ['id', 'name', 'email', 'phone', 'status', 'tags_json', 'notes', 'consent_at', 'created_at', 'updated_at', 'conversation_count'];
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  await appendAudit(context.env, {
    eventType: 'customer.exported',
    actorType: 'admin',
    actorId: context.get('admin').email,
    subjectType: 'customer_export',
    metadata: { count: rows.length, truncated },
  });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orient-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      'X-Export-Truncated': String(truncated),
      'Cache-Control': 'private, no-store',
    },
  });
});

app.patch('/api/admin/customers/:id', async (context) => {
  const id = context.req.param('id');
  const input = z.object({ status: z.enum(['new', 'contacted', 'qualified', 'closed']).optional(), tags: z.array(z.string().max(40)).max(20).optional(), notes: z.string().max(2000).optional() }).parse(await context.req.json());
  await context.env.DB.prepare(
    `UPDATE customers SET status = COALESCE(?, status), tags = COALESCE(?, tags), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(input.status || null, input.tags ? JSON.stringify(input.tags) : null, input.notes ?? null, id).run();
  await appendAudit(context.env, {
    eventType: 'customer.updated',
    actorType: 'admin',
    actorId: context.get('admin').email,
    subjectType: 'customer',
    subjectId: id,
    metadata: { fields: Object.keys(input) },
  });
  return context.json({ ok: true });
});

app.get('/api/admin/settings', async (context) => {
  const result = await context.env.DB.prepare(`SELECT key, value_json, updated_at FROM settings ORDER BY key`).all<{ key: string; value_json: string }>();
  return context.json(Object.fromEntries(result.results.map((row) => [row.key, JSON.parse(row.value_json)])));
});

app.put('/api/admin/settings/:key', async (context) => {
  const key = context.req.param('key');
  if (!['answer_policy', 'retention', 'appearance', 'escalation'].includes(key)) return context.json({ error: 'Invalid setting' }, 400);
  const value = await context.req.json();
  const admin = context.get('admin');
  await context.env.DB.prepare(
    `INSERT INTO settings (key, value_json, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
  ).bind(key, JSON.stringify(value), admin.email).run();
  await appendAudit(context.env, { eventType: 'settings.updated', actorType: 'admin', actorId: admin.email, subjectType: 'setting', subjectId: key });
  return context.json({ ok: true });
});

app.get('/api/admin/audit', async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT sequence, id, ledger_id, ledger_sequence, event_type, actor_type, actor_id,
      subject_type, subject_id, metadata_json, previous_hash, event_hash, created_at
     FROM audit_events ORDER BY sequence DESC LIMIT 200`,
  ).all();
  return context.json({ result: result.results });
});

app.get('/api/admin/reports/monthly', async (context) => {
  const listed = await context.env.AUDIT_ARCHIVE.list({ prefix: 'reports/', limit: 24 });
  const reports = listed.objects
    .filter((object) => /^reports\/\d{4}-\d{2}\.json$/.test(object.key))
    .sort((a, b) => b.key.localeCompare(a.key));
  const requestedMonth = context.req.query('month');
  const key = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)
    ? `reports/${requestedMonth}.json`
    : reports[0]?.key;
  if (!key) return Response.json({ availableMonths: [], report: null });
  const object = await context.env.AUDIT_ARCHIVE.get(key);
  if (!object) return Response.json({ error: 'Report not found' }, { status: 404 });
  return Response.json({
    availableMonths: reports.map((item) => item.key.slice(8, 15)),
    report: await object.json(),
  });
});

app.get('/api/admin/audit/verify', async (context) => {
  const requestedLedger = context.req.query('ledger');
  const ledgerId = requestedLedger && /^orient-audit-\d{4}-\d{2}$/.test(requestedLedger)
    ? requestedLedger
    : `orient-audit-${new Date().toISOString().slice(0, 7)}`;
  const count = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM audit_events WHERE ledger_id = ?`,
  ).bind(ledgerId).first<{ count: number }>();
  const rows = await context.env.DB.prepare(
    `SELECT event_json FROM audit_events WHERE ledger_id = ? ORDER BY ledger_sequence ASC LIMIT 10001`,
  ).bind(ledgerId).all<{ event_json: string }>();

  let expectedPreviousHash = 'GENESIS';
  let verified = true;
  let failedSequence: number | null = null;
  for (const row of rows.results.slice(0, 10000)) {
    const event = JSON.parse(row.event_json) as AuditArchiveEvent;
    if (!(await verifyAuditEvent(event, expectedPreviousHash))) {
      verified = false;
      failedSequence = event.ledgerSequence;
      break;
    }
    expectedPreviousHash = event.eventHash;
  }

  return context.json({
    ledgerId,
    verified,
    verifiedEvents: verified ? Math.min(rows.results.length, 10000) : Math.max(0, (failedSequence || 1) - 1),
    totalEvents: count?.count || 0,
    truncated: rows.results.length > 10000,
    failedSequence,
    lastVerifiedHash: expectedPreviousHash,
  });
});

app.post('/api/admin/maintenance/start', async (context) => {
  const result = await context.env.MAINTENANCE_SCHEDULER.getByName('orient-maintenance').start();
  await appendAudit(context.env, {
    eventType: 'maintenance.scheduler_started',
    actorType: 'admin',
    actorId: context.get('admin').email,
    subjectType: 'maintenance_scheduler',
    subjectId: 'orient-maintenance',
    metadata: { ok: result.ok, nextRunAt: result.nextRunAt },
  });
  return context.json(result);
});

app.get('/api/admin/maintenance/status', async (context) => {
  const result = await context.env.MAINTENANCE_SCHEDULER.getByName('orient-maintenance').status();
  return context.json(result);
});

export default {
  fetch: app.fetch,
  queue: archiveAuditBatch,
} satisfies ExportedHandler<Env, AuditArchiveEvent>;
