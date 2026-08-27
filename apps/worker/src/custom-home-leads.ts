import { decryptPII, encryptPII, sha256 } from './security';
import { normalizePhoneNumber } from './phone';

/**
 * The fields that may be retained as the custom-home consultation summary.
 * Contact details are deliberately not part of this shape and must be passed
 * through `contact` only.
 */
export type CustomHomeLeadIntake = {
  landOwnership?: 'owned' | 'not_owned' | 'unknown';
  landLocation?: string;
  landSizeSqm?: number;
  landSizeNote?: string;
  desiredArea?: string;
  householdSize?: number;
  householdDescription?: string;
  layout?: string;
  budgetYen?: number;
  budgetNote?: string;
  timing?: string;
  priorities?: string;
};

export type CustomHomeLeadInput = {
  conversationId: string;
  contact: { name?: string; phone: string };
  intake: CustomHomeLeadIntake;
};

export type CustomHomeLeadQueuePayload = { leadId: string };

export type CustomHomeLeadResult = {
  leadId: string;
  customerId: string;
  queue: CustomHomeLeadQueuePayload;
  created: boolean;
  queueRequired: boolean;
};

export type CustomHomeDraftInput = {
  conversationId: string;
  name: string;
  intake: CustomHomeLeadIntake;
};

const INTAKE_KEYS: (keyof CustomHomeLeadIntake)[] = [
  'landOwnership',
  'landLocation',
  'landSizeSqm',
  'landSizeNote',
  'desiredArea',
  'householdSize',
  'householdDescription',
  'layout',
  'budgetYen',
  'budgetNote',
  'timing',
  'priorities',
];

export class CustomHomeLeadValidationError extends Error {
  constructor() {
    super('注文住宅のお問い合わせ情報を確認できませんでした');
    this.name = 'CustomHomeLeadValidationError';
  }
}

function normalizePhone(input: string) {
  return normalizePhoneNumber(input, { lenient: true }) || '';
}

