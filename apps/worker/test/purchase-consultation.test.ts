import { describe, expect, it } from 'vitest';
import { evaluatePurchaseConsultation, extractPurchaseConsultationState } from '../src/purchase-consultation';

describe('purchase consultation', () => {
  it('collects purchase criteria in a deterministic button-friendly order', () => {
    const history = [
      { role: 'user' as const, content: '物件を探す' },
      { role: 'assistant' as const, content: '賃貸と購入のどちらを探しているか教えてにゃん。' },
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '購入物件を一緒に探すにゃん。まず、希望エリアを選んでにゃん。' },
      { role: 'user' as const, content: '堺市' },
      { role: 'assistant' as const, content: '購入予算の上限を選んでにゃん。' },
      { role: 'user' as const, content: '購入予算3000万円まで' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user' as const, content: '新築戸建て' },
      { role: 'assistant' as const, content: '購入物件の希望間取りを選んでにゃん。' },
    ];

    expect(evaluatePurchaseConsultation(history, '4LDK')).toEqual({ active: true });
    expect(extractPurchaseConsultationState(history, '4LDK')).toMatchObject({
      area: '堺市', maxPriceYen: 30_000_000, propertyType: '新築戸建て', layout: '4LDK',
      propertyTypeSet: true, layoutSet: true,
    });
  });

  it('asks only for the next missing purchase criterion', () => {
    expect(evaluatePurchaseConsultation([], '購入')).toMatchObject({
      active: true,
      response: expect.stringContaining('希望エリア'),
    });
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
    ], '堺市')).toMatchObject({ response: expect.stringContaining('購入予算の上限') });
  });

  it('skips layout when the visitor chooses land', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
      { role: 'user', content: '堺市' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
      { role: 'user', content: '購入予算3000万円まで' },
      { role: 'assistant', content: '購入する物件の種類を選んでにゃん。' },
    ], '土地')).toEqual({ active: true });
  });

  it('leaves the completed purchase flow when the visitor changes the subject', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
      { role: 'user', content: '茨木市' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
      { role: 'user', content: '購入予算6000万円まで' },
      { role: 'assistant', content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user', content: '物件種別はこだわりなし' },
      { role: 'assistant', content: '購入物件の希望間取りを選んでにゃん。' },
      { role: 'user', content: '間取りはこだわりなし' },
      { role: 'assistant', content: '茨木市で条件に合う購入物件が見つかったにゃん。' },
    ], 'あなたはだれ？')).toEqual({ active: false });
  });

  it('continues the completed purchase flow for a property follow-up', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
      { role: 'user', content: '茨木市' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
      { role: 'user', content: '購入予算6000万円まで' },
      { role: 'assistant', content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user', content: '物件種別はこだわりなし' },
      { role: 'assistant', content: '購入物件の希望間取りを選んでにゃん。' },
      { role: 'user', content: '間取りはこだわりなし' },
      { role: 'assistant', content: '茨木市で条件に合う購入物件が見つかったにゃん。' },
    ], 'ほかの物件も見たい')).toEqual({ active: true });
  });

  it('stops the purchase consultation when a visitor switches to living alone', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '賃貸と購入のどちらを探しているか教えてにゃん。' },
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
      { role: 'user', content: '茨木市' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
    ], '一人暮らししたい')).toEqual({ active: false });
  });

  it('starts a fresh purchase consultation when a visitor switches from rental', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user', content: '堺市' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
    ], '購入したい')).toEqual({
      active: true,
      response: expect.stringContaining('希望エリア'),
    });
  });

  it('leaves a pending purchase flow for ordinary conversation', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '購入物件を一緒に探すにゃん。まず、希望エリアを選んでにゃん。' },
    ], 'おなかすいた')).toEqual({ active: false });
  });

  it('leaves a pending purchase budget step for an identity question', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
      { role: 'user', content: '茨木市' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
    ], 'あなたはだれ？')).toEqual({ active: false });
  });
});
