import { choicesForChatAnswer, type ChatChoice } from './chat-choices';
import type { RentalCriteria } from './rental-catalog';
import type { SaleCriteria } from './sale-catalog';

type RentalAreaAvailability = {
  min_rent_yen: number;
  layout_min_rent_yen: Record<string, number>;
};

type SaleAreaAvailability = {
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

const RESTART_CHOICE: ChatChoice = {
  label: '条件を変えて探す',
  value: '物件を探す',
  tone: 'primary',
};

function filteredOrRestart(choices: ChatChoice[]) {
  return choices.length > 0 ? choices : [RESTART_CHOICE];
}

function budgetFromChoice(value: string) {
  const tenThousands = value.match(/(\d[\d,]*)万円/u)?.[1];
  return tenThousands ? Number(tenThousands.replace(/,/gu, '')) * 10_000 : undefined;
}

function rentalLayoutFromChoice(value: string) {
  return value === 'ワンルーム' ? '1R' : value.toUpperCase();
}

export async function loadGuidedSearchOptions(env: Env): Promise<GuidedSearchOptions | null> {
  try {
    const response = await env.STATIC_ASSETS.fetch(
      new Request('https://assets.internal/knowledge/guided_search_options.json'),
    );
    if (!response.ok) return null;
    return await response.json<GuidedSearchOptions>();
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'guided_search_options.unavailable',
      message: error instanceof Error ? error.message : 'unknown error',
    }));
    return null;
  }
}

export function rentalChoicesForAvailability(
  answer: string,
  options: GuidedSearchOptions | null,
  criteria: RentalCriteria,
) {
  const choices = choicesForChatAnswer(answer);
  if (!options || choices.length === 0) return choices;

  if (/(?:住みたい地域や最寄り駅|希望エリアを選んで)/u.test(answer)) {
    return filteredOrRestart(choices.filter((item) => Boolean(options.rental[item.value])));
  }

  const area = criteria.area ? options.rental[criteria.area] : undefined;
  if (/家賃の上限/u.test(answer)) {
    if (!area) return [RESTART_CHOICE];
    return filteredOrRestart(choices.filter((item) => {
      const budget = budgetFromChoice(item.value);
      return budget != null && area.min_rent_yen <= budget;
    }));
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
  if (!options || choices.length === 0) return choices;

  if (/希望エリアを選んで/u.test(answer)) {
    return filteredOrRestart(choices.filter((item) => Boolean(options.sale[item.value])));
  }

  const area = criteria.area ? options.sale[criteria.area] : undefined;
  if (/購入予算の上限/u.test(answer)) {
    if (!area) return [RESTART_CHOICE];
    return filteredOrRestart(choices.filter((item) => {
      const budget = budgetFromChoice(item.value);
      return budget != null && area.min_price_yen <= budget;
    }));
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
