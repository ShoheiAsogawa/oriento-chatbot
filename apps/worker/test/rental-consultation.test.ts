import { describe, expect, it } from 'vitest';
import { evaluateRentalConsultation } from '../src/rental-consultation';

describe('rental consultation', () => {
  it('starts a property search without returning property detail links before conditions are known', () => {
    expect(evaluateRentalConsultation([], '物件を探す')).toEqual({
      active: false,
      response: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。',
    });
  });

  it('asks for the property type before searching when an area follows a property-search request', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。' },
    ], '高槻市')).toEqual({
      active: false,
      response: 'まず、賃貸か購入か教えてにゃん。',
    });
  });

  it('uses only the supplied conversation history when deciding whether a property type is pending', () => {
    const awaitingType = [
      { role: 'user' as const, content: '物件を探す' },
      { role: 'assistant' as const, content: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。' },
    ];

    expect(evaluateRentalConsultation(awaitingType, '高槻市')).toEqual({
      active: false,
      response: 'まず、賃貸か購入か教えてにゃん。',
    });
    expect(evaluateRentalConsultation([], '高槻市')).toEqual({ active: false });
  });

  it('keeps asking for the property type when only its latest prompt remains in the history', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '高槻市' },
      { role: 'assistant', content: 'まず、賃貸か購入か教えてにゃん。' },
    ], '茨木市')).toEqual({
      active: false,
      response: 'まず、賃貸か購入か教えてにゃん。',
    });
  });

  it('starts the rental flow after the visitor chooses rental', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。' },
    ], '賃貸')).toEqual({
      active: true,
      response: expect.stringContaining('住みたい地域や最寄り駅'),
    });
  });

  it('treats a later property-search request as a new search instead of reusing an older rental intent', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '一人暮らししたい' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。' },
    ], '高槻市')).toEqual({
      active: false,
      response: 'まず、賃貸か購入か教えてにゃん。',
    });
  });

  it('uses the latest property-search request when rental is selected after an older purchase discussion', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '中古マンションを買いたい' },
      { role: 'assistant', content: '希望エリアを教えてください。' },
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。' },
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
    ], '高槻市')).toEqual({
      active: true,
      response: expect.stringContaining('家賃の上限'),
    });
  });

  it('does not reuse old rental conditions after a fresh property-search request', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '大阪市浪速区で一人暮らし、家賃8万円まで、1Kがいい' },
      { role: 'assistant', content: '候補を探しますにゃん。' },
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。' },
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
    ], '高槻市')).toEqual({
      active: true,
      response: expect.stringContaining('家賃の上限'),
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
