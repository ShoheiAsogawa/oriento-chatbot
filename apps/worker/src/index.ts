import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import {
  authenticateAdminRequest,
  clearAdminSessionCookie,
  loginAdmin,
  logoutAdmin,
} from './admin-auth';
import { appendAudit, archiveAuditBatch, AuditLedger, verifyAuditEvent } from './audit';
import { appendRateLimitAudit } from './rate-limit-audit';
import { choicesForChatAnswer } from './chat-choices';
import {
  customHomeChoicesForResponse,
  evaluateCustomHomeConsultation,
  extractCustomHomeConsultationState,
} from './custom-home-consultation';
import {
  persistCustomHomeDraft,
  persistCustomHomeLead,
  type CustomHomeLeadQueuePayload,
} from './custom-home-leads';
import { customHomeIntakeFromState, redactCustomHomeContactTurn } from './custom-home-chat';
import { processCustomHomeNotification, type CustomHomeNotificationPayload } from './custom-home-notifications';
import {
  guidedAnswerForAvailability,
  loadGuidedSearchOptions,
  purchaseChoicesForAvailability,
  rentalChoicesForAvailability,
} from './guided-search-options';
import { consumeDailyAllowance, japanDay } from './cost-controls';
import { loadOverview, normalizeTrackedPropertyUrl, type PropertyCatalogItem } from './overview';
import {
  buildContextualQuestion,
  buildSearchMessages,
  INTAKE_HISTORY_MESSAGE_LIMIT,
  loadConversationContext,
} from './conversation-context';
import { MaintenanceScheduler } from './maintenance';
import { AiGatewayError, generateConversationAnswer, generateGroundedAnswer } from './openai';
import { directConversationAnswer, ensureOrinyanEnding, evaluatePolicy, isPropertyKnowledgeQuestion, noGroundingDecision, SYSTEM_PROMPT } from './policy';
import { deleteManagedProperty, upsertManagedProperty } from './property-inventory';
import { wantsOtherPropertyCandidates } from './property-search-continuation';
import { evaluatePurchaseConsultation } from './purchase-consultation';
import { extractRentalCriteria, formatRentalAnswer, loadRentalCatalog, recommendRentalProperties, rentalPropertyChunk } from './rental-catalog';
import { evaluateRentalConsultation } from './rental-consultation';
import { extractSaleCriteria, formatSaleAnswer, loadSaleCatalog, recommendSaleProperties, salePropertyChunk } from './sale-catalog';
import { attachMissingSourceMarkers, filterAnswerableChunks, propertyDetailSources, safeSourceUrl, selectAnswerSources, shouldShowPropertyDetailLinks, sourceFromChunk } from './sources';
import {
  createSessionToken,
  decryptPII,
  encryptPII,
  redactPII,
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

const propertyViewSchema = z.object({
  sourcePage: z.string().url().max(1000),
}).strict();

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

const adminLoginSchema = z.object({
  loginId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/u),
  password: z.string().min(1).max(128),
}).strict();

const knowledgeReseedSchema = z.object({
  prune: z.boolean().default(false),
});

const propertyCategorySchema = z.enum(['properties_for_sale', 'properties_for_rent']);
const propertyTypeSchema = z.enum(['sale', 'rent']);

function normalizePropertyText(value: string) {
  return value.replace(/\s+/gu, ' ').trim();
}

const propertyOptionalText = (maximum: number) => z.string()
  .trim()
  .max(maximum)
  .transform((value) => normalizePropertyText(value) || undefined)
  .optional();

const propertyKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(160).transform(normalizePropertyText),
  category: propertyCategorySchema.optional(),
  // `type` is retained as a compact API alias for integrations that do not use the admin UI.
  type: propertyTypeSchema.optional(),
  sourceUrl: z.string()
    .trim()
    .min(1)
    .max(1000)
    .refine((value) => Boolean(safeSourceUrl(value)), { message: 'The source URL must be an official HTTPS URL' }),
  address: propertyOptionalText(240),
  lineStation: propertyOptionalText(240),
  priceOrRent: propertyOptionalText(100),
  managementFee: propertyOptionalText(100),
  layout: propertyOptionalText(100),
  floorArea: propertyOptionalText(100),
  buildingType: propertyOptionalText(100),
  builtYear: propertyOptionalText(80),
  floor: propertyOptionalText(80),
  availability: propertyOptionalText(120),
  features: z.array(z.string().trim().min(1).max(120).transform(normalizePropertyText))
    .max(30)
    .default([])
    .transform((features) => [...new Set(features)]),
  notes: z.string()
    .trim()
    .max(2000)
    .refine((value) => value.split(/\r?\n/gu).length <= 24, { message: 'Notes may contain at most 24 lines' })
    .transform((value) => value.replace(/\r\n?/gu, '\n').split('\n').map((line) => line.trim()).filter(Boolean).join('\n') || undefined)
    .optional(),
}).strict().superRefine((value, issue) => {
  if (!value.category && !value.type) {
    issue.addIssue({ code: 'custom', path: ['category'], message: 'A property category or type is required' });
    return;
  }
  if (value.category && value.type) {
    const typeCategory = value.type === 'sale' ? 'properties_for_sale' : 'properties_for_rent';
    if (value.category !== typeCategory) {
      issue.addIssue({ code: 'custom', path: ['type'], message: 'Property category and type must match' });
    }
  }
});

type PropertyKnowledgeInput = z.infer<typeof propertyKnowledgeSchema>;

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
    allowHeaders: ['Content-Type'],
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

async function adminRateLimitKey(request: Request, env: Env, scope: string, loginId = '') {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  return `${scope}:${await sha256(`${env.HASH_SALT}:${ip}:${loginId.trim().toLowerCase()}`)}`;
}

app.get('/api/auth/admin/session', async (context) => {
  try {
    const identity = await authenticateAdminRequest(context.req.raw, context.env);
    return context.json({ authenticated: true, user: identity });
  } catch {
    return context.json({ authenticated: false, user: null });
  }
});

app.post('/api/auth/admin/login', async (context) => {
  const input = adminLoginSchema.parse(await context.req.json());
  const rate = await context.env.ADMIN_RATE_LIMITER.limit({
    key: await adminRateLimitKey(context.req.raw, context.env, 'admin-login', input.loginId),
  });
  if (!rate.success) return context.json({ error: '試行回数が多すぎます。1分ほど待ってからお試しください' }, 429);
  const result = await loginAdmin(input.loginId, input.password, context.env);
  if (!result.ok) {
    return context.json({ error: '管理者IDまたはパスワードが正しくありません' }, 401);
  }
  context.header('Set-Cookie', result.cookie!);
  await appendAudit(context.env, {
    eventType: 'admin.logged_in',
    actorType: 'admin',
    actorId: result.identity!.loginId,
    subjectType: 'admin_user',
    subjectId: result.identity!.subject,
  });
  return context.json({ ok: true, user: result.identity });
});

app.post('/api/auth/admin/logout', async (context) => {
  await logoutAdmin(context.req.raw, context.env);
  context.header('Set-Cookie', clearAdminSessionCookie());
  return context.json({ ok: true });
});

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

