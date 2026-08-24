import { describe, expect, it } from 'vitest';
import { evaluatePurchaseConsultation, extractPurchaseConsultationState } from '../src/purchase-consultation';

describe('purchase consultation', () => {
  it.each([
    '注文住宅と購入はどっちがいい？',
    '賃貸と購入で迷っています',
    '購入と賃貸を比較したい',
  ])('leaves a mode comparison to the conversational agent: %s', (message) => {
    expect(evaluatePurchaseConsultation([], message)).toEqual({ active: false });
  });
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
      response: expect.stringContaining('希望の都道府県'),
    });
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
    ], '堺市')).toMatchObject({ response: expect.stringContaining('購入する物件の種類') });
  });

  it('continues from a no-preference property-type choice to the purchase budget', () => {
    const history = [
      { role: 'user' as const, content: '物件を探す' },
      { role: 'assistant' as const, content: '住まい探しだね。購入・注文住宅・賃貸のどれを考えているか選んでにゃん。' },
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '購入物件を一緒に探すにゃん。まず、希望の都道府県を選んでにゃん。' },
      { role: 'user' as const, content: '大阪府' },
      { role: 'assistant' as const, content: '大阪府で購入物件を探すにゃん。次に、市区町村を選んでにゃん。' },
      { role: 'user' as const, content: '大阪市' },
      { role: 'assistant' as const, content: '大阪市で購入物件を探すにゃん。次に区を選んでにゃん。' },
      { role: 'user' as const, content: '阿倍野区' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。まだ決まっていなければ、こだわりなしでも探せるにゃん。' },
    ];

    expect(evaluatePurchaseConsultation(history, '物件種別はこだわりなし')).toMatchObject({
      active: true,
      response: expect.stringContaining('購入予算の上限'),
    });
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

  it('does not replay purchase results for an unrelated health-care question', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
      { role: 'user', content: '大阪市' },
      { role: 'assistant', content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user', content: '中古マンション' },
      { role: 'assistant', content: '大阪市で条件に合う購入物件が見つかったにゃん。' },
    ], 'おすすめの病院を教えて')).toEqual({ active: false });
  });

  it('continues purchase after an older custom-home consultation was explicitly replaced', () => {
    const history = [
      { role: 'user' as const, content: '注文住宅' },
      { role: 'assistant' as const, content: '土地を持っているか教えてにゃん。' },
      { role: 'user' as const, content: '土地を持っていない' },
      { role: 'assistant' as const, content: '建てたいエリアを教えてにゃん。' },
      { role: 'user' as const, content: '物件を探す' },
      { role: 'assistant' as const, content: '住まい探しだね。購入・注文住宅・賃貸のどれを考えているか選んでにゃん。' },
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '購入物件を一緒に探すにゃん。まず、希望の都道府県を選んでにゃん。' },
    ];

    expect(evaluatePurchaseConsultation(history, '広島県')).toEqual({
      active: true,
      response: '広島県で購入物件を探すにゃん。次に、市区町村を選んでにゃん。',
    });
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

  it.each(['どれがおすすめ？', '内見したい', '問い合わせしたい'])
  ('hands a completed purchase action back to the conversational agent: %s', (message) => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '購入物件の希望間取りを選んでにゃん。' },
      { role: 'user', content: '間取りはこだわりなし' },
      { role: 'assistant', content: '茨木市で条件に合う購入物件が見つかったにゃん。' },
    ], message)).toEqual({ active: false });
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
      response: expect.stringContaining('希望の都道府県'),
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

  it('accepts a dynamically generated high-price budget choice', () => {
    const history = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '希望の都道府県を選んでにゃん。' },
      { role: 'user' as const, content: '広島県' },
      { role: 'assistant' as const, content: '市区町村を選んでにゃん。' },
      { role: 'user' as const, content: '福山市' },
      { role: 'assistant' as const, content: '購入予算の上限を選んでにゃん。' },
    ];

    expect(evaluatePurchaseConsultation(history, '購入予算12000万円まで')).toMatchObject({
      active: true,
      response: expect.stringContaining('物件の種類'),
    });
    expect(extractPurchaseConsultationState(history, '購入予算12000万円まで').maxPriceYen)
      .toBe(120_000_000);
  });

  it('does not turn a new-versus-used comparison into a location prompt', () => {
    expect(evaluatePurchaseConsultation([], '新築と中古はどちらがいい？')).toEqual({ active: false });
  });

  it.each([
    ['もっと安い物件がいい', '新しい購入予算の上限'],
    ['もっと広い物件がいい', '購入物件の希望間取り'],
    ['もっと駅に近い物件がいい', '徒歩10分以内'],
  ] as const)('asks for a concrete purchase refinement after results: %s', (message, expected) => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '茨木市で条件に合う購入物件が見つかったにゃん。' },
    ], message).response).toContain(expected);
  });

  it('stores the explicit walking-distance answer for the next recommendation', () => {
    expect(extractPurchaseConsultationState([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '茨木市で条件に合う購入物件が見つかったにゃん。' },
      { role: 'user', content: 'もっと駅に近い物件がいい' },
      { role: 'assistant', content: '希望する駅徒歩の上限を「徒歩10分以内」のように教えてにゃん。' },
    ], '徒歩5分以内').maxWalkMinutes).toBe(5);
  });

  it('accepts natural no-preference wording without leaving the guided flow', () => {
    expect(evaluatePurchaseConsultation([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望の都道府県を選んでにゃん。' },
      { role: 'user', content: '和歌山県' },
      { role: 'assistant', content: '市区町村を選んでにゃん。' },
      { role: 'user', content: '田辺市' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
      { role: 'user', content: '5000万円' },
      { role: 'assistant', content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user', content: '中古戸建て' },
      { role: 'assistant', content: '購入物件の希望間取りを選んでにゃん。' },
    ], '間取りはこだわりなしにしたい')).toEqual({ active: true });
  });

  it.each(['未定', 'わからない', '相談したい'])('keeps going when the budget answer is %s', (answer) => {
    const history = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '希望の都道府県を選んでにゃん。' },
      { role: 'user' as const, content: '大阪府' },
      { role: 'assistant' as const, content: '市区町村を選んでにゃん。' },
      { role: 'user' as const, content: '大阪市' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user' as const, content: '物件種別はこだわりなし' },
      { role: 'assistant' as const, content: '購入予算の上限を選んでにゃん。' },
    ];
    expect(extractPurchaseConsultationState(history, answer).maxPriceYen).toBe(Number.MAX_SAFE_INTEGER);
    expect(evaluatePurchaseConsultation(history, answer).response).toContain('希望間取り');
  });

  it.each([
    ['予算を変更したい', '購入予算の上限'],
    ['間取りを選び直したい', '希望間取り'],
    ['物件種別を変更したい', '物件の種類'],
    ['エリアを変えたい', '希望の都道府県'],
  ] as const)('asks for the requested purchase condition instead of replaying results: %s', (message, expected) => {
    const history = [
      { role: 'user' as const, content: '大阪市で購入を探したい' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user' as const, content: '物件種別はこだわりなし' },
      { role: 'assistant' as const, content: '購入予算の上限を選んでにゃん。' },
      { role: 'user' as const, content: '5000万円' },
      { role: 'assistant' as const, content: '購入物件の希望間取りを選んでにゃん。' },
      { role: 'user' as const, content: '間取りはこだわりなし' },
      { role: 'assistant' as const, content: '大阪市で条件に合う購入物件が見つかったにゃん。' },
    ];
    expect(evaluatePurchaseConsultation(history, message).response).toContain(expected);
  });

  it('clears an old city even when the newly selected prefecture is unchanged', () => {
    const history = [
      { role: 'user' as const, content: '大阪市で購入を探したい' },
      { role: 'assistant' as const, content: '大阪市で条件に合う購入物件が見つかったにゃん。' },
      { role: 'user' as const, content: 'エリアを変えたい' },
      { role: 'assistant' as const, content: '新しい希望の都道府県を選んでにゃん。' },
    ];
    expect(extractPurchaseConsultationState(history, '大阪府')).toMatchObject({ prefecture: '大阪府', area: undefined });
    expect(evaluatePurchaseConsultation(history, '大阪府').response).toContain('市区町村');
  });

  it.each(['未定', 'わからない', 'どこでもいい', 'おまかせ'])('does not store %s as a purchase location', (answer) => {
    const prefectureHistory = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '希望の都道府県を選んでにゃん。' },
    ];
    expect(extractPurchaseConsultationState(prefectureHistory, answer).area).toBeUndefined();
    expect(evaluatePurchaseConsultation(prefectureHistory, answer).response).toContain('都道府県を選んで');

    const cityHistory = [
      ...prefectureHistory,
      { role: 'user' as const, content: '大阪府' },
      { role: 'assistant' as const, content: '大阪府で購入物件を探すにゃん。次に、市区町村を選んでにゃん。' },
    ];
    expect(extractPurchaseConsultationState(cityHistory, answer).area).toBeUndefined();
    expect(evaluatePurchaseConsultation(cityHistory, answer).response).toContain('市区町村を選んで');
  });

  it('re-asks the current purchase step when a leftover guided button is tapped', () => {
    const history = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '希望の都道府県を選んでにゃん。' },
      { role: 'user' as const, content: '大阪府' },
      { role: 'assistant' as const, content: '大阪府で購入物件を探すにゃん。次に、市区町村を選んでにゃん。' },
      { role: 'user' as const, content: '茨木市' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。まだ決まっていなければ、こだわりなしでも探せるにゃん。' },
      { role: 'user' as const, content: '物件種別はこだわりなし' },
      { role: 'assistant' as const, content: '購入予算の上限を選んでにゃん。諸費用を除いた物件価格の目安で大丈夫にゃん。' },
    ];
    expect(evaluatePurchaseConsultation(history, '物件種別はこだわりなし')).toEqual({
      active: true,
      response: '購入予算の上限を選んでにゃん。諸費用を除いた物件価格の目安で大丈夫にゃん。',
    });
  });

  it('re-asks the Osaka ward step instead of dropping a leftover city button to the model', () => {
    const history = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '希望の都道府県を選んでにゃん。' },
      { role: 'user' as const, content: '大阪府' },
      { role: 'assistant' as const, content: '市区町村を選んでにゃん。' },
      { role: 'user' as const, content: '大阪市' },
      { role: 'assistant' as const, content: '大阪市で購入物件を探すにゃん。次に区を選んでにゃん。' },
    ];
    expect(evaluatePurchaseConsultation(history, '大阪市')).toEqual({
      active: true,
      response: '大阪市で購入物件を探すにゃん。次に区を選んでにゃん。',
    });
  });

  it('repeats represented wards when the ward is unknown', () => {
    const history = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '希望の都道府県を選んでにゃん。' },
      { role: 'user' as const, content: '大阪府' },
      { role: 'assistant' as const, content: '市区町村を選んでにゃん。' },
      { role: 'user' as const, content: '大阪市' },
      { role: 'assistant' as const, content: '大阪市で購入物件を探すにゃん。次に区を選んでにゃん。' },
    ];
    expect(evaluatePurchaseConsultation(history, 'わからない').response).toContain('物件の種類');
  });
});
