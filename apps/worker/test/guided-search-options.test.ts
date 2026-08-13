import { describe, expect, it } from 'vitest';
import {
  buildGuidedSearchOptions,
  purchaseChoicesForAvailability,
  rentalChoicesForAvailability,
  type GuidedSearchOptions,
} from '../src/guided-search-options';

const options: GuidedSearchOptions = {
  version: 1,
  rental: {
    大阪市: {
      prefecture: '大阪府',
      min_rent_yen: 40_000,
      layout_min_rent_yen: { '1K': 40_000, '1LDK': 98_000, '2LDK': 200_000 },
    },
    堺市: {
      prefecture: '大阪府',
      min_rent_yen: 65_000,
      layout_min_rent_yen: { '1R': 65_000 },
    },
  },
  sale: {
    岸和田市: {
      prefecture: '大阪府',
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
  it('builds Wakayama, Hyogo, and every represented Osaka municipality from inventory', () => {
    const dynamic = buildGuidedSearchOptions([], [
      { id: '1', title: '田辺', url: 'https://orijyu.com/buy/post-1.html', property_type: '中古一戸建て', price_yen: 10_000_000, address: '和歌山県田辺市上屋敷', transport: [], layout: '3LDK', walk_minutes: null, status: '' },
      { id: '2', title: '神戸', url: 'https://orijyu.com/buy/post-2.html', property_type: '土地', price_yen: 12_000_000, address: '神戸市長田区', transport: [], layout: '', walk_minutes: null, status: '' },
      { id: '3', title: '東大阪', url: 'https://orijyu.com/buy/post-3.html', property_type: '中古マンション', price_yen: 15_000_000, address: '東大阪市長田', transport: [], layout: '2LDK', walk_minutes: null, status: '' },
      { id: '5', title: '水戸', url: 'https://orijyu.com/buy/post-5.html', property_type: '土地', price_yen: 4_500_000, address: '茨城県水戸市酒門町', transport: [], layout: '', walk_minutes: null, status: '' },
    ]);
    expect(Object.values(dynamic.sale).map((area) => area.prefecture)).toEqual(
      expect.arrayContaining(['和歌山県', '兵庫県', '大阪府']),
    );
    expect(dynamic.sale).toHaveProperty('田辺市');
    expect(dynamic.sale).toHaveProperty('神戸市');
    expect(dynamic.sale).toHaveProperty('東大阪市');
    expect(dynamic.sale['水戸市']?.prefecture).toBe('茨城県');
  });

  it('does not mistake Osaka City wards for a fictitious prefecture', () => {
    const dynamic = buildGuidedSearchOptions([], [
      { id: '4', title: '都島', url: 'https://orijyu.com/buy/post-4.html', property_type: '中古マンション', price_yen: 20_000_000, address: '大阪市都島区友渕町', transport: [], layout: '3LDK', walk_minutes: null, status: '' },
    ]);
    expect(dynamic.sale['大阪市']?.prefecture).toBe('大阪府');
    expect(Object.values(dynamic.sale).some((area) => area.prefecture === '大阪市都')).toBe(false);
  });

  it('shows only prefectures and municipalities with residential inventory', () => {
    const values = rentalChoicesForAvailability(
      '賃貸を一緒に探すにゃん。まず、住みたい都道府県を選んでにゃん。',
      options,
      {},
    ).map((item) => item.value);

    expect(values).toEqual(['大阪府']);
    expect(rentalChoicesForAvailability(
      '大阪府で賃貸を探すにゃん。次に、市区町村を選んでにゃん。',
      options,
      { prefecture: '大阪府' },
    ).map((item) => item.value)).toEqual(['堺市', '大阪市']);
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
