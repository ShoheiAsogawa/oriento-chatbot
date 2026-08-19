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
    });
  });

  it('normalizes and validates Japanese phone numbers without putting raw phone in state', () => {
    expect(normalizeCustomHomePhone('090-1234-5678')).toBe('09012345678');
    expect(normalizeCustomHomePhone('+81 90 1234 5678')).toBe('09012345678');
    expect(normalizeCustomHomePhone('03-1234-5678')).toBe('0312345678');
    expect(normalizeCustomHomePhone('12345')).toBeUndefined();
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
