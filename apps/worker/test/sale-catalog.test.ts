import { describe, expect, it } from 'vitest';
import { formatSaleAnswer, recommendSaleProperties, type SaleProperty } from '../src/sale-catalog';

const properties: SaleProperty[] = [
  {
    id: '1', title: 'OrientCity 七道', url: 'https://orijyu.com/buy/post-1.html',
    property_type: '新築一戸建て', price_yen: 29_800_000, address: '堺市堺区北旅籠町西1丁',
    transport: ['南海本線「七道」徒歩5分'], layout: '4LDK', walk_minutes: 5, status: '',
  },
  {
    id: '2', title: '予算超過', url: 'https://orijyu.com/buy/post-2.html',
    property_type: '新築一戸建て', price_yen: 45_000_000, address: '堺市堺区',
    transport: ['南海本線「堺」徒歩8分'], layout: '4LDK', walk_minutes: 8, status: '',
  },
];

describe('sale catalog', () => {
  it('filters sale properties by area, budget, type, and layout', () => {
    expect(recommendSaleProperties(properties, {
      area: '堺市', maxPriceYen: 30_000_000, propertyType: '新築戸建て', layout: '4LDK',
    })).toEqual([properties[0]]);
  });

  it('formats each purchase property with its own detail source marker', () => {
    const answer = formatSaleAnswer([properties[0]!], { area: '堺市' });
    expect(answer).toContain('OrientCity 七道');
    expect(answer).toContain('販売価格2980万円');
    expect(answer).toContain('[1]');
  });
});
