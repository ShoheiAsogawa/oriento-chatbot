import type { ConversationContextMessage } from './conversation-context';

const PROPERTY_SEARCH_STARTER = /^(?:物件を探す|物件を探したい|物件探し(?:をしたい|したい)?)(?:[。！!？?])?$/u;
const CONVERSATION_RESET = /^(?:やり直し|リセット|最初から|キャンセル|やめる)[。！!？?]*$/u;
const EXPLICIT_RENTAL_MODE = /(?:一人暮らし|ひとり暮らし|単身|二人暮らし|部屋を借り|借りたい|部屋探し(?:を)?したい|引っ越(?:したい|しをしたい)|賃貸(?:物件)?(?:$|を?(?:探(?:す|したい)|検索)|で(?:探|検索|探し直す)|に(?:変更|切り替え)|がいい|を希望|にしたい))/u;
const EXPLICIT_PURCHASE_MODE = /(?:購入(?:物件)?(?:$|を?(?:探(?:す|したい)|検索)|したい|で(?:探|検索|探し直す)|に(?:変更|切り替え)|がいい|を希望|にしたい)|買いたい|家を買|物件を買|戸建てを買|土地を買)/u;
const EXPLICIT_CUSTOM_HOME_MODE = /(?:注文住宅|注文建築|自由設計|マイホームを建て|家を建て(?:たい|る|よう))/u;
const COMPLETED_PROPERTY_SEARCH = /条件に合う.*(?:賃貸|購入物件).*(?:見つかった|見つからなかった)/u;
// A completed search must not hijack a new, unrelated question just because it
// contains a generic word such as "おすすめ" or a place-name suffix.  Keep
// continuation signals tied to a property, a search action, or a concrete
// property condition.  Exact area-only replies are handled separately below.
const PROPERTY_FOLLOW_UP = /(?:物件|候補|部屋|住まい|賃貸|購入|買う|借りる|内見|詳細|リンク|URL|問い合わせ|ほか|他|別|もっと|どれ|どちら|この中|一番|家賃|予算|価格|万円?|円|安い|高い|広い|狭い|新築|中古|戸建|マンション|土地|間取り|ワンルーム|\d+[SLDKR]+|駅|徒歩|沿線|地域|エリア|ペット|駐車|築|家族|一人暮らし|二人暮らし|条件|こだわり)/iu;
const AREA_ONLY_PROPERTY_FOLLOW_UP = /^[\p{Script=Han}々ヶケぁ-んァ-ヶー]{2,18}(?:都|道|府|県|市|区|町|村)$/u;
const CONVERSATION_DETOUR = /(?:(?:あなた|君|きみ|オリにゃん).*(?:誰|だれ|何者|なに|何ですか)|^(?:誰|だれ)(?:なの|ですか)?|おなか|お腹|腹が?(?:すい|減)|ごはん|ご飯|食べたい|眠い|疲れた|元気(?:ですか|？|\?)?|おはよう|こんにちは|こんばんは|ありがとう|雑談|^(?:やり直し|リセット|最初から|キャンセル|やめる)[。！!？?]*$)/u;
const SEARCH_CONTINUATION_SIGNAL = /(?:物件|候補|部屋探し|引っ越し|賃貸|購入|買いたい|借りたい|一人暮らし|二人暮らし|家族で住|ほか|他|別|もっと)/u;
const COMPLETED_SEARCH_HANDOFF = /(?:(?:どれ|どちら|どの).*(?:おすすめ|良い|いい|向いて)|(?:内見|見学|問い合わせ|申込).*(?:したい|希望|お願い|進めたい))/u;
const OTHER_PROPERTY_REQUEST = /(?:(?:ほか|他|別|追加|もっと).*(?:物件|候補|部屋|住まい)|^(?:ほか|他|別|もっと)(?:に|は|も|を)?(?:ありますか|ある|見たい|ください)?[。！!？?]?$)/u;
const GUIDED_SELECTION = /^(?:(?:物件種別|間取り)は)?(?:特に)?(?:こだわり|指定)?(?:なし|ない)|^(?:家賃|購入予算).{0,12}\d|^(?:新築戸建て|中古戸建て|中古マンション|土地|その他・事業用|戸建て|マンション)|^(?:ワンルーム|\d+[SLDKR]+(?:以上)?)[。！!？?]*$|[\p{Script=Han}々ヶケぁ-んァ-ヶー]{2,18}(?:都|道|府|県|市|区|町|村)$/u;

export function isObviousConversationDetour(input: string) {
  const normalized = input.normalize('NFKC').trim();
  if (SEARCH_CONTINUATION_SIGNAL.test(normalized)) return false;
  return CONVERSATION_DETOUR.test(normalized);
}

export function wantsOtherPropertyCandidates(input: string) {
  return OTHER_PROPERTY_REQUEST.test(input.normalize('NFKC').trim());
}

export function looksLikeGuidedSearchSelection(input: string) {
  return GUIDED_SELECTION.test(input.normalize('NFKC').trim());
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
    if (message.role !== 'user') return;
    const content = message.content.normalize('NFKC').trim();
    if (PROPERTY_SEARCH_STARTER.test(content)) scopeStart = index;
    // A reset is a real state boundary, not only a canned reply. Excluding the
    // reset turn itself ensures an area-like next message cannot revive an old
    // completed search from earlier in the same conversation.
    if (CONVERSATION_RESET.test(content)) scopeStart = index + 1;
  });

  const searchMessages = allMessages.slice(scopeStart);
  let latestMode: 'rental' | 'purchase' | 'custom_home' | undefined;
  let latestModeStart = 0;
  searchMessages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const content = message.content.normalize('NFKC').trim();
    const rental = EXPLICIT_RENTAL_MODE.test(content);
    const purchase = EXPLICIT_PURCHASE_MODE.test(content);
    const customHome = EXPLICIT_CUSTOM_HOME_MODE.test(content);
    const activeModes = [rental, purchase, customHome].filter(Boolean);
    if (activeModes.length !== 1) return;
    const mode = rental ? 'rental' : purchase ? 'purchase' : 'custom_home';
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

  if (COMPLETED_SEARCH_HANDOFF.test(currentMessage.normalize('NFKC'))) return false;

  const normalized = currentMessage.normalize('NFKC').trim();
  return PROPERTY_FOLLOW_UP.test(normalized) || AREA_ONLY_PROPERTY_FOLLOW_UP.test(normalized);
}
