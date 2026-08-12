import type { ConversationContextMessage } from './conversation-context';
import { shouldContinueCompletedPropertySearch } from './property-search-continuation';

export type RentalConsultationDecision = {
  active: boolean;
  response?: string;
};

export type RentalConsultationState = {
  householdSize?: number;
  area?: string;
  maxRentYen?: number;
  layout?: string;
  maxWalkMinutes?: number;
  hasPreference: boolean;
};

const RENTAL_INTENT = /(?:一人暮らし|ひとり暮らし|単身|二人暮らし|賃貸|部屋探し|部屋を探|借りたい|引っ越し|住みたい)/u;
const SALE_INTENT = /(?:購入|買いたい|新築|中古|戸建てを買|土地を買)/u;
const PROPERTY_SEARCH_STARTER = /^(?:物件を探す|物件探し)(?:[。！!？?])?$/u;
const PROPERTY_TYPE_QUESTION = /賃貸(?:と|か)購入.*(?:教えて|選んで)/u;
const AREA_PROMPT = /(?:住みたい地域|希望(?:の)?エリア|地域や最寄り駅|最寄り駅)/u;
const BUDGET_PROMPT = /(?:家賃|予算).*(?:上限|教えて)/u;
const COMPACT_LAYOUT_CONFIRMATION = /(?:かなり手狭|ワンルームのまま|1Rのまま|1Kのまま)/u;
const KEEP_COMPACT_LAYOUT = /(?:そのまま|ワンルーム(?:のまま|でいい)|1R(?:のまま|でいい)|1K(?:のまま|でいい))/iu;
const AREA_WITH_SUFFIX = /([\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,18}(?:都|道|府|県|市|区|町|村)|[\p{Script=Han}々ヶケァ-ヶー]{1,18}駅)/gu;
const PREFERENCE = /(?:ワンルーム|\d+[SLDKR]+|駅近|徒歩\s*\d+分|ペット|築浅|駐車|オートロック|バス・トイレ|こだわり.*(?:なし|ない))/iu;
const NO_PREFERENCE = /^(?:特に)?(?:なし|ない|ありません|こだわりなし)[。！!？?]?$/u;
const NON_AREA_ANSWER = /(?:賃貸|購入|物件|部屋|探す|したい|家族|人家族|一人暮らし|ひとり暮らし|単身|夫婦|カップル|子ども|子供|大人|家賃|予算|万円?|円|間取り|ワンルーム|[SLDKR]|ペット|徒歩|駅近|駐車|なし|ない)/iu;

function messagesSinceLatestPropertySearch(
  history: ConversationContextMessage[],
  currentMessage: string,
) {
  const messages: ConversationContextMessage[] = [
    ...history,
    { role: 'user', content: currentMessage },
  ];
  let lastSearchStart = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user' && PROPERTY_SEARCH_STARTER.test(message.content.trim())) {
      lastSearchStart = index;
      break;
    }
  }

  return lastSearchStart >= 0 ? messages.slice(lastSearchStart) : [];
}

function hasPendingPropertyType(
  propertySearchMessages: ConversationContextMessage[],
  lastAssistant: string,
) {
  const hasSelectedType = propertySearchMessages.some((message) => (
    message.role === 'user' && (RENTAL_INTENT.test(message.content) || SALE_INTENT.test(message.content))
  ));

  return !hasSelectedType && (
    propertySearchMessages.length > 0 || PROPERTY_TYPE_QUESTION.test(lastAssistant)
  );
}

function numericPeople(value: string | undefined) {
  if (!value) return undefined;
  const japaneseDigits: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  };
  return japaneseDigits[value] || Number(value) || undefined;
}