app.post('/api/property-view', async (context) => {
  const input = propertyViewSchema.parse(await context.req.json());
  const sourceUrl = normalizeTrackedPropertyUrl(input.sourcePage);
  if (!sourceUrl) return context.json({ recorded: false });
  const ip = context.req.header('CF-Connecting-IP') || 'local';
  const visitorHash = await sha256(`${context.env.HASH_SALT}:${ip}:${context.req.header('User-Agent') || ''}`);
  const rate = await context.env.RATE_LIMITER.limit({ key: `property-view:${visitorHash}` });
  if (!rate.success) return context.json({ recorded: false }, 202);
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO property_page_views (day, source_url, visitor_hash)
     VALUES (?, ?, ?)`,
  ).bind(japanDay(new Date()), sourceUrl, visitorHash).run();
  return context.json({ recorded: true }, 202);
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
  if (!rate.success) {
    await appendRateLimitAudit(context.env, 'session', id);
    return context.json({ error: '少し時間をおいてからお試しください' }, 429);
  }
  const dailySessions = await consumeDailyAllowance(
    context.env.DB,
    'chat_sessions',
    context.env.DAILY_SESSION_LIMIT,
    500,
  );
  if (!dailySessions.allowed) {
    console.warn(JSON.stringify({ level: 'warn', event: 'cost_guard.sessions_exhausted', day: dailySessions.day, limit: dailySessions.limit }));
    return context.json({ error: '本日のチャット受付上限に達しました。公式LINEをご利用ください。' }, 429);
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
    .split('/')
    .at(-1)
    ?.replace(/\.md$/iu, '')
    .replace(/-part-\d+$/iu, '') || 'general';
  return /^[a-z0-9_]{1,64}$/u.test(category) ? category : 'general';
}

const MAX_KNOWLEDGE_ITEM_SIZE = 4 * 1024 * 1024;
const SUPPORTED_KNOWLEDGE_ITEM = /\.(?:pdf|docx?|xlsx?|csv|txt|md|png|jpe?g|webp)$/iu;
const INITIAL_KNOWLEDGE_PATH = /^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.md$/iu;
const PROPERTY_KNOWLEDGE_CATEGORY = /^properties_for_(?:sale|rent)$/u;
const KNOWLEDGE_LIST_STATUS = ['queued', 'running', 'completed', 'error', 'skipped', 'outdated'] as const;

const initialKnowledgeEntrySchema = z.object({
  file: z.string().trim().min(1).max(240),
  category: z.string().trim().min(1).max(64).optional(),
  bytes: z.number().int().nonnegative().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/iu).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  source_url: z.string().url().max(1000).optional(),
});

const initialKnowledgeManifestSchema = z.object({
  files: z.array(initialKnowledgeEntrySchema).default([]),
});

const propertyDashboardIndexSchema = z.array(z.object({
  sourceUrl: z.string().url().max(1000),
  title: z.string().trim().min(1).max(500),
  address: z.string().max(500).default(''),
  prefecture: z.string().trim().min(1).max(20).default('その他'),
  category: propertyCategorySchema,
}));

type InitialKnowledgeEntry = z.infer<typeof initialKnowledgeEntrySchema>;
type KnowledgeListStatus = (typeof KNOWLEDGE_LIST_STATUS)[number];

function isSafeInitialKnowledgePath(value: string) {
  return INITIAL_KNOWLEDGE_PATH.test(value);
}

function normalizeKnowledgeCategory(value: unknown, fallback = 'general') {
  const category = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9_]{1,64}$/u.test(category) ? category : fallback;
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function initialKnowledgeCategory(entry: InitialKnowledgeEntry) {
  return normalizeKnowledgeCategory(entry.category, knowledgeCategoryFromFilename(entry.file));
}

function initialKnowledgeTitle(entry: InitialKnowledgeEntry) {
  return entry.title?.trim() || entry.file.split('/').at(-1) || entry.file;
}

function initialKnowledgeSourceUrl(entry: InitialKnowledgeEntry) {
  return safeSourceUrl(entry.source_url) || 'https://orijyu.com/';
}

function initialKnowledgeItemKey(entry: InitialKnowledgeEntry) {
  const filename = entry.file.replaceAll('/', '__');
  return entry.sha256
    ? `initial-${entry.sha256.slice(0, 16)}-${filename}`
    : `initial-${filename}`;
}

function isPropertyKnowledgeCategory(category: string | undefined) {
  return Boolean(category && PROPERTY_KNOWLEDGE_CATEGORY.test(category));
}

function isManagedInitialKnowledgeItem(item: AiSearchItemInfo) {
  return Boolean(metadataString(item.metadata, 'manifest_sha256')?.match(/^[a-f0-9]{64}$/iu));
}

function initialKnowledgeManualOverrideFile(item: AiSearchItemInfo) {
  const marker = metadataString(item.metadata, 'manifest_sha256');
  const filename = marker?.startsWith('manual:') ? marker.slice('manual:'.length) : '';
  return filename && isSafeInitialKnowledgePath(filename) ? filename : undefined;
}

function knowledgeItemSourceUrl(item: AiSearchItemInfo) {
  return safeSourceUrl(metadataString(item.metadata, 'source_url'));
}

function propertyKnowledgeCategory(type: PropertyKnowledgeInput) {
  return type.category || (type.type === 'rent' ? 'properties_for_rent' : 'properties_for_sale');
}

async function propertyKnowledgeItemKey(sourceUrl: string) {
  return `property-${await sha256(sourceUrl)}.md`;
}

type GeneralKnowledgeUpdateInput = {
  title: string;
  sourceUrl: string;
};

function knowledgeFileExtension(value: string) {
  return value.trim().toLocaleLowerCase('en-US').match(/\.[a-z0-9]{1,10}$/u)?.[0] || '';
}

function isPlainTextKnowledgeItem(item: AiSearchItemInfo) {
  return /\.(?:md|txt)$/iu.test(item.key.trim());
}

async function knowledgeContentRevision(content: string) {
  return sha256(content);
}

async function downloadPlainTextKnowledgeContent(items: AiSearchItems, item: AiSearchItemInfo) {
  if (typeof item.file_size === 'number' && item.file_size > MAX_KNOWLEDGE_ITEM_SIZE) {
    throw new Error('KNOWLEDGE_CONTENT_TOO_LARGE');
  }
  const downloaded = await items.get(item.id).download();
  const bytes = await new Response(downloaded.body).arrayBuffer();
  if (bytes.byteLength > MAX_KNOWLEDGE_ITEM_SIZE) throw new Error('KNOWLEDGE_CONTENT_TOO_LARGE');
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('KNOWLEDGE_CONTENT_NOT_UTF8');
  }
  return { content, revision: await knowledgeContentRevision(content) };
}

/**
 * Keep the existing object key whenever the replacement keeps the same file
 * extension. AI Search uses the key to choose the document converter. A
 * different extension therefore gets a new, item-scoped key; the old item is
 * only removed after that upload succeeds.
 */
function generalKnowledgeReplacementItemKey(item: AiSearchItemInfo, filename: string) {
  const existingKey = item.key.trim();
  const replacementExtension = knowledgeFileExtension(filename);
  if (replacementExtension && replacementExtension === knowledgeFileExtension(existingKey)) return existingKey;

  const itemId = item.id.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 40) || 'item';
  const rawStem = filename.trim()
    .replace(/\.[^.]+$/u, '')
    .replace(/[\\/:*?"<>|]+/gu, '-')
    .replace(/[^A-Za-z0-9_-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '') || 'replacement';
  const extension = replacementExtension || '.txt';
  const prefix = `general-${itemId}-`;
  const maximumStemLength = Math.max(8, 240 - prefix.length - extension.length);
  return `${prefix}${rawStem.slice(0, maximumStemLength)}${extension}`;
}

function generalKnowledgeMetadata(
  existing: AiSearchItemInfo,
  input: GeneralKnowledgeUpdateInput,
  initialKnowledgeOverrideFile?: string,
) {
  const existingManifestMarker = metadataString(existing.metadata, 'manifest_sha256');
  const manualMarker = existingManifestMarker?.startsWith('manual:') ? existingManifestMarker : undefined;
  return {
    category: normalizeKnowledgeCategory(metadataString(existing.metadata, 'category')),
    language: metadataString(existing.metadata, 'language') || 'ja',
    source_url: input.sourceUrl,
    title: input.title,
    ...(initialKnowledgeOverrideFile
      ? { manifest_sha256: `manual:${initialKnowledgeOverrideFile}` }
      : manualMarker ? { manifest_sha256: manualMarker } : {}),
  };
}

async function upsertGeneralKnowledgeItem(
  items: AiSearchItems,
  existing: AiSearchItemInfo,
  input: GeneralKnowledgeUpdateInput,
  replacement?: File,
  initialKnowledgeOverrideFile?: string,
  textContent?: string,
) {
  const itemKey = replacement
    ? generalKnowledgeReplacementItemKey(existing, replacement.name)
    : existing.key;
  const content = textContent !== undefined
    ? textContent
    : replacement || (await items.get(existing.id).download()).body;
  const metadata = generalKnowledgeMetadata(existing, input, initialKnowledgeOverrideFile);
  const result = await items.upload(itemKey, content, { metadata });
  const replacedItemIds = itemKey !== existing.key && result.id !== existing.id
    ? [existing.id]
    : [];
  await Promise.all(replacedItemIds.map((obsoleteId) => items.delete(obsoleteId)));
  return { result, itemKey, metadata, replacedItemCount: replacedItemIds.length };
}

function propertyKnowledgeMarkdown(input: PropertyKnowledgeInput, category: string, sourceUrl: string) {
  const typeLabel = category === 'properties_for_rent' ? '賃貸' : '売買';
  const fields: Array<[string, string | undefined]> = [
    ['種別', typeLabel],
    ['物件名', input.title],
    ['住所', input.address],
    ['沿線・最寄駅', input.lineStation],
    ['価格・賃料', input.priceOrRent],
    ['管理費・共益費', input.managementFee],
    ['間取り', input.layout],
    ['専有・建物面積', input.floorArea],
    ['建物種別', input.buildingType],
    ['築年', input.builtYear],
    ['所在階・階数', input.floor],
    ['掲載状況', input.availability],
  ];
  const lines = fields.filter(([, value]) => Boolean(value)).map(([label, value]) => `- ${label}: ${value}`);
  const featureLines = input.features.map((feature) => `- ${feature}`);
  return [
    `# ${input.title}`,
    '',
    '## 物件情報',
    ...lines,
    ...(featureLines.length > 0 ? ['', '## 特徴・設備', ...featureLines] : []),
    '',
    '## 公式情報',
    `- 公式物件詳細ページ: ${sourceUrl}`,
    ...(input.notes ? ['', '## 備考', input.notes] : []),
  ].join('\n');
}

function propertyKnowledgeFromMarkdown(markdown: string, fallback: { title: string; category: string; sourceUrl: string }): PropertyKnowledgeInput {
  const lines = markdown.split(/\r?\n/u);
  const values: Record<string, string> = {};
  const features: string[] = [];
  const notes: string[] = [];
  const extraNotes: string[] = [];
  let section = '';
  const fieldLabels = new Set([
    '種別', '物件名', '住所', '沿線・最寄駅', '価格・賃料', '管理費・共益費',
    '間取り', '専有・建物面積', '建物種別', '築年', '所在階・階数', '掲載状況',
  ]);
  const legacyFieldMap: Record<string, string> = {
    '物件種別': '建物種別',
    '賃料': '価格・賃料',
    '販売価格': '価格・賃料',
    '価格': '価格・賃料',
    '所在地': '住所',
    '住所': '住所',
    '交通': '沿線・最寄駅',
    '沿線・最寄駅': '沿線・最寄駅',
    '管理費': '管理費・共益費',
    '共益費': '管理費・共益費',
    '間取り': '間取り',
    'タイプ': '間取り',
    '専有面積': '専有・建物面積',
    '建物面積': '専有・建物面積',
    '土地面積': '専有・建物面積',
    '築年': '築年',
    '築年月': '築年',
    '所在階': '所在階・階数',
    '階数': '所在階・階数',
    '賃貸状況': '掲載状況',
    '販売状況': '掲載状況',
    '掲載状況': '掲載状況',
  };
  const legacyLabels = new Set([
    ...Object.keys(legacyFieldMap), '物件番号', '礼金', '敷金', '水道代', '取引態様', '備考1', '備考2',
  ]);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || '';
    const trimmedLine = line.trim();
    const heading = line.match(/^##\s+(.+)$/u);
    const headingValue = heading?.[1]?.trim();
    if (headingValue) {
      section = headingValue;
      continue;
    }
    const title = line.match(/^#\s+(.+)$/u);
    const titleValue = title?.[1]?.trim();
    if (titleValue && !values.title) values.title = titleValue;
    const sourceLine = trimmedLine.match(/^(?:Source URL|公式ページ|公式物件詳細ページ)\s*:\s*(https:\/\/\S+)/u);
    if (sourceLine?.[1]) {
      values.sourceUrl = sourceLine[1];
      continue;
    }
    const categoryLine = trimmedLine.match(/^Knowledge category:\s*(properties_for_(?:sale|rent))$/u);
    if (categoryLine?.[1]) {
      values.category = categoryLine[1];
      continue;
    }
    const bullet = line.match(/^[-*]\s+([^:：]+)\s*[:：]\s*(.*)$/u);
    if (bullet) {
      const label = bullet[1]?.trim() || '';
      const value = bullet[2]?.trim() || '';
      if (fieldLabels.has(label)) values[label] = value;
      else if (label === '公式物件詳細ページ') values.sourceUrl = value;
      else if (section === '特徴・設備' || section === '特徴') features.push(line.replace(/^[-*]\s+/u, '').trim());
      continue;
    }
    const featureBullet = line.match(/^[-*]\s+(.+)$/u);
    if ((section === '特徴・設備' || section === '特徴') && featureBullet?.[1]?.trim()) {
      features.push(featureBullet[1].trim());
      continue;
    }
    const legacyTarget = legacyFieldMap[trimmedLine];
    if (legacyTarget) {
      const collected: string[] = [];
      let nextIndex = index + 1;
      while (nextIndex < lines.length) {
        const nextLine = lines[nextIndex]?.trim() || '';
        if (!nextLine || nextLine.startsWith('#') || legacyLabels.has(nextLine) || nextLine === 'お問い合わせ') break;
        collected.push(nextLine);
        nextIndex += 1;
        if (legacyTarget !== '沿線・最寄駅') break;
      }
      if (collected.length) values[legacyTarget] = collected.join(legacyTarget === '沿線・最寄駅' ? ' / ' : '\n');
      index = nextIndex - 1;
      continue;
    }
    if (legacyLabels.has(trimmedLine)) {
      const nextLine = lines[index + 1]?.trim() || '';
      if (nextLine && !nextLine.startsWith('#')) extraNotes.push(`${trimmedLine}: ${nextLine}`);
      index += 1;
      continue;
    }
    if (section === '備考' && trimmedLine) notes.push(trimmedLine);
  }

  const category = values.category || (values['種別'] === '賃貸' ? 'properties_for_rent'
    : values['種別'] === '売買' || fallback.category === 'properties_for_sale' ? 'properties_for_sale'
      : fallback.category);
  return {
    title: values.title || fallback.title,
    category: category === 'properties_for_rent' ? 'properties_for_rent' : 'properties_for_sale',
    sourceUrl: safeSourceUrl(values.sourceUrl) || fallback.sourceUrl,
    address: values['住所'],
    lineStation: values['沿線・最寄駅'],
    priceOrRent: values['価格・賃料'],
    managementFee: values['管理費・共益費'],
    layout: values['間取り'],
    floorArea: values['専有・建物面積'],
    buildingType: values['建物種別'],
    builtYear: values['築年'],
    floor: values['所在階・階数'],
    availability: values['掲載状況'],
    features: [...new Set(features)],
    notes: [...extraNotes, ...notes].join('\n') || undefined,
  };
}

function excludeInitialPropertiesCoveredByManualItems(entries: InitialKnowledgeEntry[], existingItems: AiSearchItemInfo[]) {
  const manuallyManagedSources = new Set(existingItems
    .filter((item) => isPropertyKnowledgeCategory(normalizeKnowledgeCategory(metadataString(item.metadata, 'category'))))
    .filter((item) => !isManagedInitialKnowledgeItem(item))
    .map(knowledgeItemSourceUrl)
    .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl)));
  return entries.filter((entry) => {
    return !isPropertyKnowledgeCategory(initialKnowledgeCategory(entry))
      || !manuallyManagedSources.has(initialKnowledgeSourceUrl(entry));
  });
}

