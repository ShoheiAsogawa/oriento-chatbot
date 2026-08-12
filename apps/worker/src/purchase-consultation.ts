import type { ConversationContextMessage } from './conversation-context';
import { shouldContinueCompletedPropertySearch } from './property-search-continuation';

export type PurchaseConsultationDecision = {
  active: boolean;
  response?: string;
};

export type PurchaseConsultationState = {
  area?: string;
  maxPriceYen?: number;
  propertyType?: string;
  layout?: string;
  propertyTypeSet: boolean;
  layoutSet: boolean;
};

const PURCHASE_INTENT = /(?:購入|買いたい|買う|新築|中古|戸建て|マンション|土地)/u;
const RENTAL_INTENT = /(?:賃貸|借りたい|部屋を借り)/u;
const PROPERTY_SEARCH_STARTER = /^(?:物件を探す|物件探し)(?:[。！!？?])?$/u;
const AREA_PROMPT = /(?:希望エリア|購入したい地域)/u;
const BUDGET_PROMPT = /購入予算の上限/u;
const TYPE_PROMPT = /購入する物件の種類/u;
const LAYOUT_PROMPT = /購入物件の希望間取り/u;
const AREA_WITH_SUFFIX = /([\p{Script=Han}々ヶケぁ-んァ-ヶー]{1,18}(?:都|道|府|県|市|区|町|村)|[\p{Script=Han}々ヶケァ-ヶー]{1,18}駅)/gu;

function messagesSinceLatestSearch(history: ConversationContextMessage[], currentMessage: string) {
  const messages = [...history, { role: 'user' as const, content: currentMessage }];
  let startIndex = -1;
  messages.forEach((message, index) => {
    if (message.role === 'user' && PROPERTY_SEARCH_STARTER.test(message.content.trim())) startIndex = index;
  });
  return startIndex >= 0 ? messages.slice(startIndex) : messages;
}

function shortArea(content: string) {
  const candidate = content.trim().replace(/[。！!？?、,]/gu, '');
  if (!/^[\p{Script=Han}々ヶケぁ-んァ-ヶー]{2,18}$/u.test(candidate)) return undefined;
  if (/(?:購入|予算|万円?|物件|戸建|マンション|土地|間取り|LDK|こだわり|なし)/iu.test(candidate)) return undefined;
  return candidate;
}

function areaFromMessage(content: string, answeredPrompt: boolean) {
  const matches = Array.from(content.matchAll(AREA_WITH_SUFFIX));
  const explicit = matches.at(-1)?.[1];
  if (explicit) return explicit;
  return answeredPrompt ? shortArea(content) : undefined;
}

function budgetFromMessage(content: string, answeredPrompt: boolean) {
  const tenThousands = content.match(/(\d+(?:\.\d+)?)\s*万(?:円)?/u)?.[1];
  if (tenThousands) return Math.round(Number(tenThousands) * 10_000);
  const yen = content.match(/(\d[\d,]{5,})\s*円/u)?.[1];
  if (yen) return Number(yen.replace(/,/gu, ''));
  if (answeredPrompt) {
    const plain = content.match(/^\s*(\d+(?:\.\d+)?)\s*$/u)?.[1];
    if (plain) return Math.round(Number(plain) * 10_000);
  }
  return undefined;
}

function propertyTypeFromMessage(content: string) {
  if (/新築(?:一戸建て|戸建て?)/u.test(content)) return '新築戸建て';
  if (/中古(?:一戸建て|戸建て?)/u.test(content)) return '中古戸建て';
  if (/中古マンション/u.test(content)) return '中古マンション';
  if (/土地/u.test(content)) return '土地';
  return undefined;
}

function layoutFromMessage(content: string) {
  return content.match(/\d+[SLDKR]+/iu)?.[0]?.toUpperCase();
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
    const area = areaFromMessage(content, AREA_PROMPT.test(previousAssistant));
    const maxPriceYen = budgetFromMessage(content, BUDGET_PROMPT.test(previousAssistant));
    const propertyType = propertyTypeFromMessage(content);
    const layout = layoutFromMessage(content);

    if (area) state.area = area;
    if (maxPriceYen) state.maxPriceYen = maxPriceYen;
    if (propertyType) {
      state.propertyType = propertyType;
      state.propertyTypeSet = true;
    } else if (TYPE_PROMPT.test(previousAssistant) && /(?:こだわりなし|なし|指定なし)/u.test(content)) {
      state.propertyType = undefined;
      state.propertyTypeSet = true;
    }
    if (layout) {
      state.layout = layout;
      state.layoutSet = true;
    } else if (LAYOUT_PROMPT.test(previousAssistant) && /(?:こだわりなし|なし|指定なし)/u.test(content)) {
      state.layout = undefined;
      state.layoutSet = true;
    }
  });
  return state;
}

export function evaluatePurchaseConsultation(
  history: ConversationContextMessage[],
  currentMessage: string,
): PurchaseConsultationDecision {
  const messages = messagesSinceLatestSearch(history, currentMessage);
  const userContext = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');
  const active = PURCHASE_INTENT.test(userContext) && !RENTAL_INTENT.test(userContext);
  if (!active) return { active: false };
  if (!shouldContinueCompletedPropertySearch(messages, currentMessage)) {
    return { active: false };
  }

  const state = extractPurchaseConsultationState(history, currentMessage);
  if (!state.area) {
    return { active: true, response: '購入物件を一緒に探すにゃん。まず、希望エリアを選んでにゃん。' };
  }
  if (!state.maxPriceYen) {
    return { active: true, response: '購入予算の上限を選んでにゃん。諸費用を除いた物件価格の目安で大丈夫にゃん。' };
  }
  if (!state.propertyTypeSet) {
    return { active: true, response: '購入する物件の種類を選んでにゃん。まだ決まっていなければ、こだわりなしでも探せるにゃん。' };
  }
  if (!state.layoutSet && state.propertyType !== '土地') {
    return { active: true, response: '購入物件の希望間取りを選んでにゃん。決まっていなければ、こだわりなしで大丈夫にゃん。' };
  }
  return { active: true };
}
