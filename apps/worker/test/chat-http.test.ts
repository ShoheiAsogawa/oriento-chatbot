import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ DurableObject: class {} }));
import {
  CHAT_BODY_MAX_BYTES,
  claimChatTurn,
  completeChatTurn,
  readChatJson,
  releaseChatTurn,
  safeChatSourcePage,
} from '../src/chat-http';

type Row = {
  conversationId: string;
  clientTurnId: string;
  claimId: string;
  status: 'processing' | 'completed' | 'abandoned';
  responseJson: string | null;
  stale?: boolean;
};

class FakeD1 {
  rows = new Map<string, Row>();
  failCompletionAttempts = 0;

  prepare(sql: string) {
    const database = this;
    return {
      bind(...args: unknown[]) {
        return {
          async first<T>() {
            const conversationId = String(args[0]);
            const clientTurnId = String(args[1]);
            const row = database.rows.get(`${conversationId}:${clientTurnId}`);
            if (!row) return null as T | null;
            return { status: row.status, response_json: row.responseJson } as T;
          },
          async run() {
            const conversationId = String(args[0]);
            const clientTurnId = String(args[1]);
            const key = `${conversationId}:${clientTurnId}`;
            const row = database.rows.get(key);
            let changes = 0;
            if (sql.includes('INSERT INTO chat_turn_requests')) {
              if ([...database.rows.values()].some((item) => item.conversationId === conversationId && item.status === 'processing')) {
                throw new Error('UNIQUE constraint failed');
              }
              database.rows.set(key, {
                conversationId,
                clientTurnId,
                claimId: String(args[2]),
                status: 'processing',
                responseJson: null,
              });
              changes = 1;
            } else if (sql.includes('SET claim_id = ?')) {
              const staleRow = database.rows.get(`${args[1]}:${args[2]}`);
              if (staleRow?.status === 'processing' && staleRow.stale) {
                staleRow.claimId = String(args[0]);
                staleRow.stale = false;
                changes = 1;
              }
            } else if (sql.includes("SET status = 'processing'")) {
              const abandonedRow = database.rows.get(`${args[1]}:${args[2]}`);
              if (abandonedRow?.status === 'abandoned') {
                abandonedRow.status = 'processing';
                abandonedRow.claimId = String(args[0]);
                abandonedRow.responseJson = null;
                changes = 1;
              }
            } else if (sql.includes("SET status = 'abandoned'") && sql.includes("status = 'processing'") && sql.includes('updated_at <= ')) {
              for (const item of database.rows.values()) {
                if (item.conversationId === conversationId && item.status === 'processing' && item.stale) {
                  item.status = 'abandoned';
                  changes += 1;
                }
              }
            } else if (sql.includes("SET status = 'completed'")) {
              if (database.failCompletionAttempts > 0) {
                database.failCompletionAttempts -= 1;
                throw new Error('temporary D1 failure');
              }
              const completedRow = database.rows.get(`${args[1]}:${args[2]}`);
              if (completedRow?.status === 'processing' && completedRow.claimId === String(args[3])) {
                completedRow.status = 'completed';
                completedRow.responseJson = String(args[0]);
                changes = 1;
              }
            } else if (sql.includes("SET status = 'abandoned'")) {
              if (row?.status === 'processing' && row.claimId === String(args[2])) {
                row.status = 'abandoned';
                changes = 1;
              }
            }
            return { meta: { changes } };
          },
        };
      },
    };
  }
}

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('https://orijyu.com/api/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

describe('chat HTTP boundary', () => {
  it('requires JSON, rejects malformed JSON, and enforces a byte limit', async () => {
    await expect(readChatJson(new Request('https://orijyu.com', { method: 'POST' })))
      .rejects.toMatchObject({ status: 415 });
    await expect(readChatJson(jsonRequest('{'))).rejects.toMatchObject({ status: 400 });
    await expect(readChatJson(jsonRequest('x', { 'Content-Length': String(CHAT_BODY_MAX_BYTES + 1) })))
      .rejects.toMatchObject({ status: 413 });
    await expect(readChatJson(jsonRequest(JSON.stringify({ text: '絵文字 🏠' }))))
      .resolves.toEqual({ text: '絵文字 🏠' });

    const oversizedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"x":"' + 'a'.repeat(CHAT_BODY_MAX_BYTES) + '"}'));
        controller.close();
      },
    });
    await expect(readChatJson(new Request('https://orijyu.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversizedStream,
      // A stream body is intentionally used to exercise the byte-by-byte cap.
      // @ts-expect-error RequestInit.duplex is required by Node's fetch types.
      duplex: 'half',
    }))).rejects.toMatchObject({ status: 413 });

    const invalidUtf8 = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc3, 0x28, 0x7d]));
        controller.close();
      },
    });
    await expect(readChatJson(new Request('https://orijyu.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: invalidUtf8,
      // @ts-expect-error RequestInit.duplex is required by Node's fetch types.
      duplex: 'half',
    }))).rejects.toMatchObject({ status: 400 });
  });

  it('allows only configured HTTPS origins and strips query/hash', () => {
    expect(safeChatSourcePage('https://orijyu.com/property/1?utm=test#chat', 'https://orijyu.com,https://www.orijyu.com'))
      .toBe('https://orijyu.com/property/1');
    expect(safeChatSourcePage('javascript:alert(1)', 'https://orijyu.com')).toBeUndefined();
    expect(safeChatSourcePage('https://orijyu.com:8443/property/1', 'https://orijyu.com')).toBeUndefined();
    expect(safeChatSourcePage('https://attacker.example/property/1', 'https://orijyu.com')).toBeUndefined();
  });

  it('serializes one turn per conversation and reuses completed responses', async () => {
    const database = new FakeD1() as unknown as D1Database;
    const first = await claimChatTurn(database, 'conversation-1', 'turn-1');
    expect(first.kind).toBe('claimed');
    const competing = await claimChatTurn(database, 'conversation-1', 'turn-2');
    expect(competing).toEqual({ kind: 'busy' });
    if (first.kind !== 'claimed') throw new Error('expected claim');
    await expect(completeChatTurn(database, first.claim, { answer: '回答にゃん' })).resolves.toBe(true);
    await expect(claimChatTurn(database, 'conversation-1', 'turn-1'))
      .resolves.toEqual({ kind: 'cached', response: { answer: '回答にゃん' } });
    await releaseChatTurn(database, first.claim);
  });

  it('releases a failed turn so another client can continue', async () => {
    const database = new FakeD1() as unknown as D1Database;
    const first = await claimChatTurn(database, 'conversation-1', 'turn-1');
    expect(first.kind).toBe('claimed');
    if (first.kind !== 'claimed') throw new Error('expected claim');
    await releaseChatTurn(database, first.claim);
    const next = await claimChatTurn(database, 'conversation-1', 'turn-2');
    expect(next.kind).toBe('claimed');
  });

  it('reclaims a stale processing lease without releasing the new claimant', async () => {
    const database = new FakeD1() as unknown as FakeD1;
    const first = await claimChatTurn(database as unknown as D1Database, 'conversation-1', 'turn-1');
    expect(first.kind).toBe('claimed');
    if (first.kind !== 'claimed') throw new Error('expected claim');
    database.rows.get('conversation-1:turn-1')!.stale = true;
    const reclaimed = await claimChatTurn(database as unknown as D1Database, 'conversation-1', 'turn-1');
    expect(reclaimed.kind).toBe('claimed');
    if (reclaimed.kind !== 'claimed') throw new Error('expected reclaimed claim');
    expect(reclaimed.claim.claimId).not.toBe(first.claim.claimId);
    await releaseChatTurn(database as unknown as D1Database, first.claim);
    expect(database.rows.get('conversation-1:turn-1')?.status).toBe('processing');
    await releaseChatTurn(database as unknown as D1Database, reclaimed.claim);
  });

  it('retries a transient completion write before exposing the answer', async () => {
    const database = new FakeD1();
    const first = await claimChatTurn(database as unknown as D1Database, 'conversation-1', 'turn-1');
    if (first.kind !== 'claimed') throw new Error('expected claim');
    database.failCompletionAttempts = 1;
    await expect(completeChatTurn(database as unknown as D1Database, first.claim, { answer: '回答にゃん' }))
      .resolves.toBe(true);
    await expect(claimChatTurn(database as unknown as D1Database, 'conversation-1', 'turn-1'))
      .resolves.toEqual({ kind: 'cached', response: { answer: '回答にゃん' } });
  });
});