function excludeInitialGeneralKnowledgeOverriddenByManualItems(entries: InitialKnowledgeEntry[], existingItems: AiSearchItemInfo[]) {
  const overriddenFiles = new Set(existingItems
    .filter((item) => !isPropertyKnowledgeCategory(normalizeKnowledgeCategory(metadataString(item.metadata, 'category'))))
    .map(initialKnowledgeManualOverrideFile)
    .filter((file): file is string => Boolean(file)));
  return entries.filter((entry) => (
    isPropertyKnowledgeCategory(initialKnowledgeCategory(entry)) || !overriddenFiles.has(entry.file)
  ));
}

export {
  canonicalInitialKnowledgeItem,
  excludeInitialGeneralKnowledgeOverriddenByManualItems,
  excludeInitialPropertiesCoveredByManualItems,
  generalKnowledgeMetadata,
  generalKnowledgeReplacementItemKey,
  isPlainTextKnowledgeItem,
  knowledgeContentRevision,
  initialKnowledgeItemKey,
  initialKnowledgePruneSafety,
  isFreshPendingInitialItem,
  matchingInitialKnowledgeItems,
  propertyKnowledgeCategory,
  propertyKnowledgeItemKey,
  propertyKnowledgeMarkdown,
  propertyKnowledgeFromMarkdown,
  propertyKnowledgeSchema,
  syncInitialKnowledgeFiles,
  upsertGeneralKnowledgeItem,
};

async function readInitialKnowledgeManifest(env: Env, baseUrl: URL) {
  const manifestResponse = await env.STATIC_ASSETS.fetch(new Request(new URL('/knowledge/manifest.json', baseUrl)));
  if (!manifestResponse.ok) throw new Error('Initial knowledge manifest could not be loaded');
  const parsed = initialKnowledgeManifestSchema.safeParse(await manifestResponse.json<unknown>());
  if (!parsed.success) throw new Error('Initial knowledge manifest has an invalid format');
  const unsafePath = parsed.data.files.find((entry) => !isSafeInitialKnowledgePath(entry.file));
  if (unsafePath) throw new Error(`Initial knowledge manifest contains an unsafe path: ${unsafePath.file}`);
  const invalidPropertySource = parsed.data.files.find((entry) => {
    return isPropertyKnowledgeCategory(initialKnowledgeCategory(entry)) && !safeSourceUrl(entry.source_url);
  });
  if (invalidPropertySource) throw new Error(`Property knowledge is missing an official source URL: ${invalidPropertySource.file}`);
  const files = new Set<string>();
  const propertySources = new Set<string>();
  for (const entry of parsed.data.files) {
    if (files.has(entry.file)) throw new Error(`Initial knowledge manifest contains a duplicate file: ${entry.file}`);
    files.add(entry.file);
    if (!isPropertyKnowledgeCategory(initialKnowledgeCategory(entry))) continue;
    const sourceUrl = initialKnowledgeSourceUrl(entry);
    if (propertySources.has(sourceUrl)) {
      throw new Error(`Initial knowledge manifest contains a duplicate property source URL: ${sourceUrl}`);
    }
    propertySources.add(sourceUrl);
  }
  return parsed.data.files;
}

async function readPropertyDashboardIndex(env: Env, baseUrl: URL): Promise<PropertyCatalogItem[]> {
  const response = await env.STATIC_ASSETS.fetch(new Request(new URL('/knowledge/property-dashboard-index.json', baseUrl)));
  if (!response.ok) return [];
  const parsed = propertyDashboardIndexSchema.safeParse(await response.json<unknown>());
  if (!parsed.success) throw new Error('Property dashboard index has an invalid format');
  return parsed.data;
}

async function readKnowledgeSourceExclusions(env: Env) {
  const result = await env.DB.prepare(
    `SELECT source_url FROM knowledge_source_exclusions`,
  ).all<{ source_url: string }>();
  return new Set(result.results
    .map((row) => safeSourceUrl(row.source_url))
    .filter((url): url is string => Boolean(url)));
}

function excludeRemovedInitialKnowledge(entries: InitialKnowledgeEntry[], exclusions: Set<string>) {
  return entries.filter((entry) => {
    const category = initialKnowledgeCategory(entry);
    return !isPropertyKnowledgeCategory(category) || !exclusions.has(initialKnowledgeSourceUrl(entry));
  });
}

async function fetchInitialKnowledgeAsset(env: Env, baseUrl: URL, entry: InitialKnowledgeEntry) {
  const filename = entry.file;
  const assetResponse = await env.STATIC_ASSETS.fetch(new Request(new URL(`/knowledge/${filename}`, baseUrl)));
  if (!assetResponse.ok) throw new Error(`初期ナレッジを読み込めません: ${filename}`);
  const body = await assetResponse.arrayBuffer();
  if (body.byteLength > MAX_KNOWLEDGE_ITEM_SIZE) throw new Error(`初期ナレッジが4MBを超えています: ${filename}`);
  return new File([body], filename.split('/').at(-1) || filename, { type: 'text/markdown' });
}

function initialKnowledgeMetadata(entry: InitialKnowledgeEntry) {
  return {
    category: initialKnowledgeCategory(entry),
    language: 'ja',
    source_url: initialKnowledgeSourceUrl(entry),
    title: initialKnowledgeTitle(entry),
    ...(entry.sha256 ? { manifest_sha256: entry.sha256 } : {}),
  };
}

async function listAllKnowledgeItems(items: AiSearchItems, status?: KnowledgeListStatus) {
  const perPage = 50;
  const all: AiSearchItemInfo[] = [];
  let page = 1;
  let totalCount = Number.POSITIVE_INFINITY;
  while (all.length < totalCount) {
    const response = await items.list({ page, per_page: perPage, status });
    all.push(...response.result);
    const reportedTotal = response.result_info?.total_count;
    totalCount = typeof reportedTotal === 'number' ? reportedTotal : all.length + (response.result.length === perPage ? 1 : 0);
    if (response.result.length < perPage) break;
    page += 1;
  }
  return all;
}

type InitialKnowledgeSyncItem = {
  file: string;
  key: string;
  id: string;
  status: string;
};

function matchingInitialKnowledgeItems(entry: InitialKnowledgeEntry, existingItems: AiSearchItemInfo[]) {
  const legacyFilename = entry.file.replaceAll('/', '__');
  const category = initialKnowledgeCategory(entry);
  const sourceUrl = initialKnowledgeSourceUrl(entry);
  return existingItems.filter((item) => {
    if (!isManagedInitialKnowledgeItem(item)) return false;
    if (isPropertyKnowledgeCategory(category) && new URL(sourceUrl).pathname !== '/') {
      return knowledgeItemSourceUrl(item) === sourceUrl;
    }
    return item.key === initialKnowledgeItemKey(entry)
      || item.key === legacyFilename
      || item.key.endsWith(`-${legacyFilename}`);
  });
}

function isFreshPendingInitialItem(item: AiSearchItemInfo, expectedSha256?: string) {
  if (!expectedSha256 || metadataString(item.metadata, 'manifest_sha256') !== expectedSha256) return false;
  if (item.status !== 'queued' && item.status !== 'running') return false;
  const timestamp = Date.parse(item.last_seen_at || item.created_at || '');
  return Number.isFinite(timestamp) && Date.now() - timestamp < 15 * 60 * 1000;
}

function canonicalInitialKnowledgeItem(entry: InitialKnowledgeEntry, existingItems: AiSearchItemInfo[]) {
  const versionKey = initialKnowledgeItemKey(entry);
  return matchingInitialKnowledgeItems(entry, existingItems)
    .sort((left, right) => {
      const score = (item: AiSearchItemInfo) => (
        (metadataString(item.metadata, 'manifest_sha256') === entry.sha256 ? 100 : 0)
        + (item.status === 'completed' ? 30 : 0)
        + (isFreshPendingInitialItem(item, entry.sha256) ? 20 : 0)
        + (item.key === versionKey ? 10 : 0)
      );
      return score(right) - score(left) || left.key.localeCompare(right.key);
    })[0];
}

function recoveryInitialKnowledgeItemKey(entry: InitialKnowledgeEntry) {
  const filename = entry.file.replaceAll('/', '__');
  const version = entry.sha256?.slice(0, 16) || 'unversioned';
  return `initial-${version}-retry-${crypto.randomUUID().slice(0, 8)}-${filename}`.slice(0, 240);
}

function isCurrentInitialKnowledgeItem(entry: InitialKnowledgeEntry, item: AiSearchItemInfo | undefined) {
  if (!item) return false;
  if (entry.sha256 && metadataString(item.metadata, 'manifest_sha256') !== entry.sha256) return false;
  return item.status === 'completed';
}