function safeIntake(input: CustomHomeLeadIntake) {
  const result: Record<string, string | number> = {};
  for (const key of INTAKE_KEYS) {
    const value = input[key];
    if (typeof value === 'string') {
      const trimmed = value
        .normalize('NFKC')
        .replace(/[\u0000-\u001F\u007F]/gu, ' ')
        .trim()
        .slice(0, 500);
      if (trimmed) result[key] = trimmed;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}

function safeText(value: string | undefined, maxLength: number) {
  return value?.normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .trim()
    .slice(0, maxLength) || '';
}

/**
 * Stores a custom-home lead without putting contact details in conversation
 * messages, audit events, or the queue. The queue payload is intentionally an
 * opaque ID; a consumer can read and decrypt the record when it sends mail.
 */
export async function persistCustomHomeLead(
  db: D1Database,
  env: Pick<Env, 'HASH_SALT' | 'PII_ENCRYPTION_KEY'>,
  input: CustomHomeLeadInput,
): Promise<CustomHomeLeadResult> {
  const conversationId = safeText(input.conversationId, 100);
  const phone = normalizePhone(input.contact.phone);
  if (!conversationId || !phone) {
    throw new CustomHomeLeadValidationError();
  }

  const existingConversationLead = await db.prepare(
    'SELECT id, notification_status, contact_name_enc FROM custom_home_leads WHERE conversation_id = ? LIMIT 1',
  ).bind(conversationId).first<{ id: string; notification_status: string; contact_name_enc: string | null }>();
  const name = safeText(input.contact.name, 100) || await decryptPII(existingConversationLead?.contact_name_enc || null, env as Env) || '';
  if (!name) throw new CustomHomeLeadValidationError();

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

  // A concurrent request may have won the phone-hash unique constraint.
  const resolvedCustomer = await db.prepare(
    'SELECT id FROM customers WHERE phone_hash = ? LIMIT 1',
  ).bind(phoneHash).first<{ id: string }>();
  if (!resolvedCustomer?.id) throw new Error('注文住宅のお問い合わせを保存できませんでした');

  const intakeEnc = await encryptPII(JSON.stringify(safeIntake(input.intake)), env as Env);
  const nameEncForLead = await encryptPII(name, env as Env);
  const leadId = crypto.randomUUID();
  if (existingConversationLead) {
    await db.prepare(
      `UPDATE custom_home_leads SET customer_id = ?, contact_name_enc = ?, intake_enc = ?,
        notification_status = CASE WHEN notification_status = 'sent' THEN notification_status ELSE 'pending' END,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(resolvedCustomer.id, nameEncForLead, intakeEnc, existingConversationLead.id).run();
    await db.batch([
      db.prepare(
        'INSERT OR IGNORE INTO conversation_customers (conversation_id, customer_id) VALUES (?, ?)',
      ).bind(conversationId, resolvedCustomer.id),
      db.prepare('UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(resolvedCustomer.id),
    ]);
    return {
      leadId: existingConversationLead.id,
      customerId: resolvedCustomer.id,
      queue: { leadId: existingConversationLead.id },
      created: false,
      queueRequired: existingConversationLead.notification_status !== 'sent',
    };
  }
  const inserted = await db.prepare(
    `INSERT OR IGNORE INTO custom_home_leads
      (id, conversation_id, customer_id, contact_name_enc, intake_enc, notification_status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
  ).bind(leadId, conversationId, resolvedCustomer.id, nameEncForLead, intakeEnc).run();

  const existingLead = inserted.meta.changes === 0
    ? await db.prepare('SELECT id FROM custom_home_leads WHERE conversation_id = ? LIMIT 1')
      .bind(conversationId).first<{ id: string }>()
    : null;
  const resolvedLeadId = existingLead?.id || leadId;
  if (!resolvedLeadId) throw new Error('注文住宅のお問い合わせを保存できませんでした');

  await db.batch([
    db.prepare(
      'INSERT OR IGNORE INTO conversation_customers (conversation_id, customer_id) VALUES (?, ?)',
    ).bind(conversationId, resolvedCustomer.id),
    db.prepare('UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(resolvedCustomer.id),
  ]);

  return {
    leadId: resolvedLeadId,
    customerId: resolvedCustomer.id,
    queue: { leadId: resolvedLeadId },
    created: inserted.meta.changes !== 0,
    queueRequired: true,
  };
}

/** Saves the name while the visitor is still answering the intake questions. */
export async function persistCustomHomeDraft(
  db: D1Database,
  env: Pick<Env, 'PII_ENCRYPTION_KEY'>,
  input: CustomHomeDraftInput,
) {
  const conversationId = safeText(input.conversationId, 100);
  const name = safeText(input.name, 100);
  if (!conversationId || !name) throw new CustomHomeLeadValidationError();
  const intakeEnc = await encryptPII(JSON.stringify(safeIntake(input.intake)), env as Env);
  const nameEnc = await encryptPII(name, env as Env);
  const existing = await db.prepare(
    'SELECT id FROM custom_home_leads WHERE conversation_id = ? LIMIT 1',
  ).bind(conversationId).first<{ id: string }>();
  if (existing) {
    await db.prepare(
      `UPDATE custom_home_leads SET contact_name_enc = ?, intake_enc = ?,
        notification_status = CASE WHEN notification_status IN ('sent', 'pending') THEN notification_status ELSE 'collecting' END,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(nameEnc, intakeEnc, existing.id).run();
    return { leadId: existing.id, created: false };
  }
  const leadId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO custom_home_leads
      (id, conversation_id, contact_name_enc, intake_enc, notification_status)
     VALUES (?, ?, ?, ?, 'collecting')`,
  ).bind(leadId, conversationId, nameEnc, intakeEnc).run();
  return { leadId, created: true };
}
