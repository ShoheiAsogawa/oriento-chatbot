import { decryptPII } from './security';

/** The queue deliberately carries only this opaque identifier. */
export type CustomHomeNotificationPayload = { leadId: string };

export type CustomHomeEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

export type CustomHomeNotificationResult = {
  disposition: 'ack' | 'retry';
  status: 'sent' | 'skipped' | 'failed';
  attempt: number;
};

export type CustomHomeNotificationOptions = {
  /** Kept injectable so tests and the Worker Email binding use the same code. */
  send: (email: CustomHomeEmail) => Promise<unknown>;
  recipient: string;
  sender: string;
  maxAttempts?: number;
};

type LeadRow = {
  id: string;
  contact_name_enc: string | null;
  phone_enc: string | null;
  intake_enc: string;
  notification_status: string;
  notification_attempts: number;
  updated_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DEFAULT_MAX_ATTEMPTS = 5;
// Email delivery normally finishes in seconds. Keeping this short allows the
// same Queue message to reclaim a lead if a Worker disappears after claiming
// it, while still avoiding a concurrent duplicate send.
const PROCESSING_LEASE_MS = 30 * 1000;

function isPayload(value: unknown): value is CustomHomeNotificationPayload {
  if (!value || typeof value !== 'object') return false;
  const leadId = (value as { leadId?: unknown }).leadId;
  return typeof leadId === 'string' && UUID.test(leadId);
}

function safeDisplay(value: unknown, max = 500) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
    .replace(/\r?\n/gu, ' ')
    .trim()
    .slice(0, max);
}

function displayIntake(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const labels: Record<string, string> = {
      landOwnership: '土地', landLocation: '土地の場所', landSizeSqm: '土地面積',
      desiredArea: '希望エリア', householdSize: '世帯人数', householdDescription: '家族構成',
      layout: '希望間取り', budgetYen: '予算', timing: '入居時期', priorities: 'こだわり',
    };
    const lines: string[] = [];
    for (const [key, label] of Object.entries(labels)) {
      const raw = parsed[key];
      if (typeof raw === 'string' || typeof raw === 'number') {
        const shown = safeDisplay(String(raw));
        if (shown) lines.push(`${label}: ${shown}`);
      }
    }
    return lines.length ? lines.join('\n') : '（未入力）';
  } catch {
    return '（内容を読み取れませんでした）';
  }
}

function safeFailureCode(error: unknown): 'decrypt_failed' | 'send_failed' {
  // Never return or persist an exception message: it could contain contact data.
  return error instanceof Error && error.name === 'OperationError' ? 'decrypt_failed' : 'send_failed';
}

/**
 * Sends one custom-home lead notification. It is safe for at-least-once queue
 * delivery: the lead is claimed atomically and already-sent leads are ignored.
 * No contact data is read from, or written to, the queue payload or status fields.
 */
export async function processCustomHomeNotification(
  db: D1Database,
  env: Pick<Env, 'PII_ENCRYPTION_KEY'>,
  payload: unknown,
  options: CustomHomeNotificationOptions,
): Promise<CustomHomeNotificationResult> {
  if (!isPayload(payload)) return { disposition: 'ack', status: 'skipped', attempt: 0 };
  const maxAttempts = Math.max(1, Math.min(10, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  const lead = await db.prepare(
    `SELECT l.id, l.contact_name_enc, c.phone_enc, l.intake_enc,
       l.notification_status, l.notification_attempts, l.updated_at
     FROM custom_home_leads l
     LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.id = ? LIMIT 1`,
  ).bind(payload.leadId).first<LeadRow>();
  if (!lead) return { disposition: 'ack', status: 'skipped', attempt: 0 };
  if (lead.notification_status === 'sent' || lead.notification_status === 'collecting') {
    return { disposition: 'ack', status: 'skipped', attempt: lead.notification_attempts };
  }
  if (lead.notification_status === 'processing') {
    // A Worker can disappear after claiming a message. Reclaim only an
    // expired lease, and include the observed timestamp in the conditional
    // update so a fresh processor can never be reset underneath it.
    const updatedAt = Date.parse(lead.updated_at);
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt < PROCESSING_LEASE_MS) {
      return { disposition: 'retry', status: 'skipped', attempt: lead.notification_attempts };
    }
    const reclaimed = await db.prepare(
      `UPDATE custom_home_leads SET notification_status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND notification_status = 'processing' AND updated_at = ?`,
    ).bind(payload.leadId, lead.updated_at).run();
    if (!reclaimed.meta.changes) {
      return { disposition: 'ack', status: 'skipped', attempt: lead.notification_attempts };
    }
  }
  if (lead.notification_attempts >= maxAttempts) {
    return { disposition: 'ack', status: 'failed', attempt: lead.notification_attempts };
  }

  const claimed = await db.prepare(
    `UPDATE custom_home_leads
     SET notification_status = 'processing', notification_attempts = notification_attempts + 1,
         notification_last_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND notification_status IN ('pending', 'failed')
       AND notification_attempts < ?`,
  ).bind(payload.leadId, maxAttempts).run();
  if (!claimed.meta.changes) return { disposition: 'ack', status: 'skipped', attempt: lead.notification_attempts };
  const attempt = lead.notification_attempts + 1;

  try {
    const [name, phone, intake] = await Promise.all([
      decryptPII(lead.contact_name_enc, env as Env),
      decryptPII(lead.phone_enc, env as Env),
      decryptPII(lead.intake_enc, env as Env),
    ]);
    if (!name || !phone || !intake) throw new Error('missing_encrypted_field');
    await options.send({
      from: options.sender,
      to: options.recipient,
      subject: '【注文住宅】新しいご相談が届きました',
      text: [
        '注文住宅のお問い合わせ', '', `お名前: ${safeDisplay(name, 100)}`,
        `電話番号: ${safeDisplay(phone, 30)}`, '', 'ご相談内容:', displayIntake(intake),
      ].join('\n'),
    });
    await db.prepare(
      `UPDATE custom_home_leads SET notification_status = 'sent', notified_at = CURRENT_TIMESTAMP,
         notification_last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(payload.leadId).run();
    return { disposition: 'ack', status: 'sent', attempt };
  } catch (error) {
    const code = safeFailureCode(error);
    await db.prepare(
      `UPDATE custom_home_leads SET notification_status = 'failed', notification_last_error = ?,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(code, payload.leadId).run();
    return { disposition: attempt < maxAttempts ? 'retry' : 'ack', status: 'failed', attempt };
  }
}
