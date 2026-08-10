import { describe, expect, it } from 'vitest';
import { extractRentalCriteria, formatRentalAnswer, recommendRentalProperties, type RentalProperty } from '../src/rental-catalog';

const properties: RentalProperty[] = [
  {
    id: '1', title: 'HOUSE EGRET 405号室', url: 'https://orijyu.com/rent/post-1.html', property_type: 'マンション',
    rent_yen: 40_000, common_fee: '5,000円', address: '大阪市港区波除5丁目', transport: ['弁天町 徒歩6分'],
    layout: '1K', walk_minutes: 6, status: '即入居可',
  },
  {
    id: '2', title: '事務所', url: 'https://orijyu.com/rent/post-2.html', property_type: '店舗・事務所',
    rent_yen: 30_000, common_fee: '', address: '大阪市港区', transport: ['弁天町 徒歩3分'],
    layout: '1K', walk_minutes: 3, status: '即入居可',
  },
  {
    id: '3', title: '高額物件', url: 'https://orijyu.com/rent/post-3.html', property_type: 'アパート',
    rent_yen: 80_000, common_fee: '', address: '大阪市港区', transport: ['弁天町 徒歩5分'],
    layout: '1K', walk_minutes: 5, status: '即入居可',
  },
];

describe('rental catalog', () => {
  it('extracts numeric criteria from the conversation', () => {
    expect(extractRentalCriteria([
      { role: 'user', content: '一人暮らししたい' },
      { role: 'assistant', content: '地域を教えてにゃん。' },
      { role: 'user', content: '大阪市がいい' },
      { role: 'assistant', content: '家賃上限を教えてにゃん。' },
      { role: 'user', content: '家賃5万円まで' },
    ], '1Kで駅徒歩10分以内')).toEqual({
      area: '大阪市', maxRentYen: 50_000, layout: '1K', maxWalkMinutes: 10,
    });
  });

  it('keeps only residential rentals satisfying every condition', () => {
    expect(recommendRentalProperties(properties, {
      area: '大阪市', maxRentYen: 50_000, layout: '1K', maxWalkMinutes: 10,
    })).toEqual([properties[0]]);
  });

  it('formats the exact Japanese detail link marker position', () => {
    expect(formatRentalAnswer([properties[0]!], { area: '大阪市' })).toContain('HOUSE EGRET 405号室');
    expect(formatRentalAnswer([properties[0]!], { area: '大阪市' })).toContain('[1]');
  });
});
