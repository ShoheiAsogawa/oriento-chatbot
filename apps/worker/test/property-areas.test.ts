import { describe, expect, it } from 'vitest';
import { propertyArea, sortPrefectures } from '../src/property-areas';

describe('property area normalization', () => {
  it.each([
    ['広島県福山市西新涯町2丁目', { prefecture: '広島県', municipality: '福山市' }],
    ['茨城県水戸市酒門町', { prefecture: '茨城県', municipality: '水戸市' }],
    ['大阪市都島区友渕町', { prefecture: '大阪府', municipality: '大阪市', ward: '都島区' }],
    ['和歌山県田辺市文里2丁目', { prefecture: '和歌山県', municipality: '田辺市' }],
    ['河内長野市木戸3丁目', { prefecture: '大阪府', municipality: '河内長野市' }],
  ])('extracts prefecture and municipality from %s', (address, expected) => {
    expect(propertyArea(address)).toEqual(expected);
  });

  it('keeps Ibaraki in the configured prefecture order', () => {
    expect(sortPrefectures(['広島県', '茨城県', '千葉県'])).toEqual(['茨城県', '千葉県', '広島県']);
  });
});
