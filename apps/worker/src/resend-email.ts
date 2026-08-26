import type { CustomHomeEmail } from './custom-home-notifications';

const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

type ResendEmailOptions = {
  apiKey: string;
  idempotencyKey: string;
  fetcher?: typeof fetch;
};

/**
 * Sends a transactional email through Resend without exposing the API key or
 * message body in errors. Queue retries reuse the same idempotency key, so a
 * lost Worker response cannot create duplicate staff notifications.
 */
export async function sendEmailWithResend(
  email: CustomHomeEmail,
  options: ResendEmailOptions,
) {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error('resend_not_configured');

  const response = await (options.fetcher || fetch)(RESEND_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': options.idempotencyKey,
    },
    body: JSON.stringify(email),
  });

  if (!response.ok) {
    // Never include Resend's response body: it can echo recipient or sender
    // details and notification failures are persisted to D1.
    throw new Error(`resend_http_${response.status}`);
  }
}
