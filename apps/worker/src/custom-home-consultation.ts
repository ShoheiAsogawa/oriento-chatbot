import type { ConversationContextMessage } from './conversation-context';
import { normalizePhoneNumber } from './phone';
import { isObviousConversationDetour } from './property-search-continuation';

/**
 * The custom-home flow is intentionally kept separate from the rental/sale
 * search flows. The caller can use the state and decision as a domain module
 * and decide how to persist a lead or send it to a CRM.
 */
export type CustomHomeLandOwnership = 'owned' | 'not_owned' | 'unknown';

export type CustomHomeStep =
  | 'land_ownership'
  | 'land_location'
  | 'land_size'
  | 'desired_area'
  | 'household'
  | 'layout'
  | 'budget'
  | 'timing'
  | 'priorities'
  | 'contact_name'
  | 'contact_phone'
  | 'complete';

export type CustomHomeChoice = {
  label: string;
  value: string;
};

export type CustomHomeConsultationState = {
  mode: 'custom_home';
  landOwnership?: CustomHomeLandOwnership;
  landLocation?: string;
  landSizeSqm?: number;
  /** Free-text note when the visitor does not know the land size yet. */
  landSizeNote?: string;
  desiredArea?: string;
  householdSize?: number;
  householdDescription?: string;
  layout?: string;
  budgetYen?: number;
  /** Free-text note when the visitor does not know the budget yet. */
  budgetNote?: string;
  timing?: string;
  priorities?: string;
  /** The name is intentionally never retained; only whether it was supplied is tracked. */
  /** Only the last four digits are retained in the conversation state. */
  contactPhoneLast4?: string;
  landOwnershipSet: boolean;
  landLocationSet: boolean;
  landSizeSet: boolean;
  desiredAreaSet: boolean;
  householdSet: boolean;
  layoutSet: boolean;
  budgetSet: boolean;
  timingSet: boolean;
  prioritiesSet: boolean;
  contactNameSet: boolean;
  contactPhoneSet: boolean;
  leadReady: boolean;
};

export type CustomHomeConsultationDecision = {
  active: boolean;
  response?: string;
  step?: CustomHomeStep;
  leadReady?: boolean;
};

export type CustomHomeContact = {
  /** Use this value only for the protected lead handoff; do not store it in chat history. */
  name?: string;
  /** Normalized Japanese phone number, e.g. 09012345678. */
  phone?: string;
  phoneLast4?: string;
};

export type CustomHomeContactExtractionOptions = {
  /** Set when the preceding prompt asks for the visitor's name. */
  expectingName?: boolean;
  /** Set when the preceding prompt asks for a phone number. */
  expectingPhone?: boolean;
};

