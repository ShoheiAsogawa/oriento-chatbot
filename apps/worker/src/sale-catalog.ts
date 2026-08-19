import type { ConversationContextMessage } from './conversation-context';
import { extractPurchaseConsultationState } from './purchase-consultation';
import type { SearchChunk } from './types';
import { loadManagedProperties, transportFromText, walkMinutesFromText, yenFromText } from './property-inventory';
import { prefectureFromText } from './property-areas';

export type SaleProperty = {
  id: string;
  title: string;
  url: string;
  property_type: string;
  price_yen: number;
  address: string;
  transport: string[];
  layout: string;
  walk_minutes: number | null;
  status: string;
};

export type SaleCriteria = {
  prefecture?: string;
  area?: string;
  ward?: string;
  maxPriceYen?: number;
  propertyType?: string;
  layout?: string;
  maxWalkMinutes?: number;
};

export type SaleRecommendationExclusions = {
  ids?: Iterable<string>;
  urls?: Iterable<string>;
};

/**
 * Some imported listing pages repeat the Osaka/Sakai ward prefix, e.g.
 * `大阪市天王寺区大阪市天王寺区小橋町`. Keep the catalog source untouched,
 * but present and filter on a clean address at the application boundary.
 */
export function normalizeSaleAddress(value: string) {
  let normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const match = normalized.match(/((?:大阪市|堺市)[^区]{1,10}区)/u);
  if (!match || match.index == null) return normalized;
  const prefix = match[1]!;
  const before = normalized.slice(0, match.index);
  let after = normalized.slice(match.index + prefix.length);
  while (after.startsWith(prefix)) after = after.slice(prefix.length);
  return `${before}${prefix}${after}`;
}

export function extractSaleCriteria(
  history: ConversationContextMessage[],
  currentMessage: string,
): SaleCriteria {
  const state = extractPurchaseConsultationState(history, currentMessage);
  return {
    prefecture: state.prefecture,
    area: state.area,
    ...(state.ward ? { ward: state.ward } : {}),
    maxPriceYen: state.maxPriceYen,
    propertyType: state.propertyType,
    layout: state.layout,
    maxWalkMinutes: state.maxWalkMinutes,
  };
}

export async function loadSaleCatalog(env: Env): Promise<SaleProperty[]> {
  const [response, inventory] = await Promise.all([
    env.STATIC_ASSETS.fetch(new Request('https://assets.internal/knowledge/sale_catalog.json')),
    loadManagedProperties(env.DB, 'properties_for_sale'),
  ]);
  if (!response.ok) throw new Error('購入物件カタログを読み込めません');
  const catalog = await response.json<{ properties?: SaleProperty[] }>();
  const managed = inventory.managed.flatMap<SaleProperty>((row) => {
    const price = yenFromText(row.price_or_rent);
    if (price == null) return [];
    return [{
      id: `managed-${row.source_url}`,
      title: row.title,
      url: row.source_url,
      property_type: row.building_type || '売買物件',
      price_yen: price,
      address: normalizeSaleAddress(row.address),
      transport: transportFromText(row.line_station),
      layout: row.layout,
      walk_minutes: walkMinutesFromText(row.line_station),
      status: row.availability,
    }];
  });
  const managedUrls = new Set(managed.map((property) => property.url));
  return [
    ...(catalog.properties || []).map((property) => ({
      ...property,
      address: normalizeSaleAddress(property.address),
    })).filter((property) => (
      !inventory.excludedUrls.has(property.url) && !managedUrls.has(property.url)
    )),
    ...managed,
  ];
}

function matchesPropertyType(actual: string, requested: string) {
  actual = normalizePropertyType(actual);
  if (requested === '新築戸建て') return /新築.*(?:一戸建て|戸建)/u.test(actual);
  if (requested === '中古戸建て') return /中古.*(?:一戸建て|戸建)/u.test(actual);
  if (requested === '中古マンション') return /マンション/u.test(actual) && !/新築/u.test(actual);
  if (requested === '土地') return /土地/u.test(actual);
  if (requested === '戸建て') return /(?:一戸建て|戸建)/u.test(actual);
  if (requested === 'マンション') return /マンション/u.test(actual);
  if (requested === 'その他・事業用') {
    return /(?:その他|店舗|事務所|収益|アパート|ビル|テラスハウス)/u.test(actual);
  }
  return actual.includes(requested);
}

