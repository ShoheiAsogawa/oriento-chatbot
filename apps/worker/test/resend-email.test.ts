import { describe, expect, it, vi } from 'vitest';
import { sendEmailWithResend } from '../src/resend-email';

const email = {
  from: 'オリにゃん <no-reply@orijyu.com>',
  to: 'hankyo@orijyu.com',
  subject: 'ご相談が届きました',
  text: '本文',
};

describe('Resend email delivery', () => {
  it('sends through the Resend API with an idempotency key', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ id: 'email-id' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));

    await sendEmailWithResend(email, {
      apiKey: 're_test_key',
      idempotencyKey: 'custom-home-lead/11111111-1111-4111-8111-111111111111',
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: 'Bearer re_test_key',
        'content-type': 'application/json',
        'idempotency-key': 'custom-home-lead/11111111-1111-4111-8111-111111111111',
      },
      body: JSON.stringify(email),
    });
  });

  it('fails safely when the API key is absent', async () => {
    await expect(sendEmailWithResend(email, {
      apiKey: '',
      idempotencyKey: 'lead-id',
    })).rejects.toThrow('resend_not_configured');
  });

  it('does not include Resend response details in an error', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ message: 'invalid recipient hankyo@orijyu.com' }),
      { status: 422, headers: { 'content-type': 'application/json' } },
    ));

    await expect(sendEmailWithResend(email, {
      apiKey: 're_test_key',
      idempotencyKey: 'lead-id',
      fetcher,
    })).rejects.toThrow('resend_http_422');
  });
});
