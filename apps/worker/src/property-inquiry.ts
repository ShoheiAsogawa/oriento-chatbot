import type { ChatChoice } from './chat-choices';
import type { ConversationContextMessage } from './conversation-context';
import {
  extractCustomHomeContact,
  normalizeCustomHomePhone,
} from './custom-home-consultation';
import { isObviousConversationDetour, wantsOtherPropertyCandidates } from './property-search-continuation';

export type PropertyInquiryKind = 'document_request' | 'phone' | 'viewing';

export type PropertyInquiryStep =
  | 'select_property'
  | 'viewing_datetime'
  | 'viewing_day'
  | 'viewing_time'
  | 'viewing_datetime_text'
  | 'contact_name'
  | 'contact_address'
  | 'contact_phone'
  | 'complete';

export type ChatDatetimePicker = {
  type: 'datetime';
  min: string;
  max: string;
  prefix: string;
};

export type InquiryPropertyOption = {
  title: string;
  url?: string;
};

export type PropertyInquiryDecision = {
  active: boolean;
  response?: string;
  step?: PropertyInquiryStep;
  leadReady?: boolean;
  kind?: PropertyInquiryKind;
  picker?: ChatDatetimePicker;
  properties?: InquiryPropertyOption[];
};

export type PropertyInquiryContact = {
  name?: string;
  phone?: string;
  address?: string;
};

export type PropertyInquiryState = {
  kind?: PropertyInquiryKind;
  preferredDate?: string;
  preferredTime?: string;
  preferredDatetime?: string;
  wantsFreeDatetime: boolean;
  propertySet: boolean;
  selectedProperty?: InquiryPropertyOption;
  needsPropertyChoice: boolean;
  nameSet: boolean;
  addressSet: boolean;
  phoneSet: boolean;
  leadReady: boolean;
};

export const PROPERTY_INQUIRY_VALUES = {
  document: '資料請求したい',
  phone: '電話で相談したい',
  viewing: '見学したい',
  viewingFreeText: '見学日時を自分で書く',
  propertyUndecided: '対象物件:未定',
} as const;

export const PROPERTY_INQUIRY_FOLLOW_UP_ANSWER =
  '気に入った物件はあったかにゃ？資料請求・電話・見学から選んでにゃん。';

export const PROPERTY_INQUIRY_FOLLOW_UP_CHOICES: ChatChoice[] = [
  { label: '資料請求', value: PROPERTY_INQUIRY_VALUES.document },
  { label: '電話', value: PROPERTY_INQUIRY_VALUES.phone },
  { label: '見学', value: PROPERTY_INQUIRY_VALUES.viewing },
];

