import { choicesForChatAnswer, type ChatChoice } from './chat-choices';
import { propertyArea, sortPrefectures } from './property-areas';
import { loadRentalCatalog, type RentalCriteria, type RentalProperty } from './rental-catalog';
import { loadSaleCatalog, type SaleCriteria, type SaleProperty } from './sale-catalog';

type RentalAreaAvailability = {
  prefecture: string;
  min_rent_yen: number;
  layout_min_rent_yen: Record<string, number>;
};

type SaleAreaAvailability = {
  prefecture: string;
  min_price_yen: number;
  type_min_price_yen: Record<string, number>;
  layout_min_price_yen: Record<string, number>;
  layout_min_price_yen_by_type: Record<string, Record<string, number>>;
};

export type GuidedSearchOptions = {
  version: number;
  rental: Record<string, RentalAreaAvailability>;
  sale: Record<string, SaleAreaAvailability>;
};

const RESIDENTIAL_RENTAL = /(?:賃貸住宅|マンション|アパート|貸家|一戸建|テラスハウス)/u;
const UNAVAILABLE_RENTAL_STATUS = /(?:成約|契約済|募集終了|非公開|掲載終了|取扱終了)/u;
const UNAVAILABLE_SALE_STATUS = /(?:成約済|契約済|販売終了|掲載終了|非公開|取(?:り)?下げ|売(?:り)?止)/u;
const RESTART_CHOICE: ChatChoice = {
  label: '条件を変えて探す',
  value: '物件を探す',
  tone: 'primary',
};
const RENTAL_BUDGET_STEP_YEN = 10_000;
const PURCHASE_BUDGET_STEP_YEN = 10_000_000;

function filteredOrRestart(choices: ChatChoice[]) {
  return choices.length > 0 ? choices : [RESTART_CHOICE];
}

export function guidedAnswerForAvailability(
  answer: string,
  choices: ChatChoice[],
  mode: 'rental' | 'purchase',
  criteria: Pick<RentalCriteria | SaleCriteria, 'area' | 'prefecture'>,
) {
  const restartOnly = choices.length === 1 && choices[0]?.value === RESTART_CHOICE.value;
  if (!restartOnly) return answer;
  const location = criteria.area || criteria.prefecture || '選択した地域';
  const propertyLabel = mode === 'rental' ? '賃貸' : '購入';
  return `${location}では、現在の条件に合う登録中の${propertyLabel}物件が見つからないにゃん。条件や地域を変えて探すか、最新情報は公式LINEで問い合わせてにゃん。`;
}

function button(label: string): ChatChoice {
  return { label, value: label, tone: 'default' };
}

function budgetFromChoice(value: string) {
  const tenThousands = value.match(/(\d[\d,]*)万円/u)?.[1];
  return tenThousands ? Number(tenThousands.replace(/,/gu, '')) * 10_000 : undefined;
}

function inventoryBudgetChoice(
  minimumPriceYen: number,
  stepYen: number,
  valuePrefix: '家賃' | '購入予算',
): ChatChoice {
  const ceilingYen = Math.ceil(minimumPriceYen / stepYen) * stepYen;
  const tenThousands = ceilingYen / 10_000;
  return {
    label: `${tenThousands.toLocaleString('ja-JP')}万円まで`,
    value: `${valuePrefix}${tenThousands}万円まで`,
    tone: 'primary',
  };
}

function availabilityForArea<T>(options: Record<string, T>, requestedArea?: string) {
  if (!requestedArea) return undefined;
  if (options[requestedArea]) return options[requestedArea];
  const normalized = requestedArea.normalize('NFKC').replace(/[市区町村]$/u, '');
  const matches = Object.entries(options).filter(([municipality]) => (
    municipality.normalize('NFKC').replace(/[市区町村]$/u, '') === normalized
  ));
  return matches.length === 1 ? matches[0]?.[1] : undefined;
}

function rentalLayoutFromChoice(value: string) {
  return value === 'ワンルーム' ? '1R' : value.toUpperCase();
}

