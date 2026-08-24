import type { ConversationContextMessage } from './conversation-context';
import {
  isObviousConversationDetour,
  scopePropertySearchMessages,
  shouldContinueCompletedPropertySearch,
} from './property-search-continuation';

export type PurchaseConsultationDecision = {
  active: boolean;
  response?: string;
};

export type PurchaseConsultationState = {
  prefecture?: string;
  area?: string;
  ward?: string;
  maxPriceYen?: number;
  propertyType?: string;
  layout?: string;
  maxWalkMinutes?: number;
  propertyTypeSet: boolean;
  layoutSet: boolean;
};

const PURCHASE_INTENT = /(?:購入|買いたい|買う|新築|中古|戸建(?:て)?|一戸建て|マンション|土地)/u;
const RENTAL_INTENT = /(?:賃貸|借りたい|部屋を借り)/u;
const EXACT_PURCHASE_START = /^(?:購入|購入したい|家を買いたい|物件を買いたい)(?:[。！!？?])?$/u;
const AREA_PROMPT = /(?:希望エリア|購入したい地域|都道府県|市区町村)/u;
const WARD_PROMPT = /(?:次に|希望の?)区を選んで/u;
const BUDGET_PROMPT = /購入予算の上限/u;
const TYPE_PROMPT = /購入する物件の種類/u;
const LAYOUT_PROMPT = /購入物件の希望間取り/u;
const COMPLETED_PURCHASE_SEARCH = /条件に合う購入物件.*(?:見つかった|見つからなかった)/u;
const PURCHASE_EXPLANATION_REQUEST = /(?:(?:とは|違い|比較|メリット|デメリット|特徴|について教えて|について知りたい|どういう|どんな)(?:物件)?|(?:どちら|どっち).*(?:いい|良い|おすすめ|向いて)|(?:迷って|悩んで))/u;
const NO_PREFERENCE = /^(?:(?:物件種別|間取り)(?:は|を)?)?(?:特に)?(?:(?:こだわり|指定)(?:は)?(?:なし|ない|ありません)|なし|ない|ありません|未定|わからない|わかりません|決めていない|決まっていない)(?:で(?:いい|大丈夫)(?:ですか)?|に(?:する|したい))?(?:です)?[。！!？?]?$/u;
const UNLIMITED_BUDGET = /(?:予算|購入価格|購入金額).*(?:未定|わからない|わかりません|決めていない|決まっていない|相談したい|上限.*(?:なし|ない)|なし)/u;
const AREA_WITH_SUFFIX = /([\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,18}(?:都|道|府|県|市|区|町|村)|[\p{Script=Han}々ヶケァ-ヶー]{1,18}駅)/gu;
const PREFECTURE = /([\p{Script=Han}々ヶケ]{2,8}(?:都|道|府|県))/u;
const CITY_WARD = /(大阪市|堺市)\s*([\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,10}区)/u;
const GUIDED_WARD_CITY = /^(?:大阪市|堺市)$/u;
const UNKNOWN_LOCATION = /^(?:未定|わからない|わかりません|決めていない|決まっていない|どこでも(?:いい|大丈夫)?|おまかせ|相談したい)[。！!？?]*$/u;

function messagesSinceLatestSearch(history: ConversationContextMessage[], currentMessage: string) {
  const messages = scopePropertySearchMessages(history, currentMessage);
  // Selecting "購入" again is an explicit restart, including after a completed
  // purchase search. Do not carry old prefecture or budget into the new search.
  if (EXACT_PURCHASE_START.test(currentMessage.normalize('NFKC').trim())) {
    return messages.slice(-1);
  }
  return messages;
}

function shortArea(content: string) {
  const candidate = content.trim().replace(/[。！!？?、,]/gu, '');
  if (!/^[\p{Script=Han}々ヶケぁ-んァ-ヶー]{2,18}$/u.test(candidate)) return undefined;
  if (/(?:購入|予算|万円?|物件|戸建|マンション|土地|間取り|LDK|こだわり|なし|未定|わから|決めていない|相談|どこでも|おまかせ)/iu.test(candidate)) return undefined;
  return candidate;
}

