import { describe, expect, it } from 'vitest';
import { evaluateRentalConsultation } from '../src/rental-consultation';

describe('rental consultation', () => {
  it('starts a property search without returning property detail links before conditions are known', () => {
    expect(evaluateRentalConsultation([], '物件を探す')).toEqual({
      active: false,
      response: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。',
    });
  });

  it('asks for an area first when a visitor wants to live alone', () => {
    expect(evaluateRentalConsultation([], '一人暮らししたい')).toEqual({
      active: true,
      response: expect.stringContaining('住みたい地域や最寄り駅'),
    });
  });

  it('asks for budget after the visitor specifies an area', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '一人暮らししたい' },
      { role: 'assistant', content: '住みたい地域を教えてにゃん。' },
    ], '大阪市浪速区がいい')).toEqual({
      active: true,
      response: expect.stringContaining('家賃の上限'),
    });
  });

  it('accepts a short station or neighborhood answer after asking for an area', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '一人暮らししたい' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
    ], '梅田')).toEqual({
      active: true,
      response: expect.stringContaining('家賃の上限'),
    });
  });

  it('asks for preferences after area and budget', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '大阪市浪速区で一人暮らししたい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
    ], '家賃8万円まで')).toEqual({
      active: true,
      response: expect.stringContaining('希望の間取りや条件'),
    });
  });

  it('is ready to search rentals after enough criteria are collected', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '大阪市浪速区で一人暮らししたい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
      { role: 'user', content: '家賃8万円まで' },
      { role: 'assistant', content: '希望条件を教えてにゃん。' },
    ], '1Kで駅徒歩10分以内')).toEqual({ active: true });
  });
});
