import type { ConversationContextMessage } from './conversation-context';
import type { SearchChunk } from './types';
import { extractRentalConsultationState } from './rental-consultation';
import { loadManagedProperties, transportFromText, walkMinutesFromText, yenFromText } from './property-inventory';
import { prefectureFromText, propertyArea } from './property-areas';

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
  prefecture?: string;
  area?: string;
  ward?: string;
  maxRentYen?: number;
  includeCommonFee?: boolean;
  layout?: string;
  maxWalkMinutes?: number;
};

const RESIDENTIAL_TYPES = /(?:賃貸住宅|マンション|アパート|貸家|一戸建|戸建|テラスハウス|メゾネット|長屋|ハイツ)/u;
const UNAVAILABLE_STATUS = /(?:成約|契約済|申込済|募集終了|非公開|掲載終了|取扱終了|空室なし)/u;

export function extractRentalCriteria(
  history: ConversationContextMessage[],
  currentMessage: string,
): RentalCriteria {
  const state = extractRentalConsultationState(history, currentMessage);
  return {
    prefecture: state.prefecture,
    area: state.area,
    ...(state.ward ? { ward: state.ward } : {}),
    maxRentYen: state.maxRentYen,
    ...(state.includeCommonFee == null ? {} : { includeCommonFee: state.includeCommonFee }),
    layout: state.layout,
    maxWalkMinutes: state.maxWalkMinutes,
  };
}

function layoutMatches(actual: string, requested: string) {
  const normalizedActual = actual.normalize('NFKC').toUpperCase().replace('ワンルーム', '1R');
  const normalizedRequested = requested.normalize('NFKC').toUpperCase().replace('ワンルーム', '1R');
  const parse = (value: string) => Array.from(value.matchAll(/(\d+)\s*S*(LDK|DK|K|R)/gu))
    .map((match) => ({ rooms: Number(match[1]), kind: match[2]! }));
  const actualLayouts = parse(normalizedActual);
  const requestedLayouts = parse(normalizedRequested);
  if (actualLayouts.length === 0 || requestedLayouts.length === 0) return false;
  const minimum = /(?:\+|以上|より広|から)/u.test(normalizedRequested);
  return requestedLayouts.some((requestedLayout) => actualLayouts.some((actualLayout) => (
    actualLayout.kind === requestedLayout.kind
      && (minimum ? actualLayout.rooms >= requestedLayout.rooms : actualLayout.rooms === requestedLayout.rooms)
  )));
}

function normalizeResultLimit(limit: number) {
  if (!Number.isFinite(limit)) return 3;
  const integer = Math.floor(limit);
  return integer > 0 && integer <= 100 ? integer : 3;
}

export async function loadRentalCatalog(env: Env): Promise<RentalProperty[]> {
  const [response, inventory] = await Promise.all([
    env.STATIC_ASSETS.fetch(new Request('https://assets.internal/knowledge/rental_catalog.json')),
    loadManagedProperties(env.DB, 'properties_for_rent'),
  ]);
  if (!response.ok) throw new Error('賃貸物件カタログを読み込めません');
  const catalog = await response.json<{ properties?: RentalProperty[] }>();
  const managed = inventory.managed.flatMap<RentalProperty>((row) => {
    const rent = yenFromText(row.price_or_rent);
    if (rent == null) return [];
    return [{
      id: `managed-${row.source_url}`,
      title: row.title,
      url: row.source_url,
      property_type: row.building_type || '賃貸住宅',
      rent_yen: rent,
      common_fee: row.management_fee,
      address: row.address,
      transport: transportFromText(row.line_station),
      layout: row.layout,
      walk_minutes: walkMinutesFromText(row.line_station),
      status: row.availability,
    }];
  });
  const managedUrls = new Set(managed.map((property) => property.url));
  return [
    ...(catalog.properties || []).filter((property) => (
      !inventory.excludedUrls.has(property.url) && !managedUrls.has(property.url)
    )),
    ...managed,
  ];
}

export function recommendRentalProperties(
  properties: RentalProperty[],
  criteria: RentalCriteria,
  excludedPropertyIdsOrUrls: ReadonlySet<string> = new Set(),
  limit = 3,
) {
  return properties.filter((property) => {
    if (excludedPropertyIdsOrUrls.has(property.id) || excludedPropertyIdsOrUrls.has(property.url)) return false;
    if (!RESIDENTIAL_TYPES.test(property.property_type)) return false;
    if (!property.url.startsWith('https://orijyu.com/rent/')) return false;
    if (UNAVAILABLE_STATUS.test(property.status)) return false;
    if (!Number.isFinite(property.rent_yen) || property.rent_yen <= 0) return false;
    if (criteria.prefecture) {
      const listedPrefecture = prefectureFromText(property.address)
        || prefectureFromText(property.title)
        || propertyArea(property.address)?.prefecture;
      if (listedPrefecture !== criteria.prefecture) return false;
    }
    if (criteria.area) {
      const location = `${property.title}\n${property.address}\n${property.transport.join('\n')}`;
      if (!location.includes(criteria.area)) return false;
      if (criteria.ward && !location.includes(criteria.ward)) return false;
    }
    const commonFeeYen = criteria.includeCommonFee ? (yenFromText(property.common_fee) || 0) : 0;
    if (criteria.maxRentYen != null && property.rent_yen + commonFeeYen > criteria.maxRentYen) return false;
    if (criteria.layout && !layoutMatches(property.layout, criteria.layout)) return false;
    if (criteria.maxWalkMinutes != null && (property.walk_minutes == null || property.walk_minutes > criteria.maxWalkMinutes)) return false;
    return true;
  }).sort((left, right) => left.rent_yen - right.rent_yen || (left.walk_minutes ?? 999) - (right.walk_minutes ?? 999)).slice(0, normalizeResultLimit(limit));
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
