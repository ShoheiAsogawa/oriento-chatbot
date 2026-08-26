import { decryptPII } from './security';
import type { CustomHomeEmail, CustomHomeNotificationOptions, CustomHomeNotificationResult } from './custom-home-notifications';
import type { PropertyInquiryKind } from './property-inquiry';
import type { CitedProperty, PropertyInquiryQueuePayload } from './property-inquiry-leads';

type InquiryRow = {
  id: string;
  kind: PropertyInquiryKind;
  contact_name_enc: string | null;
  address_enc: string | null;
  preferred_datetime: string | null;
  property_summary: string | null;
  phone_enc: string | null;
  notification_status: string;
  notification_attempts: number;
  updated_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DEFAULT_MAX_ATTEMPTS = 5;
const PROCESSING_LEASE_MS = 30 * 1000;

const KIND_LABELS: Record<PropertyInquiryKind, string> = {
  document_request: '資料請求',
  phone: '電話相談',
  viewing: '見学予約',
};

export function isPropertyInquiryQueuePayload(value: unknown): value is PropertyInquiryQueuePayload {
  if (!value || typeof value !== 'object') return false;
  const id = (value as { propertyInquiryId?: unknown }).propertyInquiryId;
  return typeof id === 'string' && UUID.test(id);
}

function safeDisplay(value: unknown, max = 500) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
    .replace(/\r?\n/gu, ' ')
    .trim()
    .slice(0, max);
}

function displayProperties(value: string | null) {
  if (!value) return '（案内中の物件なし）';
  try {
    const parsed = JSON.parse(value) as CitedProperty[];
    if (!Array.isArray(parsed) || parsed.length === 0) return '（案内中の物件なし）';
    return parsed
      .map((item) => {
        const title = safeDisplay(item.title, 120);
        const url = safeDisplay(item.url, 500);
        return title && url ? `- ${title}\n  ${url}` : '';
      })
      .filter(Boolean)
      .join('\n') || '（案内中の物件なし）';
  } catch {
    return '（物件情報を読み取れませんでした）';
  }
}

export function formatPropertyInquiryEmail(input: {
  kind: PropertyInquiryKind;
  name: string;
  phone: string;
  address?: string;
  preferredDatetime?: string;
  propertySummary?: string | null;
}) {
  const kindLabel = KIND_LABELS[input.kind] || 'お問い合わせ';
  const lines = [
    'オリエントグループ ご担当者様',
    '',
    `公式サイトのAIチャット「オリにゃん」から、${kindLabel}が届きました。`,
    '管理画面の「お問い合わせ」からも同じ内容を確認できます。',
    '',
    '■ ご連絡先',
    `お名前: ${safeDisplay(input.name, 100)}`,
    `電話番号: ${safeDisplay(input.phone, 30)}`,
  ];
  if (input.kind !== 'phone') {
    lines.push(`住所: ${safeDisplay(input.address, 120) || '（未入力）'}`);
  }
  if (input.kind === 'viewing') {
    lines.push(`希望日時: ${safeDisplay(input.preferredDatetime, 80) || '（未入力）'}`);
  }
  lines.push('', '■ ご案内中の物件', displayProperties(input.propertySummary || null), '');
  lines.push('このメールは自動送信です。お客様への折り返し連絡をお願いします。');
  return {
    subject: `【オリにゃん】${kindLabel}が届きました`,
    text: lines.join('\n'),
  };
}

function safeFailureCode(error: unknown): 'decrypt_failed' | 'send_failed' {
  return error instanceof Error && error.name === 'OperationError' ? 'decrypt_failed' : 'send_failed';
}

export async function processPropertyInquiryNotification(
  db: D1Database,
  env: Pick<Env, 'PII_ENCRYPTION_KEY'>,
  payload: unknown,
  options: CustomHomeNotificationOptions,
): Promise<CustomHomeNotificationResult> {
  if (!isPropertyInquiryQueuePayload(payload)) return { disposition: 'ack', status: 'skipped', attempt: 0 };
  const maxAttempts = Math.max(1, Math.min(10, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  const inquiry = await db.prepare(
    `SELECT i.id, i.kind, i.contact_name_enc, i.address_enc, i.preferred_datetime, i.property_summary,
       i.notification_status, i.notification_attempts, i.updated_at, c.phone_enc
     FROM property_inquiries i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.id = ? LIMIT 1`,
  ).bind(payload.propertyInquiryId).first<InquiryRow>();
  if (!inquiry) return { disposition: 'ack', status: 'skipped', attempt: 0 };
  if (inquiry.notification_status === 'sent' || inquiry.notification_status === 'collecting') {
    return { disposition: 'ack', status: 'skipped', attempt: inquiry.notification_attempts };
  }
  if (inquiry.notification_status === 'processing') {
    const updatedAt = Date.parse(inquiry.updated_at);
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt < PROCESSING_LEASE_MS) {
      return { disposition: 'retry', status: 'skipped', attempt: inquiry.notification_attempts };
    }
    const reclaimed = await db.prepare(
      `UPDATE property_inquiries SET notification_status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND notification_status = 'processing' AND updated_at = ?`,
    ).bind(payload.propertyInquiryId, inquiry.updated_at).run();
    if (!reclaimed.meta.changes) {
      return { disposition: 'ack', status: 'skipped', attempt: inquiry.notification_attempts };
    }
  }
  if (inquiry.notification_attempts >= maxAttempts) {
    return { disposition: 'ack', status: 'failed', attempt: inquiry.notification_attempts };
  }

  const claimed = await db.prepare(
    `UPDATE property_inquiries
     SET notification_status = 'processing', notification_attempts = notification_attempts + 1,
         notification_last_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND notification_status IN ('pending', 'failed')
       AND notification_attempts < ?`,
  ).bind(payload.propertyInquiryId, maxAttempts).run();
  if (!claimed.meta.changes) return { disposition: 'ack', status: 'skipped', attempt: inquiry.notification_attempts };
  const attempt = inquiry.notification_attempts + 1;

  try {
    const [name, phone, address] = await Promise.all([
      decryptPII(inquiry.contact_name_enc, env as Env),
      decryptPII(inquiry.phone_enc, env as Env),
      decryptPII(inquiry.address_enc, env as Env),
    ]);
    if (!name || !phone) throw new Error('missing_encrypted_field');
    const email = formatPropertyInquiryEmail({
      kind: inquiry.kind,
      name,
      phone,
      address: address || undefined,
      preferredDatetime: inquiry.preferred_datetime || undefined,
      propertySummary: inquiry.property_summary,
    });
    await options.send({
      from: options.sender,
      to: options.recipient,
      subject: email.subject,
      text: email.text,
    } satisfies CustomHomeEmail);
    await db.prepare(
      `UPDATE property_inquiries SET notification_status = 'sent', notified_at = CURRENT_TIMESTAMP,
         notification_last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(payload.propertyInquiryId).run();
    return { disposition: 'ack', status: 'sent', attempt };
  } catch (error) {
    const code = safeFailureCode(error);
    await db.prepare(
      `UPDATE property_inquiries SET notification_status = 'failed', notification_last_error = ?,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(code, payload.propertyInquiryId).run();
    return { disposition: attempt < maxAttempts ? 'retry' : 'ack', status: 'failed', attempt };
  }
}
