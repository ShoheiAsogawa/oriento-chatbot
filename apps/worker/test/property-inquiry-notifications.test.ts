import { describe, expect, it } from 'vitest';
import { encryptPII } from '../src/security';
import { formatPropertyInquiryEmail, processPropertyInquiryNotification } from '../src/property-inquiry-notifications';

const inquiryId = '22222222-2222-4222-8222-222222222222';
const env = () => ({ PII_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } as unknown as Env);

function mockDb(initial: { status?: string; attempts?: number } = {}) {
  const state = {
    status: initial.status ?? 'pending',
    attempts: initial.attempts ?? 0,
    kind: 'document_request' as const,
    nameEnc: '',
    phoneEnc: '',
    addressEnc: '',
    preferredDatetime: null as string | null,
    propertySummary: JSON.stringify([{ title: 'サンプル物件', url: 'https://orijyu.com/rent/example/' }]),
    lastError: null as string | null,
    updatedAt: new Date().toISOString(),
  };
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('SELECT i.id')) {
                return {
                  id: inquiryId,
                  kind: state.kind,
                  contact_name_enc: state.nameEnc,
                  address_enc: state.addressEnc,
                  preferred_datetime: state.preferredDatetime,
                  property_summary: state.propertySummary,
                  phone_enc: state.phoneEnc,
                  notification_status: state.status,
                  notification_attempts: state.attempts,
                  updated_at: state.updatedAt,
                } as T;
              }
              return null;
            },
            async run() {
              if (sql.includes("SET notification_status = 'processing'")) {
                if (!['pending', 'failed'].includes(state.status)) return { meta: { changes: 0 } };
                state.status = 'processing';
                state.attempts += 1;
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET notification_status = 'sent'")) state.status = 'sent';
              if (sql.includes("SET notification_status = 'failed'")) {
                state.status = 'failed';
                state.lastError = String(args[0]);
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, state };
}

describe('formatPropertyInquiryEmail', () => {
  it('uses a kind-specific subject and includes contact details', () => {
    const email = formatPropertyInquiryEmail({
      kind: 'viewing',
      name: '山田 太郎',
      phone: '09012345678',
      address: '大阪府大阪市北区梅田1-1-1',
      preferredDatetime: '2026-08-28 15:00〜17:00',
      propertySummary: JSON.stringify([{ title: 'サンプル物件', url: 'https://orijyu.com/rent/example/' }]),
    });
    expect(email.subject).toBe('【オリにゃん】見学予約が届きました');
    expect(email.text).toContain('お名前: 山田 太郎');
    expect(email.text).toContain('電話番号: 09012345678');
    expect(email.text).toContain('住所: 大阪府大阪市北区梅田1-1-1');
    expect(email.text).toContain('希望日時: 2026-08-28 15:00〜17:00');
    expect(email.text).toContain('サンプル物件');
  });
});

describe('processPropertyInquiryNotification', () => {
  it('sends once and ignores a second delivery', async () => {
    const store = mockDb();
    store.state.nameEnc = await encryptPII('山田 太郎', env() as Env) as string;
    store.state.phoneEnc = await encryptPII('09012345678', env() as Env) as string;
    store.state.addressEnc = await encryptPII('大阪府大阪市北区梅田1-1-1', env() as Env) as string;
    const sent: Array<{ subject: string }> = [];
    const first = await processPropertyInquiryNotification(store.db, env(), { propertyInquiryId: inquiryId }, {
      sender: 'no-reply@orijyu.com',
      recipient: 'staff@example.com',
      send: async (email) => { sent.push(email); },
    });
    expect(first).toMatchObject({ disposition: 'ack', status: 'sent' });
    store.state.status = 'sent';
    const second = await processPropertyInquiryNotification(store.db, env(), { propertyInquiryId: inquiryId }, {
      sender: 'no-reply@orijyu.com',
      recipient: 'staff@example.com',
      send: async (email) => { sent.push(email); },
    });
    expect(second.status).toBe('skipped');
    expect(sent).toHaveLength(1);
  });
});
