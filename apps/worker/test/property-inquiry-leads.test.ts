import { describe, expect, it } from 'vitest';
import {
  persistPropertyInquiryDraft,
  persistPropertyInquiryLead,
} from '../src/property-inquiry-leads';
import { decryptPII } from '../src/security';

type Customer = { id: string; phoneHash: string; nameEnc: string | null; phoneEnc: string | null };
type Inquiry = {
  id: string;
  conversationId: string;
  kind: string;
  customerId: string | null;
  nameEnc: string | null;
  addressEnc: string | null;
  datetime: string | null;
  summary: string | null;
  status: string;
};

function mockDb() {
  const customers: Customer[] = [];
  const inquiries: Inquiry[] = [];
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async <T>() => {
        if (sql.includes('FROM customers WHERE phone_hash')) {
          const row = customers.find((item) => item.phoneHash === args[0]);
          return (row ? { id: row.id } : null) as T | null;
        }
        if (sql.includes("notification_status = 'collecting'")) {
          const row = [...inquiries].reverse().find((item) => (
            item.conversationId === args[0] && item.status === 'collecting'
          ));
          return (row ? {
            id: row.id,
            kind: row.kind,
            contact_name_enc: row.nameEnc,
            address_enc: row.addressEnc,
            preferred_datetime: row.datetime,
            property_summary: row.summary,
            notification_status: row.status,
          } : null) as T | null;
        }
        if (sql.includes('notification_status !=') && sql.includes('FROM property_inquiries')) {
          const row = [...inquiries].reverse().find((item) => (
            item.conversationId === args[0] && item.kind === args[1] && item.status !== 'collecting'
          ));
          return (row ? {
            id: row.id,
            kind: row.kind,
            contact_name_enc: row.nameEnc,
            address_enc: row.addressEnc,
            preferred_datetime: row.datetime,
            property_summary: row.summary,
            notification_status: row.status,
          } : null) as T | null;
        }
        return null;
      },
      run: async () => {
        if (sql.startsWith('INSERT OR IGNORE INTO customers')) {
          const [id, nameEnc, phoneEnc, phoneHash] = args as [string, string, string, string];
          if (!customers.some((item) => item.phoneHash === phoneHash)) {
            customers.push({ id, nameEnc, phoneEnc, phoneHash });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        }
        if (sql.includes('UPDATE customers SET')) {
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes('INSERT OR IGNORE INTO conversation_customers')) {
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes('INSERT') && sql.includes('property_inquiries')) {
          if (sql.includes("'collecting'")) {
            const [id, conversationId, kind, nameEnc, addressEnc, datetime, summary] = args as [
              string, string, string, string | null, string | null, string | null, string | null,
            ];
            inquiries.push({
              id, conversationId, kind, customerId: null, nameEnc, addressEnc, datetime, summary, status: 'collecting',
            });
            return { success: true, meta: { changes: 1 } };
          }
          const [id, conversationId, customerId, kind, nameEnc, addressEnc, datetime, summary] = args as [
            string, string, string, string, string | null, string | null, string | null, string | null,
          ];
          inquiries.push({
            id, conversationId, kind, customerId, nameEnc, addressEnc, datetime, summary, status: 'pending',
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE property_inquiries SET')) {
          const inquiryId = args.at(-1) as string;
          const row = inquiries.find((item) => item.id === inquiryId);
          if (!row) return { success: true, meta: { changes: 0 } };
          if (sql.includes('customer_id')) {
            row.customerId = args[0] as string;
            row.kind = args[1] as string;
            row.nameEnc = args[2] as string;
            row.addressEnc = args[3] as string | null;
            row.datetime = args[4] as string | null;
            row.summary = args[5] as string | null;
            if (!sql.includes('CASE WHEN notification_status')) row.status = 'pending';
            else if (row.status !== 'sent') row.status = 'pending';
          } else {
            row.kind = args[0] as string;
            row.nameEnc = (args[1] as string | null) || row.nameEnc;
            row.addressEnc = (args[2] as string | null) || row.addressEnc;
            row.datetime = (args[3] as string | null) || row.datetime;
            row.summary = args[4] as string | null;
          }
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 1 } };
      },
    }),
  });
  const db = { prepare, batch: async () => [] } as unknown as D1Database;
  return { db, customers, inquiries };
}

function env() {
  return {
    HASH_SALT: 'test-salt',
    PII_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  } as unknown as Env;
}

describe('persistPropertyInquiryLead', () => {
  it('reuses a collecting draft when the visitor finishes the inquiry', async () => {
    const store = mockDb();
    await persistPropertyInquiryDraft(store.db, env(), {
      conversationId: 'conversation-1',
      kind: 'document_request',
      name: '山田 太郎',
      address: '大阪府大阪市北区梅田1-1-1',
    });
    const result = await persistPropertyInquiryLead(store.db, env(), {
      conversationId: 'conversation-1',
      kind: 'document_request',
      contact: { name: '山田 太郎', phone: '090-1234-5678', address: '大阪府大阪市北区梅田1-1-1' },
    });
    expect(result.created).toBe(false);
    expect(result.queueRequired).toBe(true);
    expect(store.inquiries).toHaveLength(1);
    expect(store.inquiries[0]?.status).toBe('pending');
  });

  it('does not insert a second lead for the same conversation and kind', async () => {
    const store = mockDb();
    const input = {
      conversationId: 'conversation-2',
      kind: 'document_request' as const,
      contact: { name: '山田 太郎', phone: '09012345678', address: '大阪府大阪市北区梅田1-1-1' },
    };
    const first = await persistPropertyInquiryLead(store.db, env(), input);
    store.inquiries[0]!.status = 'sent';
    const second = await persistPropertyInquiryLead(store.db, env(), input);
    expect(second.inquiryId).toBe(first.inquiryId);
    expect(second.created).toBe(false);
    expect(second.queueRequired).toBe(false);
    expect(store.inquiries).toHaveLength(1);
  });

  it('still opens a viewing lead after a document request in the same conversation', async () => {
    const store = mockDb();
    await persistPropertyInquiryLead(store.db, env(), {
      conversationId: 'conversation-3',
      kind: 'document_request',
      contact: { name: '山田 太郎', phone: '09012345678', address: '大阪府大阪市北区梅田1-1-1' },
    });
    store.inquiries[0]!.status = 'sent';
    const viewing = await persistPropertyInquiryLead(store.db, env(), {
      conversationId: 'conversation-3',
      kind: 'viewing',
      contact: { name: '山田 太郎', phone: '09012345678', address: '大阪府大阪市北区梅田1-1-1' },
      preferredDatetime: '2026-08-28 15:00',
    });
    expect(viewing.created).toBe(true);
    expect(store.inquiries).toHaveLength(2);
  });

  it('stores unusual phone formats instead of rejecting the lead', async () => {
    const store = mockDb();
    const result = await persistPropertyInquiryLead(store.db, env(), {
      conversationId: 'conversation-4',
      kind: 'phone',
      contact: { name: 'テスト', phone: '090ー1234ー5678' },
    });
    expect(result.created).toBe(true);
    expect(await decryptPII(store.customers[0]!.phoneEnc, env())).toBe('09012345678');
  });
});