async function uploadInitialKnowledgeItem(
  env: Env,
  baseUrl: URL,
  items: AiSearchItems,
  entry: InitialKnowledgeEntry,
  key: string,
) {
  const file = await fetchInitialKnowledgeAsset(env, baseUrl, entry);
  const result = await items.upload(key, file, { metadata: initialKnowledgeMetadata(entry) });
  return { file: entry.file, key: result.key || key, id: result.id, status: result.status };
}

async function syncInitialKnowledgeFiles(
  env: Env,
  baseUrl: URL,
  items: AiSearchItems,
  files: InitialKnowledgeEntry[],
  existingItems: AiSearchItemInfo[],
) {
  const accepted: InitialKnowledgeSyncItem[] = [];
  const skipped: InitialKnowledgeSyncItem[] = [];

  for (let offset = 0; offset < files.length; offset += 3) {
    const batch = files.slice(offset, offset + 3);
    const results = await Promise.all(batch.flatMap((entry) => {
      const matching = matchingInitialKnowledgeItems(entry, existingItems);
      const sameVersion = entry.sha256
        ? matching.filter((item) => metadataString(item.metadata, 'manifest_sha256') === entry.sha256)
        : matching.filter((item) => item.key === initialKnowledgeItemKey(entry));
      const existing = canonicalInitialKnowledgeItem(entry, sameVersion);
      if (existing && (isCurrentInitialKnowledgeItem(entry, existing)
        || isFreshPendingInitialItem(existing, entry.sha256))) {
        skipped.push({ file: entry.file, key: existing.key, id: existing.id, status: existing.status });
        return [];
      }

      if (existing) {
        return [items.get(existing.id).sync()
          .then((result) => ({
            file: entry.file,
            key: result.key || existing.key,
            id: result.id || existing.id,
            status: result.status,
          }))
          .catch(() => uploadInitialKnowledgeItem(
            env,
            baseUrl,
            items,
            entry,
            recoveryInitialKnowledgeItemKey(entry),
          ))];
      }

      return [uploadInitialKnowledgeItem(
        env,
        baseUrl,
        items,
        entry,
        initialKnowledgeItemKey(entry),
      )];
    }));
    accepted.push(...results);
  }

  return { accepted, skipped };
}

function initialKnowledgePruneSafety(files: InitialKnowledgeEntry[], existingItems: AiSearchItemInfo[]) {
  if (files.length === 0) return { safe: false, reason: 'manifest_empty' } as const;
  const desiredPropertySources = new Set(files
    .filter((entry) => isPropertyKnowledgeCategory(initialKnowledgeCategory(entry)))
    .map(initialKnowledgeSourceUrl));
  const existingPropertySources = new Set(existingItems
    .filter(isManagedInitialKnowledgeItem)
    .filter((item) => isPropertyKnowledgeCategory(normalizeKnowledgeCategory(metadataString(item.metadata, 'category'))))
    .map(knowledgeItemSourceUrl)
    .filter((sourceUrl): sourceUrl is string => (
      typeof sourceUrl === 'string' && new URL(sourceUrl).pathname !== '/'
    )));
  if (existingPropertySources.size > 0
    && desiredPropertySources.size < Math.ceil(existingPropertySources.size * 0.95)) {
    return { safe: false, reason: 'property_count_dropped_unexpectedly' } as const;
  }
  return { safe: true, reason: null } as const;
}

function completedInitialKnowledgeItemIds(files: InitialKnowledgeEntry[], existingItems: AiSearchItemInfo[]) {
  const ids = new Set<string>();
  for (const entry of files) {
    const current = canonicalInitialKnowledgeItem(entry, existingItems);
    if (!isCurrentInitialKnowledgeItem(entry, current)) return null;
    ids.add(current!.id);
  }
  return ids;
}

async function pruneManagedInitialKnowledgeItems(
  items: AiSearchItems,
  existingItems: AiSearchItemInfo[],
  desiredItemIds: Set<string>,
) {
  const obsolete = existingItems.filter((item) => (
    isManagedInitialKnowledgeItem(item) && !desiredItemIds.has(item.id)
  ));
  const deleted: string[] = [];
  for (let offset = 0; offset < obsolete.length; offset += 3) {
    const batch = obsolete.slice(offset, offset + 3);
    await Promise.all(batch.map(async (item) => {
      await items.delete(item.id);
      deleted.push(item.key);
    }));
  }
  return deleted;
}

function boundedPositiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function projectKnowledgeItem(item: AiSearchItemInfo) {
  const title = metadataString(item.metadata, 'title') || item.key;
  const category = normalizeKnowledgeCategory(metadataString(item.metadata, 'category'));
  const sourceUrl = safeSourceUrl(metadataString(item.metadata, 'source_url')) || '';
  return {
    ...item,
    chunks_count: item.chunks_count || 0,
    file_size: item.file_size || 0,
    created_at: item.created_at || '',
    last_seen_at: item.last_seen_at || item.created_at || '',
    title,
    category,
    source_url: sourceUrl,
  };
}

