import type { ConversationContextMessage } from './conversation-context';
import type { SearchChunk } from './types';

export type RentalProperty = {
  id: string;
  title: string;
  url: string;
  property_type: string;
  rent_yen: number;
  common_fee: string;
  address: string;
  transport: string[];
  layout: string;
  walk_minutes: number | null;
  status: string;
};

export type RentalCriteria = {
  area?: string;
  maxRentYen?: number;
  layout?: string;
  maxWalkMinutes?: number;
};

const RESIDENTIAL_TYPES = /(?:マンション|アパート|貸家|一戸建|テラスハウス)/u;

function userContext(history: ConversationContextMessage[], currentMessage: string) {
  return [
    ...history.filter((message) => message.role === 'user').map((message) => message.content),
    currentMessage,
  ].join('\n');
}

export function extractRentalCriteria(
  history: ConversationContextMessage[],
  currentMessage: string,
): RentalCriteria {
  const context = userContext(history, currentMessage);
  const areas = Array.from(context.matchAll(/([\p{Script=Han}々ヶケ]{1,14}(?:都|道|府|県|市|区|町|村|駅))/gu));
  const budget = context.match(/(\d+(?:\.\d+)?)\s*万(?:円)?\s*(?:以下|以内|まで|前後)?/u);
  const layout = context.match(/(?:ワンルーム|\d+[SLDKR]+)/iu)?.[0];
  const walk = context.match(/徒歩\s*(\d+)分\s*(?:以内|まで)?/u);
  return {
    area: areas.at(-1)?.[1],
    maxRentYen: budget ? Math.round(Number(budget[1]) * 10_000) : undefined,
    layout: layout?.toUpperCase().replace('ワンルーム', '1R'),
    maxWalkMinutes: walk ? Number(walk[1]) : undefined,
  };
}

export async function loadRentalCatalog(env: Env): Promise<RentalProperty[]> {
  const response = await env.STATIC_ASSETS.fetch(new Request('https://assets.internal/knowledge/rental_catalog.json'));
  if (!response.ok) throw new Error('賃貸物件カタログを読み込めません');
  const catalog = await response.json<{ properties?: RentalProperty[] }>();
  return catalog.properties || [];
}

export function recommendRentalProperties(properties: RentalProperty[], criteria: RentalCriteria) {
  return properties.filter((property) => {
    if (!RESIDENTIAL_TYPES.test(property.property_type)) return false;
    if (!property.url.startsWith('https://orijyu.com/rent/')) return false;
    if (criteria.area) {
      const location = `${property.title}\n${property.address}\n${property.transport.join('\n')}`;
      if (!location.includes(criteria.area)) return false;
    }
    if (criteria.maxRentYen != null && property.rent_yen > criteria.maxRentYen) return false;
    if (criteria.layout && property.layout.toUpperCase() !== criteria.layout) return false;
    if (criteria.maxWalkMinutes != null && (property.walk_minutes == null || property.walk_minutes > criteria.maxWalkMinutes)) return false;
    return true;
  }).sort((left, right) => left.rent_yen - right.rent_yen || (left.walk_minutes ?? 999) - (right.walk_minutes ?? 999)).slice(0, 3);
}

export function rentalPropertyChunk(property: RentalProperty, index: number): SearchChunk {
  return {
    id: `rental-${property.id}`,
    type: 'text',
    score: 1 - index * 0.01,
    text: `## ${property.title}\n公式ページ: ${property.url}\n\n賃料 ${property.rent_yen}円\n所在地 ${property.address}\n間取り ${property.layout}\n交通 ${property.transport.join('、')}`,
    item: {
      key: `rental_catalog/${property.id}.json`,
      metadata: { title: property.title, source_url: property.url, category: 'properties_for_rent', language: 'ja' },
    },
  } as unknown as SearchChunk;
}

export function formatRentalAnswer(properties: RentalProperty[], criteria: RentalCriteria) {
  if (properties.length === 0) {
    return '条件に合う居住用の賃貸物件は見つからなかったにゃん。家賃上限、間取り、駅からの徒歩分数のどれを広げられるか教えてにゃん。';
  }
  const lines = properties.map((property, index) => {
    const rent = `${Math.round(property.rent_yen / 1_000) / 10}万円`;
    const fee = property.common_fee ? `、共益費 ${property.common_fee}` : '';
    const walk = property.walk_minutes != null ? `、駅徒歩${property.walk_minutes}分` : '';
    return `- ${property.title}：家賃${rent}${fee}、${property.layout}、${property.address}${walk}にゃん。[${index + 1}]`;
  });
  const area = criteria.area ? `${criteria.area}で` : '';
  return `${area}条件に合う居住用賃貸が見つかったにゃん。\n${lines.join('\n')}`;
}