function normalizePropertyType(value: string) {
  return [...new Set(value.split(/[,、]/u).map((item) => item.trim()).filter(Boolean))].join('、');
}

function normalizeLayout(value: string) {
  return value.normalize('NFKC').toUpperCase().replace(/([SLDKR])\1+/gu, '$1');
}

function isUnavailableStatus(value: string) {
  return /(?:成約済|契約済|販売終了|掲載終了|非公開|取(?:り)?下げ|売(?:り)?止)/u.test(value);
}

export function recommendSaleProperties(
  properties: SaleProperty[],
  criteria: SaleCriteria,
  exclusions: SaleRecommendationExclusions = {},
) {
  const excludedIds = new Set(exclusions.ids || []);
  const excludedUrls = new Set(exclusions.urls || []);
  return properties.filter((property) => {
    if (excludedIds.has(property.id) || excludedUrls.has(property.url)) return false;
    if (!property.url.startsWith('https://orijyu.com/buy/')) return false;
    if (isUnavailableStatus(property.status)) return false;
    const location = `${property.title}\n${property.address}\n${property.transport.join('\n')}`;
    const listedPrefecture = prefectureFromText(property.address) || prefectureFromText(property.title);
    if (criteria.prefecture && listedPrefecture && listedPrefecture !== criteria.prefecture) return false;
    if (criteria.area) {
      if (!location.includes(criteria.area)) return false;
      if (criteria.ward && !location.includes(criteria.ward)) return false;
    }
    if (criteria.maxPriceYen != null && property.price_yen > criteria.maxPriceYen) return false;
    if (criteria.propertyType && !matchesPropertyType(property.property_type, criteria.propertyType)) return false;
    if (criteria.layout && !normalizeLayout(property.layout).includes(normalizeLayout(criteria.layout))) return false;
    if (criteria.maxWalkMinutes != null
      && (property.walk_minutes == null || property.walk_minutes > criteria.maxWalkMinutes)) return false;
    return true;
  }).sort((left, right) => left.price_yen - right.price_yen || (left.walk_minutes ?? 999) - (right.walk_minutes ?? 999)).slice(0, 3);
}

export function salePropertyChunk(property: SaleProperty, index: number): SearchChunk {
  const propertyType = normalizePropertyType(property.property_type);
  const layout = normalizeLayout(property.layout);
  return {
    id: `sale-${property.id}`,
    type: 'text',
    score: 1 - index * 0.01,
    text: `## ${property.title}\n公式ページ: ${property.url}\n\n販売価格 ${property.price_yen}円\n所在地 ${property.address}\n物件種別 ${propertyType}\n間取り ${layout}\n交通 ${property.transport.join('、')}`,
    item: {
      key: `sale_catalog/${property.id}.json`,
      metadata: { title: property.title, source_url: property.url, category: 'properties_for_sale', language: 'ja' },
    },
  } as SearchChunk;
}

export function formatSaleAnswer(properties: SaleProperty[], criteria: SaleCriteria) {
  if (properties.length === 0) {
    return '条件に合う購入物件は見つからなかったにゃん。予算、物件種別、間取りのどれかを広げて探してみてにゃん。';
  }
  const lines = properties.map((property, index) => {
    const price = `${Math.round(property.price_yen / 1_000) / 10}万円`;
    const propertyType = normalizePropertyType(property.property_type);
    const layout = property.layout ? `、${normalizeLayout(property.layout)}` : '';
    const walk = property.walk_minutes != null ? `、駅徒歩${property.walk_minutes}分` : '';
    return `- ${property.title}：${propertyType}、販売価格${price}${layout}、${property.address}${walk}にゃん。[${index + 1}]`;
  });
  return `${criteria.area || criteria.prefecture || '指定エリア'}で条件に合う購入物件が見つかったにゃん。\n${lines.join('\n')}`;
}