function knowledgeItemUpdatedAt(item: AiSearchItemInfo) {
  return item.last_seen_at || item.created_at || '';
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

async function previouslyCitedPropertyUrls(database: D1Database, conversationId: string) {
  const result = await database.prepare(`
    SELECT DISTINCT c.source_url
    FROM citations c
    INNER JOIN messages m ON m.id = c.message_id
    WHERE m.conversation_id = ?
      AND c.source_url IS NOT NULL
  `).bind(conversationId).all<{ source_url: string }>();
  return new Set((result.results || []).map((row) => row.source_url).filter(Boolean));
}

app.post('/api/chat/message', async (context) => {
  const startedAt = Date.now();
  const input = messageSchema.parse(await context.req.json());
  if (!(await verifySessionToken(input.sessionToken, input.conversationId, context.env))) {
    return context.json({ error: 'Session expired' }, 401);
  }
  const conversation = await context.env.DB.prepare(`SELECT id FROM conversations WHERE id = ?`).bind(input.conversationId).first();
  if (!conversation) return context.json({ error: 'Conversation not found' }, 404);

  const rate = await context.env.CHAT_RATE_LIMITER.limit({ key: input.conversationId });
  if (!rate.success) {
    await appendRateLimitAudit(context.env, 'message', input.conversationId);
    return context.json({ error: '少し時間をおいてからお試しください' }, 429);
  }

  // A complete custom-home intake has more than the normal 16-message
  // property-search window. Load the bounded intake window here; downstream
  // AI calls still receive their own small context window.
  const conversationHistory = await loadConversationContext(
    context.env.DB,
    input.conversationId,
    INTAKE_HISTORY_MESSAGE_LIMIT,
  );
  const customHomeContactTurn = redactCustomHomeContactTurn(conversationHistory, input.message);
  const redacted = customHomeContactTurn.redacted;
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

  const directAnswer = directConversationAnswer(redacted);
  if (directAnswer) {
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      directAnswer,
      'allow',
      'real-estate-agent-rules-v1',
      Date.now() - startedAt,
    );
    await appendAudit(context.env, {
      eventType: 'chat.answered',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { model: 'real-estate-agent-rules-v1', sourceCount: 0, mode: 'direct_conversation' },
    });
    return context.json({
      answer: directAnswer,
      sources: [],
      choices: choicesForChatAnswer(directAnswer),
      action: 'none',
      policy: 'allow',
      messageId,
    });
  }

  const customHomeConsultation = evaluateCustomHomeConsultation(conversationHistory, redacted);
  if (customHomeConsultation.active) {
    const customHomeState = extractCustomHomeConsultationState(conversationHistory, redacted);
    const intake = customHomeIntakeFromState(customHomeState);

    if (customHomeConsultation.leadReady) {
      const contactPhone = customHomeContactTurn.contact.phone;
      if (!contactPhone) {
        const answer = 'お電話番号を確認できなかったにゃん。数字を続けてもう一度入力してにゃん。';
        const messageId = await recordTurn(
          context.env,
          input.conversationId,
          redacted,
          answer,
          'allow',
          null,
          Date.now() - startedAt,
        );
        await appendAudit(context.env, {
          eventType: 'chat.clarification_requested',
          actorType: 'visitor',
          subjectType: 'message',
          subjectId: messageId,
          metadata: { flow: 'custom_home', reason: 'phone_not_extractable' },
        });
        return context.json({ answer, sources: [], choices: [], action: 'none', policy: 'allow', messageId, redactUserMessage: true });
      }

      const lead = await persistCustomHomeLead(context.env.DB, context.env, {
        conversationId: input.conversationId,
        contact: { ...customHomeContactTurn.contact, phone: contactPhone },
        intake,
      });
      let notificationQueued = false;
      if (lead.queueRequired) {
        try {
          await context.env.CUSTOM_HOME_LEAD_QUEUE.send(lead.queue);
          notificationQueued = true;
        } catch {
          // The encrypted lead remains pending in D1. Never log contact data.
          await appendAudit(context.env, {
            eventType: 'custom_home.notification_enqueue_failed',
            actorType: 'system',
            subjectType: 'custom_home_lead',
            subjectId: lead.leadId,
          });
        }
      }
      const answer = notificationQueued || !lead.queueRequired
        ? 'ご相談を受け付けたにゃん。担当者からご連絡するので、少し待っていてにゃん。'
        : 'ご相談は受け付けたにゃん。確認のため、公式LINEからもお問い合わせ内容を送ってにゃん。';
      const messageId = await recordTurn(
        context.env,
        input.conversationId,
        redacted,
        answer,
        'allow',
        'custom-home-intake-v1',
        Date.now() - startedAt,
      );
      await appendAudit(context.env, {
        eventType: 'custom_home.lead_accepted',
        actorType: 'visitor',
        subjectType: 'custom_home_lead',
        subjectId: lead.leadId,
        metadata: { created: lead.created, notificationQueued, flow: 'custom_home' },
      });
      return context.json({ answer, sources: [], choices: [], action: 'none', policy: 'allow', messageId, redactUserMessage: true });
    }

    if (customHomeContactTurn.contact.name) {
      await persistCustomHomeDraft(context.env.DB, context.env, {
        conversationId: input.conversationId,
        name: customHomeContactTurn.contact.name,
        intake,
      });
    }

    if (customHomeConsultation.response) {
      const answer = customHomeConsultation.response;
      const messageId = await recordTurn(
        context.env,
        input.conversationId,
        redacted,
        answer,
        'allow',
        'custom-home-intake-v1',
        Date.now() - startedAt,
      );
      await appendAudit(context.env, {
        eventType: 'chat.clarification_requested',
        actorType: 'visitor',
        subjectType: 'message',
        subjectId: messageId,
        metadata: {
          flow: 'custom_home',
          step: customHomeConsultation.step,
          contactDraftSaved: Boolean(customHomeContactTurn.contact.name),
        },
      });
      return context.json({
        answer,
        sources: [],
        choices: customHomeChoicesForResponse(answer),
        action: 'none',
        policy: 'allow',
        messageId,
        redactUserMessage: Boolean(customHomeContactTurn.contact.name || customHomeContactTurn.contact.phone),
      });
    }
  }

  const propertyKnowledgeQuestion = isPropertyKnowledgeQuestion(
    redacted,
    conversationHistory.map((message) => message.content),
  );
  const rentalConsultation = propertyKnowledgeQuestion
    ? { active: false, response: undefined }
    : evaluateRentalConsultation(conversationHistory, redacted);
  if (rentalConsultation.response) {
    const criteria = extractRentalCriteria(conversationHistory, redacted);
    const choices = rentalConsultation.active
      ? rentalChoicesForAvailability(
        rentalConsultation.response,
        await loadGuidedSearchOptions(context.env),
        criteria,
      )
      : choicesForChatAnswer(rentalConsultation.response);
    const answer = rentalConsultation.active
      ? guidedAnswerForAvailability(rentalConsultation.response, choices, 'rental', criteria)
      : rentalConsultation.response;
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      answer,
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
      answer,
      sources: [],
      choices,
      action: 'none',
      policy: 'allow',
      messageId,
    });
  }

  if (rentalConsultation.active) {
    const criteria = extractRentalCriteria(conversationHistory, redacted);
    const wantsOtherCandidates = wantsOtherPropertyCandidates(redacted);
    const excludedUrls = wantsOtherCandidates
      ? await previouslyCitedPropertyUrls(context.env.DB, input.conversationId)
      : new Set<string>();
    const recommendations = recommendRentalProperties(
      await loadRentalCatalog(context.env),
      criteria,
      excludedUrls,
    );
    const answer = wantsOtherCandidates && recommendations.length === 0
      ? '条件に合うほかの賃貸物件は、現在の登録情報では見つからなかったにゃん。条件を変えて探すか、最新情報は公式LINEで問い合わせてにゃん。'
      : formatRentalAnswer(recommendations, criteria);
    const chunks = recommendations.map(rentalPropertyChunk);
    const sources = chunks.map(sourceFromChunk);
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      answer,
      'allow',
      'rental-catalog-v1',
      Date.now() - startedAt,
      chunks,
    );
    await appendAudit(context.env, {
      eventType: 'chat.answered',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { model: 'rental-catalog-v1', sourceCount: sources.length, flow: 'rental_consultation' },
    });
    return context.json({ answer, sources, choices: choicesForChatAnswer(answer), action: 'none', policy: 'allow', messageId });
  }

  const purchaseConsultation = propertyKnowledgeQuestion
    ? { active: false, response: undefined }
    : evaluatePurchaseConsultation(conversationHistory, redacted);
  if (purchaseConsultation.response) {
    const criteria = extractSaleCriteria(conversationHistory, redacted);
    const choices = purchaseChoicesForAvailability(
      purchaseConsultation.response,
      await loadGuidedSearchOptions(context.env),
      criteria,
    );
    const answer = guidedAnswerForAvailability(
      purchaseConsultation.response,
      choices,
      'purchase',
      criteria,
    );
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      answer,
      'allow',
      null,
      Date.now() - startedAt,
    );
    await appendAudit(context.env, {
      eventType: 'chat.clarification_requested',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { flow: 'purchase_consultation' },
    });
    return context.json({
      answer,
      sources: [],
      choices,
      action: 'none',
      policy: 'allow',
      messageId,
    });
  }

  if (purchaseConsultation.active) {
    const criteria = extractSaleCriteria(conversationHistory, redacted);
    const wantsOtherCandidates = wantsOtherPropertyCandidates(redacted);
    const excludedUrls = wantsOtherCandidates
      ? await previouslyCitedPropertyUrls(context.env.DB, input.conversationId)
      : new Set<string>();
    const recommendations = recommendSaleProperties(
      await loadSaleCatalog(context.env),
      criteria,
      { urls: excludedUrls },
    );
    const answer = wantsOtherCandidates && recommendations.length === 0
      ? '条件に合うほかの購入物件は、現在の登録情報では見つからなかったにゃん。条件を変えて探すか、最新情報は公式LINEで問い合わせてにゃん。'
      : formatSaleAnswer(recommendations, criteria);
    const chunks = recommendations.map(salePropertyChunk);
    const sources = chunks.map(sourceFromChunk);
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      answer,
      'allow',
      'sale-catalog-v1',
      Date.now() - startedAt,
      chunks,
    );
    await appendAudit(context.env, {
      eventType: 'chat.answered',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { model: 'sale-catalog-v1', sourceCount: sources.length, flow: 'purchase_consultation' },
    });
    return context.json({ answer, sources, choices: choicesForChatAnswer(answer), action: 'none', policy: 'allow', messageId });
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
        max_num_results: rentalConsultation.active ? 6 : 4,
        match_threshold: rentalConsultation.active ? 0.2 : 0.4,
        context_expansion: 1,
        ...(rentalConsultation.active
          ? { keyword_match_mode: 'or' as const }
          : { boost_by: [{ field: 'timestamp', direction: 'desc' as const }] }),
      },
      // buildSearchMessages already resolves the visitor's recent context locally.
      // Skipping a second rewrite keeps the retrieval round-trip short.
      query_rewrite: { enabled: false },
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
  if (propertyKnowledgeQuestion && (chunks.length === 0 || bestScore < 0.48)) {
    const decision = noGroundingDecision();
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      decision.response || '',
      decision.code,
      null,
      Date.now() - startedAt,
    );
    await appendAudit(context.env, {
      eventType: 'chat.refused',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { code: decision.code, bestScore, mode: 'property_knowledge_fallback' },
    });
    return context.json({
      answer: decision.response,
      sources: [],
      choices: [],
      action: 'escalate',
      policy: decision.code,
      messageId,
    });
  }
  if (chunks.length === 0 || bestScore < 0.48) {
    let completion: { answer: string; model: string };
    try {
      completion = await generateConversationAnswer(
        context.env,
        redacted,
        SYSTEM_PROMPT,
        conversationHistory,
      );
    } catch (error) {
      if (error instanceof AiGatewayError && error.status === 429) {
        console.warn(JSON.stringify({ level: 'warn', event: 'cost_guard.gateway_spend_limit', requestId: context.get('requestId') }));
        return context.json({ error: '今月のAI利用上限に達しました。公式LINEをご利用ください。' }, 429);
      }
      throw error;
    }
    const answer = ensureOrinyanEnding(completion.answer);
    const messageId = await recordTurn(
      context.env,
      input.conversationId,
      redacted,
      answer,
      'allow',
      completion.model,
      Date.now() - startedAt,
    );
    await appendAudit(context.env, {
      eventType: 'chat.answered',
      actorType: 'visitor',
      subjectType: 'message',
      subjectId: messageId,
      metadata: { model: completion.model, sourceCount: 0, bestScore, mode: 'conversation' },
    });
    return context.json({ answer, sources: [], action: 'none', policy: 'allow', messageId });
  }

  let completion: { answer: string; model: string };
  try {
    completion = await generateGroundedAnswer(context.env, redacted, chunks, SYSTEM_PROMPT, conversationHistory);
  } catch (error) {
    if (error instanceof AiGatewayError && error.status === 429) {
      console.warn(JSON.stringify({ level: 'warn', event: 'cost_guard.gateway_spend_limit', requestId: context.get('requestId') }));
      return context.json({ error: '今月のAI利用上限に達しました。公式LINEをご利用ください。' }, 429);
    }
    throw error;
  }
  const voicedAnswer = ensureOrinyanEnding(completion.answer);
  const selectedSources = propertyDetailSources(selectAnswerSources(voicedAnswer, chunks, 2, contextualQuestion));
  const sources = shouldShowPropertyDetailLinks(voicedAnswer, selectedSources) ? selectedSources : [];
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
  if (!rate.success) {
    await appendRateLimitAudit(context.env, 'lead', input.conversationId);
    return context.json({ error: '少し時間をおいてからお試しください' }, 429);
  }

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
  const admin = await authenticateAdminRequest(context.req.raw, context.env);
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
        { field_name: 'manifest_sha256', data_type: 'text' },
      ],
    });
  }
  await appendAudit(context.env, {
    eventType: found ? 'knowledge.instance_verified' : 'knowledge.instance_created',
    actorType: 'admin',
    actorId: context.get('admin').loginId,
    subjectType: 'ai_search_instance',
    subjectId: id,
  });
  return context.json({ ok: true, instance: id, created: !found });
});

app.post('/api/admin/knowledge/seed', async (context) => {
  const input = knowledgeReseedSchema.parse(await context.req.json().catch(() => ({})));
  const baseUrl = new URL(context.req.url);
  const [manifestEntries, exclusions] = await Promise.all([
    readInitialKnowledgeManifest(context.env, baseUrl),
    readKnowledgeSourceExclusions(context.env),
  ]);
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const existingItems = await listAllKnowledgeItems(items);
  const exclusionFiltered = excludeRemovedInitialKnowledge(manifestEntries, exclusions);
  const propertyFiltered = excludeInitialPropertiesCoveredByManualItems(exclusionFiltered, existingItems);
  const files = excludeInitialGeneralKnowledgeOverriddenByManualItems(propertyFiltered, existingItems);
  const generalOverrides = propertyFiltered.length - files.length;
  const { accepted, skipped: skippedItems } = await syncInitialKnowledgeFiles(
    context.env,
    baseUrl,
    items,
    files,
    existingItems,
  );
  const syncedItems = [...accepted, ...skippedItems];
  const incomplete = syncedItems.filter((item) => item.status !== 'completed');
  const pruneSafety = initialKnowledgePruneSafety(files, existingItems);
  const refreshedItems = input.prune && incomplete.length === 0 && pruneSafety.safe
    ? await listAllKnowledgeItems(items)
    : null;
  const desiredItemIds = refreshedItems
    ? completedInitialKnowledgeItemIds(files, refreshedItems)
    : null;
  const pruneBlockedReason = !input.prune
    ? null
    : incomplete.length > 0
      ? 'indexing_incomplete'
      : !pruneSafety.safe
        ? pruneSafety.reason
        : !desiredItemIds
          ? 'completed_items_not_visible'
          : null;
  const deleted = input.prune && !pruneBlockedReason && refreshedItems && desiredItemIds
    ? await pruneManagedInitialKnowledgeItems(items, refreshedItems, desiredItemIds)
    : [];
  const skipped = skippedItems.map((item) => item.file);

  await appendAudit(context.env, {
    eventType: 'knowledge.initial_seeded',
    actorType: 'admin',
    actorId: context.get('admin').loginId,
    subjectType: 'ai_search_instance',
    subjectId: context.env.AI_SEARCH_INSTANCE,
    metadata: {
      accepted: accepted.length,
      skipped: skipped.length,
      incomplete: incomplete.length,
      deleted: deleted.length,
      pruneRequested: input.prune,
      pruneBlockedReason,
      excluded: manifestEntries.length - exclusionFiltered.length,
      coveredByManualItem: exclusionFiltered.length - files.length,
      generalOverrides,
    },
  });
  return context.json({
    ok: incomplete.length === 0 && (!input.prune || !pruneBlockedReason),
    accepted,
    skipped,
    incomplete,
    deleted,
    pruneRequested: input.prune,
    pruneApplied: input.prune && !pruneBlockedReason,
    pruneBlockedReason,
    excluded: manifestEntries.length - exclusionFiltered.length,
    coveredByManualItem: exclusionFiltered.length - files.length,
    generalOverrides,
  }, incomplete.length ? 202 : 200);
});