function areaFromMessage(content: string, answeredPrompt: boolean) {
  const matches = Array.from(content.matchAll(AREA_WITH_SUFFIX));
  const matched = matches.at(-1)?.[1];
  const prefecture = prefectureFromMessage(content);
  const prefectureOffset = matched && prefecture ? matched.lastIndexOf(prefecture) : -1;
  const explicit = prefectureOffset >= 0 && prefecture
    ? matched!.slice(prefectureOffset + prefecture.length).replace(/^[の\s]+/u, '') || matched
    : matched;
  if (explicit) return explicit;
  return answeredPrompt ? shortArea(content) : undefined;
}

function prefectureFromMessage(content: string) {
  return content.match(PREFECTURE)?.[1];
}

function wardFromMessage(content: string) {
  return content.match(/^[\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,10}区$/u)?.[0];
}

function budgetFromMessage(content: string, answeredPrompt: boolean) {
  if (/(?:^|[^\d])[-−]\s*\d/u.test(content)) return undefined;
  const number = (value: string) => Number(value.replace(/,/gu, ''));
  if (UNLIMITED_BUDGET.test(content)
    || (answeredPrompt && /^(?:未定|わからない|わかりません|決めていない|決まっていない|相談(?:したい|して決めたい)?)[。！!？?]*$/u.test(content.trim()))) {
    return Number.MAX_SAFE_INTEGER;
  }
  const hundredMillions = content.match(/(\d[\d,]*(?:\.\d+)?)\s*億(?:\s*(\d[\d,]*(?:\.\d+)?)\s*万)?(?:円)?/u);
  if (hundredMillions?.[1]) {
    return Math.round(number(hundredMillions[1]) * 100_000_000 + number(hundredMillions[2] || '0') * 10_000);
  }
  const tenMillions = content.match(/(\d[\d,]*(?:\.\d+)?)\s*千万(?:円)?/u)?.[1];
  if (tenMillions) return Math.round(number(tenMillions) * 10_000_000);
  const tenThousands = content.match(/(\d[\d,]*(?:\.\d+)?)\s*万(?:円)?/u)?.[1];
  if (tenThousands) return Math.round(number(tenThousands) * 10_000);
  const yen = content.match(/(\d[\d,]{5,})\s*円/u)?.[1];
  if (yen) return number(yen);
  if (answeredPrompt) {
    const plain = content.match(/^\s*(\d[\d,]*(?:\.\d+)?)\s*$/u)?.[1];
    if (plain) {
      const parsed = number(plain);
      return Math.round(parsed >= 1_000_000 ? parsed : parsed * 10_000);
    }
  }
  return undefined;
}

function propertyTypeFromMessage(content: string) {
  const detachedHouse = /(?:一戸建て|戸建て?|一軒家)/u.test(content);
  if (/新築/u.test(content) && detachedHouse) return '新築戸建て';
  if (/中古/u.test(content) && detachedHouse) return '中古戸建て';
  if (/中古マンション/u.test(content)) return '中古マンション';
  if (/土地/u.test(content)) return '土地';
  if (/(?:その他・?事業用|事業用|収益物件|店舗・事務所)/u.test(content)) return 'その他・事業用';
  if (detachedHouse) return '戸建て';
  if (/マンション/u.test(content)) return 'マンション';
  return undefined;
}

function layoutFromMessage(content: string) {
  if (/(?:^|[^\d])[-−]\s*\d+\s*[SLDKR]/iu.test(content)) return undefined;
  const layout = content.match(/\d+[SLDKR]+/iu)?.[0]?.toUpperCase().replace(/([SLDKR])\1+/gu, '$1');
  return layout && /(?:以上|より広|から)/u.test(content) ? `${layout}+` : layout;
}

function walkMinutesFromMessage(content: string) {
  if (/徒歩\s*[-−]\s*\d+/u.test(content)) return undefined;
  const minutes = content.match(/徒歩\s*(\d+)分\s*(?:以内|まで)?/u)?.[1];
  return minutes ? Number(minutes) : undefined;
}

function isPurchaseCriterionReply(content: string, lastAssistant: string) {
  const normalized = content.normalize('NFKC');
  if (WARD_PROMPT.test(lastAssistant)) {
    return Boolean(wardFromMessage(normalized) || UNKNOWN_LOCATION.test(normalized.trim()));
  }
  return Boolean(
    prefectureFromMessage(normalized)
    || areaFromMessage(normalized, AREA_PROMPT.test(lastAssistant))
    || budgetFromMessage(normalized, BUDGET_PROMPT.test(lastAssistant))
    || propertyTypeFromMessage(normalized)
    || layoutFromMessage(normalized)
    || walkMinutesFromMessage(normalized) != null
    || ((TYPE_PROMPT.test(lastAssistant) || LAYOUT_PROMPT.test(lastAssistant))
      && NO_PREFERENCE.test(normalized))
  );
}

