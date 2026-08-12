import { describe, expect, it } from 'vitest';
import {
  purchaseChoicesForAvailability,
  rentalChoicesForAvailability,
  type GuidedSearchOptions,
} from '../src/guided-search-options';

const options: GuidedSearchOptions = {
  version: 1,
  rental: {
    大阪市: {
      min_rent_yen: 40_000,
      layout_min_rent_yen: { '1K': 40_000, '1LDK': 98_000, '2LDK': 200_000 },
    },
    堺市: {
      min_rent_yen: 65_000,
      layout_min_rent_yen: { '1R': 65_000 },
    },
  },
  sale: {
    岸和田市: {
      min_price_yen: 6_000_000,
      type_min_price_yen: {
        新築戸建て: 22_800_000,
        中古戸建て: 13_700_000,
        土地: 6_000_000,
      },
      layout_min_price_yen: { '3LDK': 13_700_000, '4LDK': 22_800_000 },
      layout_min_price_yen_by_type: {
        新築戸建て: { '4LDK': 22_800_000 },
        中古戸建て: { '3LDK': 13_700_000 },
      },
    },
  },
};

describe('guided search availability choices', () => {
  it('hides rental areas without residential inventory', () => {
    const values = rentalChoicesForAvailability(
      '賃貸を一緒に探すにゃん。まず、住みたい地域や最寄り駅を教えてにゃん。',
      options,
      {},
    ).map((item) => item.value);

    expect(values).toEqual(['大阪市', '堺市']);
  });

  it('hides rental budgets and layouts that cannot return inventory', () => {
    expect(rentalChoicesForAvailability(
      '次に、家賃の上限を教えてにゃん。',
      options,
      { area: '堺市' },
    ).map((item) => item.value)).toEqual(['家賃7万円まで', '家賃10万円まで', '家賃15万円まで']);

    expect(rentalChoicesForAvailability(
      '希望の間取りや条件を教えてにゃん。',
      options,
      { area: '堺市', maxRentYen: 100_000 },
    ).map((item) => item.value)).toEqual(['ワンルーム', 'こだわりなし']);
  });

  it('hides purchase types and layouts outside the selected budget', () => {
    expect(purchaseChoicesForAvailability(
      '購入する物件の種類を選んでにゃん。',
      options,
      { area: '岸和田市', maxPriceYen: 20_000_000 },
    ).map((item) => item.value)).toEqual([
      '中古戸建て',
      '土地',
      '物件種別はこだわりなし',
    ]);

    expect(purchaseChoicesForAvailability(
      '購入物件の希望間取りを選んでにゃん。',
      options,
      { area: '岸和田市', maxPriceYen: 30_000_000, propertyType: '新築戸建て' },
    ).map((item) => item.value)).toEqual(['4LDK', '間取りはこだわりなし']);
  });
});