app.post('/api/internal/knowledge/reseed', async (context) => {
  const configuredSecret = context.env.KNOWLEDGE_SYNC_SECRET;
  const providedSecret = context.req.header('X-Knowledge-Sync-Token');
  if (!configuredSecret || !providedSecret || providedSecret !== configuredSecret) {
    return context.json({ error: 'Not found' }, 404);
  }
  const input = knowledgeReseedSchema.parse(await context.req.json().catch(() => ({})));
  const baseUrl = new URL(context.req.url);
  const [manifestEntries, exclusions] = await Promise.all([
    readInitialKnowledgeManifest(context.env, baseUrl),
    readKnowledgeSourceExclusions(context.env),
  ]);
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const existingItems = await listAllKnowledgeItems(items);
  const exclusionFiltered = excludeRemovedInitialKnowledge(manifestEntries, exclusions);
  const propertyFiltered = excludeInitialPropertiesCoveredByManualItems(exclusionFiltered, existingItems);
  const generalOverrideFiltered = excludeInitialGeneralKnowledgeOverriddenByManualItems(propertyFiltered, existingItems);
  const generalOverrides = propertyFiltered.length - generalOverrideFiltered.length;
  const files = generalOverrideFiltered
    .filter((entry): entry is InitialKnowledgeEntry & { sha256: string } => Boolean(entry.sha256));
  const { accepted, skipped } = await syncInitialKnowledgeFiles(
    context.env,
    baseUrl,
    items,
    files,
    existingItems,
  );
  const incomplete = [...accepted, ...skipped].filter((item) => item.status !== 'completed');
  const pruneSafety = initialKnowledgePruneSafety(files, existingItems);
  const refreshedItems = input.prune && incomplete.length === 0 && pruneSafety.safe
    ? await listAllKnowledgeItems(items)
    : null;
  const desiredItemIds = refreshedItems
    ? completedInitialKnowledgeItemIds(files, refreshedItems)
    : null;
  const pruneBlockedReason = !input.prune
    ? null
    : incomplete.length > 0
      ? 'indexing_incomplete'
      : !pruneSafety.safe
        ? pruneSafety.reason
        : !desiredItemIds
          ? 'completed_items_not_visible'
          : null;
  const deleted = input.prune && !pruneBlockedReason && refreshedItems && desiredItemIds
    ? await pruneManagedInitialKnowledgeItems(items, refreshedItems, desiredItemIds)
    : [];

  await appendAudit(context.env, {
    eventType: 'knowledge.initial_reseeded',
    actorType: 'system',
    subjectType: 'ai_search_instance',
    subjectId: context.env.AI_SEARCH_INSTANCE,
    metadata: {
      accepted: accepted.length,
      skipped: skipped.length,
      incomplete: incomplete.length,
      deleted: deleted.length,
      pruneRequested: input.prune,
      pruneBlockedReason,
      excluded: manifestEntries.length - exclusionFiltered.length,
      coveredByManualItem: exclusionFiltered.length - files.length,
      generalOverrides,
    },
  });
  return context.json({
    ok: incomplete.length === 0 && (!input.prune || !pruneBlockedReason),
    accepted,
    skipped,
    incomplete,
    deleted,
    pruneRequested: input.prune,
    pruneApplied: input.prune && !pruneBlockedReason,
    pruneBlockedReason,
    excluded: manifestEntries.length - exclusionFiltered.length,
    coveredByManualItem: exclusionFiltered.length - files.length,
    generalOverrides,
  }, incomplete.length ? 202 : 200);
});

app.get('/api/admin/overview', async (context) => {
  const [knowledge, propertyCatalog] = await Promise.all([
    context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items.list({ page: 1, per_page: 1 }),
    readPropertyDashboardIndex(context.env, new URL(context.req.url)),
  ]);
  return context.json(await loadOverview(context.env.DB, {
    knowledgeItems: knowledge.result_info?.total_count || 0,
    propertyCatalog,
    sessionLimit: context.env.DAILY_SESSION_LIMIT,
    aiRequestLimit: context.env.DAILY_AI_REQUEST_LIMIT,
  }));
});

app.get('/api/admin/knowledge', async (context) => {
  const query = context.req.query();
  const status = KNOWLEDGE_LIST_STATUS.includes(query.status as KnowledgeListStatus)
    ? query.status as KnowledgeListStatus
    : undefined;
  const requestedCategory = query.category?.trim().toLowerCase();
  const otherCategory = requestedCategory === 'other';
  const category = requestedCategory && !otherCategory && /^[a-z0-9_]{1,64}$/u.test(requestedCategory)
    ? requestedCategory
    : undefined;
  const search = (query.search || query.q || '').trim().slice(0, 250).toLocaleLowerCase('ja-JP');
  const sort = query.sort === 'title_asc' || query.sort === 'title_desc' || query.sort === 'updated_asc'
    ? query.sort
    : 'updated_desc';
  const page = boundedPositiveInteger(query.page, 1, 1000);
  const perPage = boundedPositiveInteger(query.perPage, 20, 1000);
  const allItems = await listAllKnowledgeItems(
    context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items,
    status,
  );
  const projected = allItems.map(projectKnowledgeItem);
  const categories = Object.entries(projected.reduce<Record<string, number>>((counts, item) => {
    counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, {})).map(([value, count]) => ({ value, count })).sort((left, right) => left.value.localeCompare(right.value, 'ja'));

  const filtered = projected.filter((item) => {
    if (category && item.category !== category) return false;
    if (otherCategory && isPropertyKnowledgeCategory(item.category)) return false;
    if (!search) return true;
    return [item.title, item.key, item.source_url]
      .some((value) => value.toLocaleLowerCase('ja-JP').includes(search));
  });
  filtered.sort((left, right) => {
    if (sort === 'title_asc' || sort === 'title_desc') {
      const compared = left.title.localeCompare(right.title, 'ja') || left.key.localeCompare(right.key, 'ja');
      return sort === 'title_asc' ? compared : -compared;
    }
    const compared = knowledgeItemUpdatedAt(left).localeCompare(knowledgeItemUpdatedAt(right));
    return sort === 'updated_asc' ? compared : -compared;
  });
  const offset = (page - 1) * perPage;
  const result = filtered.slice(offset, offset + perPage);
  return context.json({
    result,
    result_info: {
      count: result.length,
      page,
      per_page: perPage,
      total_count: filtered.length,
    },
    categories,
  });
});

app.post('/api/admin/knowledge', async (context) => {
  const form = await context.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return context.json({ error: 'A file is required' }, 400);
  if (file.size > MAX_KNOWLEDGE_ITEM_SIZE) return context.json({ error: 'AI Search accepts files up to 4 MB' }, 413);

  const sourceValue = form.get('sourceUrl');
  const sourceUrl = safeSourceUrl(sourceValue);
  if (typeof sourceValue === 'string' && sourceValue.trim() && !sourceUrl) {
    return context.json({ error: 'The source URL must be an official HTTPS URL' }, 400);
  }
  const titleValue = form.get('title');
  const title = typeof titleValue === 'string' && titleValue.trim()
    ? titleValue.trim().replace(/\s+/gu, ' ').slice(0, 500)
    : file.name;
  const category = normalizeKnowledgeCategory(form.get('category'), knowledgeCategoryFromFilename(file.name));
  const itemName = file.name.trim().slice(0, 240);
  if (!itemName) return context.json({ error: 'A file name is required' }, 400);
  if (!SUPPORTED_KNOWLEDGE_ITEM.test(itemName)) {
    return context.json({ error: 'Unsupported knowledge file format' }, 415);
  }

  const result = await context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items.upload(itemName, file, {
    metadata: {
      category,
      language: 'ja',
      source_url: sourceUrl || '',
      title,
    },
  });
  if (isPropertyKnowledgeCategory(category) && sourceUrl) {
    await context.env.DB.prepare(
      'DELETE FROM knowledge_source_exclusions WHERE source_url = ?',
    ).bind(sourceUrl).run();
  }
  const admin = context.get('admin');
  await appendAudit(context.env, {
    eventType: 'knowledge.uploaded',
    actorType: 'admin',
    actorId: admin.loginId,
    subjectType: 'knowledge_item',
    subjectId: result.id,
    metadata: { filename: itemName, size: file.size, type: file.type, title, category, sourceUrl: sourceUrl || null },
  });
  return context.json({ ...result, title, category, source_url: sourceUrl || '' }, 202);
});

app.post('/api/admin/knowledge/property', async (context) => {
  const contentType = context.req.header('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return context.json({ error: 'Content-Type must be application/json' }, 415);
  }

  const input = propertyKnowledgeSchema.parse(await context.req.json());
  const sourceUrl = safeSourceUrl(input.sourceUrl);
  if (!sourceUrl) return context.json({ error: 'The source URL must be an official HTTPS URL' }, 400);

  const category = propertyKnowledgeCategory(input);
  const itemKey = await propertyKnowledgeItemKey(sourceUrl);
  const markdown = propertyKnowledgeMarkdown(input, category, sourceUrl);
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const existingItems = await listAllKnowledgeItems(items);
  const sourceMatches = existingItems.filter((item) => knowledgeItemSourceUrl(item) === sourceUrl);
  const result = await items.upload(itemKey, markdown, {
    metadata: {
      category,
      language: 'ja',
      source_url: sourceUrl,
      title: input.title,
    },
  });

  // AI Search upload upserts by key. Remove a legacy/static item with the same official URL
  // only after the new item exists, so a manual update cannot create a duplicate search result.
  const replacedItemIds = [...new Set(sourceMatches
    .filter((item) => item.id !== result.id)
    .map((item) => item.id))];
  await Promise.all(replacedItemIds.map((id) => items.delete(id)));
  await context.env.DB.prepare(
    'DELETE FROM knowledge_source_exclusions WHERE source_url = ?',
  ).bind(sourceUrl).run();
  await upsertManagedProperty(context.env.DB, { ...input, category, sourceUrl });

  const admin = context.get('admin');
  await appendAudit(context.env, {
    eventType: 'knowledge.property_upserted',
    actorType: 'admin',
    actorId: admin.loginId,
    subjectType: 'knowledge_item',
    subjectId: result.id,
    metadata: {
      itemKey,
      title: input.title,
      category,
      sourceUrl,
      updated: sourceMatches.length > 0,
      replacedItemCount: replacedItemIds.length,
      featureCount: input.features.length,
    },
  });
  return context.json({
    ...result,
    key: itemKey,
    title: input.title,
    category,
    source_url: sourceUrl,
    replacedItemCount: replacedItemIds.length,
    reindexStarted: true,
  }, 202);
});

app.get('/api/admin/knowledge/status', async (context) => {
  const ids = [...new Set((context.req.query('ids') || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9._:-]{1,200}$/u.test(id)))]
    .slice(0, 25);
  if (!ids.length) return context.json({ result: [] });
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const result = (await Promise.all(ids.map(async (id) => {
    try {
      return projectKnowledgeItem(await items.get(id).info());
    } catch {
      return null;
    }
  }))).filter((item): item is ReturnType<typeof projectKnowledgeItem> => Boolean(item));
  return context.json({ result });
});

