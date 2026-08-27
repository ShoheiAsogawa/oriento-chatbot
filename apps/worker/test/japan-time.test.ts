import { describe, expect, it } from 'vitest';
import { formatJapanDateTime, parseStoredUtc } from '../src/japan-time';

describe('Japan datetime display', () => {
  it('treats D1 CURRENT_TIMESTAMP as UTC and shows Tokyo time', () => {
    expect(parseStoredUtc('2026-08-27 02:48:48')?.toISOString()).toBe('2026-08-27T02:48:48.000Z');
    expect(formatJapanDateTime('2026-08-27 02:48:48')).toBe('08/27 11:48');
    expect(formatJapanDateTime('2026-08-27 02:56:01')).toBe('08/27 11:56');
  });

  it('keeps ISO timestamps with an explicit offset', () => {
    expect(formatJapanDateTime('2026-08-27T02:56:01.667Z')).toBe('08/27 11:56');
    expect(formatJapanDateTime('2026-08-27T11:56:01+09:00')).toBe('08/27 11:56');
  });

  it('returns a placeholder for empty values', () => {
    expect(formatJapanDateTime('')).toBe('—');
    expect(formatJapanDateTime('not-a-date')).toBe('—');
  });
});
