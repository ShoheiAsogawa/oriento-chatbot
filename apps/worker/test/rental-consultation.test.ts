import { describe, expect, it } from 'vitest';
import { evaluateRentalConsultation, extractRentalConsultationState } from '../src/rental-consultation';

describe('rental consultation', () => {
  it('starts a property search without returning property detail links before conditions are known', () => {
    expect(evaluateRentalConsultation([], '物件を探す')).toEqual({
      active: false,
      response: '物件探しだね。まず、賃貸と購入のどちらを探しているか選んでにゃん。',
    });
  });

  it('accepts a natural property-search starter', () => {
    expect(evaluateRentalConsultation([], '物件を探したい')).toEqual({
      active: false,
      response: '物件探しだね。まず、賃貸と購入のどちらを探しているか選んでにゃん。',
    });
  });

  it.each(['賃貸のメリットは？', '賃貸と購入はどちらがいい？'])
  ('does not hijack an explanatory comparison as a guided rental search: %s', (question) => {
    expect(evaluateRentalConsultation([], question)).toEqual({ active: false });
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
      response: expect.stringContaining('住みたい都道府県'),
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
      response: expect.stringContaining('住みたい都道府県'),
    });
  });

  it('understands that a newly built home can still be a rental request', () => {
    expect(evaluateRentalConsultation([], '新築の賃貸に住みたい')).toEqual({
      active: true,
      response: expect.stringContaining('住みたい都道府県'),
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

  it('keeps household, budget, and area when answers arrive in a different order', () => {
    const history = [
      { role: 'user' as const, content: '賃貸' },
      { role: 'assistant' as const, content: '賃貸を一緒に探すにゃん。まず、住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user' as const, content: '家族4人' },
      { role: 'assistant' as const, content: '4人で暮らす賃貸を一緒に探すにゃん。まず、住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user' as const, content: '10万' },
      { role: 'assistant' as const, content: '4人で暮らす賃貸を一緒に探すにゃん。まず、住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user' as const, content: '岸和田' },
      { role: 'assistant' as const, content: '希望の間取りや条件を教えてにゃん。2LDK・3LDK、駅からの徒歩分数、ペット可などから選べるにゃん。' },
    ];

    const decision = evaluateRentalConsultation(history, 'ワンルーム');
    expect(decision.active).toBe(true);
    expect(decision.response).toContain('4人家族');
    expect(decision.response).toContain('2LDK以上');
    expect(decision.response).not.toContain('一人暮らし向け');
  });

  it('accepts a safer layout after warning about a compact family layout', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '家族4人で岸和田市の賃貸を家賃10万円までで探したい' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
      { role: 'user', content: 'ワンルーム' },
      { role: 'assistant', content: '4人家族でワンルームはかなり手狭になりそうにゃん。ワンルームのまま探すか、2LDK以上に広げるか教えてにゃん。' },
    ], '2LDK')).toEqual({ active: true });
  });

  it('accepts all required criteria in one message regardless of order', () => {
    expect(evaluateRentalConsultation([], '家賃10万、岸和田市で家族4人、3LDKの賃貸')).toEqual({
      active: true,
    });
  });

  it('does not mistake a household answer for an area after the area prompt', () => {
    const decision = evaluateRentalConsultation([
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
    ], '夫婦と子ども2人');
    expect(decision.response).toContain('4人で暮らす賃貸');
    expect(decision.response).toContain('住みたい都道府県');
  });

  it('keeps an early budget while continuing to ask for a missing area', () => {
    const decision = evaluateRentalConsultation([
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
    ], '家賃は8.5万円まで');
    expect(decision.response).toContain('住みたい都道府県');
    expect(decision.response).not.toContain('家賃の上限');
  });

  it('accepts a full-width layout written with lowercase letters', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user', content: '堺市' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
      { role: 'user', content: '10万' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
    ], '２ldk')).toEqual({ active: true });
  });

  it('accepts a standalone no-preference answer', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '堺市で賃貸を探したい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
      { role: 'user', content: '10万' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
    ], 'なし')).toEqual({ active: true });
  });

  it('leaves the completed rental flow when the visitor changes the subject', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '堺市で賃貸を探したい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
      { role: 'user', content: '10万' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
      { role: 'user', content: 'こだわりなし' },
      { role: 'assistant', content: '堺市で条件に合う居住用賃貸が見つかったにゃん。' },
    ], 'あなたはだれ？')).toEqual({ active: false });
  });

  it('continues the completed rental flow for a condition change', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '堺市で賃貸を探したい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
      { role: 'user', content: '10万' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
      { role: 'user', content: 'こだわりなし' },
      { role: 'assistant', content: '堺市で条件に合う居住用賃貸が見つかったにゃん。' },
    ], 'もっと駅に近い物件がいい')).toEqual({
      active: true,
      response: '希望する駅徒歩の上限を「徒歩10分以内」のように教えてにゃん。',
    });
  });

  it.each([
    ['もっと安い物件がいい', '新しい家賃の上限'],
    ['もっと広い部屋がいい', '希望の間取りや条件'],
  ] as const)('asks for a concrete rental refinement instead of repeating results: %s', (message, expected) => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '堺市で賃貸を探したい' },
      { role: 'assistant', content: '条件に合う居住用賃貸が見つかったにゃん。' },
    ], message).response).toContain(expected);
  });

  it.each(['どれがおすすめ？', '内見したい', '問い合わせしたい'])
  ('hands a completed rental action back to the conversational agent: %s', (message) => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '堺市で賃貸を探したい' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
      { role: 'user', content: 'こだわりなし' },
      { role: 'assistant', content: '堺市で条件に合う居住用賃貸が見つかったにゃん。' },
    ], message)).toEqual({ active: false });
  });

  it('starts from prefecture again when rental is explicitly restarted after completed results', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '堺市で賃貸を探したい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
      { role: 'user', content: '10万' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
      { role: 'user', content: '1K' },
      { role: 'assistant', content: '堺市で条件に合う居住用賃貸が見つかったにゃん。' },
    ], 'もう一度賃貸を探したい')).toEqual({
      active: true,
      response: expect.stringContaining('住みたい都道府県'),
    });
  });

  it('starts a fresh rental consultation when a visitor switches from purchase to living alone', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '賃貸と購入のどちらを探しているか教えてにゃん。' },
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望エリアを選んでにゃん。' },
      { role: 'user', content: '茨木市' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
    ], '一人暮らししたい')).toEqual({
      active: true,
      response: expect.stringContaining('住みたい都道府県'),
    });
  });

  it('stops the rental consultation when a visitor switches to purchase', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user', content: '堺市' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
    ], '購入したい')).toEqual({ active: false });
  });

  it('leaves a pending rental flow for ordinary conversation', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '一人暮らししたい' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
    ], 'おなかすいた')).toEqual({ active: false });
  });

  it('does not resume an older rental flow after an AI conversation reply', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '一人暮らししたい' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user', content: 'おなかすいた' },
      { role: 'assistant', content: 'おなかがすいたんだね。無理せず何か食べてにゃん。' },
    ], 'あなたはだれ？')).toEqual({ active: false });
  });

  it('leaves a pending rental budget step for an identity question', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '一人暮らししたい' },
      { role: 'assistant', content: '住みたい地域や最寄り駅を教えてにゃん。' },
      { role: 'user', content: '堺市' },
      { role: 'assistant', content: '次に、家賃の上限を教えてにゃん。' },
    ], 'あなたはだれ？')).toEqual({ active: false });
  });

  it.each([
    '和歌山県田辺市',
    '和歌山県の田辺市',
    '和歌山県で田辺市',
  ])('keeps both prefecture and municipality from one free-text answer: %s', (answer) => {
    const history = [
      { role: 'user' as const, content: '賃貸' },
      { role: 'assistant' as const, content: '住みたい都道府県と市区町村を教えてにゃん。' },
    ];
    expect(extractRentalConsultationState(history, answer)).toMatchObject({
      prefecture: '和歌山県',
      area: '田辺市',
    });
    expect(evaluateRentalConsultation(history, answer).response).toContain('家賃の上限');
  });

  it('clears a municipality when the visitor changes only the prefecture', () => {
    expect(extractRentalConsultationState([
      { role: 'user', content: '大阪府堺市で賃貸を探したい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
    ], '兵庫県に変更')).toMatchObject({
      prefecture: '兵庫県',
      area: undefined,
    });
  });

  it.each([
    ['家族は4人です', 4],
    ['3人で暮らします', 3],
    ['5名で入居予定', 5],
    ['大人2人、子ども2人', 4],
  ] as const)('understands household-size wording %s', (answer, expectedSize) => {
    expect(extractRentalConsultationState([], `賃貸で${answer}`)).toMatchObject({
      householdSize: expectedSize,
    });
  });

  it.each([
    ['家賃8万5千円まで', 85_000],
    ['家賃8万5000円まで', 85_000],
    ['家賃の上限は未定', Number.MAX_SAFE_INTEGER],
  ] as const)('normalizes rent wording %s', (answer, expectedRent) => {
    expect(extractRentalConsultationState([], `堺市の賃貸、${answer}`)).toMatchObject({
      maxRentYen: expectedRent,
    });
  });

  it('does not interpret having no budget as an unlimited rent ceiling', () => {
    expect(extractRentalConsultationState([], '予算がないので賃貸は厳しい').maxRentYen).toBeUndefined();
  });

  it('records whether the rent ceiling includes the common fee', () => {
    expect(extractRentalConsultationState([], '堺市の賃貸、共益費込みで10万円まで、1K')).toMatchObject({
      maxRentYen: 100_000,
      includeCommonFee: true,
    });
    expect(extractRentalConsultationState([], '堺市の賃貸、管理費は別で10万円まで、1K')).toMatchObject({
      includeCommonFee: false,
    });
  });

  it.each([
    'こだわりなし',
    '間取りはこだわりなし',
    '間取りはなんでもいい',
  ])('clears an earlier layout when the visitor removes the condition: %s', (answer) => {
    const state = extractRentalConsultationState([
      { role: 'user', content: '堺市で賃貸、家賃10万円、1K' },
      { role: 'assistant', content: '条件に合う居住用賃貸が見つかったにゃん。' },
    ], answer);
    expect(state.layout).toBeUndefined();
    expect(state.hasPreference).toBe(true);
  });

  it('does not return unfiltered recommendations for unsupported rental conditions', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '堺市で賃貸を探したい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
      { role: 'user', content: '10万円まで' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
    ], 'ペット可')).toEqual({
      active: true,
      response: expect.stringMatching(/ペット.*正確に絞り込めない.*公式LINE/su),
    });
  });

  it('can continue after the visitor removes an unsupported condition', () => {
    expect(evaluateRentalConsultation([
      { role: 'user', content: '堺市で賃貸を探したい' },
      { role: 'assistant', content: '家賃の上限を教えてにゃん。' },
      { role: 'user', content: '10万円まで' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
      { role: 'user', content: 'ペット可' },
      { role: 'assistant', content: 'ペット可は正確に絞り込めないにゃん。' },
    ], 'こだわりなし')).toEqual({ active: true });
  });

  it('removes only the unsupported condition when using the recovery button', () => {
    const state = extractRentalConsultationState([
      { role: 'user', content: '堺市で賃貸、家賃10万円' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
      { role: 'user', content: '2LDK、ペット可' },
      { role: 'assistant', content: 'ペットは正確に絞り込めないにゃん。' },
    ], 'ペットを条件から外す');
    expect(state).toMatchObject({ layout: '2LDK' });
    expect(state.unsupportedCondition).toBeUndefined();
  });

  it('keeps an explicit minimum-layout request for family searches', () => {
    expect(extractRentalConsultationState([], '岸和田市で家族4人、家賃10万円、2LDK以上の賃貸')).toMatchObject({
      layout: '2LDK+',
    });
  });
});