app.get('/api/admin/knowledge/:id/content', async (context) => {
  const id = context.req.param('id');
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const existing = await items.get(id).info();
  const category = normalizeKnowledgeCategory(metadataString(existing.metadata, 'category'));
  if (isPropertyKnowledgeCategory(category)) {
    return context.json({ error: '物件ナレッジの本文は専用フォームから編集してください' }, 400);
  }
  if (!isPlainTextKnowledgeItem(existing)) {
    return context.json({ error: '本文編集に対応しているのはMarkdownまたはプレーンテキスト資料のみです' }, 415);
  }
  try {
    const downloaded = await downloadPlainTextKnowledgeContent(items, existing);
    return context.json(downloaded);
  } catch (error) {
    if (error instanceof Error && error.message === 'KNOWLEDGE_CONTENT_TOO_LARGE') {
      return context.json({ error: 'AI Search accepts files up to 4 MB' }, 413);
    }
    if (error instanceof Error && error.message === 'KNOWLEDGE_CONTENT_NOT_UTF8') {
      return context.json({ error: '資料本文はUTF-8テキストである必要があります' }, 415);
    }
    throw error;
  }
});

app.get('/api/admin/knowledge/:id', async (context) => {
  const id = context.req.param('id');
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const existing = await items.get(id).info();
  const projected = projectKnowledgeItem(existing);
  if (!isPropertyKnowledgeCategory(projected.category)) {
    return context.json({ item: projected, property: null });
  }

  const fallbackSourceUrl = projected.source_url || 'https://orijyu.com/';
  const fallback = {
    title: projected.title,
    category: projected.category,
    sourceUrl: fallbackSourceUrl,
  };
  let property = propertyKnowledgeFromMarkdown('', fallback);
  try {
    const downloaded = await items.get(id).download();
    const markdown = await new Response(downloaded.body).text();
    property = propertyKnowledgeFromMarkdown(markdown, fallback);
  } catch {
    // Metadata still provides a safe minimal edit form when an older item cannot be downloaded.
  }
  return context.json({ item: projected, property });
});

app.put('/api/admin/knowledge/:id', async (context) => {
  const form = await context.req.formData();
  const titleValue = form.get('title');
  const title = typeof titleValue === 'string'
    ? titleValue.trim().replace(/\s+/gu, ' ').slice(0, 500)
    : '';
  if (!title) return context.json({ error: '資料名を入力してください' }, 400);

  const sourceValue = form.get('sourceUrl');
  const sourceUrl = safeSourceUrl(sourceValue);
  if (typeof sourceValue === 'string' && sourceValue.trim() && !sourceUrl) {
    return context.json({ error: '関連ページURLには公式サイトのHTTPS URLを入力してください' }, 400);
  }

  const replacementValue = form.get('file');
  if (replacementValue !== null && !(replacementValue instanceof File)) {
    return context.json({ error: '置き換えるファイルを確認できませんでした' }, 400);
  }
  const replacement = replacementValue instanceof File ? replacementValue : undefined;
  const contentValue = form.get('content');
  if (contentValue !== null && typeof contentValue !== 'string') {
    return context.json({ error: '本文を確認できませんでした' }, 400);
  }
  const textContent = typeof contentValue === 'string' ? contentValue : undefined;
  const revisionValue = form.get('contentRevision');
  if (revisionValue !== null && typeof revisionValue !== 'string') {
    return context.json({ error: '本文の版情報を確認できませんでした' }, 400);
  }
  const contentRevision = typeof revisionValue === 'string' ? revisionValue.trim() : undefined;
  if (textContent !== undefined && !contentRevision) {
    return context.json({ error: '本文を更新するにはcontentRevisionが必要です' }, 400);
  }
  if (replacement && textContent !== undefined) {
    return context.json({ error: 'ファイルと本文は同時に指定できません' }, 400);
  }
  if (textContent !== undefined && new TextEncoder().encode(textContent).byteLength > MAX_KNOWLEDGE_ITEM_SIZE) {
    return context.json({ error: 'AI Search accepts files up to 4 MB' }, 413);
  }
  if (replacement) {
    const replacementName = replacement.name.trim();
    if (!replacementName || !SUPPORTED_KNOWLEDGE_ITEM.test(replacementName)) {
      return context.json({ error: 'Unsupported knowledge file format' }, 415);
    }
    if (replacement.size > MAX_KNOWLEDGE_ITEM_SIZE) {
      return context.json({ error: 'AI Search accepts files up to 4 MB' }, 413);
    }
  }

  const id = context.req.param('id');
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const existing = await items.get(id).info();
  const category = normalizeKnowledgeCategory(metadataString(existing.metadata, 'category'));
  if (isPropertyKnowledgeCategory(category)) {
    if (textContent !== undefined) {
      return context.json({ error: '物件ナレッジの本文は専用フォームから編集してください' }, 400);
    }
    return context.json({ error: '物件ナレッジは専用フォームから編集してください' }, 400);
  }
  if (textContent !== undefined && !isPlainTextKnowledgeItem(existing)) {
    return context.json({ error: '本文編集に対応しているのはMarkdownまたはプレーンテキスト資料のみです' }, 415);
  }
  if (textContent !== undefined) {
    try {
      const current = await downloadPlainTextKnowledgeContent(items, existing);
      if (current.revision !== contentRevision) {
        return context.json({ error: '資料本文が他の管理者によって更新されています。再読み込みしてから保存してください' }, 409);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'KNOWLEDGE_CONTENT_TOO_LARGE') {
        return context.json({ error: 'AI Search accepts files up to 4 MB' }, 413);
      }
      if (error instanceof Error && error.message === 'KNOWLEDGE_CONTENT_NOT_UTF8') {
        return context.json({ error: '資料本文はUTF-8テキストである必要があります' }, 415);
      }
      throw error;
    }
  }

  let initialKnowledgeOverrideFile: string | undefined;
  if (isManagedInitialKnowledgeItem(existing)) {
    const manifestEntries = await readInitialKnowledgeManifest(context.env, new URL(context.req.url));
    const initialEntry = manifestEntries.find((entry) => (
      !isPropertyKnowledgeCategory(initialKnowledgeCategory(entry))
      && matchingInitialKnowledgeItems(entry, [existing]).some((item) => item.id === existing.id)
    ));
    if (!initialEntry) {
      return context.json({ error: '初期資料との紐付けを確認できませんでした。同期完了後にもう一度お試しください' }, 409);
    }
    initialKnowledgeOverrideFile = initialEntry.file;
  }

  const input = { title, sourceUrl: sourceUrl || '' };
  const updated = await upsertGeneralKnowledgeItem(
    items,
    existing,
    input,
    replacement,
    initialKnowledgeOverrideFile,
    textContent,
  );
  const admin = context.get('admin');
  await appendAudit(context.env, {
    eventType: 'knowledge.general_updated',
    actorType: 'admin',
    actorId: admin.loginId,
    subjectType: 'knowledge_item',
    subjectId: updated.result.id,
    metadata: {
      oldItemId: id,
      oldKey: existing.key,
      itemKey: updated.itemKey,
      title,
      category: updated.metadata.category,
      sourceUrl: sourceUrl || null,
      fileReplaced: Boolean(replacement),
      contentUpdated: textContent !== undefined,
      initialKnowledgeOverrideFile: initialKnowledgeOverrideFile || null,
      replacedItemCount: updated.replacedItemCount,
      previousFileSize: existing.file_size || null,
      replacementFileName: replacement?.name || null,
      replacementFileSize: replacement?.size || null,
    },
  });
  return context.json({
    ...updated.result,
    key: updated.result.key || updated.itemKey,
    title,
    category: updated.metadata.category,
    source_url: sourceUrl || '',
    replacedItemCount: updated.replacedItemCount,
    reindexStarted: true,
  }, 202);
});

app.put('/api/admin/knowledge/:id/property', async (context) => {
  const id = context.req.param('id');
  const contentType = context.req.header('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return context.json({ error: 'Content-Type must be application/json' }, 415);
  }

  const input = propertyKnowledgeSchema.parse(await context.req.json());
  const sourceUrl = safeSourceUrl(input.sourceUrl);
  if (!sourceUrl) return context.json({ error: 'The source URL must be an official HTTPS URL' }, 400);

  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const existing = await items.get(id).info();
  const oldCategory = normalizeKnowledgeCategory(metadataString(existing.metadata, 'category'));
  if (!isPropertyKnowledgeCategory(oldCategory)) {
    return context.json({ error: 'Only property knowledge can be edited with this endpoint' }, 400);
  }
  const oldSourceUrl = safeSourceUrl(metadataString(existing.metadata, 'source_url'));
  const category = propertyKnowledgeCategory(input);
  const itemKey = await propertyKnowledgeItemKey(sourceUrl);
  const markdown = propertyKnowledgeMarkdown(input, category, sourceUrl);
  const existingItems = await listAllKnowledgeItems(items);
  const sourceMatches = existingItems.filter((item) => knowledgeItemSourceUrl(item) === sourceUrl && item.id !== id);
  const result = await items.upload(itemKey, markdown, {
    metadata: {
      category,
      language: 'ja',
      source_url: sourceUrl,
      title: input.title,
    },
  });

  const obsoleteIds = [...new Set([
    ...sourceMatches.map((item) => item.id),
    ...(result.id !== id ? [id] : []),
  ])];
  await Promise.all(obsoleteIds.map((obsoleteId) => items.delete(obsoleteId)));
  if (oldSourceUrl) {
    await context.env.DB.prepare('DELETE FROM knowledge_source_exclusions WHERE source_url = ?').bind(oldSourceUrl).run();
  }
  if (sourceUrl !== oldSourceUrl) {
    await context.env.DB.prepare('DELETE FROM knowledge_source_exclusions WHERE source_url = ?').bind(sourceUrl).run();
  }
  if (oldSourceUrl && oldSourceUrl !== sourceUrl) await deleteManagedProperty(context.env.DB, oldSourceUrl);
  await upsertManagedProperty(context.env.DB, { ...input, category, sourceUrl });

  const admin = context.get('admin');
  await appendAudit(context.env, {
    eventType: 'knowledge.property_updated',
    actorType: 'admin',
    actorId: admin.loginId,
    subjectType: 'knowledge_item',
    subjectId: result.id,
    metadata: {
      itemKey,
      oldSourceUrl: oldSourceUrl || null,
      sourceUrl,
      title: input.title,
      category,
      replacedItemCount: obsoleteIds.length,
    },
  });
  return context.json({
    ...result,
    key: itemKey,
    title: input.title,
    category,
    source_url: sourceUrl,
    replacedItemCount: obsoleteIds.length,
    reindexStarted: true,
  }, 202);
});