const VIEWING_DAY_PREFIX = '見学希望日:';
const VIEWING_TIME_PREFIX = '見学希望時間:';
const VIEWING_DATETIME_PREFIX = '見学希望日時:';
const PROPERTY_SELECT_PREFIX = '対象物件:';
const WEEKDAYS = '日月火水木金土';
const MODE_SWITCH = /^(?:(?:賃貸|購入)(?:物件)?(?:を?(?:探す|探したい)|に変更|で探したい|がいい|を希望|にしたい|したい|に切り替え|へ切り替え|へ変更)?|(?:注文住宅|注文建築|自由設計)(?:(?:から|じゃなくて?|ではなく|をやめて?)\s*(?:賃貸|購入)|.*(?:賃貸|購入).*(?:切り替え|変更|探したい|にする))|物件を?(?:探す|探したい)|物件探し(?:をしたい|したい)?)(?:[。！!？?])?$/u;
const RESET_INTENT = /^(?:やり直し|リセット|最初から|キャンセル|やめる)[。！!？?]*$/u;
const DOCUMENT_INTENT = /(?:資料(?:を?(?:請求|希望|ください|下さい|ほしい|欲しい|送って|ください))|パンフレット|間取り図)/u;
const PHONE_INTENT = /(?:(?:電話|お電話)(?:で|を)?(?:相談|連絡|して)|折り返し.*(?:電話|連絡)|電話相談)/u;
const VIEWING_INTENT = /(?:(?:見学|内見|内覧)(?:を)?(?:したい|予約)|見に行きたい)/u;
const NAME_PROMPT = /(?:お名前|氏名|名前).*(?:教えて|聞かせ|入力)/u;
const ADDRESS_PROMPT = /(?:住所|ご住所|届ける住所|現在の(?:ご)?住所).*(?:教えて|聞かせ|入力|書ける)/u;
const PHONE_PROMPT = /(?:電話番号|連絡用の電話).*(?:教えて|入力|聞かせ)/u;
const PROPERTY_PROMPT = /どの物件(?:を見学したい|の資料|について相談)|候補から選んでにゃん/u;
const PHONE_RETRY_PROMPT = /お電話番号を確認できなかった/u;
const DATETIME_TEXT_PROMPT = /(?:希望日時を(?:自由に|そのまま)|希望日時を[、，].*(?:教えて|書いて)|日時を(?:教えて|書いて))/u;
const NAME_REDACTED = /\[お名前\]/u;
const PHONE_REDACTED = /\[電話番号\]/u;
const ADDRESS_REDACTED = /\[住所\]/u;
const CONTACT_LINK_OR_URL = /(?:https?:\/\/|www\.|line\.me|公式\s*LINE|LINEから|リンク|URL)/iu;
const CONTACT_DECLINE = /(?:^(?:なし|ない|ありません|未定|後で|あとで|匿名(?:で|希望)?|名無し|教えたくない|言いたくない|入力したくない)[。！!？?]?$|(?:名前|氏名|電話番号|連絡先|住所|個人情報).*(?:教えたくない|言いたくない|入力したくない))/u;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const ADDRESS_HINT = /(?:都|道|府|県|市|区|町|村|丁目|番地|号|マンション|アパート|ビル|\d[-−ー]\d)/u;
const VIEWING_DATE_HINT = /(?:\d{1,2}\s*[\/月]\s*\d{1,2}|\d{4}-\d{2}-\d{2}|明日|あさって|今週末|来週|平日|土日|[月火水木金土日]曜)/u;
const VIEWING_TIME_HINT = /(?:\d{1,2}\s*時|\d{1,2}:\d{2}|午前|午後|夕方|朝|夜|昼過ぎ|時間は相談|相談して決める)/u;

const KIND_BY_VALUE: Record<string, PropertyInquiryKind> = {
  [PROPERTY_INQUIRY_VALUES.document]: 'document_request',
  [PROPERTY_INQUIRY_VALUES.phone]: 'phone',
  [PROPERTY_INQUIRY_VALUES.viewing]: 'viewing',
};

function normalize(value: string) {
  return value.normalize('NFKC').trim();
}

function hasMeaningfulText(value: string) {
  return /[\p{L}\p{N}]/u.test(value);
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function jstCalendarDate(now: Date, dayOffset = 0) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() + dayOffset));
}

