import type { ConversationContextMessage } from './conversation-context';

export type RentalConsultationDecision = {
  active: boolean;
  response?: string;
};

const RENTAL_INTENT = /(?:一人暮らし|ひとり暮らし|賃貸|部屋探し|部屋を探|借りたい|引っ越し|住みたい)/u;
const SALE_INTENT = /(?:購入|買いたい|新築|中古|戸建てを買|土地を買)/u;
const PROPERTY_SEARCH_STARTER = /^(?:物件を探す|物件探し)(?:[。！!？?])?$/u;
const AREA = /(?:[\p{Script=Han}々ヶケ]{1,14}(?:都|道|府|県|市|区|町|村|駅))(?:内|周辺|近く)?/u;
const BUDGET = /(?:家賃|予算|月額)[^\n]{0,16}\d|\d+(?:\.\d+)?\s*万(?:円)?\s*(?:以下|以内|まで|前後)?/u;
const PREFERENCE = /(?:ワンルーム|\d+[SLDKR]+|駅近|徒歩\s*\d+分|ペット|築浅|駐車|オートロック|バス・トイレ|こだわり.*(?:なし|ない))/iu;

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
  const active = RENTAL_INTENT.test(context) && !SALE_INTENT.test(context);
  if (!active) return { active: false };

  const answeredAreaPrompt = /(?:住みたい地域|最寄り駅)/u.test(lastAssistant) && currentMessage.length <= 40;
  if (!AREA.test(context) && !answeredAreaPrompt) {
    return {
      active: true,
      response: '一人暮らし向けの賃貸を一緒に探すにゃん。まず、住みたい地域や最寄り駅を教えてにゃん。',
    };
  }
  if (!BUDGET.test(context)) {
    return {
      active: true,
      response: '次に、家賃の上限を教えてにゃん。共益費込みか別かも分かれば探しやすいにゃん。',
    };
  }
  if (!PREFERENCE.test(context)) {
    return {
      active: true,
      response: '希望の間取りや条件を教えてにゃん。ワンルーム・1K、駅からの徒歩分数、ペット可などから選べるにゃん。',
    };
  }
  return { active: true };
}
