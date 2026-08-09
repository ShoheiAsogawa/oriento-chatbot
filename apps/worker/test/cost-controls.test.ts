import { describe, expect, it, vi } from 'vitest';
import { consumeDailyAllowance, parseDailyLimit } from '../src/cost-controls';

function mockDbReturning(row: { count: number } | null) {
  const first = vi.fn(async () => row);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, prepare, bind, first };
}

describe('parseDailyLimit', () => {
  it('accepts a positive safe integer and otherwise uses the fallback', () => {
    expect(parseDailyLimit('500', 100)).toBe(500);
    expect(parseDailyLimit('0', 100)).toBe(100);
    expect(parseDailyLimit('-1', 100)).toBe(100);
    expect(parseDailyLimit('1.5', 100)).toBe(100);
    expect(parseDailyLimit('not-a-number', 100)).toBe(100);
  });
});

describe('consumeDailyAllowance', () => {
  it('counts against the Japan calendar day and reports remaining allowance', async () => {
    const { db, bind } = mockDbReturning({ count: 12 });
    const result = await consumeDailyAllowance(
      db,
      'ai_requests',
      '2000',
      1000,
      new Date('2026-08-09T15:30:00Z'),
    );

    expect(bind).toHaveBeenCalledWith('2026-08-10', 'ai_requests', 2000);
    expect(result).toEqual({ allowed: true, count: 12, limit: 2000, remaining: 1988, day: '2026-08-10' });
  });

  it('fails closed when the conditional increment returns no row', async () => {
    const { db } = mockDbReturning(null);
    const result = await consumeDailyAllowance(db, 'chat_sessions', '500', 250);
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(500);
    expect(result.remaining).toBe(0);
  });
});
