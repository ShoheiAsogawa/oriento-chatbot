import { describe, expect, it } from 'vitest';
import { createPasswordEmailCopy, normalizeAdminEmail, validateAdminPassword } from '../src/admin-auth';

describe('admin authentication helpers', () => {
  it('normalizes the configured administrator email', () => {
    expect(normalizeAdminEmail('  S_ASOGAWA@AMALINK.CO.JP ')).toBe('s_asogawa@amalink.co.jp');
  });

  it('enforces the password policy', () => {
    expect(validateAdminPassword('short')).toContain('10〜128文字');
    expect(validateAdminPassword('lowercase123')).toContain('英大文字');
    expect(validateAdminPassword('UPPERCASE123')).toContain('英小文字');
    expect(validateAdminPassword('NoDigitsHere')).toContain('数字');
    expect(validateAdminPassword('OrientAdmin2026')).toBeNull();
  });

  it('creates distinct setup and reset email copy', () => {
    const url = 'https://orient-chat-api.example/admin/?reset_token=example';
    const setup = createPasswordEmailCopy('setup', 's_asogawa@amalink.co.jp', url);
    const reset = createPasswordEmailCopy('reset', 's_asogawa@amalink.co.jp', url);

    expect(setup.subject).toContain('初回パスワード設定');
    expect(setup.text).toContain('30分以内');
    expect(setup.html).toContain(url);
    expect(reset.subject).toContain('パスワード再設定');
    expect(reset.text).toContain('心当たりがない場合');
  });
});