const CUSTOM_HOME_INTENT = /(?:注文住宅|注文建築|自由設計|マイホームを建て|家を建て(?:たい|る|よう))/u;
const MODE_SWITCH = /^(?:(?:賃貸|購入)(?:物件)?(?:を?(?:探す|探したい)|に変更|で探したい|がいい|を希望|にしたい|したい|に切り替え|へ切り替え|へ変更)?|(?:注文住宅|注文建築|自由設計)(?:(?:から|じゃなくて?|ではなく|をやめて?)\s*(?:賃貸|購入)|.*(?:賃貸|購入).*(?:切り替え|変更|探したい|にする))|物件を?(?:探す|探したい)|物件探し(?:をしたい|したい)?)(?:[。！!？?])?$/u;
const CUSTOM_HOME_EXPLANATION = /(?:(?:注文住宅|注文建築|自由設計).*(?:とは|って何|メリット|デメリット|違い|比較|どっち|どちら|迷って|悩んで)|(?:建売|購入|賃貸).*(?:注文住宅|注文建築|自由設計).*(?:違い|比較|どっち|どちら|迷って|悩んで))/u;
const LAND_PROMPT = /(?:土地を持っているか|土地の有無|土地.*(?:持って|所有))/u;
const LAND_LOCATION_PROMPT = /(?:土地.*(?:所在地|場所)|土地の場所|所在地.*(?:市区町村|教えて))/u;
const LAND_SIZE_PROMPT = /(?:土地.*(?:広さ|大きさ)|敷地.*(?:広さ|大きさ)|何坪|何㎡)/u;
const DESIRED_AREA_PROMPT = /(?:希望エリア|建てたいエリア|どこで.*(?:探|建)|土地探し.*(?:エリア|場所))/u;
const HOUSEHOLD_PROMPT = /(?:家族.*(?:人数|構成)|何人.*(?:暮ら|住)|ご家族)/u;
const LAYOUT_PROMPT = /(?:希望.*間取り|間取り.*(?:希望|教えて)|平屋|二世帯)/u;
const BUDGET_PROMPT = /(?:予算|建築費|ご予算).*(?:上限|目安|教えて|いくら)/u;
const TIMING_PROMPT = /(?:時期|いつ.*(?:建|入居)|建築.*(?:予定|時期))/u;
const PRIORITIES_PROMPT = /(?:こだわり|重視|優先|希望条件|要望)/u;
const NAME_PROMPT = /(?:お名前|氏名|名前).*(?:教えて|聞かせ|入力)/u;
const PHONE_PROMPT = /(?:電話番号|お電話|連絡先).*(?:教えて|入力|聞かせ)/u;
const PHONE_REDACTED = /\[電話番号\]/u;
const NAME_REDACTED = /\[お名前\]/u;
const NO_PREFERENCE = /^(?:(?:間取り|家族構成|希望条件|こだわり)(?:は|を)?)?(?:特に)?(?:なし|ない|ありません|未定|決まっていない|決めていない)(?:です)?[。！!？?]?$/u;
const UNKNOWN_ANSWER = /^(?:(?:まだ|今は|現時点では)?(?:わからない|分からない|不明|未定|決まっていない|決まってない|決めていない|検討中)|相談したい|相談して決めたい|おまかせ|お任せ|特になし|なし|ない)(?:です|だと思います)?[。！!？?]?$/u;
const LAND_SIZE_HELP_REQUEST = /(?:何坪|何平米|何㎡|どのくらいの広さ|(?:坪数?|広さ).*(?:目安|教えて|知りたい|どのくらい))/u;
const UNKNOWN_NOTE = '未定（相談希望）';
const CONTACT_DECLINE = /(?:^(?:なし|ない|ありません|未定|後で|あとで|匿名(?:で|希望)?|名無し)[。！!？?]?$|(?:名前|氏名|電話番号|連絡先|個人情報).*(?:教えたくない|言いたくない|入力したくない|送りたくない|不安|心配)|LINEで(?:相談|送る|連絡))/u;
const BUDGET_TO_CONSULT = /^(?:予算(?:は|を)?(?:相談(?:して)?(?:決めたい|したい)|未定)|相談(?:して)?(?:決めたい|したい)|未定)[。！!？?]?$/u;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const PHONE_CANDIDATE = /((?:(?:\+?81|0081)[-ー－−\s()]?[1-9]\d{0,3}|0\d{1,4})[\d\s().\-ー－−]{3,20}\d)/u;
const LAYOUT = /(?:\d+\s*[SLDKR]+|平屋|二世帯住宅?|自由設計)/iu;
const AREA_SUFFIX = /(?:都|道|府|県|市|区|町|村|駅)/u;
const LOCATION_NOISE = /(?:ありがとう|どうも|よろしく|わからない|分からない|おなか|ごはん|誰|だれ)/u;
const COURTESY_PREFIX = /^(?:(?:ありがとう(?:ございます)?|どうも)(?:[、,\s]+|$))/u;
const COURTESY_SUFFIX = /(?:[、,\s]*(?:ありがとう(?:ございます)?|どうも|よろしく(?:お願いします)?|お願いします|助かります))+(?:[。！!？?]*)$/u;
const LAND_OWNERSHIP_AFFIRMATIVE = /^(?:はい|あります|ある|持っています|持ってます|所有しています|所有している|ございます)$/u;
const LAND_OWNERSHIP_NEGATIVE = /^(?:いいえ|ありません|ない|ないです|持っていません|持っていない|持ってない|なし)$/u;
const CONTACT_LINK_OR_URL = /(?:https?:\/\/|www\.|line\.me|公式\s*LINE|LINEから|リンク|URL)/iu;
const NON_NAME_REPLY = /(?:教えて|おすすめ|探して|検索して|してください|できますか|どこ|いつ|なぜ|どうすれば|病院|医者|ラーメン|飲食店|物件|賃貸|購入|注文住宅|連絡先を送信)/u;
const RESET_INTENT = /^(?:やり直し|リセット|最初から|キャンセル|やめる)[。！!？?]*$/u;

function normalize(value: string) {
  return value.normalize('NFKC').trim();
}

function hasMeaningfulText(value: string) {
  return /[\p{L}\p{N}]/u.test(value);
}

/**
 * A visitor often appends a polite acknowledgement to an otherwise valid
 * intake answer (for example, "まだわからない、ありがとう").  Preserve the
 * answer and ignore only that courtesy tail, rather than making the flow ask
 * the same question again.
 */
function intakeAnswer(value: string) {
  return normalize(value)
    .replace(COURTESY_PREFIX, '')
    .replace(COURTESY_SUFFIX, '')
    .trim();
}

function allMessages(history: ConversationContextMessage[], currentMessage: string) {
  return [...history, { role: 'user' as const, content: currentMessage }];
}

function flowMessages(history: ConversationContextMessage[], currentMessage: string) {
  const messages = allMessages(history, currentMessage);
  let start = 0;
  let latestReset = -1;
  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const content = normalize(message.content);
    if (RESET_INTENT.test(content)) latestReset = index;
    if (CUSTOM_HOME_INTENT.test(content)) start = index;
  });
  // A reset is a hard boundary. An old custom-home selection must not be
  // revived when the visitor sends an ordinary answer after the reset reply.
  if (latestReset >= start) start = latestReset + 1;
  return messages.slice(start);
}

/**
 * A visitor can change their mind in the same conversation (for example,
 * "注文住宅" -> "物件を探す" -> "購入").  The old custom-home intent must
 * not keep the intake active after that later property-search mode switch.
 */
