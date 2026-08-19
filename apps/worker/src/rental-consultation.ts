import type { ConversationContextMessage } from './conversation-context';
import {
  isObviousConversationDetour,
  scopePropertySearchMessages,
  shouldContinueCompletedPropertySearch,
} from './property-search-continuation';

export type RentalConsultationDecision = {
  active: boolean;
  response?: string;
};

export type RentalConsultationState = {
  householdSize?: number;
  prefecture?: string;
  area?: string;
  ward?: string;
  maxRentYen?: number;
  includeCommonFee?: boolean;
  layout?: string;
  maxWalkMinutes?: number;
  unsupportedCondition?: string;
  hasPreference: boolean;
};

const RENTAL_INTENT = /(?:一人暮らし|ひとり暮らし|単身|二人暮らし|賃貸|部屋探し|部屋を探|借りたい|引っ越し|住みたい)/u;
const SALE_INTENT = /(?:購入|買いたい|^(?:新築|中古)(?:戸建て?|マンション)$|(?:新築|中古)(?:戸建|マンション)?.*(?:買|購入)|戸建てを買|土地を買)/u;
const FRESH_RENTAL_RESTART = /^(?:(?:もう一度|改めて|新しく)\s*)?賃貸(?:物件)?(?:を探(?:す|したい))?[。！!？?]?$/u;
const PROPERTY_SEARCH_STARTER = /^(?:物件を探す|物件を探したい|物件探し(?:をしたい|したい)?)(?:[。！!？?])?$/u;
const PROPERTY_TYPE_QUESTION = /賃貸(?:と|か)購入.*(?:教えて|選んで)/u;
const AREA_PROMPT = /(?:住みたい地域|希望(?:の)?エリア|地域や最寄り駅|最寄り駅|都道府県|市区町村)/u;
const WARD_PROMPT = /(?:次に|希望の?)区を選んで/u;
const BUDGET_PROMPT = /(?:家賃|予算).*(?:上限|教えて)/u;
const PREFERENCE_PROMPT = /(?:希望の間取りや条件|希望条件)/u;
const COMPACT_LAYOUT_CONFIRMATION = /(?:かなり手狭|ワンルームのまま|1Rのまま|1Kのまま)/u;
const KEEP_COMPACT_LAYOUT = /(?:そのまま|ワンルーム(?:のまま|でいい)|1R(?:のまま|でいい)|1K(?:のまま|でいい))/iu;
const AREA_WITH_SUFFIX = /([\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,18}(?:都|道|府|県|市|区|町|村)|[\p{Script=Han}々ヶケァ-ヶー]{1,18}駅)/gu;
const PREFECTURE = /([\p{Script=Han}々ヶケ]{2,8}(?:都|道|府|県))/u;
const CITY_WARD = /(大阪市|堺市)\s*([\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,10}区)/u;
const GUIDED_WARD_CITY = /^(?:大阪市|堺市)$/u;
const PREFERENCE = /(?:ワンルーム|\d+[SLDKR]+|駅近|徒歩\s*\d+分|ペット|築浅|駐車|オートロック|バス・トイレ|こだわり.*(?:なし|ない))/iu;
const NO_PREFERENCE = /^(?:特に)?(?:なし|ない|ありません|こだわり(?:は)?(?:なし|ない)|指定(?:は)?(?:なし|ない)|なんでも(?:いい|大丈夫)|問わない|未定|わからない|わかりません|決めていない|決まっていない)(?:です)?[。！!？?]?$/u;
const CLEAR_LAYOUT_PREFERENCE = /(?:間取り|部屋数).*(?:こだわり|指定).*(?:なし|ない)|(?:間取り|部屋数).*(?:なんでも|問わない|未定)/u;
const CLEAR_WALK_PREFERENCE = /(?:徒歩|駅からの距離|駅距離).*(?:こだわり|指定).*(?:なし|ない)|(?:徒歩|駅からの距離|駅距離).*(?:なんでも|問わない|未定)/u;
const UNSUPPORTED_RENTAL_CONDITION = /(?:ペット|犬|猫|駐車場|駐輪場|オートロック|バス・トイレ|築浅|築年|楽器|ネット無料|インターネット無料|敷金|礼金|保証人|南向き|角部屋|女性限定)/u;
const CLEAR_UNSUPPORTED_CONDITION = /(?:ペット|犬|猫|駐車場|駐輪場|オートロック|バス・トイレ|築浅|築年|楽器|ネット|インターネット|敷金|礼金|保証人|南向き|角部屋|女性限定).*(?:条件から外|なしで|不要|こだわらない|問わない|なくても|じゃなくても)/u;
const UNLIMITED_BUDGET = /(?:上限.*(?:なし|ない|未定|問わない)|(?:家賃|予算).*(?:決めていない|決めてない|未定|問わない|わからない|相談したい))/u;
const RENTAL_EXPLANATION_REQUEST = /(?:賃貸|購入|注文住宅|借りる|買う|建てる).*(?:とは|違い|比較|メリット|デメリット|特徴|(?:どちら|どっち).*(?:いい|良い|おすすめ|向いて)|向いている|迷って|悩んで)/u;
const COMPLETED_RENTAL_SEARCH = /条件に合う.*賃貸.*(?:見つかった|見つからなかった)/u;
const NON_AREA_ANSWER = /(?:賃貸|購入|物件|部屋|探す|したい|家族|人家族|一人暮らし|ひとり暮らし|単身|夫婦|カップル|子ども|子供|大人|家賃|予算|万円?|円|間取り|ワンルーム|[SLDKR]|ペット|徒歩|駅近|駐車|なし|ない)/iu;
const UNKNOWN_LOCATION = /^(?:未定|わからない|わかりません|決めていない|決まっていない|どこでも(?:いい|大丈夫)?|おまかせ|相談したい)[。！!？?]*$/u;