function guidedLayout(value: string) {
  return value.normalize('NFKC').toUpperCase().replace('ワンルーム', '1R')
    .match(/(?:1R|1K|1LDK|2LDK|3LDK|4LDK)/u)?.[0];
}

function canonicalSaleType(value: string) {
  if (/新築.*(?:一戸建て?|戸建)/u.test(value)) return '新築戸建て';
  if (/中古.*(?:一戸建て?|戸建)/u.test(value)) return '中古戸建て';
  if (/マンション/u.test(value) && !/新築/u.test(value)) return '中古マンション';
  if (/土地/u.test(value)) return '土地';
  if (/(?:その他|店舗|事務所|収益|アパート|ビル|テラスハウス)/u.test(value)) return 'その他・事業用';
  return undefined;
}

function saleTypeKeys(value: string) {
  const canonical = canonicalSaleType(value);
  if (!canonical) return [];
  if (canonical === '新築戸建て' || canonical === '中古戸建て') return [canonical, '戸建て'];
  if (canonical === '中古マンション') return [canonical, 'マンション'];
  return [canonical];
}

function updateMinimum(record: Record<string, number>, key: string, value: number) {
  record[key] = Math.min(record[key] ?? Number.POSITIVE_INFINITY, value);
}

export function buildGuidedSearchOptions(
  rentals: RentalProperty[],
  sales: SaleProperty[],
): GuidedSearchOptions {
  const rental: GuidedSearchOptions['rental'] = {};
  rentals.forEach((property) => {
    if (!RESIDENTIAL_RENTAL.test(property.property_type)
      || UNAVAILABLE_RENTAL_STATUS.test(property.status)
      || !property.url.startsWith('https://orijyu.com/rent/')) return;
    const area = propertyArea(property.address);
    if (!area) return;
    const entry = rental[area.municipality] ||= {
      prefecture: area.prefecture,
      min_rent_yen: property.rent_yen,
      layout_min_rent_yen: {},
    };
    entry.min_rent_yen = Math.min(entry.min_rent_yen, property.rent_yen);
    const layout = guidedLayout(property.layout);
    if (layout) updateMinimum(entry.layout_min_rent_yen, layout, property.rent_yen);
  });

  const sale: GuidedSearchOptions['sale'] = {};
  sales.forEach((property) => {
    if (UNAVAILABLE_SALE_STATUS.test(property.status) || !property.url.startsWith('https://orijyu.com/buy/')) return;
    const area = propertyArea(property.address);
    if (!area) return;
    const entry = sale[area.municipality] ||= {
      prefecture: area.prefecture,
      min_price_yen: property.price_yen,
      type_min_price_yen: {},
      layout_min_price_yen: {},
      layout_min_price_yen_by_type: {},
    };
    entry.min_price_yen = Math.min(entry.min_price_yen, property.price_yen);
    const propertyTypes = saleTypeKeys(property.property_type);
    const layout = guidedLayout(property.layout);
    propertyTypes.forEach((propertyType) => {
      updateMinimum(entry.type_min_price_yen, propertyType, property.price_yen);
    });
    if (layout) updateMinimum(entry.layout_min_price_yen, layout, property.price_yen);
    if (layout) propertyTypes.forEach((propertyType) => {
      updateMinimum(entry.layout_min_price_yen_by_type[propertyType] ||= {}, layout, property.price_yen);
    });
  });

  return { version: 2, rental, sale };
}

export async function loadGuidedSearchOptions(env: Env): Promise<GuidedSearchOptions | null> {
  try {
    const [rentals, sales] = await Promise.all([loadRentalCatalog(env), loadSaleCatalog(env)]);
    return buildGuidedSearchOptions(rentals, sales);
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'guided_search_options.unavailable',
      message: error instanceof Error ? error.message : 'unknown error',
    }));
    return null;
  }
}