function customHomeSupersededByModeSwitch(messages: ConversationContextMessage[]) {
  let lastCustomHomeIntent = -1;
  let lastPropertyModeSwitch = -1;
  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const content = normalize(message.content);
    // A sentence such as "注文住宅から購入に切り替え" contains both
    // intents; the explicit switch must win over the embedded old intent.
    if (MODE_SWITCH.test(content)) lastPropertyModeSwitch = index;
    else if (isCustomHomeIntent(content)) lastCustomHomeIntent = index;
  });
  return lastPropertyModeSwitch > lastCustomHomeIntent;
}

function previousAssistant(messages: ConversationContextMessage[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = messages[cursor];
    if (candidate?.role === 'assistant' && isCustomHomePrompt(candidate.content)) {
      return normalize(candidate.content);
    }
  }
  return '';
}

function stripAnswer(value: string) {
  return intakeAnswer(value)
    .replace(/^(?:場所|所在地|土地の場所|希望エリア|探す場所|広さ|大きさ|予算|建築費|間取り|家族構成|こだわり|重視すること|名前|氏名|お名前|電話番号|お電話)(?:は|を|:|：)?\s*/u, '')
    .replace(/[。！!？?]+$/u, '')
    .trim();
}

function isContactDecline(value: string) {
  const raw = normalize(value);
  const stripped = stripAnswer(value);
  return CONTACT_DECLINE.test(raw)
    || /^(?:教えたくない|言いたくない|入力したくない|送りたくない|不安|心配)[。！!？?]*$/u.test(stripped);
}

function numberFromJapanese(value: string | undefined) {
  if (!value) return undefined;
  const table: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return table[value] || Number(value) || undefined;
}

function householdFromMessage(content: string) {
  const normalized = stripAnswer(content);
  // Keep composite household descriptions intact instead of incorrectly
  // reducing e.g. "夫婦と子ども" to two people.
  if (/(?:(?:夫婦|カップル).*(?:子ども|子供)|(?:子ども|子供).*(?:夫婦|カップル))/u.test(normalized)) return undefined;
  const explicit = normalized.match(/(?:家族(?:は|で)?\s*)(10|[1-9一二三四五六七八九])\s*人|(?:大人|子ども|子供)\s*(10|[1-9一二三四五六七八九])\s*人/u);
  const explicitSize = numberFromJapanese(explicit?.[1] || explicit?.[2]);
  if (explicitSize) return explicitSize;
  const simple = normalized.match(/(?:^|\s)(10|[1-9一二三四五六七八九])\s*(?:人|名)(?:\s*(?:家族|で|暮ら|住|$))/u)?.[1];
  if (simple) return numberFromJapanese(simple);
  if (/(?:一人暮らし|ひとり暮らし|単身)/u.test(normalized)) return 1;
  if (/(?:二人暮らし|夫婦|カップル)/u.test(normalized)) return 2;
  return undefined;
}

function budgetFromMessage(content: string, answeredPrompt: boolean) {
  const normalized = stripAnswer(content);
  if (CONTACT_LINK_OR_URL.test(normalized)) return undefined;
  const number = (value: string) => Number(value.replace(/,/gu, ''));
  const oku = normalized.match(/(\d[\d,]*(?:\.\d+)?)\s*億(?:\s*(\d[\d,]*(?:\.\d+)?)\s*万)?(?:円)?/u);
  if (oku) return Math.round(number(oku[1] || '0') * 100_000_000 + number(oku[2] || '0') * 10_000);
  const man = normalized.match(/(\d[\d,]*(?:\.\d+)?)\s*万(?:円)?/u)?.[1];
  if (man) return Math.round(number(man) * 10_000);
  const yen = normalized.match(/(\d[\d,]{5,})\s*円/u)?.[1];
  if (yen) return number(yen);
  if (answeredPrompt) {
    const plain = normalized.match(/^\s*(\d[\d,]*(?:\.\d+)?)\s*$/u)?.[1];
    if (plain) {
      const value = number(plain);
      return Math.round(value >= 1_000_000 ? value : value * 10_000);
    }
  }
  return undefined;
}

function landOwnershipFromMessage(content: string): CustomHomeLandOwnership | undefined {
  const normalized = stripAnswer(content);
  if (/(?:土地|敷地).*(?:持っていない|持ってない|ありません|なし|ない)/u.test(normalized)
    || /(?:土地|敷地)なし/u.test(normalized)) return 'not_owned';
  if (/(?:土地|敷地).*(?:持っている|持ってる|所有|あり)/u.test(normalized)
    || /(?:持っている|持ってる|所有地|土地あり)/u.test(normalized)) return 'owned';
  return undefined;
}

/** Interpret a short yes/no reply only while the preceding question asks about
 * land ownership. This avoids applying a later "はい" to the wrong field. */
function landOwnershipFromPromptReply(content: string): CustomHomeLandOwnership | undefined {
  const normalized = stripAnswer(content);
  if (LAND_OWNERSHIP_AFFIRMATIVE.test(normalized)) return 'owned';
  if (LAND_OWNERSHIP_NEGATIVE.test(normalized)) return 'not_owned';
  return undefined;
}