function householdSizeFromMessage(content: string) {
  const explicit = content.match(/(?:家族\s*([1-9一二三四五六七八九])\s*人|([1-9一二三四五六七八九])\s*人家族)/u);
  const explicitSize = numericPeople(explicit?.[1] || explicit?.[2]);
  if (explicitSize) return explicitSize;

  const adults = numericPeople(content.match(/大人\s*([1-9一二三四五六七八九])\s*人/u)?.[1]);
  const children = numericPeople(content.match(/(?:子ども|子供)\s*([1-9一二三四五六七八九])\s*人/u)?.[1]);
  if (adults && children) return adults + children;
  if (children && /夫婦/u.test(content)) return children + 2;
  if (/(?:一人暮らし|ひとり暮らし|単身)/u.test(content)) return 1;
  if (/(?:二人暮らし|夫婦|カップル)/u.test(content)) return 2;
  return undefined;
}

function shortAreaCandidate(content: string) {
  const candidate = content
    .trim()
    .replace(/[。！!？?、,]/gu, '')
    .replace(/(?:がいい|を希望|希望|あたり|辺り|周辺|付近|近く)$/u, '')
    .trim();
  if (!/^[\p{Script=Han}々ヶケぁ-んァ-ヶー]{2,18}$/u.test(candidate)) return undefined;
  if (/^[でにのがをとへ]/u.test(candidate)) return undefined;
  if (NON_AREA_ANSWER.test(candidate)) return undefined;
  return candidate;
}

function areaFromMessage(content: string, answeredAreaPrompt: boolean) {
  const explicitAreas = Array.from(content.matchAll(AREA_WITH_SUFFIX));
  const explicitArea = explicitAreas
    .map((match) => shortAreaCandidate(match[1] || ''))
    .filter((area): area is string => Boolean(area))
    .at(-1);
  if (explicitArea) return explicitArea;

  const phraseArea = content.match(/^([\p{Script=Han}々ヶケぁ-んァ-ヶー]{2,18}?)(?:周辺|付近|あたり)?(?:で|に)(?:一人暮らし|ひとり暮らし|二人暮らし|家族|賃貸|部屋|物件|住|暮ら|探)/u)?.[1];
  if (phraseArea) return shortAreaCandidate(phraseArea);
  if (answeredAreaPrompt) return shortAreaCandidate(content);
  return undefined;
}

function budgetFromMessage(content: string, answeredBudgetPrompt: boolean) {
  const tenThousands = content.match(/(\d+(?:\.\d+)?)\s*万(?:円)?/u)?.[1];
  if (tenThousands) return Math.round(Number(tenThousands) * 10_000);

  const yen = content.match(/(\d[\d,]{3,})\s*円/u)?.[1];
  if (yen) return Number(yen.replace(/,/gu, ''));

  if (answeredBudgetPrompt) {
    const plain = content.match(/^\s*(\d+(?:\.\d+)?)\s*(?:まで|以下|以内)?\s*$/u)?.[1];
    if (plain) {
      const amount = Number(plain);
      return amount <= 200 ? Math.round(amount * 10_000) : Math.round(amount);
    }
  }
  return undefined;
}

function layoutFromMessage(content: string) {
  const layout = content.match(/(?:ワンルーム|\d+[SLDKR]+)/iu)?.[0];
  return layout?.toUpperCase().replace('ワンルーム', '1R');
}

function walkMinutesFromMessage(content: string) {
  const walk = content.match(/徒歩\s*(\d+)分\s*(?:以内|まで)?/u)?.[1];
  return walk ? Number(walk) : undefined;
}

export function extractRentalConsultationState(
  history: ConversationContextMessage[],
  currentMessage: string,
): RentalConsultationState {
  const scoped = messagesSinceLatestPropertySearch(history, currentMessage);
  const messages = scoped.length > 0
    ? scoped
    : [...history, { role: 'user' as const, content: currentMessage }];
  const state: RentalConsultationState = { hasPreference: false };

  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const previous = messages[index - 1];
    const previousAssistant = previous?.role === 'assistant' ? previous.content : '';
    const normalizedContent = message.content.normalize('NFKC');
    const householdSize = householdSizeFromMessage(normalizedContent);
    const area = areaFromMessage(normalizedContent, AREA_PROMPT.test(previousAssistant));
    const maxRentYen = budgetFromMessage(normalizedContent, BUDGET_PROMPT.test(previousAssistant));
    const layout = layoutFromMessage(normalizedContent);
    const maxWalkMinutes = walkMinutesFromMessage(normalizedContent);

    if (householdSize) state.householdSize = householdSize;
    if (area) state.area = area;
    if (maxRentYen) state.maxRentYen = maxRentYen;
    if (layout) state.layout = layout;
    if (maxWalkMinutes != null) state.maxWalkMinutes = maxWalkMinutes;
    if (PREFERENCE.test(normalizedContent) || NO_PREFERENCE.test(normalizedContent)) state.hasPreference = true;
  });

  return state;
}