function isoDay(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function formatDayLabel(date: Date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}（${WEEKDAYS[date.getUTCDay()]}）`;
}

export function viewingDayChoices(now = new Date()): ChatChoice[] {
  const tomorrow = jstCalendarDate(now, 1);
  const dayAfter = jstCalendarDate(now, 2);
  let saturdayOffset = 1;
  while (jstCalendarDate(now, saturdayOffset).getUTCDay() !== 6) saturdayOffset += 1;
  let sundayOffset = 1;
  while (jstCalendarDate(now, sundayOffset).getUTCDay() !== 0) sundayOffset += 1;
  const candidates = [
    { date: tomorrow, hint: '明日' },
    { date: dayAfter, hint: 'あさって' },
    { date: jstCalendarDate(now, saturdayOffset), hint: '土曜' },
    { date: jstCalendarDate(now, sundayOffset), hint: '日曜' },
    { date: jstCalendarDate(now, saturdayOffset + 7), hint: '次の土曜' },
  ];
  const seen = new Set<string>();
  const unique = candidates.filter((item) => {
    const key = isoDay(item.date);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [
    ...unique.slice(0, 5).map((item) => ({
      label: `${item.hint} ${formatDayLabel(item.date)}`,
      value: `${VIEWING_DAY_PREFIX}${isoDay(item.date)}`,
    })),
    { label: '希望日を自分で書く', value: PROPERTY_INQUIRY_VALUES.viewingFreeText },
  ];
}

export const VIEWING_TIME_CHOICES: ChatChoice[] = [
  { label: '10〜12時', value: `${VIEWING_TIME_PREFIX}10:00〜12:00` },
  { label: '13〜15時', value: `${VIEWING_TIME_PREFIX}13:00〜15:00` },
  { label: '15〜17時', value: `${VIEWING_TIME_PREFIX}15:00〜17:00` },
  { label: '17〜19時', value: `${VIEWING_TIME_PREFIX}17:00〜19:00` },
  { label: '時間は相談', value: `${VIEWING_TIME_PREFIX}相談して決める` },
];

export function propertyInquiryFollowUp() {
  return {
    answer: PROPERTY_INQUIRY_FOLLOW_UP_ANSWER,
    choices: PROPERTY_INQUIRY_FOLLOW_UP_CHOICES,
  };
}

export function kindFromInquiryMessage(content: string): PropertyInquiryKind | undefined {
  const normalized = normalize(content);
  if (KIND_BY_VALUE[normalized]) return KIND_BY_VALUE[normalized];
  if (DOCUMENT_INTENT.test(normalized)) return 'document_request';
  if (PHONE_INTENT.test(normalized)) return 'phone';
  if (VIEWING_INTENT.test(normalized)) return 'viewing';
  return undefined;
}

function isModeSwitch(content: string) {
  const normalized = normalize(content);
  return MODE_SWITCH.test(normalized)
    || RESET_INTENT.test(normalized)
    || wantsOtherPropertyCandidates(normalized);
}

function isRealIsoDay(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isRealClockTime(hour: string, minute: string) {
  const hours = Number(hour);
  const minutes = Number(minute);
  return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isViewingDayInWindow(iso: string, now = new Date()) {
  const min = isoDay(jstCalendarDate(now, 1));
  const max = isoDay(jstCalendarDate(now, 60));
  return iso >= min && iso <= max;
}

export function viewingDayFromMessage(content: string): string | undefined {
  const normalized = normalize(content);
  if (normalized.startsWith(VIEWING_DAY_PREFIX)) {
    const iso = normalized.slice(VIEWING_DAY_PREFIX.length);
    return isRealIsoDay(iso) ? iso : undefined;
  }
  return undefined;
}

export function viewingTimeFromMessage(content: string): string | undefined {
  const normalized = normalize(content);
  if (normalized.startsWith(VIEWING_TIME_PREFIX)) {
    const slot = normalized.slice(VIEWING_TIME_PREFIX.length).trim();
    return slot ? slot.slice(0, 40) : undefined;
  }
  return undefined;
}

export function viewingDatetimePicker(now = new Date()): ChatDatetimePicker {
  return {
    type: 'datetime',
    min: isoDay(jstCalendarDate(now, 1)),
    max: isoDay(jstCalendarDate(now, 60)),
    prefix: VIEWING_DATETIME_PREFIX,
  };
}

export function viewingDatetimeFromMessage(content: string, now = new Date()): string | undefined {
  const normalized = normalize(content);
  if (!normalized.startsWith(VIEWING_DATETIME_PREFIX)) return undefined;
  const value = normalized.slice(VIEWING_DATETIME_PREFIX.length).trim();
  if (!value || value.length > 80) return undefined;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/u);
  const day = iso?.[1];
  const hour = iso?.[2];
  const minute = iso?.[3];
  if (!iso || !day) return undefined;
  if (!isRealIsoDay(day) || !isViewingDayInWindow(day, now)) return undefined;
  if (hour === undefined || minute === undefined) return undefined;
  if (!isRealClockTime(hour, minute)) return undefined;
  return `${day} ${pad2(Number(hour))}:${minute}`;
}

function formatPreferredDatetime(date?: string, time?: string, fallback?: string) {
  if (date && time) return `${date} ${time}`;
  if (date) return date;
  if (time) return time;
  return fallback || '';
}

function freeDatetimeFromMessage(content: string, expecting: boolean) {
  const normalized = normalize(content);
  if (normalized === PROPERTY_INQUIRY_VALUES.viewingFreeText) return undefined;
  if (
    normalized.startsWith(VIEWING_DATETIME_PREFIX)
    || normalized.startsWith(VIEWING_DAY_PREFIX)
    || normalized.startsWith(VIEWING_TIME_PREFIX)
  ) {
    return undefined;
  }
  if (!expecting && !VIEWING_DATE_HINT.test(normalized) && !VIEWING_TIME_HINT.test(normalized)) {
    return undefined;
  }
  if (!VIEWING_TIME_HINT.test(normalized)) return undefined;
  if (!expecting && !VIEWING_DATE_HINT.test(normalized)) return undefined;
  if (!normalized || normalized.length > 80 || CONTACT_LINK_OR_URL.test(normalized) || !hasMeaningfulText(normalized)) {
    return undefined;
  }
  if (EMAIL.test(normalized) || /(?:丁目|番地|号|\d[-−ー]\d[-−ー]\d)/u.test(normalized)) {
    return undefined;
  }
  if (isObviousConversationDetour(normalized) || isModeSwitch(normalized)) return undefined;
  return normalized;
}

export function addressFromMessage(content: string, expecting: boolean): string | undefined {
  if (CONTACT_DECLINE.test(normalize(content))) return undefined;
  if (ADDRESS_REDACTED.test(normalize(content))) return expecting ? '' : undefined;
  const normalized = normalize(content)
    .replace(/(?:住所|ご住所)(?:は|:|：)?\s*/u, '')
    .replace(/[。！!？?]+$/u, '')
    .trim();
  if (!normalized || normalized.length < 4 || normalized.length > 120) return undefined;
  if (EMAIL.test(normalized) || CONTACT_LINK_OR_URL.test(normalized) || isModeSwitch(normalized)) return undefined;
  if (normalizeCustomHomePhone(normalized)) return undefined;
  if (!expecting) return undefined;
  if (expecting && !ADDRESS_HINT.test(normalized) && !/\d/u.test(normalized)) return undefined;
  if (!hasMeaningfulText(normalized)) return undefined;
  if (isObviousConversationDetour(normalized)) return undefined;
  return normalized;
}

function allMessages(history: ConversationContextMessage[], currentMessage: string) {
  return [...history, { role: 'user' as const, content: currentMessage }];
}

function flowMessages(history: ConversationContextMessage[], currentMessage: string) {
  const messages = allMessages(history, currentMessage);
  let start = 0;
  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const content = normalize(message.content);
    if (RESET_INTENT.test(content) || MODE_SWITCH.test(content)) start = index + 1;
  });
  return messages.slice(start);
}

export function latestListedInquiryProperties(history: ConversationContextMessage[]): InquiryPropertyOption[] {
  const listingLine = /^[-・]\s*(.+?)：/u;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (!message || message.role !== 'assistant') continue;
    const titles: InquiryPropertyOption[] = [];
    const seen = new Set<string>();
    for (const line of message.content.split('\n')) {
      const match = listingLine.exec(line.trim());
      const title = match?.[1]?.trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      titles.push({ title });
    }
    if (titles.length > 0) return titles.slice(0, 6);
  }
  return [];
}

export function mergeInquiryProperties(
  listed: InquiryPropertyOption[],
  cited: Array<{ title: string; url: string }>,
): InquiryPropertyOption[] {
  if (listed.length === 0) {
    return cited.slice(0, 6).map((item) => ({ title: item.title, url: item.url }));
  }
  return listed.map((item) => {
    const citedMatch = cited.find((candidate) => candidate.title === item.title)
      || cited.find((candidate) => candidate.title.includes(item.title) || item.title.includes(candidate.title));
    return citedMatch ? { title: item.title, url: citedMatch.url } : item;
  });
}

export function inquiryPropertiesForLead(
  selected: InquiryPropertyOption | undefined,
  citations: Array<{ title: string; url: string }>,
): Array<{ title: string; url: string }> {
  if (!selected) return citations;
  const matched = citations.find((item) => (
    item.title === selected.title
    || item.url === selected.url
    || item.title.includes(selected.title)
    || selected.title.includes(item.title)
  ));
  if (matched) return [matched];
  if (selected.url?.startsWith('https://')) return [{ title: selected.title, url: selected.url }];
  return citations;
}

function matchListedProperty(content: string, listed: InquiryPropertyOption[]): InquiryPropertyOption | undefined {
  const normalized = normalize(content).replace(new RegExp(`^${PROPERTY_SELECT_PREFIX}`, 'u'), '').trim();
  if (!normalized || normalized === '未定') return undefined;
  const exact = listed.find((item) => normalize(item.title) === normalized);
  if (exact) return exact;
  const withoutType = (normalized.split(/[：:]/u)[0] || normalized).trim();
  const byTitle = listed.filter((item) => {
    const title = normalize(item.title);
    return title === withoutType || title.startsWith(withoutType) || withoutType.startsWith(title);
  });
  if (byTitle.length === 1) return byTitle[0];
  const includes = listed.filter((item) => {
    const title = normalize(item.title);
    return title.includes(withoutType) || withoutType.includes(title);
  });
  return includes.length === 1 ? includes[0] : undefined;
}

function propertySelectionFromMessage(
  content: string,
  listed: InquiryPropertyOption[],
): 'undecided' | InquiryPropertyOption | undefined {
  const normalized = normalize(content);
  if (
    normalized === PROPERTY_INQUIRY_VALUES.propertyUndecided
    || normalized === `${PROPERTY_SELECT_PREFIX}未定`
  ) {
    return 'undecided';
  }
  if (
    KIND_BY_VALUE[normalized]
    || kindFromInquiryMessage(normalized)
    || normalized === PROPERTY_INQUIRY_VALUES.viewingFreeText
    || normalized.startsWith(VIEWING_DATETIME_PREFIX)
    || normalized.startsWith(VIEWING_DAY_PREFIX)
    || normalized.startsWith(VIEWING_TIME_PREFIX)
  ) {
    return undefined;
  }
  if (listed.length === 0) return undefined;
  const title = normalized.startsWith(PROPERTY_SELECT_PREFIX)
    ? normalized.slice(PROPERTY_SELECT_PREFIX.length).trim()
    : normalized;
  return title ? matchListedProperty(title, listed) : undefined;
}

export function extractPropertyInquiryState(
  history: ConversationContextMessage[],
  currentMessage: string,
  now = new Date(),
  listedProperties?: InquiryPropertyOption[],
): PropertyInquiryState {
  const listed = listedProperties && listedProperties.length > 0
    ? listedProperties
    : latestListedInquiryProperties(history);
  const messages = flowMessages(history, currentMessage);
  const state: PropertyInquiryState = {
    wantsFreeDatetime: false,
    propertySet: false,
    needsPropertyChoice: listed.length > 0,
    nameSet: false,
    addressSet: false,
    phoneSet: false,
    leadReady: false,
  };
  let expectingName = false;
  let expectingAddress = false;
  let expectingPhone = false;
  let expectingDatetimeText = false;
  let expectingProperty = false;

  for (const message of messages) {
    const content = message.content;
    if (message.role === 'assistant') {
      expectingName = NAME_PROMPT.test(content);
      expectingAddress = ADDRESS_PROMPT.test(content);
      expectingPhone = PHONE_PROMPT.test(content) || PHONE_RETRY_PROMPT.test(content);
      expectingDatetimeText = DATETIME_TEXT_PROMPT.test(content);
      expectingProperty = PROPERTY_PROMPT.test(content);
      if (PHONE_RETRY_PROMPT.test(content)) state.phoneSet = false;
      continue;
    }

    const datetime = viewingDatetimeFromMessage(content, now);
    if (datetime) {
      if (state.kind === 'viewing') {
        state.wantsFreeDatetime = false;
        const timed = datetime.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/u);
        if (timed) {
          state.preferredDate = timed[1];
          state.preferredTime = timed[2];
          state.preferredDatetime = datetime;
        } else if (isRealIsoDay(datetime)) {
          state.preferredDate = datetime;
        } else {
          state.preferredDatetime = datetime;
        }
      }
      continue;
    }
    const day = viewingDayFromMessage(content);
    if (day) {
      if (state.kind === 'viewing') {
        state.preferredDate = day;
        state.wantsFreeDatetime = false;
        if (state.preferredTime) {
          state.preferredDatetime = formatPreferredDatetime(day, state.preferredTime);
        }
      }
      continue;
    }
    const time = viewingTimeFromMessage(content);
    if (time) {
      if (state.kind === 'viewing') {
        state.preferredTime = time;
        state.preferredDatetime = formatPreferredDatetime(state.preferredDate, time);
      }
      continue;
    }

    const kind = kindFromInquiryMessage(content);
    if (kind) {
      state.kind = kind;
      continue;
    }
    if (!state.kind) continue;

    const selection = propertySelectionFromMessage(content, listed);
    if (selection === 'undecided') {
      state.propertySet = true;
      state.selectedProperty = undefined;
      expectingProperty = false;
      continue;
    }
    if (selection) {
      state.propertySet = true;
      state.selectedProperty = selection;
      expectingProperty = false;
      continue;
    }
    if (expectingProperty) {
      expectingName = false;
      expectingAddress = false;
      expectingPhone = false;
      expectingDatetimeText = false;
      continue;
    }

    if (normalize(content) === PROPERTY_INQUIRY_VALUES.viewingFreeText) {
      state.wantsFreeDatetime = true;
      expectingDatetimeText = true;
      continue;
    }

    const freeDatetime = freeDatetimeFromMessage(content, expectingDatetimeText);
    if (freeDatetime) {
      state.preferredDatetime = freeDatetime;
      expectingDatetimeText = false;
      continue;
    }

    const contact = extractCustomHomeContact(content, { expectingName: expectingName || expectingPhone });
    if (contact.name || NAME_REDACTED.test(normalize(content))) state.nameSet = true;
    if (contact.phone || PHONE_REDACTED.test(normalize(content))) state.phoneSet = true;

    const address = addressFromMessage(content, expectingAddress);
    if (address || (expectingAddress && ADDRESS_REDACTED.test(normalize(content)))) state.addressSet = true;

    expectingName = false;
    expectingAddress = false;
    expectingPhone = false;
    expectingDatetimeText = false;
  }

  const propertyReady = !state.needsPropertyChoice || state.propertySet;
  if (state.kind === 'phone') {
    state.leadReady = propertyReady && state.nameSet && state.phoneSet;
  } else if (state.kind === 'document_request') {
    state.leadReady = propertyReady && state.nameSet && state.phoneSet && state.addressSet;
  } else if (state.kind === 'viewing') {
    state.leadReady = propertyReady
      && Boolean(state.preferredDatetime)
      && state.nameSet
      && state.phoneSet
      && state.addressSet;
  }
  return state;
}

function nextStep(state: PropertyInquiryState): PropertyInquiryStep | undefined {
  if (!state.kind) return undefined;
  const startedLaterSteps = Boolean(state.preferredDatetime)
    || state.wantsFreeDatetime
    || Boolean(state.preferredDate)
    || state.nameSet
    || state.addressSet
    || state.phoneSet;
  if (!state.propertySet && state.needsPropertyChoice && !startedLaterSteps) return 'select_property';
  if (state.kind === 'viewing' && !state.preferredDatetime) {
    if (state.wantsFreeDatetime) return 'viewing_datetime_text';
    if (state.preferredDate && !state.preferredTime) return 'viewing_time';
    if (!state.preferredDate) return 'viewing_datetime';
    return 'viewing_datetime_text';
  }
  if (!state.nameSet) return 'contact_name';
  if (state.kind !== 'phone' && !state.addressSet) return 'contact_address';
  if (!state.phoneSet) return 'contact_phone';
  if (!state.propertySet && state.needsPropertyChoice) return 'select_property';
  return 'complete';
}

function promptForStep(kind: PropertyInquiryKind, step: PropertyInquiryStep) {
  if (step === 'select_property') {
    if (kind === 'document_request') return 'どの物件の資料が必要かにゃ？候補から選んでにゃん。';
    if (kind === 'phone') return 'どの物件について相談したいかにゃ？候補から選んでにゃん。';
    return 'どの物件を見学したいにゃ？候補から選んでにゃん。';
  }
  if (step === 'viewing_datetime') return '見学の希望日時を、カレンダーから選んでにゃん。';
  if (step === 'viewing_day') return '見学の希望日を選んでにゃん。ボタンから選べるにゃん。';
  if (step === 'viewing_time') return 'その日の希望時間を選んでにゃん。';
  if (step === 'viewing_datetime_text') return '見学の希望日時を、日付と時間つきで教えてにゃん。';
  if (step === 'contact_name') {
    if (kind === 'document_request') return '資料をお届けするにゃん。お名前を教えてにゃん。';
    if (kind === 'phone') return '担当者からお電話するにゃん。お名前を教えてにゃん。';
    return '見学のお申し込みだにゃん。お名前を教えてにゃん。';
  }
  if (step === 'contact_address') {
    if (kind === 'document_request') return '資料をお届けする住所を、番地まで教えてにゃん。';
    return '現在のご住所を、番地まで教えてにゃん。';
  }
  if (step === 'contact_phone') return '連絡用の電話番号を教えてにゃん。';
  return undefined;
}

export function evaluatePropertyInquiry(
  history: ConversationContextMessage[],
  currentMessage: string,
  now = new Date(),
  listedProperties?: InquiryPropertyOption[],
): PropertyInquiryDecision {
  const listed = listedProperties && listedProperties.length > 0
    ? listedProperties
    : latestListedInquiryProperties(history);
  const normalized = normalize(currentMessage);
  if (isModeSwitch(normalized)) return { active: false };
  // Once a lead has been accepted, later chat must not re-enter this flow.
  // Otherwise follow-up questions create a second lead and hide property answers.
  if (!kindFromInquiryMessage(normalized) && extractPropertyInquiryState(history, '', now, listed).leadReady) {
    return { active: false };
  }

  const state = extractPropertyInquiryState(history, currentMessage, now, listed);
  if (!state.kind) return { active: false };

  if (state.leadReady) {
    return { active: true, leadReady: true, kind: state.kind, step: 'complete', properties: listed };
  }

  const step = nextStep(state);
  if (!step || step === 'complete') {
    return { active: true, leadReady: true, kind: state.kind, step: 'complete', properties: listed };
  }

  if (CONTACT_DECLINE.test(normalized) && /contact_/u.test(step)) {
    return {
      active: true,
      kind: state.kind,
      step,
      properties: listed,
      response: 'お名前と電話番号がないと、担当者からご連絡できないにゃん。入力できる範囲で教えてにゃん。チャットで入力しない場合は、公式LINEから担当者へ相談してにゃん。',
    };
  }

  if (
    step === 'viewing_datetime'
    && !state.preferredDatetime
    && !state.preferredDate
    && (
      normalized.startsWith(VIEWING_DATETIME_PREFIX)
      || (VIEWING_DATE_HINT.test(normalized) && !VIEWING_TIME_HINT.test(normalized))
    )
  ) {
    return {
      active: true,
      kind: state.kind,
      step,
      properties: listed,
      response: normalized.startsWith(VIEWING_DATETIME_PREFIX)
        ? 'その日時は見学の予約では選べないにゃん。カレンダーから選んでにゃん。'
        : '見学の日付と時間の両方を、カレンダーから選んでにゃん。',
    };
  }

  return {
    active: true,
    kind: state.kind,
    step,
    properties: listed,
    response: promptForStep(state.kind, step) || '見学の希望日時を、カレンダーから選んでにゃん。',
  };
}

export function propertyInquiryChoicesForResponse(
  decision: PropertyInquiryDecision,
  now = new Date(),
): ChatChoice[] {
  if (decision.step === 'select_property') {
    return [
      ...(decision.properties || []).map((item) => ({
        label: item.title,
        value: `${PROPERTY_SELECT_PREFIX}${item.title}`,
      })),
      { label: 'まだ決めてない', value: PROPERTY_INQUIRY_VALUES.propertyUndecided, size: 'compact' },
    ];
  }
  if (decision.step === 'viewing_day') return viewingDayChoices(now);
  if (decision.step === 'viewing_time') return VIEWING_TIME_CHOICES;
  return [];
}

export function propertyInquiryPickerForResponse(
  decision: PropertyInquiryDecision,
  now = new Date(),
): ChatDatetimePicker | undefined {
  if (decision.step !== 'viewing_datetime') return undefined;
  return viewingDatetimePicker(now);
}

export function extractPropertyInquiryContact(
  history: ConversationContextMessage[],
  currentMessage: string,
): PropertyInquiryContact {
  const decision = evaluatePropertyInquiry(history, '');
  const expectingName = decision.step === 'contact_name';
  const expectingPhone = decision.step === 'contact_phone';
  const expectingAddress = decision.step === 'contact_address';
  const contact = extractCustomHomeContact(currentMessage, {
    expectingName: expectingName || expectingPhone || expectingAddress,
  });
  const address = addressFromMessage(currentMessage, expectingAddress);
  return {
    ...(contact.name ? { name: contact.name } : {}),
    ...(contact.phone ? { phone: contact.phone } : {}),
    ...(address ? { address } : {}),
  };
}
