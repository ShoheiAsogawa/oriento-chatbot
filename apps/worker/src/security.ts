const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(input: string) {
  const padded = input.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function sha256(input: string) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input))));
}

export async function hmac(input: string, key: string) {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(input))));
}

function requiredSecret(env: Env, name: 'SESSION_SIGNING_KEY' | 'HASH_SALT' | 'PII_ENCRYPTION_KEY') {
  const value = env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function createSessionToken(conversationId: string, env: Env) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${conversationId}.${issuedAt}`;
  const signature = await hmac(payload, requiredSecret(env, 'SESSION_SIGNING_KEY'));
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string, conversationId: string, env: Env) {
  try {
    const [tokenConversationId, issuedAtString, signature] = token.split('.');
    if (!tokenConversationId || !issuedAtString || !signature || tokenConversationId !== conversationId) return false;
    const issuedAt = Number(issuedAtString);
    const now = Date.now() / 1000;
    if (!Number.isFinite(issuedAt) || issuedAt > now + 60 || now - issuedAt > 60 * 60 * 24) return false;
    const expected = await hmac(`${tokenConversationId}.${issuedAtString}`, requiredSecret(env, 'SESSION_SIGNING_KEY'));
    const actualBytes = base64UrlToBytes(signature);
    const expectedBytes = base64UrlToBytes(expected);
    const subtle = crypto.subtle as SubtleCrypto & {
      timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
    };
    return actualBytes.byteLength === expectedBytes.byteLength && subtle.timingSafeEqual(actualBytes, expectedBytes);
  } catch {
    return false;
  }
}

export function redactPII(input: string) {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[メールアドレス]')
    .replace(/(?:\+81[- ー－−]?|0)\d{1,4}[- ー－−]?\d{1,4}[- ー－−]?\d{3,4}/gu, '[電話番号]');
}

async function getEncryptionKey(env: Env) {
  const raw = base64UrlToBytes(requiredSecret(env, 'PII_ENCRYPTION_KEY'));
  if (raw.byteLength !== 32) throw new Error('PII encryption key must decode to 32 bytes');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptPII(value: string | undefined, env: Env) {
  if (!value) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey(env);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value)));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(encrypted)}`;
}

export async function decryptPII(value: string | null, env: Env) {
  if (!value) return null;
  const [ivEncoded, encryptedEncoded] = value.split('.');
  if (!ivEncoded || !encryptedEncoded) throw new Error('Invalid encrypted field');
  const key = await getEncryptionKey(env);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(ivEncoded) },
    key,
    base64UrlToBytes(encryptedEncoded),
  );
  return new TextDecoder().decode(plain);
}

export async function verifyTurnstile(token: string | undefined, request: Request, env: Env) {
  if (env.ENVIRONMENT === 'development') return true;
  if (!env.TURNSTILE_SECRET) return false;
  if (!token || token.length > 2048) return false;
  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET);
  form.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    if (!result.ok) return false;
    const data = (await result.json()) as { success?: boolean; action?: string; hostname?: string };
    if (data.success !== true || data.action !== 'chat_session' || !data.hostname) return false;
    const expectedHostnames = new Set(
      env.ALLOWED_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .flatMap((origin) => {
          try { return [new URL(origin).hostname]; } catch { return []; }
        }),
    );
    return expectedHostnames.has(data.hostname);
  } catch {
    return false;
  }
}
