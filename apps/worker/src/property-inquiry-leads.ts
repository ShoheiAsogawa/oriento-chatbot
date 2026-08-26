import { decryptPII, encryptPII, sha256 } from './security';
import type { PropertyInquiryKind } from './property-inquiry';

export type CitedProperty = {
  title: string;
  url: string;
};

export type PropertyInquiryLeadInput = {
  conversationId: string;
  kind: PropertyInquiryKind;
  contact: { name?: string; phone: string; address?: string };
  preferredDatetime?: string;
  properties?: CitedProperty[];
};

export type PropertyInquiryDraftInput = {
  conversationId: string;
  kind: PropertyInquiryKind;
  name?: string;
  address?: string;
  preferredDatetime?: string;
  properties?: CitedProperty[];
};

export type PropertyInquiryQueuePayload = { propertyInquiryId: string };

export type PropertyInquiryLeadResult = {
  inquiryId: string;
  customerId: string;
  queue: PropertyInquiryQueuePayload;
  created: boolean;
  queueRequired: boolean;
};

export class PropertyInquiryValidationError extends Error {
  constructor() {
    super('物件のお問い合わせ情報を確認できませんでした');
    this.name = 'PropertyInquiryValidationError';
  }
}

function normalizePhone(input: string) {
  const normalized = input.normalize('NFKC').trim();
  const digits = normalized.replace(/\D/gu, '');
  const japanese = normalized.startsWith('+81') || normalized.startsWith('0081') || /^81[789]0/u.test(digits)
    ? `0${digits.slice(digits.startsWith('0081') ? 4 : 2)}`
    : digits;
  if (/^0[789]0/u.test(japanese)) return /^0[789]0\d{8}$/u.test(japanese) ? japanese : '';
  return /^0[1-9]\d{8,9}$/u.test(japanese) ? japanese : '';
}

function safeText(value: string | undefined, maxLength: number) {
  return value?.normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .trim()
    .slice(0, maxLength) || '';
}

function safeProperties(properties: CitedProperty[] | undefined) {
  return (properties || [])
    .map((item) => ({
      title: safeText(item.title, 120),
      url: safeText(item.url, 500),
    }))
    .filter((item) => item.title && item.url.startsWith('https://'))
    .slice(0, 8);
}

function propertiesFromSummary(value: string | null | undefined): CitedProperty[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return safeProperties(parsed as CitedProperty[]);
  } catch {
    return [];
  }
}

