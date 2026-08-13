import type { ConversationContextMessage } from './conversation-context';

const PROPERTY_SEARCH_STARTER = /^(?:物件を探す|物件探し)(?:[。！!？?])?$/u;
const EXPLICIT_RENTAL_MODE = /(?:^賃貸$|一人暮らし|ひとり暮らし|単身|二人暮らし|部屋を借り|借りたい|賃貸を探)/u;
const EXPLICIT_PURCHASE_MODE = /(?:^購入$|購入したい|買いたい|家を買|物件を買|戸建てを買|土地を買)/u;
const COMPLETED_PROPERTY_SEARCH = /条件に合う.*(?:賃貸|購入物件).*(?:見つかった|見つからなかった)/u;
const PROPERTY_FOLLOW_UP = /(?:物件|候補|部屋|住まい|賃貸|購入|買う|借りる|内見|詳細|リンク|URL|問い合わせ|ほか|他|別|もっと|おすすめ|どれ|どちら|この中|一番|家賃|予算|価格|万円?|円|安い|高い|広い|狭い|新築|中古|戸建|マンション|土地|間取り|ワンルーム|\d+[SLDKR]+|駅|徒歩|沿線|地域|エリア|都|道|府|県|市|区|町|村|ペット|駐車|築|家族|一人暮らし|二人暮らし|条件|こだわり)/iu;
const CONVERSATION_DETOUR = /(?:あなた.*(?:誰|だれ|何者)|^(?:誰|だれ)(?:なの|ですか)?|おなか|お腹|腹が?(?:すい|減)|ごはん|ご飯|食べたい|眠い|疲れた|元気(?:ですか|？|\?)?|おはよう|こんにちは|こんばんは|ありがとう|雑談|[？?]|(?:誰|何|なぜ|どうして|いつ|ですか|なの|だよ|だね|した|すいた|知りたい|教えて)[。！!]?\s*$)/u;

export function isObviousConversationDetour(input: string) {
  return CONVERSATION_DETOUR.test(input.normalize('NFKC').trim());
}

export function scopePropertySearchMessages(
  history: ConversationContextMessage[],
  currentMessage: string,
) {
  const allMessages: ConversationContextMessage[] = [
    ...history,
    { role: 'user', content: currentMessage },
  ];
  let scopeStart = 0;
  allMessages.forEach((message, index) => {
    if (message.role === 'user' && PROPERTY_SEARCH_STARTER.test(message.content.trim())) {
      scopeStart = index;
    }
  });

  const searchMessages = allMessages.slice(scopeStart);
  let latestMode: 'rental' | 'purchase' | undefined;
  let latestModeStart = 0;
  searchMessages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const content = message.content.normalize('NFKC').trim();
    const rental = EXPLICIT_RENTAL_MODE.test(content);
    const purchase = EXPLICIT_PURCHASE_MODE.test(content);
    if (rental === purchase) return;
    const mode = rental ? 'rental' : 'purchase';
    if (latestMode && latestMode !== mode) latestModeStart = index;
    latestMode = mode;
  });

  return searchMessages.slice(latestModeStart);
}

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