function messagesSinceLatestPropertySearch(
  history: ConversationContextMessage[],
  currentMessage: string,
) {
  return scopePropertySearchMessages(history, currentMessage);
}

function hasPendingPropertyType(
  propertySearchMessages: ConversationContextMessage[],
  lastAssistant: string,
) {
  const hasSelectedType = propertySearchMessages.some((message) => (
    message.role === 'user' && (RENTAL_INTENT.test(message.content) || SALE_INTENT.test(message.content))
  ));

  const hasSearchStarter = propertySearchMessages.some((message) => (
    message.role === 'user' && PROPERTY_SEARCH_STARTER.test(message.content.trim())
  ));

  return !hasSelectedType && (
    hasSearchStarter || PROPERTY_TYPE_QUESTION.test(lastAssistant)
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
  if (/(?:家族\s*-\s*\d|[-−]\s*\d\s*(?:人|名))/u.test(content)) return undefined;
  const explicit = content.match(/(?:家族(?:は|で)?\s*(10|[1-9一二三四五六七八九])\s*人|(10|[1-9一二三四五六七八九])\s*人家族)/u);
  const explicitSize = numericPeople(explicit?.[1] || explicit?.[2]);
  if (explicitSize) return explicitSize;

  const adults = numericPeople(content.match(/大人\s*([1-9一二三四五六七八九])\s*人/u)?.[1]);
  const children = numericPeople(content.match(/(?:子ども|子供)\s*([1-9一二三四五六七八九])\s*人/u)?.[1]);
  if (adults && children) return adults + children;
  if (children && /夫婦/u.test(content)) return children + 2;
  if (/(?:一人暮らし|ひとり暮らし|単身)/u.test(content)) return 1;
  if (/(?:二人暮らし|夫婦|カップル)/u.test(content)) return 2;

  const general = content.match(/(10|[1-9一二三四五六七八九])\s*(?:人|名)(?:で|です|暮らし|住|入居|予定|[。！!？?]|$)/u)?.[1];
  return numericPeople(general);
}

function shortAreaCandidate(content: string) {
  const candidate = content
    .trim()
    .replace(/[。！!？?、,]/gu, '')
    .replace(/(?:がいい|を希望|希望|あたり|辺り|周辺|付近|近く)$/u, '')
    .trim();
  if (!/^[\p{Script=Han}々ヶケぁ-んァ-ヶー]{2,18}$/u.test(candidate)) return undefined;
  if (/^[ぁ-んー]+$/u.test(candidate) && !/^(?:なんば|なかもず|あびこ|うめだ|さかい|きしわだ|てんのうじ)$/u.test(candidate)) return undefined;
  if (/^[でにのがをとへ]/u.test(candidate)) return undefined;
  if (NON_AREA_ANSWER.test(candidate) || UNKNOWN_LOCATION.test(candidate)) return undefined;
  return candidate;
}

function areaFromMessage(content: string, answeredAreaPrompt: boolean) {
  const areaAfterPrefecture = content.match(/(?:都|道|府|県)(?:内)?(?:の|で)?\s*([\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,18}(?:市|区|町|村)|[\p{Script=Han}々ヶケァ-ヶー]{1,18}駅)/u)?.[1];
  if (areaAfterPrefecture) {
    const area = shortAreaCandidate(areaAfterPrefecture);
    if (area) return area;
  }

  const explicitAreas = Array.from(content.matchAll(AREA_WITH_SUFFIX));
  const explicitArea = explicitAreas
    .map((match) => shortAreaCandidate(match[1] || ''))
    .filter((area): area is string => Boolean(area) && !PREFECTURE.test(area || ''))
    .at(-1);
  if (explicitArea) return explicitArea;

  const phraseArea = content.match(/^([\p{Script=Han}々ヶケぁ-んァ-ヶー]{2,18}?)(?:周辺|付近|あたり)?(?:で|に)(?:一人暮らし|ひとり暮らし|二人暮らし|家族|賃貸|部屋|物件|住|暮ら|探)/u)?.[1];
  if (phraseArea) return shortAreaCandidate(phraseArea);
  if (answeredAreaPrompt) return shortAreaCandidate(content);
  return undefined;
}

function prefectureFromMessage(content: string) {
  return content.match(PREFECTURE)?.[1];
}

function wardFromMessage(content: string) {
  return content.match(/^[\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,10}区$/u)?.[0];
}

function budgetFromMessage(content: string, answeredBudgetPrompt: boolean) {
  if (/(?:^|[^\d])[-−]\s*\d/u.test(content)) return undefined;
  if (UNLIMITED_BUDGET.test(content)
    || (answeredBudgetPrompt && /^(?:未定|わからない|わかりません|決めていない|決まっていない|相談(?:したい|して決めたい)?)[。！!？?]*$/u.test(content.trim()))) {
    return Number.MAX_SAFE_INTEGER;
  }

  const tenThousandsAndThousands = content.match(/(\d+)\s*万\s*(\d+)\s*千(?:円)?/u);
  if (tenThousandsAndThousands) {
    return Number(tenThousandsAndThousands[1]) * 10_000 + Number(tenThousandsAndThousands[2]) * 1_000;
  }

  const mixedTenThousands = content.match(/(\d+)\s*万\s*(\d{1,4})(?!\s*千)\s*(?:円)?/u);
  if (mixedTenThousands) {
    return Number(mixedTenThousands[1]) * 10_000 + Number(mixedTenThousands[2]);
  }

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
  if (/(?:^|[^\d])[-−]\s*\d+\s*[SLDKR]/iu.test(content)) return undefined;
  const layout = content.match(/(?:ワンルーム|\d+[SLDKR]+)/iu)?.[0];
  const normalized = layout?.toUpperCase().replace('ワンルーム', '1R');
  return normalized && /(?:以上|より広|から)/u.test(content) ? `${normalized}+` : normalized;
}

function walkMinutesFromMessage(content: string) {
  if (/徒歩\s*[-−]\s*\d+/u.test(content)) return undefined;
  const walk = content.match(/徒歩\s*(\d+)分\s*(?:以内|まで)?/u)?.[1];
  return walk ? Number(walk) : undefined;
}

function commonFeePreferenceFromMessage(content: string) {
  if (/(?:共益費|管理費).*(?:別|除く|含めない)/u.test(content)) return false;
  if (/(?:共益費|管理費).*(?:込(?:み)?|含む|含めて)|(?:込(?:み)?|含めて).*(?:共益費|管理費)/u.test(content)) return true;
  return undefined;
}

function unsupportedConditionFromMessage(content: string) {
  if (CLEAR_UNSUPPORTED_CONDITION.test(content)) return undefined;
  return content.match(UNSUPPORTED_RENTAL_CONDITION)?.[0];
}

function isRentalCriterionReply(content: string, lastAssistant: string) {
  const normalized = content.normalize('NFKC');
  const answeredAreaPrompt = AREA_PROMPT.test(lastAssistant);
  const answeredBudgetPrompt = BUDGET_PROMPT.test(lastAssistant);
  return Boolean(
    householdSizeFromMessage(normalized)
    || prefectureFromMessage(normalized)
    || areaFromMessage(normalized, answeredAreaPrompt)
    || budgetFromMessage(normalized, answeredBudgetPrompt)
    || layoutFromMessage(normalized)
    || walkMinutesFromMessage(normalized) != null
    || commonFeePreferenceFromMessage(normalized) != null
    || unsupportedConditionFromMessage(normalized)
    || PREFERENCE.test(normalized)
    || NO_PREFERENCE.test(normalized)
  );
}

function isRentalFlowPrompt(content: string) {
  return PROPERTY_TYPE_QUESTION.test(content)
    || AREA_PROMPT.test(content)
    || BUDGET_PROMPT.test(content)
    || PREFERENCE_PROMPT.test(content)
    || COMPACT_LAYOUT_CONFIRMATION.test(content);
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
    const prefecture = prefectureFromMessage(normalizedContent);
    const cityWard = normalizedContent.match(CITY_WARD);
    const householdSize = householdSizeFromMessage(normalizedContent);
    const area = areaFromMessage(normalizedContent, AREA_PROMPT.test(previousAssistant));
    const maxRentYen = budgetFromMessage(normalizedContent, BUDGET_PROMPT.test(previousAssistant));
    const includeCommonFee = commonFeePreferenceFromMessage(normalizedContent);
    const layout = layoutFromMessage(normalizedContent);
    const maxWalkMinutes = walkMinutesFromMessage(normalizedContent);
    const answeredPreferencePrompt = PREFERENCE_PROMPT.test(previousAssistant)
      || COMPACT_LAYOUT_CONFIRMATION.test(previousAssistant);
    // A bare "未定" can answer the immediately preceding budget question.
    // Do not also consume the same turn as the later preference answer.
    const clearsAllPreferences = NO_PREFERENCE.test(normalizedContent)
      && (answeredPreferencePrompt
        || /(?:こだわり|指定|間取り|部屋数|徒歩|駅距離|条件|なんでも|問わない)/u.test(normalizedContent));
    const clearsLayout = clearsAllPreferences || CLEAR_LAYOUT_PREFERENCE.test(normalizedContent);
    const clearsWalk = clearsAllPreferences || CLEAR_WALK_PREFERENCE.test(normalizedContent);
    const clearsUnsupported = clearsAllPreferences || CLEAR_UNSUPPORTED_CONDITION.test(normalizedContent);
    const unsupportedCondition = unsupportedConditionFromMessage(normalizedContent);

    if (/新しい希望の都道府県/u.test(previousAssistant)) {
      state.prefecture = undefined;
      state.area = undefined;
      state.ward = undefined;
    }

    if (householdSize) state.householdSize = householdSize;
    if (prefecture) {
      if (!area) state.area = undefined;
      if (state.prefecture && state.prefecture !== prefecture) state.ward = undefined;
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
    if (maxRentYen) state.maxRentYen = maxRentYen;
    if (includeCommonFee != null) state.includeCommonFee = includeCommonFee;
    if (clearsLayout) state.layout = undefined;
    else if (layout) state.layout = layout;
    if (clearsWalk) state.maxWalkMinutes = undefined;
    else if (maxWalkMinutes != null) state.maxWalkMinutes = maxWalkMinutes;
    if (clearsUnsupported) state.unsupportedCondition = undefined;
    else if (unsupportedCondition) state.unsupportedCondition = unsupportedCondition;
    if (PREFERENCE.test(normalizedContent)
      || clearsLayout
      || clearsWalk
      || unsupportedCondition) state.hasPreference = true;
  });

  return state;
}

