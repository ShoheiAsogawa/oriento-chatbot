import { describe, expect, it } from 'vitest';
import {
  customHomeChoicesForResponse,
  customHomeChoicesForStep,
  evaluateCustomHomeConsultation,
  extractCustomHomeConsultationState,
  extractCustomHomeContact,
  isCustomHomeIntent,
  normalizeCustomHomePhone,
} from '../src/custom-home-consultation';

const user = (content: string) => ({ role: 'user' as const, content });
const assistant = (content: string) => ({ role: 'assistant' as const, content });

describe('custom home consultation', () => {
  it('recognizes custom-home intent without treating ordinary purchase as custom home', () => {
    expect(isCustomHomeIntent('注文住宅を建てたい')).toBe(true);
    expect(isCustomHomeIntent('自由設計で相談したい')).toBe(true);
    expect(isCustomHomeIntent('購入物件を探したい')).toBe(false);
  });

  it('starts by asking whether the visitor owns land', () => {
    expect(evaluateCustomHomeConsultation([], '注文住宅')).toEqual({
      active: true,
      response: expect.stringContaining('土地を持っているか'),
      step: 'land_ownership',
      leadReady: false,
    });
    expect(customHomeChoicesForResponse('注文住宅の相談だね。まず、土地を持っているか教えてにゃん。'))
      .toEqual(customHomeChoicesForStep('land_ownership'));
    expect(customHomeChoicesForStep('land_ownership').map((choice) => choice.value))
      .toEqual(['土地を持っている', '土地を持っていない', '未定']);
    expect(customHomeChoicesForResponse('ご家族の人数や構成を教えてにゃん。まだ決まっていなければ「未定」で大丈夫にゃん。')
      .map((choice) => choice.value)).toContain('未定');
    expect(customHomeChoicesForResponse('土地の所在地を市区町村まで教えてにゃん。分からなければ「未定」で大丈夫にゃん。'))
      .toEqual([{ label: '未定', value: '未定' }]);
  });

  it('collects an owned-land path in the requested order and then asks for lead details', () => {
    const history = [
      user('注文住宅'),
      assistant('まず、土地を持っているか教えてにゃん。'),
      user('土地を持っている'),
      assistant('土地の所在地を市区町村まで教えてにゃん。'),
      user('大阪市北区'),
      assistant('土地の広さを教えてにゃん。'),
      user('35坪'),
      assistant('ご家族の人数や構成を教えてにゃん。'),
      user('4人家族'),
      assistant('希望する間取りを教えてにゃん。'),
      user('4LDK'),
      assistant('建物と土地を含めた予算の目安を教えてにゃん。'),
      user('5000万円まで'),
      assistant('いつ頃の完成・入居を希望しているか教えてにゃん。'),
      user('1年以内'),
      assistant('住まいで重視したいことを教えてにゃん。'),
      user('断熱性能と家事動線'),
      assistant('お名前を教えてにゃん。'),
      user('山田太郎'),
      assistant('お電話番号を教えてにゃん。'),
    ];

    const state = extractCustomHomeConsultationState(history, '090-1234-5678');
    expect(state).toMatchObject({
      landOwnership: 'owned',
      landLocation: '大阪市北区',
      landSizeSqm: expect.closeTo(115.7, 1),
      householdSize: 4,
      layout: '4LDK',
      budgetYen: 50_000_000,
      timing: '1年以内',
      priorities: '断熱性能と家事動線',
      contactNameSet: true,
      contactPhoneLast4: '5678',
      leadReady: true,
    });
    expect(evaluateCustomHomeConsultation(history, '090-1234-5678')).toEqual({
      active: true,
      step: 'complete',
      leadReady: true,
    });
  });

  it('keeps every intake answer when the full flow exceeds a normal short chat window', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っている'), assistant('土地の所在地を市区町村まで教えてにゃん。'),
      user('大阪府堺市'), assistant('土地の広さを教えてにゃん。㎡または坪で大丈夫にゃん。'),
      user('40坪'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('4人家族'), assistant('希望する間取りや住まい方を教えてにゃん。'),
      user('4LDK'), assistant('建物と諸費用を含めた予算の目安を教えてにゃん。'),
      user('3500万円'), assistant('いつ頃の完成・入居を希望しているか教えてにゃん。'),
      user('1年以内'), assistant('住まいで重視したいことを教えてにゃん。'),
      user('家事動線'), assistant('ここまでの内容を担当者に相談するため、お名前を教えてにゃん。'),
      user('[お名前]'), assistant('担当者からご連絡するため、お電話番号を教えてにゃん。'),
    ];

    expect(history).toHaveLength(20);
    expect(extractCustomHomeConsultationState(history, '[電話番号]')).toMatchObject({
      landOwnership: 'owned',
      landLocation: '大阪府堺市',
      landSizeSet: true,
      householdSize: 4,
      layout: '4LDK',
      budgetYen: 35_000_000,
      timing: '1年以内',
      priorities: '家事動線',
      leadReady: true,
    });
  });

  it('asks for desired area instead of land details when land is not owned', () => {
    const history = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('土地は持っていない'),
      assistant('建てたいエリアを教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, '和歌山市')).toMatchObject({
      active: true,
      response: expect.stringContaining('ご家族の人数'),
      step: 'household',
    });
    expect(extractCustomHomeConsultationState(history, '和歌山市')).toMatchObject({
      landOwnership: 'not_owned',
      desiredArea: '和歌山市',
      desiredAreaSet: true,
      landLocationSet: false,
      landSizeSet: false,
    });
  });

  it('supports button-friendly answers and no-preference responses', () => {
    const history = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'),
      assistant('建てたいエリアを教えてにゃん。'),
      user('堺市'),
      assistant('ご家族の人数や構成を教えてにゃん。'),
      user('4人'),
      assistant('希望する間取りを教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, 'こだわりなし')).toMatchObject({ step: 'budget' });
    const choices = customHomeChoicesForResponse('希望する間取りや住まい方を教えてにゃん。');
    expect(choices.map((choice) => choice.value)).toContain('平屋');
  });

  it('advances when the budget button asks to consult rather than naming an amount', () => {
    const history = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'),
      assistant('建てたいエリアを教えてにゃん。'),
      user('堺市'),
      assistant('ご家族の人数や構成を教えてにゃん。'),
      user('4人'),
      assistant('希望する間取りや住まい方を教えてにゃん。'),
      user('3LDK'),
      assistant('土地と建物を含めた総予算の目安を教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, '相談したい')).toMatchObject({ step: 'timing' });
    const state = extractCustomHomeConsultationState(history, '相談したい');
    expect(state).toMatchObject({ budgetSet: true });
    expect(state).not.toHaveProperty('budgetYen');
  });

  it('does not treat a budget button as the move-in date', () => {
    const history = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'),
      assistant('建てたいエリアを教えてにゃん。'),
      user('未定'),
      assistant('ご家族の人数や構成を教えてにゃん。'),
      user('2人'),
      assistant('希望する間取りや住まい方を教えてにゃん。'),
      user('4LDK'),
      assistant('土地と建物を含めた総予算の目安を教えてにゃん。例：4,000万円まで、未定、相談したいなどで大丈夫にゃん。'),
    ];

    const afterBudget = extractCustomHomeConsultationState(history, '5,000万円まで');
    expect(afterBudget).toMatchObject({
      landOwnership: 'not_owned',
      desiredArea: '未定（相談希望）',
      householdSize: 2,
      layout: '4LDK',
      budgetYen: 50_000_000,
      budgetSet: true,
      timingSet: false,
    });
    expect(afterBudget.timing).toBeUndefined();
    expect(evaluateCustomHomeConsultation(history, '5,000万円まで')).toMatchObject({
      step: 'timing',
      response: expect.stringContaining('入居'),
    });

    const afterTiming = [
      ...history,
      user('5,000万円まで'),
      assistant('いつ頃の完成・入居を希望しているか教えてにゃん。未定でも大丈夫にゃん。'),
    ];
    expect(extractCustomHomeConsultationState(afterTiming, 'できるだけ早く')).toMatchObject({
      budgetYen: 50_000_000,
      timing: 'できるだけ早く',
      timingSet: true,
    });
    expect(evaluateCustomHomeConsultation(afterTiming, 'できるだけ早く')).toMatchObject({ step: 'priorities' });
  });

  it('does not fill timing from an earlier 未定 answer to another question', () => {
    const history = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('未定'),
      assistant('建てたいエリアを教えてにゃん。'),
    ];
    const state = extractCustomHomeConsultationState(history, '未定');
    expect(state).toMatchObject({
      landOwnership: 'unknown',
      desiredArea: '未定（相談希望）',
      timingSet: false,
    });
    expect(evaluateCustomHomeConsultation(history, '未定')).toMatchObject({ step: 'household' });
  });

  it('accepts unknown answers for every non-contact intake question and keeps the uncertainty explicit', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('わからない'), assistant('建てたいエリアを教えてにゃん。'),
      user('未定'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('わからない'), assistant('希望する間取りや住まい方を教えてにゃん。'),
      user('相談したい'), assistant('土地と建物を含めた総予算の目安を教えてにゃん。'),
      user('未定'), assistant('いつ頃の完成・入居を希望しているか教えてにゃん。'),
      user('まだわからない'), assistant('住まいで重視したいことを教えてにゃん。'),
      user('相談したい'), assistant('お名前を教えてにゃん。'),
    ];
    const state = extractCustomHomeConsultationState(history, '山田太郎');
    expect(state).toMatchObject({
      landOwnership: 'unknown',
      landOwnershipSet: true,
      desiredArea: '未定（相談希望）',
      desiredAreaSet: true,
      householdDescription: '未定（相談希望）',
      householdSet: true,
      layout: '未定（相談希望）',
      layoutSet: true,
      budgetNote: '未定（相談希望）',
      budgetSet: true,
      timing: '未定（相談希望）',
      timingSet: true,
      priorities: '相談したい',
      prioritiesSet: true,
      contactNameSet: true,
    });
    expect(evaluateCustomHomeConsultation(history, '山田太郎')).toMatchObject({
      active: true,
      step: 'contact_phone',
    });
  });

  it('keeps a substantive unknown answer when it has a polite acknowledgement attached', () => {
    const history = [
      user('注文住宅'),
      assistant('まず、土地を持っているか教えてにゃん。'),
    ];

    expect(extractCustomHomeConsultationState(history, 'まだわからない、ありがとう')).toMatchObject({
      landOwnership: 'unknown',
      landOwnershipSet: true,
    });
    expect(evaluateCustomHomeConsultation(history, 'まだわからない、ありがとう')).toMatchObject({
      active: true,
      step: 'desired_area',
    });
  });

  it('keeps a free-text location when it has a polite acknowledgement attached', () => {
    const history = [
      user('注文住宅'),
      assistant('まず、土地を持っているか教えてにゃん。'),
      user('土地を持っていない'),
      assistant('建てたいエリアを教えてにゃん。'),
    ];

    expect(extractCustomHomeConsultationState(history, '実家の近くがいいです、ありがとう')).toMatchObject({
      desiredArea: '実家の近くがいいです',
      desiredAreaSet: true,
    });
    expect(evaluateCustomHomeConsultation(history, '実家の近くがいいです、ありがとう')).toMatchObject({
      active: true,
      step: 'household',
    });
  });

  it.each([
    ['あります', 'owned', 'land_location'],
    ['持っていません', 'not_owned', 'desired_area'],
    ['いいえ', 'not_owned', 'desired_area'],
  ] as const)('accepts a short land ownership reply: %s', (reply, ownership, nextStep) => {
    const history = [
      user('注文住宅'),
      assistant('まず、土地を持っているか教えてにゃん。'),
    ];

    expect(extractCustomHomeConsultationState(history, reply)).toMatchObject({
      landOwnership: ownership,
      landOwnershipSet: true,
    });
    expect(evaluateCustomHomeConsultation(history, reply)).toMatchObject({
      active: true,
      step: nextStep,
    });
  });

  it('answers a tsubo clarification helpfully without recording it as land size', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っている'), assistant('土地の所在地を教えてにゃん。'),
      user('大阪市'), assistant('土地の広さを教えてにゃん。㎡または坪で大丈夫にゃん。'),
    ];
    const decision = evaluateCustomHomeConsultation(history, '何坪ぐらい？');
    expect(decision).toMatchObject({ active: true, step: 'land_size' });
    expect(decision.response).toContain('30〜40坪前後');
    expect(extractCustomHomeConsultationState(history, '何坪ぐらい？')).toMatchObject({
      landOwnership: 'owned',
      landSizeSet: false,
    });
  });

  it('advances on useful free-text answers even when they do not match a preset pattern', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('家族と相談中'), assistant('建てたいエリアを教えてにゃん。'),
      user('実家の近く'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('夫婦と子ども'), assistant('希望する間取りや住まい方を教えてにゃん。'),
    ];
    expect(extractCustomHomeConsultationState(history, '暮らしやすければ大丈夫')).toMatchObject({
      landOwnership: 'unknown',
      desiredArea: '実家の近く',
      householdDescription: '夫婦と子ども',
      layout: '暮らしやすければ大丈夫',
      landOwnershipSet: true,
      desiredAreaSet: true,
      householdSet: true,
      layoutSet: true,
    });
    expect(evaluateCustomHomeConsultation(history, '暮らしやすければ大丈夫')).toMatchObject({
      active: true,
      step: 'budget',
    });
  });

  it('does not treat a land-size question as an answer to land ownership', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
    ];
    expect(extractCustomHomeConsultationState(history, '何坪ぐらいが目安？')).toMatchObject({
      landOwnershipSet: false,
    });
    expect(evaluateCustomHomeConsultation(history, '何坪ぐらいが目安？')).toMatchObject({
      active: true,
      step: 'land_ownership',
      response: expect.stringContaining('30〜40坪前後'),
    });
  });

  it('normalizes and validates Japanese phone numbers without putting raw phone in state', () => {
    expect(normalizeCustomHomePhone('090-1234-5678')).toBe('09012345678');
    expect(normalizeCustomHomePhone('+81 90 1234 5678')).toBe('09012345678');
    expect(normalizeCustomHomePhone('03-1234-5678')).toBe('0312345678');
    expect(normalizeCustomHomePhone('090ー1234ー5678')).toBe('09012345678');
    expect(normalizeCustomHomePhone('090-1234-56')).toBe('090123456');
    expect(normalizeCustomHomePhone('090-1234-56789')).toBe('090123456789');
    expect(normalizeCustomHomePhone('12345')).toBeUndefined();
    expect(normalizeCustomHomePhone('090-秘密', { lenient: true })).toBe('090');
    expect(extractCustomHomeContact('名前は山田太郎、電話番号は090-1234-5678')).toEqual({
      name: '山田太郎',
      phone: '09012345678',
      phoneLast4: '5678',
    });
    expect(extractCustomHomeContact('山田太郎 090-1234-5678', { expectingName: true })).toEqual({
      name: '山田太郎',
      phone: '09012345678',
      phoneLast4: '5678',
    });
    const state = extractCustomHomeConsultationState([
      user('注文住宅'),
      assistant('お名前を教えてにゃん。'),
      user('山田太郎'),
      assistant('お電話番号を教えてにゃん。'),
    ], '[電話番号]');
    expect(state.contactPhoneLast4).toBe('番号入力済み');
    expect(JSON.stringify(state)).not.toContain('09012345678');
    expect(JSON.stringify(state)).not.toContain('山田太郎');
  });

  it('accepts redacted contact markers without retaining PII', () => {
    const state = extractCustomHomeConsultationState([
      user('注文住宅'),
      assistant('お名前を教えてにゃん。'),
    ], '[お名前]');
    const withPhone = extractCustomHomeConsultationState([
      user('注文住宅'),
      assistant('お名前を教えてにゃん。'),
      user('[お名前]'),
      assistant('お電話番号を教えてにゃん。'),
    ], '[電話番号]');
    expect(state.contactNameSet).toBe(true);
    expect(withPhone).toMatchObject({ contactNameSet: true, contactPhoneSet: true, contactPhoneLast4: '番号入力済み' });
    expect(JSON.stringify(withPhone)).not.toMatch(/お名前|電話番号/);
  });

  it.each([
    ['81 90 1234 5678', '09012345678'],
    ['0081-90-1234-5678', '09012345678'],
    ['+81 6 1234 5678', '0612345678'],
    ['090.1234.5678', '09012345678'],
    ['0120-123-456', '0120123456'],
    ['090ー1234ー5678', '09012345678'],
    ['０９０−１２３４−５６７８', '09012345678'],
    ['090-1234-56', '090123456'],
  ])('accepts common phone format: %s', (input, expected) => {
    expect(normalizeCustomHomePhone(input)).toBe(expected);
    expect(extractCustomHomeContact(input, { expectingName: true }).phone).toBe(expected);
  });

  it.each([
    'https://page.line.me/089wmudt',
  ])('does not mistake an invalid/contact link value for a phone: %s', (input) => {
    expect(extractCustomHomeContact(input, { expectingName: true })).toEqual({});
  });

  it('accepts a short or messy number while the phone prompt is showing', () => {
    expect(extractCustomHomeContact('090-秘密', { expectingPhone: true }).phone).toBe('090');
    expect(extractCustomHomeContact('内線1234', { expectingPhone: true }).phone).toBe('1234');
  });

  it('does not treat an official LINE link or instruction as the visitor name', () => {
    const history = [
      user('注文住宅'),
      assistant('お名前を教えてにゃん。'),
    ];
    expect(extractCustomHomeContact('公式LINEから問い合わせてにゃん', { expectingName: true })).toEqual({});
    expect(extractCustomHomeContact('https://page.line.me/089wmudt', { expectingName: true })).toEqual({});
    expect(evaluateCustomHomeConsultation(history, '公式LINEから問い合わせてにゃん')).toMatchObject({ active: true });
  });

  it.each(['😀', '😂😂', '！！！'])('does not accept emoji/punctuation-only input as a name', (input) => {
    expect(extractCustomHomeContact(input, { expectingName: true })).toEqual({});
  });

  it('keeps the contact steps active when a visitor declines to provide contact details', () => {
    const nameHistory = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('未定'), assistant('建てたいエリアを教えてにゃん。'),
      user('未定'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('未定'), assistant('希望する間取りや住まい方を教えてにゃん。'),
      user('未定'), assistant('総予算を教えてにゃん。'),
      user('未定'), assistant('いつ頃の完成・入居を希望しているか教えてにゃん。'),
      user('未定'), assistant('住まいで重視したいことを教えてにゃん。'),
      user('未定'), assistant('お名前を教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(nameHistory, '匿名希望')).toMatchObject({
      active: true,
      step: 'contact_name',
    });
    const phoneHistory = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'), assistant('建てたいエリアを教えてにゃん。'),
      user('大阪市'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('4人'), assistant('希望する間取りを教えてにゃん。'),
      user('3LDK'), assistant('予算を教えてにゃん。'),
      user('5000万円'), assistant('いつ頃の完成・入居を希望しているか教えてにゃん。'),
      user('1年以内'), assistant('住まいで重視したいことを教えてにゃん。'),
      user('家事動線'), assistant('お名前を教えてにゃん。'),
      user('[お名前]'), assistant('お電話番号を教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(phoneHistory, 'なし')).toMatchObject({
      active: true,
      step: 'contact_phone',
    });
  });

  it('does not record emoji-only intake answers as valid criteria', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'), assistant('建てたいエリアを教えてにゃん。'),
    ];
    const state = extractCustomHomeConsultationState(history, '😀');
    expect(state.desiredAreaSet).toBe(false);
    expect(evaluateCustomHomeConsultation(history, '😀')).toMatchObject({
      active: true,
      step: 'desired_area',
    });
  });

  it('does not record a URL as a land location or numeric intake answer', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っている'), assistant('土地の所在地を教えてにゃん。'),
    ];
    const url = 'https://example.com/5000万円/150坪';
    const state = extractCustomHomeConsultationState(history, url);
    expect(state.landLocationSet).toBe(false);
    expect(state.landSizeSet).toBe(false);
    expect(state.budgetSet).toBe(false);
    expect(evaluateCustomHomeConsultation(history, url)).toMatchObject({
      active: true,
      step: 'land_location',
    });
  });

  it('does not complete the phone step from a phone-shaped value entered as budget', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'), assistant('建てたいエリアを教えてにゃん。'),
      user('大阪市'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('4人'), assistant('希望する間取りを教えてにゃん。'),
      user('3LDK'), assistant('土地と建物を含めた総予算の目安を教えてにゃん。'),
    ];
    const state = extractCustomHomeConsultationState(history, '09012345678');
    expect(state.budgetSet).toBe(true);
    expect(state.contactPhoneSet).toBe(false);
    expect(evaluateCustomHomeConsultation(history, '09012345678')).toMatchObject({ step: 'timing' });
  });

  it.each(['匿名で', '名前は教えたくない', '個人情報が心配'])('offers LINE without storing a refused name: %s', (answer) => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('未定'), assistant('建てたいエリアを教えてにゃん。'),
      user('未定'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('未定'), assistant('希望する間取りを教えてにゃん。'),
      user('未定'), assistant('総予算を教えてにゃん。'),
      user('未定'), assistant('入居時期を教えてにゃん。'),
      user('未定'), assistant('重視したいことを教えてにゃん。'),
      user('未定'), assistant('お名前を教えてにゃん。'),
    ];
    expect(extractCustomHomeContact(answer, { expectingName: true }).name).toBeUndefined();
    expect(evaluateCustomHomeConsultation(history, answer)).toMatchObject({
      active: true,
      step: 'contact_name',
      response: expect.stringContaining('公式LINE'),
    });
  });

  it.each(['電話番号は教えたくない', '後で', 'LINEで相談する'])('offers LINE without accepting a refused phone: %s', (answer) => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('未定'), assistant('建てたいエリアを教えてにゃん。'),
      user('未定'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('未定'), assistant('希望する間取りを教えてにゃん。'),
      user('未定'), assistant('総予算を教えてにゃん。'),
      user('未定'), assistant('入居時期を教えてにゃん。'),
      user('未定'), assistant('重視したいことを教えてにゃん。'),
      user('未定'), assistant('お名前を教えてにゃん。'),
      user('[お名前]'), assistant('お電話番号を教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, answer)).toMatchObject({
      active: true,
      step: 'contact_phone',
      response: expect.stringContaining('公式LINE'),
      leadReady: false,
    });
  });

  it('does not resume a completed lead when the visitor later sends a detour', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'), assistant('建てたいエリアを教えてにゃん。'),
      user('大阪市'), assistant('ご家族の人数や構成を教えてにゃん。'),
      user('4人'), assistant('希望する間取りを教えてにゃん。'),
      user('3LDK'), assistant('予算を教えてにゃん。'),
      user('5000万円'), assistant('いつ頃の完成・入居を希望しているか教えてにゃん。'),
      user('1年以内'), assistant('住まいで重視したいことを教えてにゃん。'),
      user('家事動線'), assistant('お名前を教えてにゃん。'),
      user('[お名前]'), assistant('お電話番号を教えてにゃん。'),
      user('[電話番号]'), assistant('ご相談を受け付けたにゃん。'),
    ];
    expect(extractCustomHomeConsultationState(history, '')).toMatchObject({ leadReady: true });
    expect(evaluateCustomHomeConsultation(history, 'ありがとう')).toEqual({ active: false });
    expect(evaluateCustomHomeConsultation(history, '購入物件を探したい')).toEqual({ active: false });
    expect(evaluateCustomHomeConsultation(history, '注文住宅')).toMatchObject({
      active: true,
      step: 'land_ownership',
    });
  });

  it.each(['やり直し', 'リセット', '最初から', 'キャンセル', 'やめる'])('treats %s as a hard reset boundary', (reset) => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'), assistant('建てたいエリアを教えてにゃん。'),
      user(reset), assistant('了解にゃん。物件探しを最初からやり直すなら「物件を探す」と送ってにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, '大阪府')).toEqual({ active: false });
    expect(evaluateCustomHomeConsultation(history, '未定')).toEqual({ active: false });
    expect(evaluateCustomHomeConsultation(history, '注文住宅')).toMatchObject({
      active: true,
      step: 'land_ownership',
    });
  });

  it.each([
    '注文住宅から購入に切り替え',
    '注文住宅から賃貸へ変更',
    '注文住宅じゃなくて購入',
    '注文住宅ではなく賃貸',
    '注文住宅をやめて購入',
    '購入に切り替え',
    '賃貸へ変更',
  ])('stops custom-home intake on an explicit mode switch: %s', (message) => {
    const history = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, message)).toEqual({ active: false });
  });

  it.each([
    '注文住宅とは？',
    '注文住宅と購入はどっちがいい？',
    '建売と注文住宅の違いを教えて',
  ])('leaves an explanation or comparison question to the conversational answer path: %s', (message) => {
    expect(evaluateCustomHomeConsultation([], message)).toEqual({ active: false });
  });

  it('starts custom-home intake when switching from purchase to custom home', () => {
    expect(evaluateCustomHomeConsultation([
      user('購入'),
      assistant('希望の都道府県を選んでにゃん。'),
    ], '購入から注文住宅に切り替え')).toMatchObject({ active: true, step: 'land_ownership' });
  });

  it('does not revive custom-home intake after a switch sentence that mentions both modes', () => {
    const history = [
      user('注文住宅'), assistant('土地を持っているか教えてにゃん。'),
      user('注文住宅から購入に切り替え'),
      assistant('購入物件を探すにゃん。まず、希望の都道府県を選んでにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, '広島県')).toEqual({ active: false });
  });

  it('does not hijack mode switches or unrelated conversation', () => {
    const history = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, '購入')).toEqual({ active: false });
    expect(evaluateCustomHomeConsultation(history, '購入物件を探したい')).toEqual({ active: false });
    expect(evaluateCustomHomeConsultation(history, '賃貸物件を探したい')).toEqual({ active: false });
    expect(evaluateCustomHomeConsultation(history, 'あなたはだれ？')).toEqual({ active: false });
  });

  it('does not mistake a purchase type prompt containing こだわり for a custom-home intake', () => {
    const purchaseHistory = [
      user('物件を探す'),
      assistant('住まい探しだね。購入・注文住宅・賃貸のどれを考えているか選んでにゃん。'),
      user('購入'),
      assistant('購入物件を一緒に探すにゃん。まず、希望の都道府県を選んでにゃん。'),
      user('大阪府'),
      assistant('大阪府で購入物件を探すにゃん。次に、市区町村を選んでにゃん。'),
      user('大阪市'),
      assistant('大阪市で購入物件を探すにゃん。次に区を選んでにゃん。'),
      user('阿倍野区'),
      assistant('購入する物件の種類を選んでにゃん。まだ決まっていなければ、こだわりなしでも探せるにゃん。'),
    ];

    expect(evaluateCustomHomeConsultation(purchaseHistory, '物件種別はこだわりなし')).toEqual({ active: false });
  });

  it('stops the old custom-home intake after switching to property purchase', () => {
    const history = [
      user('注文住宅'),
      assistant('まず、土地を持っているか教えてにゃん。'),
      user('土地を持っていない'),
      assistant('建てたいエリアを教えてにゃん。'),
      user('物件を探す'),
      assistant('住まい探しだね。購入・注文住宅・賃貸のどれを考えているか選んでにゃん。'),
      user('購入'),
      assistant('購入物件を一緒に探すにゃん。まず、希望の都道府県を選んでにゃん。'),
    ];

    expect(evaluateCustomHomeConsultation(history, '広島県')).toEqual({ active: false });
  });

  it('resumes after a harmless identity detour using the latest custom-home prompt', () => {
    const history = [
      user('注文住宅'),
      assistant('まず、土地を持っているか教えてにゃん。'),
      user('あなたは誰？'),
      assistant('オリにゃんだよ。住まい探しをお手伝いするにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(history, '土地を持っている')).toMatchObject({
      active: true,
      step: 'land_location',
    });
  });

  it('uses a different budget question depending on land ownership', () => {
    const owned = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っている'),
      assistant('土地の所在地を教えてにゃん。'),
      user('大阪市北区'),
      assistant('土地の広さを教えてにゃん。'),
      user('30坪'),
      assistant('ご家族の人数を教えてにゃん。'),
      user('4人'),
      assistant('希望する間取りを教えてにゃん。'),
      user('3LDK'),
      assistant('予算を教えてにゃん。'),
    ];
    const noLand = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'),
      assistant('建てたいエリアを教えてにゃん。'),
      user('堺市'),
      assistant('ご家族の人数を教えてにゃん。'),
      user('4人'),
      assistant('希望する間取りを教えてにゃん。'),
      user('3LDK'),
      assistant('予算を教えてにゃん。'),
    ];
    expect(evaluateCustomHomeConsultation(owned, '')).toMatchObject({
      response: expect.stringContaining('土地代は除いた'),
      step: 'budget',
    });
    expect(evaluateCustomHomeConsultation(noLand, '')).toMatchObject({
      response: expect.stringContaining('土地と建物を含めた総予算'),
      step: 'budget',
    });
  });

  it('returns no choice buttons for free-text contact prompts', () => {
    expect(customHomeChoicesForResponse('担当者に相談するため、お名前を教えてにゃん。')).toEqual([]);
    expect(customHomeChoicesForResponse('お電話番号を教えてにゃん。')).toEqual([]);
  });
});