function regionChoices(
  options: Record<string, RentalAreaAvailability | SaleAreaAvailability>,
  prefecture?: string,
) {
  if (prefecture) {
    return Object.entries(options)
      .filter(([, availability]) => availability.prefecture === prefecture)
      .map(([municipality]) => municipality)
      .sort((left, right) => left.localeCompare(right, 'ja'))
      .map(button);
  }
  return sortPrefectures([...new Set(Object.values(options).map((area) => area.prefecture))]).map(button);
}

export function rentalChoicesForAvailability(
  answer: string,
  options: GuidedSearchOptions | null,
  criteria: RentalCriteria,
) {
  const choices = choicesForChatAnswer(answer);
  if (!options) return choices;

  if (/都道府県を選んで/u.test(answer)) {
    return filteredOrRestart(regionChoices(options.rental));
  }
  if (/市区町村を選んで/u.test(answer)) {
    return filteredOrRestart(regionChoices(options.rental, criteria.prefecture));
  }
  if (choices.length === 0) return choices;

  const area = availabilityForArea(options.rental, criteria.area);
  if (/家賃の上限/u.test(answer)) {
    if (!area) return [RESTART_CHOICE];
    const availableChoices = choices.filter((item) => {
      const budget = budgetFromChoice(item.value);
      return budget != null && area.min_rent_yen <= budget;
    });
    return availableChoices.length > 0
      ? availableChoices
      : [inventoryBudgetChoice(area.min_rent_yen, RENTAL_BUDGET_STEP_YEN, '家賃')];
  }

  if (/希望の間取りや条件/u.test(answer)) {
    if (!area || criteria.maxRentYen == null) return [RESTART_CHOICE];
    return filteredOrRestart(choices.filter((item) => {
      if (item.value === 'こだわりなし') return true;
      const minimum = area.layout_min_rent_yen[rentalLayoutFromChoice(item.value)];
      return minimum != null && minimum <= criteria.maxRentYen!;
    }));
  }

  return choices;
}

export function purchaseChoicesForAvailability(
  answer: string,
  options: GuidedSearchOptions | null,
  criteria: SaleCriteria,
) {
  const choices = choicesForChatAnswer(answer);
  if (!options) return choices;

  if (/都道府県を選んで/u.test(answer)) {
    return filteredOrRestart(regionChoices(options.sale));
  }
  if (/市区町村を選んで/u.test(answer)) {
    return filteredOrRestart(regionChoices(options.sale, criteria.prefecture));
  }
  if (choices.length === 0) return choices;

  const area = availabilityForArea(options.sale, criteria.area);
  if (/購入予算の上限/u.test(answer)) {
    if (!area) return [RESTART_CHOICE];
    const availableChoices = choices.filter((item) => {
      const budget = budgetFromChoice(item.value);
      return budget != null && area.min_price_yen <= budget;
    });
    return availableChoices.length > 0
      ? availableChoices
      : [inventoryBudgetChoice(area.min_price_yen, PURCHASE_BUDGET_STEP_YEN, '購入予算')];
  }

  if (/購入する物件の種類/u.test(answer)) {
    if (!area || criteria.maxPriceYen == null) return [RESTART_CHOICE];
    return filteredOrRestart(choices.filter((item) => {
      if (item.value === '物件種別はこだわりなし') return true;
      const minimum = area.type_min_price_yen[item.value];
      return minimum != null && minimum <= criteria.maxPriceYen!;
    }));
  }

  if (/購入物件の希望間取り/u.test(answer)) {
    if (!area || criteria.maxPriceYen == null) return [RESTART_CHOICE];
    const layoutMinimums = criteria.propertyType
      ? area.layout_min_price_yen_by_type[criteria.propertyType] || {}
      : area.layout_min_price_yen;
    return filteredOrRestart(choices.filter((item) => {
      if (item.value === '間取りはこだわりなし') return true;
      const minimum = layoutMinimums[item.value.toUpperCase()];
      return minimum != null && minimum <= criteria.maxPriceYen!;
    }));
  }

  return choices;
}
