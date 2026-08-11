import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken, redactPII, verifySessionToken, verifyTurnstile } from '../src/security';

const productionEnv = {
  ENVIRONMENT: 'production',
  TURNSTILE_SECRET: 'test-secret',
  ALLOWED_ORIGINS: 'https://orijyu.com,https://www.orijyu.com',
} as Env;

const request = new Request('https://orient-chat-api.example.workers.dev/api/chat/session', {
  method: 'POST',
  headers: { 'CF-Connecting-IP': '192.0.2.1' },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verifyTurnstile', () => {
  it('fails closed when the production secret is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyTurnstile('token', request, {
      ...productionEnv,
      TURNSTILE_SECRET: '',
    })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows the explicit local development bypass', async () => {
    await expect(verifyTurnstile(undefined, request, {
      ...productionEnv,
      ENVIRONMENT: 'development',
      TURNSTILE_SECRET: '',
    })).resolves.toBe(true);
  });

  it('rejects a missing token in production without calling Siteverify', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyTurnstile(undefined, request, productionEnv)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a valid token only for the chat action and an allowed hostname', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const form = init.body as FormData;
      expect(form.get('secret')).toBe('test-secret');
      expect(form.get('response')).toBe('valid-token');
      expect(form.get('remoteip')).toBe('192.0.2.1');
      return Response.json({ success: true, action: 'chat_session', hostname: 'orijyu.com' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyTurnstile('valid-token', request, productionEnv)).resolves.toBe(true);
  });

  it.each([
    [{ success: true, action: 'login', hostname: 'orijyu.com' }, 'an unexpected action'],
    [{ success: true, action: 'chat_session', hostname: 'attacker.example' }, 'an unexpected hostname'],
    [{ success: false, action: 'chat_session', hostname: 'orijyu.com' }, 'a failed challenge'],
  ])('rejects Siteverify results with %s (%s)', async (result) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(result)));
    await expect(verifyTurnstile('invalid-token', request, productionEnv)).resolves.toBe(false);
  });

  it('fails closed when Siteverify is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network unavailable'); }));
    await expect(verifyTurnstile('token', request, productionEnv)).resolves.toBe(false);
  });
});

describe('redactPII', () => {
  it('removes email addresses and Japanese phone numbers before chat storage or inference', () => {
    expect(redactPII('連絡先は test@example.com と 090-1234-5678 です')).toBe(
      '連絡先は [メールアドレス] と [電話番号] です',
    );
  });
});

describe('chat session tokens', () => {
  const sessionEnv = {
    ...productionEnv,
    SESSION_SIGNING_KEY: 'test-session-signing-key',
  } as Env;

  it('binds a token to one conversation and rejects a different conversation ID', async () => {
    const conversationId = '18a959d1-6d70-4c90-a43e-2dc216e64c62';
    const token = await createSessionToken(conversationId, sessionEnv);

    expect(token.split('.')[0]).toBe(conversationId);
    await expect(verifySessionToken(token, '3762fe9a-6cc0-46c1-865c-d2ee7b62a4fa', sessionEnv)).resolves.toBe(false);
  });
});
