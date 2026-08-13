import type { AdminIdentity } from './types';
import { sha256 } from './security';

const encoder = new TextEncoder();
const ADMIN_SESSION_COOKIE = 'orient_admin_session';
const PASSWORD_ITERATIONS = 210_000;
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_TOKEN_TTL_SECONDS = 60 * 30;
const DUMMY_PASSWORD_SALT = new Uint8Array([17, 42, 83, 9, 114, 31, 207, 62, 5, 199, 73, 144, 28, 91, 166, 220]);

interface AdminUserRow {
  id: string;
  email: string;
  password_hash: string | null;
  password_salt: string | null;
  password_iterations: number | null;
  status: 'active' | 'disabled';
}

interface AdminPasswordTokenRow extends AdminUserRow {
  token_id: string;
  purpose: 'setup' | 'reset';
}

export interface AdminLoginResult {
  ok: boolean;
  reason?: 'invalid' | 'password_not_set';
  identity?: AdminIdentity;
  cookie?: string;
}

export interface PasswordEmailCopy {
  subject: string;
  text: string;
  html: string;
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

export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateAdminPassword(password: string) {
  if (password.length < 10 || password.length > 128) return 'パスワードは10〜128文字で入力してください';
  if (!/[a-z]/u.test(password)) return '英小文字を1文字以上含めてください';
  if (!/[A-Z]/u.test(password)) return '英大文字を1文字以上含めてください';
  if (!/[0-9]/u.test(password)) return '数字を1文字以上含めてください';
  return null;
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

async function passwordFields(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  return {
    passwordHash: bytesToBase64Url(hash),
    passwordSalt: bytesToBase64Url(salt),
    passwordIterations: PASSWORD_ITERATIONS,
  };
}

async function passwordMatches(password: string, user: AdminUserRow) {
  if (!user.password_hash || !user.password_salt || !user.password_iterations) return false;
  try {
    const actual = await derivePasswordHash(password, base64UrlToBytes(user.password_salt), user.password_iterations);
    return secureEqual(actual, base64UrlToBytes(user.password_hash));
  } catch {
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
    `SELECT u.id, u.email
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
      LIMIT 1`,
  ).bind(tokenHash, now).first<{ id: string; email: string }>();
  if (!row) throw new Error('Unauthorized');
  return { email: row.email, subject: row.id };
}

export async function loginAdmin(email: string, password: string, env: Env): Promise<AdminLoginResult> {
  const normalizedEmail = normalizeAdminEmail(email);
  const user = await env.DB.prepare(
    `SELECT id, email, password_hash, password_salt, password_iterations, status
       FROM admin_users WHERE email = ? COLLATE NOCASE LIMIT 1`,
  ).bind(normalizedEmail).first<AdminUserRow>();

  if (!user || user.status !== 'active') {
    await derivePasswordHash(password, DUMMY_PASSWORD_SALT, PASSWORD_ITERATIONS);
    return { ok: false, reason: 'invalid' };
  }
  if (!user.password_hash || !user.password_salt || !user.password_iterations) {
    return { ok: false, reason: 'password_not_set' };
  }
  if (!(await passwordMatches(password, user))) return { ok: false, reason: 'invalid' };

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
    identity: { email: user.email, subject: user.id },
    cookie: sessionCookie(token),
  };
}

export async function logoutAdmin(request: Request, env: Env) {
  const token = parseCookies(request.headers.get('Cookie')).get(ADMIN_SESSION_COOKIE);
  if (token && token.length <= 200) {
    await env.DB.prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`).bind(await sha256(token)).run();
  }
}

export function createPasswordEmailCopy(purpose: 'setup' | 'reset', email: string, resetUrl: string): PasswordEmailCopy {
  const isSetup = purpose === 'setup';
  const heading = isSetup ? '管理画面のパスワードを設定してください' : '管理画面のパスワード再設定';
  const subject = isSetup ? '【オリにゃん管理】初回パスワード設定のご案内' : '【オリにゃん管理】パスワード再設定のご案内';
  const intro = isSetup
    ? 'オリにゃん管理画面の利用開始にあたり、初回パスワードを設定してください。'
    : 'パスワード再設定の依頼を受け付けました。';
  const text = `${email} 様\n\n${intro}\n下記URLを開き、30分以内に新しいパスワードを設定してください。\n\n${resetUrl}\n\nこのリンクは1回のみ使用できます。\nこのメールに心当たりがない場合は、リンクを開かずに破棄してください。\n\nオリにゃん管理`;
  const html = `<!doctype html><html lang="ja"><body style="margin:0;background:#f4f5f7;color:#29293a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e3e8;border-radius:14px"><tr><td style="padding:30px"><div style="font-size:14px;font-weight:800;color:#ff680b">オリにゃん管理</div><h1 style="margin:18px 0 10px;font-size:22px;line-height:1.45">${heading}</h1><p style="margin:0 0 10px;color:#666873;font-size:14px;line-height:1.8">${email} 様</p><p style="margin:0 0 24px;color:#4c4e58;font-size:14px;line-height:1.8">${intro}<br>下のボタンから30分以内に新しいパスワードを設定してください。</p><a href="${resetUrl}" style="display:block;padding:14px 20px;border-radius:9px;background:#ff680b;color:#fff;font-size:14px;font-weight:800;text-align:center;text-decoration:none">${isSetup ? 'パスワードを設定する' : '新しいパスワードを設定する'}</a><p style="margin:22px 0 0;color:#858690;font-size:12px;line-height:1.8">このリンクは1回のみ使用できます。<br>心当たりがない場合は、何もせずこのメールを破棄してください。</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export async function requestAdminPasswordLink(email: string, requestUrl: string, env: Env) {
  const normalizedEmail = normalizeAdminEmail(email);
  const user = await env.DB.prepare(
    `SELECT id, email, password_hash, password_salt, password_iterations, status
       FROM admin_users WHERE email = ? COLLATE NOCASE LIMIT 1`,
  ).bind(normalizedEmail).first<AdminUserRow>();
  if (!user || user.status !== 'active') return { delivered: true, accountFound: false };

  const purpose: 'setup' | 'reset' = user.password_hash ? 'reset' : 'setup';
  const token = randomToken();
  const tokenHash = await sha256(token);
  const tokenId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + PASSWORD_TOKEN_TTL_SECONDS;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM admin_password_tokens WHERE user_id = ? AND used_at IS NULL`).bind(user.id),
    env.DB.prepare(
      `INSERT INTO admin_password_tokens (id, user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)`,
    ).bind(tokenId, user.id, purpose, tokenHash, expiresAt),
  ]);

  const resetUrl = new URL('/admin/', requestUrl);
  resetUrl.searchParams.set('reset_token', token);
  const copy = createPasswordEmailCopy(purpose, user.email, resetUrl.toString());
  try {
    const result = await env.ADMIN_EMAIL.send({
      to: user.email,
      from: { email: env.ADMIN_EMAIL_FROM, name: 'オリにゃん管理' },
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
    });
    console.log(JSON.stringify({ event: 'admin.password_email_sent', purpose, messageId: result.messageId }));
    return { delivered: true, accountFound: true, purpose };
  } catch (error) {
    await env.DB.prepare(`DELETE FROM admin_password_tokens WHERE id = ?`).bind(tokenId).run();
    const emailError = error as Error & { code?: string };
    console.error(JSON.stringify({ event: 'admin.password_email_failed', code: emailError.code || 'unknown', message: emailError.message }));
    return { delivered: false, accountFound: true, purpose };
  }
}

export async function resetAdminPassword(token: string, password: string, env: Env) {
  const validationError = validateAdminPassword(password);
  if (validationError) return { ok: false, error: validationError };
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT t.id AS token_id, t.purpose, u.id, u.email, u.password_hash, u.password_salt,
            u.password_iterations, u.status
       FROM admin_password_tokens t
       JOIN admin_users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > ? AND u.status = 'active'
      LIMIT 1`,
  ).bind(tokenHash, now).first<AdminPasswordTokenRow>();
  if (!row) return { ok: false, error: '設定リンクが無効か、有効期限が切れています' };

  const fields = await passwordFields(password);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE admin_users
          SET password_hash = ?, password_salt = ?, password_iterations = ?,
              password_set_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
    ).bind(fields.passwordHash, fields.passwordSalt, fields.passwordIterations, row.id),
    env.DB.prepare(`UPDATE admin_password_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(row.token_id),
    env.DB.prepare(`DELETE FROM admin_password_tokens WHERE user_id = ? AND id != ?`).bind(row.id, row.token_id),
    env.DB.prepare(`DELETE FROM admin_sessions WHERE user_id = ?`).bind(row.id),
  ]);
  return { ok: true, email: row.email, purpose: row.purpose };
}