function rentalSubject(state: RentalConsultationState) {
  if (state.householdSize === 1) return '一人暮らし向けの賃貸';
  if (state.householdSize && state.householdSize >= 2) return `${state.householdSize}人で暮らす賃貸`;
  return '賃貸';
}

function displayLayout(layout: string) {
  return layout === '1R' ? 'ワンルーム' : layout;
}

export function evaluateRentalConsultation(
  history: ConversationContextMessage[],
  currentMessage: string,
): RentalConsultationDecision {
  if (PROPERTY_SEARCH_STARTER.test(currentMessage.trim())) {
    return {
      active: false,
      response: '物件探しだね。賃貸と購入のどちらを探しているか、希望エリアを教えてにゃん。',
    };
  }

  const userMessages = [
    ...history.filter((message) => message.role === 'user').map((message) => message.content),
    currentMessage,
  ];
  const context = userMessages.join('\n');
  const lastAssistant = [...history].reverse().find((message) => message.role === 'assistant')?.content || '';
  const propertySearchMessages = messagesSinceLatestPropertySearch(history, currentMessage);

  if (hasPendingPropertyType(propertySearchMessages, lastAssistant)) {
    return {
      active: false,
      response: 'まず、賃貸か購入か教えてにゃん。',
    };
  }

  const currentSearchContext = propertySearchMessages.length > 0
    ? propertySearchMessages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n')
    : context;
  const active = RENTAL_INTENT.test(currentSearchContext) && !SALE_INTENT.test(currentSearchContext);
  if (!active) return { active: false };
  const currentSearchMessages = propertySearchMessages.length > 0
    ? propertySearchMessages
    : history;
  if (!shouldContinueCompletedPropertySearch(currentSearchMessages, currentMessage)) {
    return { active: false };
  }

  const state = extractRentalConsultationState(history, currentMessage);
  const subject = rentalSubject(state);
  if (!state.area) {
    return {
      active: true,
      response: `${subject}を一緒に探すにゃん。まず、住みたい地域や最寄り駅を教えてにゃん。`,
    };
  }
  if (!state.maxRentYen) {
    return {
      active: true,
      response: '次に、家賃の上限を教えてにゃん。共益費込みか別かも分かれば探しやすいにゃん。',
    };
  }
  if (!state.hasPreference) {
    const examples = state.householdSize && state.householdSize >= 3
      ? '2LDK・3LDK、駅からの徒歩分数、ペット可'
      : 'ワンルーム・1K、駅からの徒歩分数、ペット可';
    return {
      active: true,
      response: `希望の間取りや条件を教えてにゃん。${examples}などから選べるにゃん。`,
    };
  }

  const compactLayoutConflict = state.householdSize != null
    && state.householdSize >= 3
    && /^(?:1R|1K)$/u.test(state.layout || '');
  const compactLayoutConfirmed = COMPACT_LAYOUT_CONFIRMATION.test(lastAssistant)
    && KEEP_COMPACT_LAYOUT.test(currentMessage);
  if (compactLayoutConflict && !compactLayoutConfirmed) {
    return {
      active: true,
      response: `${state.householdSize}人家族で${displayLayout(state.layout || '')}はかなり手狭になりそうにゃん。${displayLayout(state.layout || '')}のまま探すか、2LDK以上に広げるか教えてにゃん。`,
    };
  }

  return { active: true };
}