function isPurchaseFlowPrompt(content: string) {
  return AREA_PROMPT.test(content)
    || WARD_PROMPT.test(content)
    || BUDGET_PROMPT.test(content)
    || TYPE_PROMPT.test(content)
    || LAYOUT_PROMPT.test(content);
}

function isPurchaseExplanationRequest(content: string) {
  const normalized = content.normalize('NFKC');
  return PURCHASE_EXPLANATION_REQUEST.test(normalized)
    && !/(?:探|ありますか|ある？|候補|紹介|おすすめ|見たい)/u.test(normalized);
}

export function extractPurchaseConsultationState(
  history: ConversationContextMessage[],
  currentMessage: string,
): PurchaseConsultationState {
  const messages = messagesSinceLatestSearch(history, currentMessage);
  const state: PurchaseConsultationState = { propertyTypeSet: false, layoutSet: false };

  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const content = message.content.normalize('NFKC');
    const previous = messages[index - 1];
    const previousAssistant = previous?.role === 'assistant' ? previous.content : '';
    const prefecture = prefectureFromMessage(content);
    const cityWard = content.match(CITY_WARD);
    const area = areaFromMessage(content, AREA_PROMPT.test(previousAssistant));
    const maxPriceYen = budgetFromMessage(content, BUDGET_PROMPT.test(previousAssistant));
    const propertyType = propertyTypeFromMessage(content);
    const layout = layoutFromMessage(content);
    const maxWalkMinutes = walkMinutesFromMessage(content);

    if (/新しい希望の都道府県/u.test(previousAssistant)) {
      state.prefecture = undefined;
      state.area = undefined;
      state.ward = undefined;
    }

    if (prefecture) {
      if (state.prefecture && state.prefecture !== prefecture) {
        state.area = undefined;
        state.ward = undefined;
      }
      state.prefecture = prefecture;
    }
    if (cityWard) {
      state.area = cityWard[1];
      state.ward = cityWard[2];
    } else if (area && !PREFECTURE.test(area)) {
      const ward = wardFromMessage(area);
      if (ward && GUIDED_WARD_CITY.test(state.area || '')) state.ward = ward;
      else {
        state.area = area;
        state.ward = undefined;
      }
    }
    if (maxPriceYen) state.maxPriceYen = maxPriceYen;
    if (propertyType) {
      state.propertyType = propertyType;
      state.propertyTypeSet = true;
      if (propertyType === '土地') {
        state.layout = undefined;
        state.layoutSet = false;
      }
    } else if (TYPE_PROMPT.test(previousAssistant) && NO_PREFERENCE.test(content)) {
      state.propertyType = undefined;
      state.propertyTypeSet = true;
    }
    if (layout) {
      state.layout = layout;
      state.layoutSet = true;
    } else if (LAYOUT_PROMPT.test(previousAssistant) && NO_PREFERENCE.test(content)) {
      state.layout = undefined;
      state.layoutSet = true;
    }
    if (maxWalkMinutes != null) state.maxWalkMinutes = maxWalkMinutes;
  });
  return state;
}

