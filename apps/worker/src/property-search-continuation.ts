import type { ConversationContextMessage } from './conversation-context';

const COMPLETED_PROPERTY_SEARCH = /条件に合う.*(?:賃貸|購入物件).*(?:見つかった|見つからなかった)/u;
const PROPERTY_FOLLOW_UP = /(?:物件|候補|部屋|住まい|賃貸|購入|買う|借りる|内見|詳細|リンク|URL|問い合わせ|ほか|他|別|もっと|おすすめ|どれ|どちら|この中|一番|家賃|予算|価格|万円?|円|安い|高い|広い|狭い|新築|中古|戸建|マンション|土地|間取り|ワンルーム|\d+[SLDKR]+|駅|徒歩|沿線|地域|エリア|市|区|町|村|ペット|駐車|築|家族|一人暮らし|二人暮らし|条件|こだわり)/iu;

export function shouldContinueCompletedPropertySearch(
  messages: ConversationContextMessage[],
  currentMessage: string,
) {
  const hasCompletedSearch = messages.some((message) => (
    message.role === 'assistant' && COMPLETED_PROPERTY_SEARCH.test(message.content)
  ));
  if (!hasCompletedSearch) return true;

  return PROPERTY_FOLLOW_UP.test(currentMessage.normalize('NFKC'));
}
