import type { AuditInput } from './types';
import { appendAudit as appendAuditLedger } from './audit';

export const CHAT_BODY_MAX_BYTES = 64 * 1024;
export const CHAT_TURN_STALE_AFTER_MINUTES = 5;

export class ChatHttpError extends Error {
  constructor(
    public readonly status: 400 | 413 | 415,
    message: string,
  ) {
    super(message);
    this.name = 'ChatHttpError';
  }
}

/**
 * Read only the bounded JSON body used by the public chat endpoints. Hono's
 * req.json() parses after buffering the complete body, so the limit must be
 * enforced while consuming the request stream.
 */
export async function readChatJson(request: Request): Promise<unknown> {
  const mediaType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new ChatHttpError(415, 'Content-Type must be application/json');
  }

  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength != null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new ChatHttpError(400, 'Invalid request body');
    }
    if (length > CHAT_BODY_MAX_BYTES) {
      throw new ChatHttpError(413, 'Request body is too large');
    }
  }

  const body = request.body;
  if (!body) throw new ChatHttpError(400, 'Invalid JSON');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > CHAT_BODY_MAX_BYTES) {
        await reader.cancel();
        throw new ChatHttpError(413, 'Request body is too large');
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof ChatHttpError) throw error;
    throw new ChatHttpError(400, 'Invalid request body');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ChatHttpError(400, 'Invalid JSON');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ChatHttpError(400, 'Invalid JSON');
  }
}

function allowedOriginsSet(value: string) {
  return new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean).map((origin) => {
    try { return new URL(origin).origin; } catch { return ''; }
  }).filter(Boolean));
}

/** Validate and canonicalize the page URL stored with a chat session. */
export function safeChatSourcePage(value: string | undefined, allowedOrigins: string) {
  if (value == null) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined;
    if (!allowedOriginsSet(allowedOrigins).has(url.origin)) return undefined;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export type ChatTurnClaim = {
  conversationId: string;
  clientTurnId: string;
  claimId: string;
};

export type ChatTurnClaimResult =
  | { kind: 'claimed'; claim: ChatTurnClaim }
  | { kind: 'cached'; response: unknown }
  | { kind: 'busy' };

type StoredTurnRequest = {
  status: 'processing' | 'completed' | 'abandoned';
  response_json: string | null;
};

function staleProcessingWhere() {
  return `status = 'processing' AND updated_at <= datetime('now', '-${CHAT_TURN_STALE_AFTER_MINUTES} minutes')`;
}

function parseCachedResponse(value: string | null) {
  if (!value) return undefined;
  try { return JSON.parse(value) as unknown; } catch { return undefined; }
}

/**
 * Claim one request per conversation. A client retry receives the completed
 * JSON response, while a concurrent different turn gets a deterministic 409.
 * Stale leases are abandoned before claiming so a crashed Worker cannot block
 * the conversation forever.
 */
export async function claimChatTurn(
  database: D1Database,
  conversationId: string,
  clientTurnId: string,
): Promise<ChatTurnClaimResult> {
  const existing = await database.prepare(
    `SELECT status, response_json FROM chat_turn_requests WHERE conversation_id = ? AND client_turn_id = ?`,
  ).bind(conversationId, clientTurnId).first<StoredTurnRequest>();
  if (existing?.status === 'completed') {
    const response = parseCachedResponse(existing.response_json);
    if (response !== undefined) return { kind: 'cached', response };
  }

  const claimId = crypto.randomUUID();
  if (existing?.status === 'processing') {
    const reclaimed = await database.prepare(
      `UPDATE chat_turn_requests
       SET claim_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE conversation_id = ? AND client_turn_id = ? AND ${staleProcessingWhere()}`,
    ).bind(claimId, conversationId, clientTurnId).run();
    if (!reclaimed.meta.changes) return { kind: 'busy' };
    return { kind: 'claimed', claim: { conversationId, clientTurnId, claimId } };
  }
  if (existing?.status === 'abandoned') {
    try {
      const reclaimed = await database.prepare(
        `UPDATE chat_turn_requests
         SET status = 'processing', claim_id = ?, response_json = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE conversation_id = ? AND client_turn_id = ? AND status = 'abandoned'`,
      ).bind(claimId, conversationId, clientTurnId).run();
      if (reclaimed.meta.changes) return { kind: 'claimed', claim: { conversationId, clientTurnId, claimId } };
    } catch {
      // Another turn for this conversation owns the partial unique lease.
      return { kind: 'busy' };
    }
  }

  // Free stale requests from a different client before the partial unique
  // index is consulted by the insert below.
  await database.prepare(
    `UPDATE chat_turn_requests SET status = 'abandoned', updated_at = CURRENT_TIMESTAMP
     WHERE conversation_id = ? AND ${staleProcessingWhere()}`,
  ).bind(conversationId).run();
  try {
    await database.prepare(
      `INSERT INTO chat_turn_requests
       (conversation_id, client_turn_id, claim_id, status, response_json)
       VALUES (?, ?, ?, 'processing', NULL)`,
    ).bind(conversationId, clientTurnId, claimId).run();
    return { kind: 'claimed', claim: { conversationId, clientTurnId, claimId } };
  } catch {
    // Another request won the race. Read the authoritative row instead of
    // exposing a D1 constraint error to the visitor.
    const winner = await database.prepare(
      `SELECT status, response_json FROM chat_turn_requests WHERE conversation_id = ? AND client_turn_id = ?`,
    ).bind(conversationId, clientTurnId).first<StoredTurnRequest>();
    if (winner?.status === 'completed') {
      const response = parseCachedResponse(winner.response_json);
      if (response !== undefined) return { kind: 'cached', response };
    }
    return { kind: 'busy' };
  }
}

export async function completeChatTurn(database: D1Database, claim: ChatTurnClaim, response: unknown) {
  const responseJson = JSON.stringify(response);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await database.prepare(
        `UPDATE chat_turn_requests
         SET status = 'completed', response_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE conversation_id = ? AND client_turn_id = ? AND claim_id = ? AND status = 'processing'`,
      ).bind(responseJson, claim.conversationId, claim.clientTurnId, claim.claimId).run();
      if (result.meta.changes > 0) return true;
      const stored = await database.prepare(
        `SELECT status, response_json FROM chat_turn_requests WHERE conversation_id = ? AND client_turn_id = ?`,
      ).bind(claim.conversationId, claim.clientTurnId).first<StoredTurnRequest>();
      return stored?.status === 'completed' && stored.response_json === responseJson;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function releaseChatTurn(database: D1Database, claim: ChatTurnClaim) {
  await database.prepare(
    `UPDATE chat_turn_requests SET status = 'abandoned', updated_at = CURRENT_TIMESTAMP
     WHERE conversation_id = ? AND client_turn_id = ? AND claim_id = ? AND status = 'processing'`,
  ).bind(claim.conversationId, claim.clientTurnId, claim.claimId).run();
}

/** Audit must not turn a successfully generated answer into a 500 response. */
export async function appendChatAudit(env: Env, input: AuditInput) {
  try {
    await appendAuditLedger(env, input);
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'chat.audit_append_failed',
      auditEventType: input.eventType,
      subjectType: input.subjectType || null,
      subjectId: input.subjectId || null,
      errorType: error instanceof Error ? error.name : 'unknown',
    }));
  }
}