function locationFromMessage(content: string, prompt: RegExp) {
  const normalized = stripAnswer(content);
  if (!prompt.test(normalized) && !AREA_SUFFIX.test(normalized)) return undefined;
  if (LOCATION_NOISE.test(normalized) || CONTACT_LINK_OR_URL.test(normalized) || normalized.length < 2 || normalized.length > 60) return undefined;
  if (!hasMeaningfulText(normalized)) return undefined;
  if (/(?:土地|敷地).*(?:持って|所有|なし|ない)/u.test(normalized)) return undefined;
  const suffix = normalized.match(/[都道府県市区町村駅]/u);
  if (prompt.test(content) || suffix) return normalized;
  return undefined;
}

function landSizeFromMessage(content: string) {
  const normalized = normalize(content);
  if (CONTACT_LINK_OR_URL.test(normalized)) return undefined;
  const match = normalized.match(/(\d[\d,]*(?:\.\d+)?)\s*(㎡|m2|m²|平米|坪)/iu);
  if (!match) return undefined;
  const value = Number((match[1] || '0').replace(/,/gu, ''));
  if (!Number.isFinite(value) || value <= 0 || value > 100_000) return undefined;
  return /坪/iu.test(match[2] || '') ? value * 3.305785 : value;
}

function layoutFromMessage(content: string, answeredPrompt: boolean) {
  const normalized = stripAnswer(content);
  if (CONTACT_LINK_OR_URL.test(normalized)) return undefined;
  const layout = normalized.match(LAYOUT)?.[0]?.replace(/\s+/gu, '').toUpperCase();
  if (layout) return layout;
  if (answeredPrompt && NO_PREFERENCE.test(normalized)) return 'こだわりなし';
  return undefined;
}

function isBudgetAmountAnswer(content: string) {
  return budgetFromMessage(content, false) != null;
}

function timingFromMessage(content: string, answeredPrompt: boolean) {
  const normalized = stripAnswer(content);
  // Budget buttons such as "5,000万円まで" contain "まで" and must not fill
  // the timing slot, or the flow skips the actual move-in question.
  if (!answeredPrompt || isBudgetAmountAnswer(normalized)) return undefined;
  if (LOCATION_NOISE.test(normalized) || CONTACT_LINK_OR_URL.test(normalized) || normalized.length < 1 || normalized.length > 80 || !hasMeaningfulText(normalized)) return undefined;
  return normalized;
}

function prioritiesFromMessage(content: string, answeredPrompt: boolean) {
  if (!answeredPrompt) return undefined;
  const normalized = stripAnswer(content);
  if (!normalized || normalized.length > 300 || LOCATION_NOISE.test(normalized) || CONTACT_LINK_OR_URL.test(normalized) || !hasMeaningfulText(normalized)) return undefined;
  return NO_PREFERENCE.test(normalized) ? 'こだわりなし' : normalized;
}

function nameFromMessage(content: string, answeredPrompt: boolean) {
  if (isContactDecline(content)) return undefined;
  if (NAME_REDACTED.test(normalize(content))) return undefined;
  const explicitName = normalize(content).match(/(?:お名前|氏名|名前)(?:は|:|：)?\s*([^、,。]+)/u)?.[1];
  const normalized = stripAnswer(explicitName || content).replace(/(?:です|と申します|さん)$/u, '').trim();
  if (!answeredPrompt && !/^(?:名前|氏名|お名前)(?:は|:|：)/u.test(normalize(content))) return undefined;
  if (!normalized || normalized.length > 100 || EMAIL.test(normalized) || PHONE_CANDIDATE.test(normalized) || CONTACT_LINK_OR_URL.test(normalized)) return undefined;
  if (!hasMeaningfulText(normalized)) return undefined;
  if (/[\d？?]/u.test(normalized) || LOCATION_NOISE.test(normalized) || NON_NAME_REPLY.test(normalized)) return undefined;
  return normalized;
}

/** Returns a normalized phone number, or undefined when nothing digit-like is present. */
export function normalizeCustomHomePhone(value: string, options: { lenient?: boolean } = {}) {
  return normalizePhoneNumber(value, options);
}

/**
 * Extract contact data at the final handoff. The raw phone is deliberately not
 * part of CustomHomeConsultationState; callers should encrypt it before storage.
 */
export function extractCustomHomeContact(
  content: string,
  options: CustomHomeContactExtractionOptions = {},
): CustomHomeContact {
  const phoneMatch = normalize(content).match(PHONE_CANDIDATE)?.[1];
  const phone = normalizeCustomHomePhone(
    phoneMatch || (options.expectingPhone ? content : ''),
    { lenient: Boolean(options.expectingPhone) },
  );
  // Remove the phone before parsing a name so a final single-message reply such
  // as "山田太郎 090-1234-5678" can be split without persisting either value.
  const nameInput = phoneMatch ? normalize(content).replace(phoneMatch, ' ') : content;
  const name = nameFromMessage(nameInput, Boolean(options.expectingName));
  return {
    ...(name ? { name } : {}),
    ...(phone ? { phone, phoneLast4: phone.slice(-4) } : {}),
  };
}

function customHomePhoneProvided(content: string, expectingPhone = false) {
  return PHONE_REDACTED.test(normalize(content))
    || Boolean(extractCustomHomeContact(content, { expectingPhone }).phone);
}

