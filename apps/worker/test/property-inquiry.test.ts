import { describe, expect, it } from 'vitest';
import type { ConversationContextMessage } from '../src/conversation-context';
import {
  evaluatePropertyInquiry,
  extractPropertyInquiryState,
  kindFromInquiryMessage,
  propertyInquiryChoicesForResponse,
  propertyInquiryFollowUp,
  propertyInquiryPickerForResponse,
  viewingDayChoices,
  viewingDayFromMessage,
  viewingDatetimeFromMessage,
  viewingTimeFromMessage,
} from '../src/property-inquiry';
import { redactPropertyInquiryTurn } from '../src/property-inquiry-chat';

const user = (content: string): ConversationContextMessage => ({ role: 'user', content });
const assistant = (content: string): ConversationContextMessage => ({ role: 'assistant', content });

const frozenNow = new Date('2026-08-26T05:00:00.000Z');

describe('property inquiry flow', () => {
  it('recognizes the three post-result inquiry intents', () => {
    expect(kindFromInquiryMessage('資料請求したい')).toBe('document_request');
    expect(kindFromInquiryMessage('電話で相談したい')).toBe('phone');
    expect(kindFromInquiryMessage('見学したい')).toBe('viewing');
    expect(kindFromInquiryMessage('内見したい')).toBe('viewing');
    expect(kindFromInquiryMessage('もっと見たい')).toBeUndefined();
    expect(kindFromInquiryMessage('物件を探す')).toBeUndefined();
  });

  it('parses calendar and legacy viewing datetime payloads', () => {
    const choices = viewingDayChoices(frozenNow);
    expect(choices[0]?.value).toMatch(/^見学希望日:\d{4}-\d{2}-\d{2}$/u);
    expect(viewingDayFromMessage('見学希望日:2026-08-27')).toBe('2026-08-27');
    expect(viewingTimeFromMessage('見学希望時間:13:00〜15:00')).toBe('13:00〜15:00');
    expect(viewingDatetimeFromMessage('見学希望日時:2026-08-28 15:00')).toBe('2026-08-28 15:00');
    expect(viewingDatetimeFromMessage('見学希望日時:2026-08-28T9:05')).toBe('2026-08-28 09:05');
  });

  it('walks document request fields in order and redacts them', () => {
    const started = evaluatePropertyInquiry([], '資料請求したい');
    expect(started).toMatchObject({ active: true, kind: 'document_request', step: 'contact_name' });
    const askingName = [user('資料請求したい'), assistant(started.response || '')];
    const named = evaluatePropertyInquiry(askingName, '山田 太郎');
    expect(named.step).toBe('contact_address');
    const redactedName = redactPropertyInquiryTurn(askingName, '山田 太郎');
    expect(redactedName.contact.name).toBe('山田 太郎');
    expect(redactedName.redacted).toBe('[お名前]');

    const askingAddress = [...askingName, user('[お名前]'), assistant(named.response || '')];
    const addressed = evaluatePropertyInquiry(askingAddress, '大阪府大阪市北区梅田1-1-1');
    expect(addressed.step).toBe('contact_phone');
    const askingPhone = [...askingAddress, user('[住所]'), assistant(addressed.response || '')];
    const ready = evaluatePropertyInquiry(askingPhone, '090-1234-5678');
    expect(ready.leadReady).toBe(true);
    expect(extractPropertyInquiryState(askingPhone, '090-1234-5678')).toMatchObject({
      kind: 'document_request',
      nameSet: true,
      addressSet: true,
      phoneSet: true,
      leadReady: true,
    });
  });

  it('only asks a phone-consult visitor for name and phone', () => {
    const started = evaluatePropertyInquiry([], '電話で相談したい');
    expect(started.step).toBe('contact_name');
    const askingName = [user('電話で相談したい'), assistant(started.response || '')];
    const named = evaluatePropertyInquiry(askingName, '佐藤 花子');
    expect(named.step).toBe('contact_phone');
    const askingPhone = [...askingName, user('[お名前]'), assistant(named.response || '')];
    expect(evaluatePropertyInquiry(askingPhone, '06-1234-5678').leadReady).toBe(true);
  });

  it('asks for a viewing datetime from the calendar before contact details', () => {
    const started = evaluatePropertyInquiry([], '見学したい');
    expect(started.step).toBe('viewing_datetime');
    expect(started.response).toMatch(/カレンダー/u);
    expect(propertyInquiryChoicesForResponse(started, frozenNow)).toEqual([]);
    expect(propertyInquiryPickerForResponse(started, frozenNow)).toEqual({
      type: 'datetime',
      min: '2026-08-27',
      max: '2026-10-25',
      prefix: '見学希望日時:',
    });
    const asking = [user('見学したい'), assistant(started.response || '')];
    const picked = evaluatePropertyInquiry(asking, '見学希望日時:2026-08-28 15:00');
    expect(picked.step).toBe('contact_name');
    expect(extractPropertyInquiryState(asking, '見学希望日時:2026-08-28 15:00').preferredDatetime).toBe('2026-08-28 15:00');
  });

  it('still accepts a day-then-time flow already in progress', () => {
    const askingDay = [
      user('見学したい'),
      assistant('見学の希望日を選んでにゃん。ボタンから選ぶとかんたんにゃん。'),
    ];
    const pickedDay = evaluatePropertyInquiry(askingDay, '見学希望日:2026-08-28');
    expect(pickedDay.step).toBe('viewing_time');
    const askingTime = [...askingDay, user('見学希望日:2026-08-28'), assistant(pickedDay.response || '')];
    const pickedTime = evaluatePropertyInquiry(askingTime, '見学希望時間:15:00〜17:00');
    expect(pickedTime.step).toBe('contact_name');
    expect(extractPropertyInquiryState(askingTime, '見学希望時間:15:00〜17:00').preferredDatetime).toBe('2026-08-28 15:00〜17:00');
  });

  it('accepts free-text datetime typed instead of the calendar', () => {
    const started = evaluatePropertyInquiry([], '見学したい');
    const asking = [user('見学したい'), assistant(started.response || '')];
    const typed = evaluatePropertyInquiry(asking, '来週の土曜の午後');
    expect(typed.step).toBe('contact_name');
    expect(extractPropertyInquiryState(asking, '来週の土曜の午後').preferredDatetime).toBe('来週の土曜の午後');
  });

  it('leaves the inquiry when the visitor starts a new search', () => {
    const history = [
      user('資料請求したい'),
      assistant('資料をお届けするにゃん。お名前を教えてにゃん。'),
    ];
    expect(evaluatePropertyInquiry(history, '物件を探す').active).toBe(false);
    expect(evaluatePropertyInquiry(history, '賃貸に切り替え').active).toBe(false);
  });

  it('keeps follow-up copy and three side-by-side actions', () => {
    expect(propertyInquiryFollowUp().choices.map((choice) => choice.label)).toEqual(['資料請求', '電話', '見学']);
  });
});