export function evaluatePurchaseConsultation(
  history: ConversationContextMessage[],
  currentMessage: string,
): PurchaseConsultationDecision {
  if (isObviousConversationDetour(currentMessage)) return { active: false };
  if (isPurchaseExplanationRequest(currentMessage)) return { active: false };
  const messages = messagesSinceLatestSearch(history, currentMessage);
  const userContext = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');
  const hasPurchaseFlowContext = messages.some((message) => (
    message.role === 'assistant'
    && (isPurchaseFlowPrompt(message.content) || COMPLETED_PURCHASE_SEARCH.test(message.content))
  ));
  const active = (PURCHASE_INTENT.test(userContext) || hasPurchaseFlowContext)
    && !RENTAL_INTENT.test(currentMessage);
  if (!active) return { active: false };
  const lastAssistant = [...history].reverse().find((message) => message.role === 'assistant')?.content || '';
  const startsPurchaseSearch = PURCHASE_INTENT.test(currentMessage) && !RENTAL_INTENT.test(currentMessage);
  const completedSearchFollowUp = !shouldContinueCompletedPropertySearch(messages, '__topic_change__')
    && shouldContinueCompletedPropertySearch(messages, currentMessage);
  const normalizedCurrent = currentMessage.normalize('NFKC').trim();
  if (UNKNOWN_LOCATION.test(normalizedCurrent) && WARD_PROMPT.test(lastAssistant)) {
    return { active: true, response: '購入する物件の種類を選んでにゃん。まだ決まっていなければ、こだわりなしでも探せるにゃん。' };
  }
  if (UNKNOWN_LOCATION.test(normalizedCurrent) && AREA_PROMPT.test(lastAssistant)) {
    return {
      active: true,
      response: /都道府県/u.test(lastAssistant)
        ? '登録物件のある都道府県を選んでにゃん。'
        : '登録物件のある市区町村を選んでにゃん。',
    };
  }
  if (!startsPurchaseSearch
    && !completedSearchFollowUp
    && !isPurchaseFlowPrompt(lastAssistant)
    && !isPurchaseCriterionReply(currentMessage, lastAssistant)) {
    return { active: false };
  }
  if (!startsPurchaseSearch
    && isPurchaseFlowPrompt(lastAssistant)
    && !isPurchaseCriterionReply(currentMessage, lastAssistant)) {
    return { active: true, response: lastAssistant };
  }
  if (!shouldContinueCompletedPropertySearch(messages, currentMessage)) {
    return { active: false };
  }

  const completedPurchaseSearch = messages.some((message) => (
    message.role === 'assistant' && COMPLETED_PURCHASE_SEARCH.test(message.content)
  ));
  if (completedPurchaseSearch && /(?:(?:もっと|より).*(?:安|価格を下げ)|(?:予算|価格(?:上限)?).*(?:変更|変え|見直|上げ|下げ|増や|減ら|広げ))/u.test(normalizedCurrent)) {
    return { active: true, response: '新しい購入予算の上限を選んでにゃん。' };
  }
  if (completedPurchaseSearch && /(?:(?:もっと|より).*(?:広|部屋数を増)|(?:間取り|部屋数).*(?:変更|変え|選び直|見直))/u.test(normalizedCurrent)) {
    return { active: true, response: '購入物件の希望間取りを選んでにゃん。決まっていなければ、こだわりなしで大丈夫にゃん。' };
  }
  if (completedPurchaseSearch && /(?:物件種別|物件の種類|種類).*(?:変更|変え|選び直|見直)/u.test(normalizedCurrent)) {
    return { active: true, response: '購入する物件の種類を選んでにゃん。まだ決まっていなければ、こだわりなしでも探せるにゃん。' };
  }
  if (completedPurchaseSearch && /(?:エリア|地域|場所|市区町村|都道府県).*(?:変更|変え|選び直|見直)/u.test(normalizedCurrent)) {
    return { active: true, response: '新しい希望の都道府県を選んでにゃん。' };
  }
  if (completedPurchaseSearch && /(?:もっと|より).*(?:駅|徒歩).*(?:近|短)/u.test(normalizedCurrent)) {
    return { active: true, response: '希望する駅徒歩の上限を「徒歩10分以内」のように教えてにゃん。' };
  }

  const state = extractPurchaseConsultationState(history, currentMessage);
  if (!state.prefecture && !state.area) {
    return { active: true, response: '購入物件を一緒に探すにゃん。まず、希望の都道府県を選んでにゃん。' };
  }
  if (!state.area) {
    return { active: true, response: `${state.prefecture}で購入物件を探すにゃん。次に、市区町村を選んでにゃん。` };
  }
  if (!state.propertyTypeSet) {
    return { active: true, response: '購入する物件の種類を選んでにゃん。まだ決まっていなければ、こだわりなしでも探せるにゃん。' };
  }
  if (!state.maxPriceYen) {
    return { active: true, response: '購入予算の上限を選んでにゃん。諸費用を除いた物件価格の目安で大丈夫にゃん。' };
  }
  if (!state.layoutSet && state.propertyType !== '土地') {
    return { active: true, response: '購入物件の希望間取りを選んでにゃん。決まっていなければ、こだわりなしで大丈夫にゃん。' };
  }
  return { active: true };
}