function isNoPreferenceAnswer(content: string) {
  return NO_PREFERENCE.test(stripAnswer(content));
}

function isUnknownAnswer(content: string) {
  return UNKNOWN_ANSWER.test(stripAnswer(content));
}

/** Accept an honest free-text answer for an intake field without accepting a
 * conversational detour or a question that still needs clarification. */
function freeTextAnswer(content: string) {
  const normalized = stripAnswer(content);
  if (!normalized || normalized.length > 300 || CONTACT_LINK_OR_URL.test(normalized) || !hasMeaningfulText(normalized) || isObviousConversationDetour(normalized)) return undefined;
  if (LAND_SIZE_HELP_REQUEST.test(normalized) || /[？?]$/u.test(normalized)) return undefined;
  return normalized;
}

function isCustomHomePrompt(content: string) {
  const normalized = normalize(content);
  return LAND_PROMPT.test(normalized)
    || LAND_LOCATION_PROMPT.test(normalized)
    || LAND_SIZE_PROMPT.test(normalized)
    || DESIRED_AREA_PROMPT.test(normalized)
    || HOUSEHOLD_PROMPT.test(normalized)
    || LAYOUT_PROMPT.test(normalized)
    || BUDGET_PROMPT.test(normalized)
    || TIMING_PROMPT.test(normalized)
    || PRIORITIES_PROMPT.test(normalized)
    || NAME_PROMPT.test(normalized)
    || PHONE_PROMPT.test(normalized);
}

