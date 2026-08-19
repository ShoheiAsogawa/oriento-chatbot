import { describe, expect, it } from 'vitest';
import { customHomeIntakeFromState, redactCustomHomeContactTurn } from '../src/custom-home-chat';
import {
  evaluateCustomHomeConsultation,
  extractCustomHomeConsultationState,
} from '../src/custom-home-consultation';
import { evaluatePurchaseConsultation } from '../src/purchase-consultation';
import { evaluateRentalConsultation } from '../src/rental-consultation';

const user = (content: string) => ({ role: 'user' as const, content });
const assistant = (content: string) => ({ role: 'assistant' as const, content });

const readyForNameHistory = () => [
  user('注文住宅'),
  assistant('土地を持っているか教えてにゃん。'),
  user('土地を持っていない'),
  assistant('建てたいエリアを教えてにゃん。'),
  user('大阪市'),
  assistant('ご家族の人数や構成を教えてにゃん。'),
  user('4人'),
  assistant('希望する間取りや住まい方を教えてにゃん。'),
  user('3LDK'),
  assistant('土地と建物を含めた総予算の目安を教えてにゃん。'),
  user('5,000万円まで'),
  assistant('いつ頃の完成・入居を希望しているか教えてにゃん。'),
  user('1年以内'),
  assistant('住まいで重視したいことを教えてにゃん。'),
  user('家事動線'),
  assistant('ここまでの内容を担当者に相談するため、お名前を教えてにゃん。'),
];

describe('custom-home chat integration boundaries', () => {
  it('replaces a name with a marker before the turn can enter chat history', () => {
    const history = readyForNameHistory();
    const turn = redactCustomHomeContactTurn(history, '山田 太郎');

    expect(turn).toMatchObject({ redacted: '[お名前]', contact: { name: '山田 太郎' }, expectedStep: 'contact_name' });
    expect(JSON.stringify(turn.redacted)).not.toContain('山田');
    const state = extractCustomHomeConsultationState(history, turn.redacted);
    expect(state.contactNameSet).toBe(true);
    expect(JSON.stringify(state)).not.toContain('山田');
  });

  it.each(['おすすめの病院を教えて', '物件を探したい', '名無し', '連絡先を送信しました'])
  ('does not redact an unrelated or refused reply as a visitor name: %s', (message) => {
    const turn = redactCustomHomeContactTurn(readyForNameHistory(), message);
    expect(turn.redacted).toBe(message);
    expect(turn.contact.name).toBeUndefined();
  });

  it('keeps a final phone number out of chat state while completing the lead handoff', () => {
    const history = [
      ...readyForNameHistory(),
      user('[お名前]'),
      assistant('お電話番号を教えてにゃん。'),
    ];
    const turn = redactCustomHomeContactTurn(history, '090-1234-5678');

    expect(turn).toMatchObject({ redacted: '[電話番号]', contact: { phone: '09012345678' }, expectedStep: 'contact_phone' });
    const state = extractCustomHomeConsultationState(history, turn.redacted);
    expect(state).toMatchObject({ contactNameSet: true, contactPhoneSet: true, leadReady: true });
    expect(JSON.stringify(state)).not.toContain('09012345678');
    expect(evaluateCustomHomeConsultation(history, turn.redacted)).toMatchObject({ leadReady: true });
  });

  it('allows name and phone in one final contact turn without leaking either marker payload', () => {
    const history = readyForNameHistory();
    const turn = redactCustomHomeContactTurn(history, '山田太郎 090-1234-5678');

    expect(turn).toMatchObject({ redacted: '[お名前] [電話番号]', contact: { name: '山田太郎', phone: '09012345678' } });
    expect(extractCustomHomeConsultationState(history, turn.redacted).leadReady).toBe(true);
  });

  it('passes only non-contact intake fields to encrypted lead storage', () => {
    const state = extractCustomHomeConsultationState([
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っていない'),
      assistant('建てたいエリアを教えてにゃん。'),
      user('大阪市'),
      assistant('お名前を教えてにゃん。'),
    ], '[お名前]');

    expect(customHomeIntakeFromState(state)).toEqual({ landOwnership: 'not_owned', desiredArea: '大阪市' });
    expect(Object.keys(customHomeIntakeFromState(state))).not.toContain('contactName');
  });

  it('fully resets custom-home criteria when the visitor switches to purchase or rental', () => {
    const history = [
      user('注文住宅'),
      assistant('土地を持っているか教えてにゃん。'),
      user('土地を持っている'),
      assistant('土地の所在地を市区町村まで教えてにゃん。'),
      user('大阪市北区'),
    ];

    expect(evaluateCustomHomeConsultation(history, '購入物件を探したい')).toEqual({ active: false });
    expect(evaluatePurchaseConsultation(history, '購入物件を探したい')).toMatchObject({
      active: true,
      response: expect.stringContaining('希望の都道府県'),
    });
    expect(evaluateCustomHomeConsultation(history, '賃貸物件を探したい')).toEqual({ active: false });
    expect(evaluateRentalConsultation(history, '賃貸物件を探したい')).toMatchObject({
      active: true,
      response: expect.stringContaining('住みたい都道府県'),
    });
  });
});
