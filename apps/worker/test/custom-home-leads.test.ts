import { describe, expect, it } from 'vitest';
import { decryptPII } from '../src/security';
import { persistCustomHomeDraft, persistCustomHomeLead } from '../src/custom-home-leads';

type Customer = { id: string; phoneHash: string; nameEnc: string | null; phoneEnc: string | null };
type Lead = { id: string; conversationId: string; customerId: string | null; intakeEnc: string; nameEnc?: string | null };

function mockDb() {
  const customers: Customer[] = [];
  const leads: Lead[] = [];
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async <T>() => {
        if (sql.includes('FROM customers WHERE phone_hash')) {
          const row = customers.find((item) => item.phoneHash === args[0]);
          return (row ? { id: row.id } : null) as T | null;
        }
        if (sql.includes('FROM custom_home_leads WHERE conversation_id')) {
          const row = leads.find((item) => item.conversationId === args[0]);
          return (row ? { id: row.id, notification_status: 'collecting', contact_name_enc: row.nameEnc || null } : null) as T | null;
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
        if (sql.includes('INSERT') && sql.includes('custom_home_leads')) {
          if (sql.includes('(id, conversation_id, contact_name_enc')) {
            const [id, conversationId, nameEnc, intakeEnc] = args as [string, string, string, string];
            leads.push({ id, conversationId, customerId: null, intakeEnc, nameEnc });
            return { success: true, meta: { changes: 1 } };
          }
          const [id, conversationId, customerId, ...rest] = args as [string, string, string | null, ...string[]];
          const intakeEnc = rest.at(-1) as string;
          const nameEnc = rest.length > 1 ? rest.at(-2) as string : null;
          if (leads.some((item) => item.conversationId === conversationId)) {
            return { success: true, meta: { changes: 0 } };
          }
          leads.push({ id, conversationId, customerId, intakeEnc, nameEnc });
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 1 } };
      },
    }),
  });
  const db = {
    prepare,
    batch: async () => [],
  } as unknown as D1Database;
  return { db, customers, leads };
}

function env() {
  return {
    HASH_SALT: 'test-salt',
    PII_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  } as unknown as Env;
}

describe('persistCustomHomeLead', () => {
  it('encrypts contact/intake data and returns an opaque queue payload', async () => {
    const store = mockDb();
    const result = await persistCustomHomeLead(store.db, env(), {
      conversationId: 'conversation-1',
      contact: { name: '山田 太郎', phone: '+81 90-1234-5678' },
      intake: { landOwnership: 'owned', landLocation: '大阪市', layout: '4LDK', budgetYen: 40_000_000 },
    });

    expect(result.queue).toEqual({ leadId: result.leadId });
    expect(result.customerId).toBe(store.customers[0]!.id);
    expect(store.leads[0]!.intakeEnc).not.toContain('大阪市');
    expect(await decryptPII(store.customers[0]!.nameEnc, env())).toBe('山田 太郎');
    expect(await decryptPII(store.customers[0]!.phoneEnc, env())).toBe('09012345678');
    expect(result.created).toBe(true);
  });

  it.each(['+81 90-1234-5678', '0081-90-1234-5678', '81 90 1234 5678'])('accepts international phone notation: %s', async (phone) => {
    const store = mockDb();
    const result = await persistCustomHomeLead(store.db, env(), {
      conversationId: `conversation-${phone}`,
      contact: { name: '山田 太郎', phone },
      intake: {},
    });
    expect(result.created).toBe(true);
    expect(await decryptPII(store.customers[0]!.phoneEnc, env())).toBe('09012345678');
  });

  it('normalizes control characters before storing intake text', async () => {
    const store = mockDb();
    await persistCustomHomeLead(store.db, env(), {
      conversationId: 'conversation-control-chars',
      contact: { name: '山田\n太郎', phone: '09012345678' },
      intake: { priorities: '断熱\u0000性能\n家事動線' },
    });
    expect(await decryptPII(store.customers[0]!.nameEnc, env())).toBe('山田 太郎');
    expect(await decryptPII(store.leads[0]!.intakeEnc, env())).toContain('断熱 性能 家事動線');
  });

  it('retains safe notes when a visitor is unsure about land size or budget', async () => {
    const store = mockDb();
    const result = await persistCustomHomeLead(store.db, env(), {
      conversationId: 'conversation-unknown-values',
      contact: { name: '山田 太郎', phone: '09012345678' },
      intake: {
        landOwnership: 'unknown',
        landSizeNote: '何坪ぐらいがよいか相談したい',
        budgetNote: 'まだわからない',
      },
    });

    const intake = await decryptPII(store.leads[0]!.intakeEnc, env());
    expect(result.created).toBe(true);
    expect(intake).toContain('landSizeNote');
    expect(intake).toContain('何坪ぐらいがよいか相談したい');
    expect(intake).toContain('budgetNote');
    expect(intake).toContain('まだわからない');
  });

  it('deduplicates a repeated conversation and phone number', async () => {
    const store = mockDb();
    const input = {
      conversationId: 'conversation-2',
      contact: { name: '山田太郎', phone: '09012345678' },
      intake: { desiredArea: '堺市' },
    };
    const first = await persistCustomHomeLead(store.db, env(), input);
    const second = await persistCustomHomeLead(store.db, env(), input);
    expect(second.leadId).toBe(first.leadId);
    expect(second.customerId).toBe(first.customerId);
    expect(second.created).toBe(false);
    expect(store.customers).toHaveLength(1);
    expect(store.leads).toHaveLength(1);
  });

  it('reuses an encrypted draft name when the final phone turn omits the name', async () => {
    const store = mockDb();
    await persistCustomHomeDraft(store.db, env(), {
      conversationId: 'conversation-phone-only',
      name: '鈴木 一郎',
      intake: { layout: '3LDK' },
    });
    const result = await persistCustomHomeLead(store.db, env(), {
      conversationId: 'conversation-phone-only',
      contact: { phone: '09012345678' },
      intake: { layout: '3LDK', budgetYen: 35_000_000 },
    });
    expect(result.queueRequired).toBe(true);
    expect(result.customerId).toBe(store.customers[0]!.id);
  });

  it('stores unusual phone formats instead of rejecting the lead', async () => {
    const store = mockDb();
    const result = await persistCustomHomeLead(store.db, env(), {
      conversationId: 'conversation-3',
      contact: { name: 'テスト', phone: '090ー1234ー5678' },
      intake: {},
    });
    expect(result.created).toBe(true);
    expect(await decryptPII(store.customers[0]!.phoneEnc, env())).toBe('09012345678');
  });

  it('stores the name step encrypted as a collecting draft', async () => {
    const store = mockDb();
    const result = await persistCustomHomeDraft(store.db, env(), {
      conversationId: 'conversation-draft',
      name: '佐藤 花子',
      intake: { desiredArea: '和歌山県' },
    });
    expect(result.created).toBe(true);
    expect(store.leads).toHaveLength(1);
    expect(store.leads[0]!.intakeEnc).not.toContain('和歌山県');
  });
});
