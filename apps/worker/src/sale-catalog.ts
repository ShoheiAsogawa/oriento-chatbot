import type { ConversationContextMessage } from './conversation-context';
import { extractPurchaseConsultationState } from './purchase-consultation';
import type { SearchChunk } from './types';
import { loadManagedProperties, transportFromText, walkMinutesFromText, yenFromText } from './property-inventory';

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
  maxPriceYen?: number;
  propertyType?: string;
  layout?: string;
};

export function extractSaleCriteria(
  history: ConversationContextMessage[],
  currentMessage: string,
): SaleCriteria {
  const state = extractPurchaseConsultationState(history, currentMessage);
  return {
    prefecture: state.prefecture,
    area: state.area,
    maxPriceYen: state.maxPriceYen,
    propertyType: state.propertyType,
    layout: state.layout,
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

function matchesPropertyType(actual: string, requested: string) {
  if (requested === '新築戸建て') return /新築.*(?:一戸建て|戸建)/u.test(actual);
  if (requested === '中古戸建て') return /中古.*(?:一戸建て|戸建)/u.test(actual);
  if (requested === '中古マンション') return /マンション/u.test(actual) && !/新築/u.test(actual);
  if (requested === '土地') return /土地/u.test(actual);
  return actual.includes(requested);
}

export function recommendSaleProperties(properties: SaleProperty[], criteria: SaleCriteria) {
  return properties.filter((property) => {
    if (!property.url.startsWith('https://orijyu.com/buy/')) return false;
    if (criteria.area) {
      const location = `${property.title}\n${property.address}\n${property.transport.join('\n')}`;
      if (!location.includes(criteria.area)) return false;
    }
    if (criteria.maxPriceYen != null && property.price_yen > criteria.maxPriceYen) return false;
    if (criteria.propertyType && !matchesPropertyType(property.property_type, criteria.propertyType)) return false;
    if (criteria.layout && !property.layout.toUpperCase().includes(criteria.layout)) return false;
    return true;
  }).sort((left, right) => left.price_yen - right.price_yen || (left.walk_minutes ?? 999) - (right.walk_minutes ?? 999)).slice(0, 3);
}

export function salePropertyChunk(property: SaleProperty, index: number): SearchChunk {
  return {
    id: `sale-${property.id}`,
    type: 'text',
    score: 1 - index * 0.01,
    text: `## ${property.title}\n公式ページ: ${property.url}\n\n販売価格 ${property.price_yen}円\n所在地 ${property.address}\n物件種別 ${property.property_type}\n間取り ${property.layout}\n交通 ${property.transport.join('、')}`,
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
    const layout = property.layout ? `、${property.layout}` : '';
    const walk = property.walk_minutes != null ? `、駅徒歩${property.walk_minutes}分` : '';
    return `- ${property.title}：${property.property_type}、販売価格${price}${layout}、${property.address}${walk}にゃん。[${index + 1}]`;
  });
  return `${criteria.area || ''}で条件に合う購入物件が見つかったにゃん。\n${lines.join('\n')}`;
}