function rentalSubject(state: RentalConsultationState) {
  if (state.householdSize === 1) return '一人暮らし向けの賃貸';
  if (state.householdSize && state.householdSize >= 2) return `${state.householdSize}人で暮らす賃貸`;
  return '賃貸';
}

function displayLayout(layout: string) {
  if (layout === '1R') return 'ワンルーム';
  return layout.endsWith('+') ? `${layout.slice(0, -1)}以上` : layout;
}

export function evaluateRentalConsultation(
  history: ConversationContextMessage[],
  currentMessage: string,
): RentalConsultationDecision {
  if (PROPERTY_SEARCH_STARTER.test(currentMessage.trim())) {
    return {
      active: false,
      response: '住まい探しだね。賃貸・購入・注文住宅のどれを考えているか選んでにゃん。',
    };
  }

  if (isObviousConversationDetour(currentMessage)) return { active: false };
  if (RENTAL_EXPLANATION_REQUEST.test(currentMessage.normalize('NFKC'))
    && !/(?:探|候補|紹介|ありますか|ある？|見たい)/u.test(currentMessage)) return { active: false };

  const userMessages = [
    ...history.filter((message) => message.role === 'user').map((message) => message.content),
    currentMessage,
  ];
  const context = userMessages.join('\n');
  const lastAssistant = [...history].reverse().find((message) => message.role === 'assistant')?.content || '';
  const propertySearchMessages = messagesSinceLatestPropertySearch(history, currentMessage);

  if (hasPendingPropertyType(propertySearchMessages, lastAssistant)) {
    if (!isRentalCriterionReply(currentMessage, lastAssistant)
      && !RENTAL_INTENT.test(currentMessage)
      && !SALE_INTENT.test(currentMessage)) {
      return { active: false };
    }
    return {
      active: false,
      response: 'まず、賃貸・購入・注文住宅のどれを考えているか選んでにゃん。',
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
  const startsRentalSearch = RENTAL_INTENT.test(currentMessage) && !SALE_INTENT.test(currentMessage);
  const completedSearchFollowUp = !shouldContinueCompletedPropertySearch(currentSearchMessages, '__topic_change__')
    && shouldContinueCompletedPropertySearch(currentSearchMessages, currentMessage);
  const normalizedCurrent = currentMessage.normalize('NFKC').trim();
  if (UNKNOWN_LOCATION.test(normalizedCurrent) && WARD_PROMPT.test(lastAssistant)) {
    return { active: true, response: '次に、家賃の上限を教えてにゃん。共益費込みか別かも分かれば探しやすいにゃん。' };
  }
  if (UNKNOWN_LOCATION.test(normalizedCurrent) && AREA_PROMPT.test(lastAssistant)) {
    return {
      active: true,
      response: /都道府県/u.test(lastAssistant)
        ? '登録物件のある都道府県を選んでにゃん。'
        : '登録物件のある市区町村を選んでにゃん。',
    };
  }
  if (!startsRentalSearch
    && !completedSearchFollowUp
    && !isRentalFlowPrompt(lastAssistant)
    && !isRentalCriterionReply(currentMessage, lastAssistant)) {
    return { active: false };
  }
  if (!startsRentalSearch
    && isRentalFlowPrompt(lastAssistant)
    && !isRentalCriterionReply(currentMessage, lastAssistant)) {
    return { active: false };
  }
  if (!shouldContinueCompletedPropertySearch(currentSearchMessages, currentMessage)) {
    return { active: false };
  }

  const completedRentalSearch = currentSearchMessages.some((message) => (
    message.role === 'assistant' && COMPLETED_RENTAL_SEARCH.test(message.content)
  ));
  if (completedRentalSearch && /(?:(?:もっと|より).*(?:安|家賃を下げ)|(?:家賃|予算).*(?:変更|変え|見直|上げ|下げ|増や|減ら|広げ))/u.test(normalizedCurrent)) {
    return { active: true, response: '新しい家賃の上限を教えてにゃん。' };
  }
  if (completedRentalSearch && /(?:(?:もっと|より).*(?:広|部屋数を増)|(?:間取り|部屋数).*(?:変更|変え|選び直|見直))/u.test(normalizedCurrent)) {
    return { active: true, response: '希望の間取りや条件を教えてにゃん。2LDK・3LDKなどから選べるにゃん。' };
  }
  if (completedRentalSearch && /(?:エリア|地域|場所|市区町村|都道府県).*(?:変更|変え|選び直|見直)/u.test(normalizedCurrent)) {
    return { active: true, response: '新しい希望の都道府県を選んでにゃん。' };
  }
  if (completedRentalSearch && /(?:もっと|より).*(?:駅|徒歩).*(?:近|短)/u.test(normalizedCurrent)) {
    return { active: true, response: '希望する駅徒歩の上限を「徒歩10分以内」のように教えてにゃん。' };
  }

  const restartsCompletedRental = !shouldContinueCompletedPropertySearch(currentSearchMessages, '__topic_change__')
    && FRESH_RENTAL_RESTART.test(currentMessage.normalize('NFKC').trim());
  const state = extractRentalConsultationState(restartsCompletedRental ? [] : history, currentMessage);
  const subject = rentalSubject(state);
  if (!state.prefecture && !state.area) {
    return {
      active: true,
      response: `${subject}を一緒に探すにゃん。まず、住みたい都道府県を選んでにゃん。`,
    };
  }
  if (!state.area) {
    return {
      active: true,
      response: `${state.prefecture}で${subject}を探すにゃん。次に、市区町村を選んでにゃん。`,
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
      ? '2LDK・3LDK、駅からの徒歩分数'
      : 'ワンルーム・1K、駅からの徒歩分数';
    return {
      active: true,
      response: `希望の間取りや条件を教えてにゃん。${examples}などから選べるにゃん。`,
    };
  }

  if (state.unsupportedCondition) {
    return {
      active: true,
      response: `「${state.unsupportedCondition}」は登録物件情報だけでは全件を正確に絞り込めないにゃん。公式LINEで担当者に確認してにゃん。この条件を外して検索する場合は「${state.unsupportedCondition}を条件から外す」と送ってにゃん。`,
    };
  }

  const compactLayoutConflict = state.householdSize != null
    && state.householdSize >= 3
    && /^(?:1R|1K)\+?$/u.test(state.layout || '');
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
