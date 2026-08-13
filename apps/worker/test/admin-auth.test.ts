import { describe, expect, it } from 'vitest';
import { normalizeAdminLoginId } from '../src/admin-auth';

describe('admin authentication helpers', () => {
  it('normalizes a distributed administrator ID', () => {
    expect(normalizeAdminLoginId('  S_ASOGAWA ')).toBe('s_asogawa');
    expect(normalizeAdminLoginId('ＡＤＭＩＮ')).toBe('admin');
  });
});
