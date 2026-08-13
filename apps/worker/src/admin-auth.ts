import type { AdminIdentity } from './types';
import { sha256 } from './security';

const encoder = new TextEncoder();
const ADMIN_SESSION_COOKIE = 'orient_admin_session';
// Workers Web Crypto currently caps PBKDF2 at 100,000 iterations.
const PASSWORD_ITERATIONS = 100_000;
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const DUMMY_PASSWORD_SALT = new Uint8Array([17, 42, 83, 9, 114, 31, 207, 62, 5, 199, 73, 144, 28, 91, 166, 220]);

interface AdminUserRow {
  id: string;
  login_id: string;
  password_hash: string | null;
  password_salt: string | null;
  password_iterations: number | null;
  status: 'active' | 'disabled';
}

export interface AdminLoginResult {
  ok: boolean;
  identity?: AdminIdentity;
  cookie?: string;
}

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

function randomToken(byteLength = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();
  for (const entry of (header || '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key) cookies.set(key, value);
  }
  return cookies;
}

function secureEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
  };
  return subtle.timingSafeEqual(left, right);
}

export function normalizeAdminLoginId(loginId: string) {
  return loginId.normalize('NFKC').trim().toLowerCase();
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = new Uint8Array(salt.byteLength);
  saltBytes.set(salt);
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: saltBytes,
    iterations,
  }, key, 256));
}

async function passwordMatches(password: string, user: AdminUserRow) {
  if (!user.password_hash || !user.password_salt || !user.password_iterations) return false;
  try {
    const actual = await derivePasswordHash(password, base64UrlToBytes(user.password_salt), user.password_iterations);
    return secureEqual(actual, base64UrlToBytes(user.password_hash));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'admin.password_compare_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown password comparison error',
    }));
    return false;
  }
}

function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS) {
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearAdminSessionCookie() {
  return sessionCookie('', 0);
}

export async function authenticateAdminRequest(request: Request, env: Env): Promise<AdminIdentity> {
  const token = parseCookies(request.headers.get('Cookie')).get(ADMIN_SESSION_COOKIE);
  if (!token || token.length > 200) throw new Error('Unauthorized');
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT u.id, u.login_id
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
      LIMIT 1`,
  ).bind(tokenHash, now).first<{ id: string; login_id: string }>();
  if (!row) throw new Error('Unauthorized');
  return { loginId: row.login_id, subject: row.id };
}

export async function loginAdmin(loginId: string, password: string, env: Env): Promise<AdminLoginResult> {
  const normalizedLoginId = normalizeAdminLoginId(loginId);
  const user = await env.DB.prepare(
    `SELECT id, login_id, password_hash, password_salt, password_iterations, status
       FROM admin_users WHERE login_id = ? COLLATE NOCASE LIMIT 1`,
  ).bind(normalizedLoginId).first<AdminUserRow>();

  if (!user || user.status !== 'active') {
    await derivePasswordHash(password, DUMMY_PASSWORD_SALT, PASSWORD_ITERATIONS);
    return { ok: false };
  }
  if (!(await passwordMatches(password, user))) return { ok: false };

  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM admin_sessions WHERE expires_at <= ?`).bind(now),
    env.DB.prepare(
      `INSERT INTO admin_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), user.id, await sha256(token), now + SESSION_TTL_SECONDS),
  ]);
  return {
    ok: true,
    identity: { loginId: user.login_id, subject: user.id },
    cookie: sessionCookie(token),
  };
}

export async function logoutAdmin(request: Request, env: Env) {
  const token = parseCookies(request.headers.get('Cookie')).get(ADMIN_SESSION_COOKIE);
  if (token && token.length <= 200) {
    await env.DB.prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`).bind(await sha256(token)).run();
  }
}