async function upsertCustomerByPhone(
  db: D1Database,
  env: Pick<Env, 'HASH_SALT' | 'PII_ENCRYPTION_KEY'>,
  name: string,
  phone: string,
) {
  const phoneHash = await sha256(`${env.HASH_SALT}:${phone}`);
  const phoneEnc = await encryptPII(phone, env as Env);
  const nameEnc = await encryptPII(name, env as Env);
  const now = new Date().toISOString();
  const existingCustomer = await db.prepare(
    'SELECT id FROM customers WHERE phone_hash = ? LIMIT 1',
  ).bind(phoneHash).first<{ id: string }>();
  const customerId = existingCustomer?.id || crypto.randomUUID();

  if (existingCustomer) {
    await db.prepare(
      `UPDATE customers SET name_enc = COALESCE(?, name_enc), phone_enc = COALESCE(?, phone_enc),
        phone_last4 = ?, consent_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(nameEnc, phoneEnc, phone.slice(-4), now, customerId).run();
  } else {
    await db.prepare(
      `INSERT OR IGNORE INTO customers
        (id, name_enc, phone_enc, phone_hash, phone_last4, consent_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(customerId, nameEnc, phoneEnc, phoneHash, phone.slice(-4), now).run();
  }

  const resolvedCustomer = await db.prepare(
    'SELECT id FROM customers WHERE phone_hash = ? LIMIT 1',
  ).bind(phoneHash).first<{ id: string }>();
  if (!resolvedCustomer?.id) throw new Error('物件のお問い合わせを保存できませんでした');
  return resolvedCustomer.id;
}

type StoredInquiry = {
  id: string;
  kind: PropertyInquiryKind;
  contact_name_enc: string | null;
  address_enc: string | null;
  preferred_datetime: string | null;
  property_summary: string | null;
  notification_status: string;
};

async function loadCollectingInquiry(db: D1Database, conversationId: string) {
  return db.prepare(
    `SELECT id, kind, contact_name_enc, address_enc, preferred_datetime, property_summary, notification_status
     FROM property_inquiries
     WHERE conversation_id = ? AND notification_status = 'collecting'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
  ).bind(conversationId).first<StoredInquiry>();
}

async function loadReusableInquiry(db: D1Database, conversationId: string, kind: PropertyInquiryKind) {
  return db.prepare(
    `SELECT id, kind, contact_name_enc, address_enc, preferred_datetime, property_summary, notification_status
     FROM property_inquiries
     WHERE conversation_id = ? AND kind = ? AND notification_status != 'collecting'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
  ).bind(conversationId, kind).first<StoredInquiry>();
}

export async function loadRecentCitedProperties(db: D1Database, conversationId: string): Promise<CitedProperty[]> {
  const result = await db.prepare(`
    SELECT c.source_title, c.source_url
    FROM citations c
    INNER JOIN messages m ON m.id = c.message_id
    WHERE m.conversation_id = ?
      AND c.source_url IS NOT NULL
    ORDER BY m.created_at DESC, m.rowid DESC
    LIMIT 20
  `).bind(conversationId).all<{ source_title: string | null; source_url: string | null }>();
  const seen = new Set<string>();
  const properties: CitedProperty[] = [];
  for (const row of result.results || []) {
    const url = safeText(row.source_url || '', 500);
    const title = safeText(row.source_title || '', 120);
    if (!url.startsWith('https://') || seen.has(url)) continue;
    seen.add(url);
    properties.push({ title: title || url, url });
    if (properties.length >= 6) break;
  }
  return properties;
}

export async function persistPropertyInquiryDraft(
  db: D1Database,
  env: Pick<Env, 'PII_ENCRYPTION_KEY'>,
  input: PropertyInquiryDraftInput,
) {
  const conversationId = safeText(input.conversationId, 100);
  const name = safeText(input.name, 100);
  const address = safeText(input.address, 120);
  const preferredDatetime = safeText(input.preferredDatetime, 80);
  if (!conversationId) throw new PropertyInquiryValidationError();
  const existing = await loadCollectingInquiry(db, conversationId);
  const nameEnc = name ? await encryptPII(name, env as Env) : existing?.contact_name_enc || null;
  const addressEnc = address ? await encryptPII(address, env as Env) : existing?.address_enc || null;
  const datetime = preferredDatetime || existing?.preferred_datetime || null;
  const propertySummary = JSON.stringify(
    safeProperties(input.properties).length
      ? safeProperties(input.properties)
      : propertiesFromSummary(existing?.property_summary),
  );
  if (existing) {
    await db.prepare(
      `UPDATE property_inquiries SET kind = ?, contact_name_enc = COALESCE(?, contact_name_enc),
        address_enc = COALESCE(?, address_enc), preferred_datetime = COALESCE(?, preferred_datetime),
        property_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(input.kind, nameEnc, addressEnc, datetime, propertySummary, existing.id).run();
    return { inquiryId: existing.id, created: false };
  }
  const inquiryId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO property_inquiries
      (id, conversation_id, kind, contact_name_enc, address_enc, preferred_datetime, property_summary, notification_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'collecting')`,
  ).bind(inquiryId, conversationId, input.kind, nameEnc, addressEnc, datetime, propertySummary).run();
  return { inquiryId, created: true };
}

export async function persistPropertyInquiryLead(
  db: D1Database,
  env: Pick<Env, 'HASH_SALT' | 'PII_ENCRYPTION_KEY'>,
  input: PropertyInquiryLeadInput,
): Promise<PropertyInquiryLeadResult> {
  const conversationId = safeText(input.conversationId, 100);
  const phone = normalizePhone(input.contact.phone);
  if (!conversationId || !/^0\d{9,10}$/u.test(phone)) {
    throw new PropertyInquiryValidationError();
  }
  const existing = await loadCollectingInquiry(db, conversationId);
  const name = safeText(input.contact.name, 100)
    || await decryptPII(existing?.contact_name_enc || null, env as Env)
    || '';
  const address = safeText(input.contact.address, 120)
    || await decryptPII(existing?.address_enc || null, env as Env)
    || '';
  if (!name) throw new PropertyInquiryValidationError();
  if (input.kind !== 'phone' && !address) throw new PropertyInquiryValidationError();
  if (input.kind === 'viewing' && !safeText(input.preferredDatetime, 80) && !existing?.preferred_datetime) {
    throw new PropertyInquiryValidationError();
  }

  const customerId = await upsertCustomerByPhone(db, env, name, phone);
  const nameEnc = await encryptPII(name, env as Env);
  const addressEnc = address ? await encryptPII(address, env as Env) : existing?.address_enc || null;
  const datetime = safeText(input.preferredDatetime, 80) || existing?.preferred_datetime || null;
  const properties = safeProperties(input.properties);
  const propertySummary = JSON.stringify(properties.length ? properties : propertiesFromSummary(existing?.property_summary));

  await db.prepare(
    'INSERT OR IGNORE INTO conversation_customers (conversation_id, customer_id) VALUES (?, ?)',
  ).bind(conversationId, customerId).run();
  await db.prepare('UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(customerId).run();

  if (existing) {
    await db.prepare(
      `UPDATE property_inquiries SET customer_id = ?, kind = ?, contact_name_enc = ?, address_enc = ?,
        preferred_datetime = ?, property_summary = ?, notification_status = 'pending',
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(customerId, input.kind, nameEnc, addressEnc, datetime, propertySummary, existing.id).run();
    return {
      inquiryId: existing.id,
      customerId,
      queue: { propertyInquiryId: existing.id },
      created: false,
      queueRequired: true,
    };
  }

  const reusable = await loadReusableInquiry(db, conversationId, input.kind);
  if (reusable) {
    await db.prepare(
      `UPDATE property_inquiries SET customer_id = ?, kind = ?, contact_name_enc = ?, address_enc = ?,
        preferred_datetime = ?, property_summary = ?,
        notification_status = CASE WHEN notification_status = 'sent' THEN notification_status ELSE 'pending' END,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(customerId, input.kind, nameEnc, addressEnc, datetime, propertySummary, reusable.id).run();
    return {
      inquiryId: reusable.id,
      customerId,
      queue: { propertyInquiryId: reusable.id },
      created: false,
      queueRequired: reusable.notification_status !== 'sent',
    };
  }

  const inquiryId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO property_inquiries
      (id, conversation_id, customer_id, kind, contact_name_enc, address_enc, preferred_datetime,
       property_summary, notification_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  ).bind(inquiryId, conversationId, customerId, input.kind, nameEnc, addressEnc, datetime, propertySummary).run();
  return {
    inquiryId,
    customerId,
    queue: { propertyInquiryId: inquiryId },
    created: true,
    queueRequired: true,
  };
}
