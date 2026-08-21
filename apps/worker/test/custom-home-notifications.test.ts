import { describe, expect, it } from 'vitest';
import { encryptPII } from '../src/security';
import { formatCustomHomeLeadEmail, processCustomHomeNotification } from '../src/custom-home-notifications';

const leadId = '11111111-1111-4111-8111-111111111111';
const env = () => ({ PII_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } as unknown as Env);

function mockDb(initial: { status?: string; attempts?: number; brokenPhone?: boolean } = {}) {
  const state = {
    status: initial.status ?? 'pending',
    attempts: initial.attempts ?? 0,
    nameEnc: '', phoneEnc: '', intakeEnc: '', lastError: null as string | null,
    updatedAt: new Date().toISOString(),
  };
  const calls: string[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('SELECT l.id')) {
                return {
                  id: leadId, contact_name_enc: state.nameEnc, phone_enc: state.phoneEnc,
                  intake_enc: state.intakeEnc, notification_status: state.status,
                  notification_attempts: state.attempts, updated_at: state.updatedAt,
                } as T;
              }
              return null;
            },
            async run() {
              calls.push(sql);
              if (sql.includes("SET notification_status = 'processing'")) {
                if (!['pending', 'failed'].includes(state.status)) return { meta: { changes: 0 } };
                state.status = 'processing'; state.attempts += 1;
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET notification_status = 'pending'") && sql.includes("notification_status = 'processing'")) {
                if (state.status !== 'processing' || args[1] !== state.updatedAt) return { meta: { changes: 0 } };
                state.status = 'pending'; state.updatedAt = new Date().toISOString();
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET notification_status = 'sent'")) state.status = 'sent';
              if (sql.includes("SET notification_status = 'failed'")) {
                state.status = 'failed'; state.lastError = String(args[0]);
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, state, calls };
}

async function seededDb(options: { status?: string; attempts?: number; brokenPhone?: boolean } = {}) {
  const store = mockDb(options);
  store.state.nameEnc = await encryptPII('山田 太郎', env() as Env) as string;
  store.state.phoneEnc = options.brokenPhone
    ? 'not-an-encrypted-value'
    : await encryptPII('09012345678', env() as Env) as string;
  store.state.intakeEnc = await encryptPII(JSON.stringify({ desiredArea: '大阪市', layout: '4LDK' }), env() as Env) as string;
  return store;
}

describe('formatCustomHomeLeadEmail', () => {
  it('writes Orient-facing copy with contact details and intake', () => {
    const email = formatCustomHomeLeadEmail(
      '山田 太郎',
      '09012345678',
      JSON.stringify({ desiredArea: '大阪市', layout: '4LDK' }),
    );
    expect(email.subject).toBe('【オリにゃん】注文住宅のご相談が届きました');
    expect(email.text).toContain('オリエントグループ ご担当者様');
    expect(email.text).toContain('お名前: 山田 太郎');
    expect(email.text).toContain('電話番号: 09012345678');
    expect(email.text).toContain('希望エリア: 大阪市');
    expect(email.text).toContain('希望間取り: 4LDK');
    expect(email.text).toContain('お客様への折り返し連絡をお願いします。');
  });
});

describe('processCustomHomeNotification', () => {
  it('decrypts the lead and sends a plain Japanese email while keeping queue data opaque', async () => {
    const store = await seededDb();
    let sent: { to: string; subject?: string; text: string } | undefined;
    const result = await processCustomHomeNotification(store.db, env(), { leadId }, {
      sender: 'no-reply@orijyu.com', recipient: 'uken.shohei@gmail.com',
      send: async (email) => { sent = { to: email.to, subject: email.subject, text: email.text }; },
    });
    expect(result).toEqual({ disposition: 'ack', status: 'sent', attempt: 1 });
    expect(store.state.status).toBe('sent');
    expect(sent?.to).toBe('uken.shohei@gmail.com');
    expect(sent?.subject).toBe('【オリにゃん】注文住宅のご相談が届きました');
    expect(sent?.text).toContain('山田 太郎');
    expect(sent?.text).toContain('大阪市');
    expect(sent?.text).toContain('オリエントグループ ご担当者様');
    expect(JSON.stringify({ leadId })).not.toContain('山田');
  });

  it('labels unknown land and free-form notes clearly in the notification', async () => {
    const store = await seededDb();
    store.state.intakeEnc = await encryptPII(JSON.stringify({
      landOwnership: 'unknown',
      landSizeNote: '何坪ぐらいか相談したい',
      budgetNote: 'まだわからない',
    }), env() as Env) as string;
    let sentText = '';
    await processCustomHomeNotification(store.db, env(), { leadId }, {
      sender: 'no-reply@orijyu.com', recipient: 'uken.shohei@gmail.com',
      send: async (email) => { sentText = email.text; },
    });
    expect(sentText).toContain('土地: 未定');
    expect(sentText).toContain('土地面積メモ: 何坪ぐらいか相談したい');
    expect(sentText).toContain('予算メモ: まだわからない');
  });

  it('retries a transient send failure without persisting the exception message', async () => {
    const store = await seededDb();
    const result = await processCustomHomeNotification(store.db, env(), { leadId }, {
      sender: 'no-reply@orijyu.com', recipient: 'uken.shohei@gmail.com',
      send: async () => { throw new Error('phone=09012345678 should not be persisted'); },
    });
    expect(result).toEqual({ disposition: 'retry', status: 'failed', attempt: 1 });
    expect(store.state.lastError).toBe('send_failed');
    expect(store.state.lastError).not.toContain('09012345678');
  });

  it('does not resend a lead already marked sent', async () => {
    const store = await seededDb({ status: 'sent', attempts: 1 });
    let sendCount = 0;
    const result = await processCustomHomeNotification(store.db, env(), { leadId }, {
      sender: 'no-reply@orijyu.com', recipient: 'uken.shohei@gmail.com',
      send: async () => { sendCount += 1; },
    });
    expect(result.status).toBe('skipped');
    expect(sendCount).toBe(0);
  });

  it('reclaims a processing lead whose lease expired after a Worker crash', async () => {
    const store = await seededDb({ status: 'processing', attempts: 1 });
    store.state.updatedAt = new Date(Date.now() - 31 * 1000).toISOString();
    let sendCount = 0;
    const result = await processCustomHomeNotification(store.db, env(), { leadId }, {
      sender: 'no-reply@orijyu.com', recipient: 'uken.shohei@gmail.com',
      send: async () => { sendCount += 1; },
    });
    expect(result).toEqual({ disposition: 'ack', status: 'sent', attempt: 2 });
    expect(sendCount).toBe(1);
    expect(store.state.status).toBe('sent');
  });

  it('retries a freshly processing lead instead of acknowledging it forever', async () => {
    const store = await seededDb({ status: 'processing', attempts: 1 });
    const result = await processCustomHomeNotification(store.db, env(), { leadId }, {
      sender: 'no-reply@orijyu.com', recipient: 'uken.shohei@gmail.com', send: async () => undefined,
    });
    expect(result).toEqual({ disposition: 'retry', status: 'skipped', attempt: 1 });
  });

  it('acks malformed or missing payloads without touching the database', async () => {
    const store = await seededDb();
    const result = await processCustomHomeNotification(store.db, env(), { leadId: 'not-an-id' }, {
      sender: 'no-reply@orijyu.com', recipient: 'uken.shohei@gmail.com', send: async () => undefined,
    });
    expect(result).toEqual({ disposition: 'ack', status: 'skipped', attempt: 0 });
    expect(store.calls).toHaveLength(0);
  });
});