app.delete('/api/admin/knowledge/:id', async (context) => {
  const id = context.req.param('id');
  const items = context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items;
  const existing = await items.get(id).info();
  const category = normalizeKnowledgeCategory(metadataString(existing.metadata, 'category'));
  const sourceUrl = safeSourceUrl(metadataString(existing.metadata, 'source_url'));
  const title = metadataString(existing.metadata, 'title') || existing.key;
  const persistExclusion = isPropertyKnowledgeCategory(category)
    && Boolean(sourceUrl)
    && new URL(sourceUrl!).pathname !== '/';

  await items.delete(id);
  if (sourceUrl) await deleteManagedProperty(context.env.DB, sourceUrl);
  if (persistExclusion && sourceUrl) {
    await context.env.DB.prepare(
      'INSERT INTO knowledge_source_exclusions (source_url, category, title, deleted_by, deleted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(source_url) DO UPDATE SET category = excluded.category, title = excluded.title, deleted_by = excluded.deleted_by, deleted_at = CURRENT_TIMESTAMP',
    ).bind(sourceUrl, category, title, context.get('admin').loginId).run();
  }
  await appendAudit(context.env, {
    eventType: 'knowledge.deleted',
    actorType: 'admin',
    actorId: context.get('admin').loginId,
    subjectType: 'knowledge_item',
    subjectId: id,
    metadata: { key: existing.key, title, category, sourceUrl: sourceUrl || null, persistedExclusion: persistExclusion },
  });
  return context.json({ ok: true, persistedExclusion: persistExclusion });
});

app.post('/api/admin/knowledge/:id/reindex', async (context) => {
  const id = context.req.param('id');
  const result = await context.env.AI_SEARCH.get(context.env.AI_SEARCH_INSTANCE).items.get(id).sync();
  await appendAudit(context.env, {
    eventType: 'knowledge.reindexed',
    actorType: 'admin',
    actorId: context.get('admin').loginId,
    subjectType: 'knowledge_item',
    subjectId: id,
    metadata: { itemId: id },
  });
  return context.json(projectKnowledgeItem(result), 202);
});

app.get('/api/admin/conversations', async (context) => {
  const page = boundedPositiveInteger(context.req.query('page'), 1, 10_000);
  const perPage = boundedPositiveInteger(context.req.query('perPage'), 30, 100);
  const search = (context.req.query('search') || '').trim().slice(0, 250);
  const result = await context.env.DB.prepare(
    `SELECT c.id, c.source_page, c.status, c.marketing_consent, c.created_at, c.updated_at,
      COUNT(m.id) AS message_count,
      MAX(CASE WHEN m.policy_action != 'allow' THEN 1 ELSE 0 END) AS has_refusal,
      COALESCE((
        SELECT mu.content_redacted
        FROM messages mu
        WHERE mu.conversation_id = c.id AND mu.role = 'user'
        -- D1's CURRENT_TIMESTAMP has second-level precision.  rowid is the
        -- insertion-order tie breaker for legacy rows and same-second turns.
        ORDER BY mu.created_at DESC, mu.rowid DESC
        LIMIT 1
      ), '') AS latest_message
     FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE (? = '' OR EXISTS (
       SELECT 1 FROM messages ms
       WHERE ms.conversation_id = c.id AND ms.content_redacted LIKE '%' || ? || '%'
     ))
     GROUP BY c.id ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`,
  ).bind(search, search, perPage, (page - 1) * perPage).all();
  return context.json({ result: result.results, page, perPage });
});

app.get('/api/admin/conversations/export.csv', async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT m.id AS message_id, m.conversation_id, m.role, m.content_redacted, m.model,
      m.latency_ms, m.policy_action, m.created_at, c.source_page, c.marketing_consent
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     ORDER BY m.created_at DESC, m.rowid DESC LIMIT 10001`,
  ).all();
  const truncated = result.results.length > 10000;
  const header = ['message_id', 'conversation_id', 'role', 'content_redacted', 'model', 'latency_ms', 'policy_action', 'created_at', 'source_page', 'marketing_consent'];
  const rows = result.results.slice(0, 10000).map((row) => header.map((key) => row[key]));
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  await appendAudit(context.env, {
    eventType: 'conversation.exported',
    actorType: 'admin',
    actorId: context.get('admin').loginId,
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
       WHERE m.conversation_id = ? GROUP BY m.id ORDER BY m.created_at ASC, m.rowid ASC`,
    ).bind(id).all(),
  ]);
  if (!conversation) return context.json({ error: 'Not found' }, 404);
  return context.json({ conversation, messages: messages.results });
});

async function safeAdminPIIDecrypt(value: string | null, env: Env) {
  try {
    return await decryptPII(value, env);
  } catch {
    // A damaged legacy record must not prevent staff from viewing other leads.
    return null;
  }
}

/**
 * Returns the custom-home inquiries for the admin inbox.
 *
 * The database stores contact details and intake JSON encrypted.  Keep the
 * ciphertext out of this response and decrypt only after the admin middleware
 * above has authenticated the request.  Notification error details are also
 * intentionally omitted: the inbox needs the delivery status, not an
 * implementation detail that could contain provider data.
 */
app.get('/api/admin/inquiries', async (context) => {
  const page = boundedPositiveInteger(context.req.query('page'), 1, 10_000);
  const perPage = boundedPositiveInteger(context.req.query('perPage'), 30, 100);
  const offset = (page - 1) * perPage;
  const [count, listed] = await Promise.all([
    context.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM custom_home_leads
       WHERE customer_id IS NOT NULL AND notification_status != 'collecting'`,
    ).first<{ total: number }>(),
    context.env.DB.prepare(
      `SELECT l.id, l.conversation_id, l.contact_name_enc, l.intake_enc,
        l.notification_status, l.notification_attempts, l.created_at, l.updated_at,
        c.name_enc AS customer_name_enc, c.phone_enc
       FROM custom_home_leads l
       LEFT JOIN customers c ON c.id = l.customer_id
       WHERE l.customer_id IS NOT NULL AND l.notification_status != 'collecting'
       ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`,
    ).bind(perPage, offset).all<{
      id: string;
      conversation_id: string;
      contact_name_enc: string | null;
      intake_enc: string | null;
      notification_status: string;
      notification_attempts: number;
      created_at: string;
      updated_at: string;
      customer_name_enc: string | null;
      phone_enc: string | null;
    }>(),
  ]);

  const result = await Promise.all(listed.results.map(async (row) => {
    const [leadName, customerName, phone, intakeText] = await Promise.all([
      safeAdminPIIDecrypt(row.contact_name_enc, context.env),
      safeAdminPIIDecrypt(row.customer_name_enc, context.env),
      safeAdminPIIDecrypt(row.phone_enc, context.env),
      safeAdminPIIDecrypt(row.intake_enc, context.env),
    ]);
    let intake: Record<string, string | number> = {};
    if (intakeText) {
      try {
        const parsed = JSON.parse(intakeText) as Record<string, unknown>;
        const allowedKeys = [
          'landOwnership', 'landLocation', 'landSizeSqm', 'landSizeNote', 'desiredArea',
          'householdSize', 'householdDescription', 'layout', 'budgetYen',
          'budgetNote', 'timing', 'priorities',
        ] as const;
        for (const key of allowedKeys) {
          const value = parsed[key];
          if (typeof value === 'string' && value.trim()) intake[key] = value.trim().slice(0, 500);
          else if (typeof value === 'number' && Number.isFinite(value)) intake[key] = value;
        }
      } catch {
        // Keep a malformed/legacy record visible without returning its raw payload.
      }
    }
    return {
      id: row.id,
      conversationId: row.conversation_id,
      name: leadName || customerName || null,
      phone,
      intake,
      notificationStatus: row.notification_status,
      notificationAttempts: row.notification_attempts,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }));
  return context.json({
    result,
    page,
    perPage,
    total: Number(count?.total || 0),
  }, 200, { 'Cache-Control': 'private, no-store' });
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
    actorId: context.get('admin').loginId,
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
    actorId: context.get('admin').loginId,
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
  ).bind(key, JSON.stringify(value), admin.loginId).run();
  await appendAudit(context.env, { eventType: 'settings.updated', actorType: 'admin', actorId: admin.loginId, subjectType: 'setting', subjectId: key });
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
    actorId: context.get('admin').loginId,
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

type WorkerQueuePayload = AuditArchiveEvent | CustomHomeLeadQueuePayload | CustomHomeNotificationPayload;

async function consumeCustomHomeLeadBatch(
  batch: MessageBatch<CustomHomeLeadQueuePayload>,
  env: Env,
) {
  for (const message of batch.messages) {
    const result = await processCustomHomeNotification(env.DB, env, message.body, {
      sender: 'no-reply@orijyu.com',
      recipient: 'uken.shohei@gmail.com',
      send: (email) => env.CUSTOM_HOME_LEAD_EMAIL.send(email),
    });
    if (result.disposition === 'retry') {
      message.retry({ delaySeconds: Math.min(60, Math.max(10, result.attempt * 10)) });
      continue;
    }
    message.ack();
    if (result.status === 'sent' || result.status === 'failed') {
      await appendAudit(env, {
        eventType: result.status === 'sent'
          ? 'custom_home.notification_sent'
          : 'custom_home.notification_failed',
        actorType: 'system',
        subjectType: 'custom_home_lead',
        subjectId: message.body.leadId,
        metadata: { attempt: result.attempt },
      });
    }
  }
}

async function consumeWorkerQueue(batch: MessageBatch<WorkerQueuePayload>, env: Env) {
  if (batch.queue === 'orient-chat-audit') {
    await archiveAuditBatch(batch as MessageBatch<AuditArchiveEvent>, env);
    return;
  }
  if (batch.queue === 'orient-chat-custom-home-leads') {
    await consumeCustomHomeLeadBatch(batch as MessageBatch<CustomHomeLeadQueuePayload>, env);
    return;
  }
  batch.ackAll();
}

export default {
  fetch: app.fetch,
  queue: consumeWorkerQueue,
} satisfies ExportedHandler<Env, WorkerQueuePayload>;
