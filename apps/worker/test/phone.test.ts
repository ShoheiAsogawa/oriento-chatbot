import { describe, expect, it } from 'vitest';
import { normalizePhoneNumber } from '../src/phone';

describe('normalizePhoneNumber', () => {
  it.each([
    ['090-1234-5678', '09012345678'],
    ['090ー1234ー5678', '09012345678'],
    ['090－1234－5678', '09012345678'],
    ['+81 90-1234-5678', '09012345678'],
    ['03(1234)5678', '0312345678'],
    ['090 1234 5678', '09012345678'],
    ['090.1234.5678', '09012345678'],
    ['090-1234-56', '090123456'],
    ['090-1234-56789', '090123456789'],
  ])('accepts %s', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it('accepts short digit groups only when lenient', () => {
    expect(normalizePhoneNumber('12345')).toBeUndefined();
    expect(normalizePhoneNumber('12345', { lenient: true })).toBe('12345');
    expect(normalizePhoneNumber('090-秘密', { lenient: true })).toBe('090');
  });

  it('does not treat a URL as a phone number', () => {
    expect(normalizePhoneNumber('https://page.line.me/089wmudt', { lenient: true })).toBeUndefined();
  });
});