function isCriterionReply(content: string, lastAssistant: string) {
  const normalized = stripAnswer(content);
  return Boolean(
    landOwnershipFromMessage(normalized)
    || (LAND_PROMPT.test(lastAssistant) && landOwnershipFromPromptReply(normalized))
    || (LAND_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (LAND_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (LAND_LOCATION_PROMPT.test(lastAssistant) && locationFromMessage(normalized, LAND_LOCATION_PROMPT))
    || (LAND_LOCATION_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (LAND_LOCATION_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (DESIRED_AREA_PROMPT.test(lastAssistant) && locationFromMessage(normalized, DESIRED_AREA_PROMPT))
    || (DESIRED_AREA_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (DESIRED_AREA_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (LAND_SIZE_PROMPT.test(lastAssistant) && landSizeFromMessage(normalized) != null)
    || (LAND_SIZE_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (LAND_SIZE_PROMPT.test(lastAssistant) && LAND_SIZE_HELP_REQUEST.test(normalized))
    || (LAND_SIZE_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (HOUSEHOLD_PROMPT.test(lastAssistant) && (householdFromMessage(normalized) != null || isNoPreferenceAnswer(normalized)))
    || (HOUSEHOLD_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (HOUSEHOLD_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (LAYOUT_PROMPT.test(lastAssistant) && layoutFromMessage(normalized, true) != null)
    || (LAYOUT_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (LAYOUT_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (BUDGET_PROMPT.test(lastAssistant) && budgetFromMessage(normalized, true) != null)
    || (BUDGET_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (BUDGET_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (TIMING_PROMPT.test(lastAssistant) && timingFromMessage(normalized, true) != null)
    || (TIMING_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (TIMING_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (PRIORITIES_PROMPT.test(lastAssistant) && prioritiesFromMessage(normalized, true) != null)
    || (PRIORITIES_PROMPT.test(lastAssistant) && isUnknownAnswer(normalized))
    || (PRIORITIES_PROMPT.test(lastAssistant) && freeTextAnswer(normalized) != null)
    || (NAME_PROMPT.test(lastAssistant) && nameFromMessage(normalized, true) != null)
    || (PHONE_PROMPT.test(lastAssistant) && customHomePhoneProvided(normalized)));
}

export function isCustomHomeIntent(input: string) {
  return CUSTOM_HOME_INTENT.test(normalize(input));
}

export function extractCustomHomeConsultationState(
  history: ConversationContextMessage[],
  currentMessage = '',
): CustomHomeConsultationState {
  const messages = flowMessages(history, currentMessage);
  const state: CustomHomeConsultationState = {
    mode: 'custom_home',
    landOwnershipSet: false,
    landLocationSet: false,
    landSizeSet: false,
    desiredAreaSet: false,
    householdSet: false,
    layoutSet: false,
    budgetSet: false,
    timingSet: false,
    prioritiesSet: false,
    contactNameSet: false,
    contactPhoneSet: false,
    leadReady: false,
  };

  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const content = stripAnswer(message.content);
    const assistant = previousAssistant(messages, index);
    const ownership = landOwnershipFromMessage(content)
      || (LAND_PROMPT.test(assistant) ? landOwnershipFromPromptReply(content) : undefined);
    if (ownership) {
      state.landOwnership = ownership;
      state.landOwnershipSet = true;
    } else if (LAND_PROMPT.test(assistant) && isUnknownAnswer(content)) {
      // Do not guess whether land exists. Keep the uncertainty explicit and
      // continue through the land-search path so the visitor is not trapped.
      state.landOwnership = 'unknown';
      state.landOwnershipSet = true;
    } else if (LAND_PROMPT.test(assistant) && freeTextAnswer(content)) {
      // A free-form response such as "家族と相談中" still answers the
      // question without inventing owned/not-owned.
      state.landOwnership = 'unknown';
      state.landOwnershipSet = true;
    }
    if (state.landOwnership === 'owned') {
      const location = locationFromMessage(content, LAND_LOCATION_PROMPT);
      if (location) {
        state.landLocation = location;
        state.landLocationSet = true;
      } else if (LAND_LOCATION_PROMPT.test(assistant) && isUnknownAnswer(content)) {
        state.landLocation = UNKNOWN_NOTE;
        state.landLocationSet = true;
      } else if (LAND_LOCATION_PROMPT.test(assistant)) {
        const note = freeTextAnswer(content);
        if (note) {
          state.landLocation = note;
          state.landLocationSet = true;
        }
      }
      const size = landSizeFromMessage(content);
      if (size != null) {
        state.landSizeSqm = size;
        state.landSizeSet = true;
      } else if (LAND_SIZE_PROMPT.test(assistant) && isUnknownAnswer(content)) {
        state.landSizeNote = UNKNOWN_NOTE;
        state.landSizeSet = true;
      } else if (LAND_SIZE_PROMPT.test(assistant) && !LAND_SIZE_HELP_REQUEST.test(content)) {
        const note = freeTextAnswer(content);
        if (note) {
          state.landSizeNote = note;
          state.landSizeSet = true;
        }
      }
    } else if (state.landOwnership === 'not_owned' || state.landOwnership === 'unknown') {
      const area = locationFromMessage(content, DESIRED_AREA_PROMPT);
      if (area) {
        state.desiredArea = area;
        state.desiredAreaSet = true;
      } else if (DESIRED_AREA_PROMPT.test(assistant) && isUnknownAnswer(content)) {
        state.desiredArea = UNKNOWN_NOTE;
        state.desiredAreaSet = true;
      } else if (DESIRED_AREA_PROMPT.test(assistant)) {
        const note = freeTextAnswer(content);
        if (note) {
          state.desiredArea = note;
          state.desiredAreaSet = true;
        }
      }
    }

    const household = householdFromMessage(content);
    if (household != null && (HOUSEHOLD_PROMPT.test(assistant) || /(?:家族|人家族|一人暮らし|二人暮らし)/u.test(content))) {
      state.householdSize = household;
      state.householdSet = true;
    } else if (HOUSEHOLD_PROMPT.test(assistant) && isNoPreferenceAnswer(content)) {
      state.householdDescription = '未定';
      state.householdSet = true;
    }
    if (HOUSEHOLD_PROMPT.test(assistant) && isUnknownAnswer(content)) {
      state.householdDescription = UNKNOWN_NOTE;
      state.householdSet = true;
    }
    const householdDescription = HOUSEHOLD_PROMPT.test(assistant) && content.length <= 100
      ? freeTextAnswer(content)
      : undefined;
    if (householdDescription && !LOCATION_NOISE.test(householdDescription) && !state.householdSet) {
      state.householdDescription = householdDescription;
      state.householdSet = true;
    }

    const layout = layoutFromMessage(content, LAYOUT_PROMPT.test(assistant));
    if (layout) {
      state.layout = layout;
      state.layoutSet = true;
    } else if (LAYOUT_PROMPT.test(assistant) && isUnknownAnswer(content)) {
      state.layout = UNKNOWN_NOTE;
      state.layoutSet = true;
    } else if (LAYOUT_PROMPT.test(assistant)) {
      const note = freeTextAnswer(content);
      if (note) {
        state.layout = note;
        state.layoutSet = true;
      }
    }
    const budget = budgetFromMessage(content, BUDGET_PROMPT.test(assistant));
    if (budget != null) {
      state.budgetYen = budget;
      state.budgetSet = true;
    } else if (BUDGET_PROMPT.test(assistant) && (isNoPreferenceAnswer(content) || BUDGET_TO_CONSULT.test(content))) {
      state.budgetSet = true;
      state.budgetNote = UNKNOWN_NOTE;
    } else if (BUDGET_PROMPT.test(assistant) && isUnknownAnswer(content)) {
      state.budgetSet = true;
      state.budgetNote = UNKNOWN_NOTE;
    } else if (BUDGET_PROMPT.test(assistant)) {
      const note = freeTextAnswer(content);
      if (note) {
        state.budgetNote = note;
        state.budgetSet = true;
      }
    }
    if (TIMING_PROMPT.test(assistant) && !isBudgetAmountAnswer(content)) {
      const timing = timingFromMessage(content, true);
      if (timing) {
        state.timing = timing;
        state.timingSet = true;
      } else if (isUnknownAnswer(content)) {
        state.timing = UNKNOWN_NOTE;
        state.timingSet = true;
      } else {
        const note = freeTextAnswer(content);
        if (note) {
          state.timing = note;
          state.timingSet = true;
        }
      }
    }
    const priorities = prioritiesFromMessage(content, PRIORITIES_PROMPT.test(assistant));
    if (priorities) {
      state.priorities = priorities;
      state.prioritiesSet = true;
    } else if (PRIORITIES_PROMPT.test(assistant) && isUnknownAnswer(content)) {
      state.priorities = UNKNOWN_NOTE;
      state.prioritiesSet = true;
    } else if (PRIORITIES_PROMPT.test(assistant)) {
      const note = freeTextAnswer(content);
      if (note) {
        state.priorities = note;
        state.prioritiesSet = true;
      }
    }
    const contact = extractCustomHomeContact(content, {
      expectingName: NAME_PROMPT.test(assistant) || PHONE_PROMPT.test(assistant),
      expectingPhone: PHONE_PROMPT.test(assistant),
    });
    if (contact.name || (NAME_PROMPT.test(assistant) && NAME_REDACTED.test(content))) {
      state.contactNameSet = true;
    }
    // A phone-shaped value in an earlier intake answer (for example a budget
    // or a deliberately malicious long number) must not silently complete the
    // contact step. Only count it while asking for contact details, or when a
    // privacy marker has already been produced for the current turn.
    if (
      (PHONE_PROMPT.test(assistant) || NAME_PROMPT.test(assistant))
      && customHomePhoneProvided(content, PHONE_PROMPT.test(assistant))
    ) {
      const phone = contact.phone;
      state.contactPhoneLast4 = phone?.slice(-4) || state.contactPhoneLast4 || '番号入力済み';
      state.contactPhoneSet = true;
    }
  });

  state.leadReady = state.contactNameSet && state.contactPhoneSet;
  return state;
}

function nextStep(state: CustomHomeConsultationState): CustomHomeStep {
  if (!state.landOwnershipSet) return 'land_ownership';
  if (state.landOwnership === 'owned') {
    if (!state.landLocationSet) return 'land_location';
    if (!state.landSizeSet) return 'land_size';
  } else if (!state.desiredAreaSet) {
    return 'desired_area';
  }
  if (!state.householdSet) return 'household';
  if (!state.layoutSet) return 'layout';
  if (!state.budgetSet) return 'budget';
  if (!state.timingSet) return 'timing';
  if (!state.prioritiesSet) return 'priorities';
  if (!state.contactNameSet) return 'contact_name';
  if (!state.contactPhoneSet) return 'contact_phone';
  return 'complete';
}

function responseForStep(step: CustomHomeStep, state?: CustomHomeConsultationState): string | undefined {
  switch (step) {
    case 'land_ownership': return 'オリエントホームが得意な注文住宅の相談だね。まず、土地を持っているか教えてにゃん。分からなければ「未定」でも大丈夫にゃん。';
    case 'land_location': return '土地をお持ちなんだね。土地の所在地を市区町村まで教えてにゃん。分からなければ「未定」で大丈夫にゃん。';
    case 'land_size': return '土地の広さを教えてにゃん。㎡または坪で大丈夫にゃん。まだ分からなければ「未定」でも大丈夫。戸建てなら30〜40坪前後が一つの目安だけど、希望の暮らし方で変わるにゃん。';
    case 'desired_area': return '土地探しからだね。建てたいエリア（市区町村や沿線）を教えてにゃん。まだ決まっていなければ「未定」で大丈夫にゃん。';
    case 'household': return 'ご家族の人数や構成を教えてにゃん。まだ決まっていなければ「未定」で大丈夫にゃん。';
    case 'layout': return '希望する間取りや住まい方を教えてにゃん。例：3LDK、平屋、二世帯などにゃん。未定でも大丈夫にゃん。';
    case 'budget': return state?.landOwnership === 'owned'
      ? '建物と諸費用を含めた予算の目安を教えてにゃん。土地代は除いた金額で大丈夫にゃん。未定・相談したいでも大丈夫にゃん。'
      : '土地と建物を含めた総予算の目安を教えてにゃん。例：4,000万円まで、未定、相談したいなどで大丈夫にゃん。';
    case 'timing': return 'いつ頃の完成・入居を希望しているか教えてにゃん。未定でも大丈夫にゃん。';
    case 'priorities': return '住まいで重視したいことを教えてにゃん。性能・デザイン・家事動線・収納など、複数あっても大丈夫にゃん。未定や相談したいでも大丈夫にゃん。';
    case 'contact_name': return 'ここまでの内容を担当者に相談するため、お名前を教えてにゃん。入力内容はご相談対応のために利用するにゃん。';
    case 'contact_phone': return '担当者からご連絡するため、お電話番号を教えてにゃん。';
    case 'complete': return undefined;
  }
}

export function evaluateCustomHomeConsultation(
  history: ConversationContextMessage[],
  currentMessage: string,
): CustomHomeConsultationDecision {
  const rawCurrent = normalize(currentMessage);
  const normalizedCurrent = stripAnswer(currentMessage);
  if (MODE_SWITCH.test(normalizedCurrent)) return { active: false };
  if (CUSTOM_HOME_EXPLANATION.test(normalizedCurrent)) return { active: false };
  const messages = flowMessages(history, currentMessage);
  if (customHomeSupersededByModeSwitch(messages)) return { active: false };
  // Once a lead has been accepted, this intake is terminal. Without this
  // guard, any later chat message re-entered the completed flow and could ask
  // for the phone again or enqueue another notification.
  if (!isCustomHomeIntent(normalizedCurrent) && extractCustomHomeConsultationState(history, '').leadReady) {
    return { active: false };
  }
  const lastAssistant = [...messages].reverse().find((message) => (
    message.role === 'assistant' && isCustomHomePrompt(message.content)
  ))?.content || '';
  // Assistant prompts can contain generic words such as "こだわり" in a
  // purchase flow. Only an explicit visitor intent may start this intake;
  // prompts are used solely to continue an intake that the visitor started.
  const hasFlow = messages.some((message) => (
    message.role === 'user' && isCustomHomeIntent(message.content)
  ));
  if (!hasFlow) return { active: false };
  if (isContactDecline(currentMessage) && NAME_PROMPT.test(lastAssistant)) {
    return {
      active: true,
      response: 'お名前をこのチャットで入力しない場合は、公式LINEから担当者へ相談してにゃん。チャットで続ける場合は、お名前を入力してにゃん。',
      step: 'contact_name',
      leadReady: false,
    };
  }
  if (isContactDecline(currentMessage) && PHONE_PROMPT.test(lastAssistant)) {
    return {
      active: true,
      response: '電話番号をこのチャットで入力しない場合は、公式LINEから担当者へ相談してにゃん。チャットで続ける場合は、電話番号を入力してにゃん。',
      step: 'contact_phone',
      leadReady: false,
    };
  }
  // A standalone "ありがとう" is a detour. A polite suffix on a substantive
  // answer is not; `normalizedCurrent` keeps the substantive part above.
  if (!normalizedCurrent && rawCurrent) return { active: false };
  const currentStartsFlow = isCustomHomeIntent(normalizedCurrent);
  const currentCriterionReply = isCriterionReply(normalizedCurrent, lastAssistant);
  if (isObviousConversationDetour(normalizedCurrent) && !currentCriterionReply) return { active: false };
  if (!currentStartsFlow && !isCustomHomePrompt(lastAssistant) && !currentCriterionReply) {
    return { active: false };
  }
  const state = extractCustomHomeConsultationState(history, currentMessage);
  const step = nextStep(state);
  if (state.leadReady) return { active: true, step: 'complete', leadReady: true };
  if (step === 'land_size' && LAND_SIZE_HELP_REQUEST.test(normalizedCurrent)) {
    return {
      active: true,
      response: responseForStep(step, state),
      step,
      leadReady: false,
    };
  }
  if (step === 'land_ownership' && LAND_SIZE_HELP_REQUEST.test(normalizedCurrent)) {
    return {
      active: true,
      response: '戸建てなら30〜40坪前後が一つの目安だけど、希望の暮らし方で変わるにゃん。土地を持っているかは、未定でも大丈夫なので教えてにゃん。',
      step,
      leadReady: false,
    };
  }
  return { active: true, response: responseForStep(step, state), step, leadReady: false };
}

export function customHomeChoicesForStep(step: CustomHomeStep): CustomHomeChoice[] {
  switch (step) {
    case 'land_ownership': return [
      { label: '土地を持っている', value: '土地を持っている' },
      { label: '土地を持っていない', value: '土地を持っていない' },
      { label: '未定', value: '未定' },
    ];
    case 'land_location':
    case 'land_size':
    case 'desired_area': return [{ label: '未定', value: '未定' }];
    case 'household': return ['1人', '2人', '3人', '4人', '5人以上', '未定'].map((value) => ({ label: value, value }));
    case 'layout': return ['平屋', '2LDK', '3LDK', '4LDK', '二世帯住宅', 'こだわりなし'].map((value) => ({ label: value, value }));
    case 'budget': return ['3,000万円まで', '4,000万円まで', '5,000万円まで', '6,000万円まで', '相談したい'].map((value) => ({ label: value, value }));
    case 'timing': return ['できるだけ早く', '半年以内', '1年以内', '時期未定'].map((value) => ({ label: value, value }));
    case 'priorities': return ['性能重視', 'デザイン重視', '家事動線重視', '収納重視', '相談して決めたい'].map((value) => ({ label: value, value }));
    default: return [];
  }
}

/** Derives only the known, safe button sets from the generated custom-home prompt. */
export function customHomeChoicesForResponse(response: string): CustomHomeChoice[] {
  const normalized = normalize(response);
  if (LAND_PROMPT.test(normalized)) return customHomeChoicesForStep('land_ownership');
  if (LAND_LOCATION_PROMPT.test(normalized)) return customHomeChoicesForStep('land_location');
  if (LAND_SIZE_PROMPT.test(normalized)) return customHomeChoicesForStep('land_size');
  if (DESIRED_AREA_PROMPT.test(normalized)) return customHomeChoicesForStep('desired_area');
  if (HOUSEHOLD_PROMPT.test(normalized)) return customHomeChoicesForStep('household');
  if (LAYOUT_PROMPT.test(normalized)) return customHomeChoicesForStep('layout');
  if (BUDGET_PROMPT.test(normalized)) return customHomeChoicesForStep('budget');
  if (TIMING_PROMPT.test(normalized)) return customHomeChoicesForStep('timing');
  if (PRIORITIES_PROMPT.test(normalized)) return customHomeChoicesForStep('priorities');
  return [];
}
