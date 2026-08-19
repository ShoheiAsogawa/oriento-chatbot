import { describe, expect, it } from 'vitest';
import { attachMissingSourceMarkers, filterAnswerableChunks, propertyDetailSources, safeSourceUrl, selectAnswerSources, shouldShowPropertyDetailLinks, sourceFromChunk } from '../src/sources';
import type { SearchChunk } from '../src/types';

function chunk(text: string, score = 0.9): SearchChunk {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    text,
    score,
    item: { key: 'properties.md', metadata: { title: 'properties.md', source_url: 'https://orijyu.com/' } },
  } as unknown as SearchChunk;
}

describe('answer sources', () => {
  it('extracts a detailed official page from repeated knowledge headers', () => {
    const source = sourceFromChunk(chunk('## 公園南矢田3丁目 1期 7号棟\n公式ページ: https://orijyu.com/buy/123/\n\n販売価格 5,899万円'), 0);
    expect(source).toMatchObject({ title: '公園南矢田3丁目 1期 7号棟', url: 'https://orijyu.com/buy/123/' });
  });

  it('recovers the property title when a search chunk starts after the heading marker', () => {
    const source = sourceFromChunk(chunk('1期 7号棟\n公式ページ: https://orijyu.com/buy/123/\n更新日: 2026-08-09\n\n大阪・堺の新築一戸建て\n大阪市東住吉区公園南矢田3丁目 1期 7号棟\n販売価格 5,899万円'), 0);
    expect(source).toMatchObject({ title: '大阪市東住吉区公園南矢田3丁目 1期 7号棟', url: 'https://orijyu.com/buy/123/' });
  });

  it('returns at most two unique cited links', () => {
    const chunks = [
      chunk('## 物件A\n公式ページ: https://orijyu.com/buy/a/\n\nA'),
      chunk('## 物件B\n公式ページ: https://oriho.com/house/b/\n\nB'),
      chunk('## 物件C\n公式ページ: https://orichin.com/property/c/\n\nC'),
    ];
    expect(selectAnswerSources('物件Bです。[2] 物件Aもあります。[1]', chunks)).toEqual([
      expect.objectContaining({ title: '物件B', url: 'https://oriho.com/house/b/' }),
      expect.objectContaining({ title: '物件A', url: 'https://orijyu.com/buy/a/' }),
    ]);
  });

  it('does not attach a property detail button to a generic condition-gathering answer', () => {
    const sources = propertyDetailSources(selectAnswerSources(
      'まずは希望エリア、家賃上限、間取りを教えてくださいにゃん。[1]',
      [chunk('## 物件A\n公式ページ: https://orijyu.com/buy/post-1.html\n\n販売価格 3,000万円')],
    ));
    expect(shouldShowPropertyDetailLinks('まずは希望エリア、家賃上限、間取りを教えてくださいにゃん。[1]', sources)).toBe(false);
  });

  it('keeps detail buttons when an answer actually introduces a property', () => {
    const sources = propertyDetailSources(selectAnswerSources(
      '物件Aは販売価格3,000万円、3LDKにゃん。[1]',
      [chunk('## 物件A\n公式ページ: https://orijyu.com/buy/post-1.html\n\n販売価格 3,000万円')],
    ));
    expect(shouldShowPropertyDetailLinks('物件Aは販売価格3,000万円、3LDKにゃん。[1]', sources)).toBe(true);
  });

  it('treats the official pri2 route as a Japanese property detail page', () => {
    const sources = propertyDetailSources(selectAnswerSources(
      'プリッ2 東中浜は販売価格3,980万円にゃん。[1]',
      [chunk('## プリッ2 東中浜\n公式ページ: https://orijyu.com/pri2/post-65240.html\n\n販売価格 3,980万円')],
    ));
    expect(sources).toEqual([expect.objectContaining({ url: 'https://orijyu.com/pri2/post-65240.html' })]);
    expect(shouldShowPropertyDetailLinks('プリッ2 東中浜は販売価格3,980万円にゃん。[1]', sources)).toBe(true);
  });

  it('filters unrelated property citations when the question names an exact address', () => {
    const chunks = [
      chunk('## OrientCity 伏見\n公式ページ: https://orijyu.com/buy/other/\n\n別の物件'),
      chunk('## 大阪市東住吉区公園南矢田3丁目 1期 7号棟\n公式ページ: https://orijyu.com/buy/target/\n\n販売価格 5,899万円'),
    ];
    expect(selectAnswerSources('価格は5,899万円です。[1][2]', chunks, 2, '大阪市東住吉区公園南矢田3丁目 1期 7号棟の価格')).toEqual([
      expect.objectContaining({ title: '大阪市東住吉区公園南矢田3丁目 1期 7号棟', url: 'https://orijyu.com/buy/target/' }),
    ]);
  });

  it('keeps one detail link when the same property exists on multiple official sites', () => {
    const chunks = [
      chunk('## 大阪市東住吉区公園南矢田3丁目 1期 7号棟\n公式ページ: https://orijyu.com/buy/target/\n\n販売価格 5,899万円'),
      chunk('## 大阪市東住吉区公園南矢田3丁目 1期 7号棟 - 大阪・兵庫の新築一戸建て\n公式ページ: https://oriho.com/buy/mirror/\n\n販売価格 5,899万円'),
    ];
    expect(selectAnswerSources('価格は5,899万円です。[1][2]', chunks)).toEqual([
      expect.objectContaining({ url: 'https://orijyu.com/buy/target/' }),
    ]);
  });

  it('excludes a different building number at the same address', () => {
    const chunks = [
      chunk('## 大阪市東住吉区公園南矢田3丁目 1期 7号棟\n公式ページ: https://orijyu.com/buy/target/\n\n販売価格 5,899万円'),
      chunk('## 大阪市東住吉区公園南矢田3丁目 1期 1号棟 - 大阪・兵庫の新築一戸建て\n公式ページ: https://oriho.com/buy/wrong-unit/\n\n販売価格 5,699万円'),
    ];
    expect(selectAnswerSources('価格は5,899万円です。', chunks, 2, '大阪市東住吉区公園南矢田3丁目 1期 7号棟の価格')).toEqual([
      expect.objectContaining({ title: '大阪市東住吉区公園南矢田3丁目 1期 7号棟', url: 'https://orijyu.com/buy/target/' }),
    ]);
  });

  it('excludes property sources without the requested building number', () => {
    const chunks = [
      chunk('## 大阪市東住吉区の別物件\n公式ページ: https://orijyu.com/buy/wrong/\n\n販売価格 4,000万円'),
      chunk('## 大阪市東住吉区公園南矢田3丁目 1期 7号棟\n公式ページ: https://orijyu.com/buy/target/\n\n販売価格 5,899万円'),
    ];
    expect(filterAnswerableChunks(chunks, '大阪市東住吉区公園南矢田3丁目 1期 7号棟の間取り')).toEqual([chunks[1]]);
  });

  it('accepts full-width citation markers for source selection', () => {
    const chunks = [chunk('## 物件A\n公式ページ: https://orijyu.com/buy/a/\n\nA')];
    expect(selectAnswerSources('物件Aです。【1】', chunks)).toEqual([
      expect.objectContaining({ title: '物件A', url: 'https://orijyu.com/buy/a/' }),
    ]);
  });

  it('attaches a missing source marker after the property detail lines', () => {
    const answer = '物件情報はこちらにゃん。\n- 販売価格：5,899万円にゃん\n- 間取り：4LDKにゃん\n\n見学予約もできるにゃん。';
    const source = sourceFromChunk(chunk('## 大阪市東住吉区公園南矢田3丁目 1期 7号棟\n公式ページ: https://orijyu.com/buy/target/\n\n販売価格 5,899万円'), 0);
    expect(attachMissingSourceMarkers(answer, [source])).toBe(
      '物件情報はこちらにゃん。\n- 販売価格：5,899万円にゃん\n- 間取り：4LDKにゃん [1]\n\n見学予約もできるにゃん。',
    );
  });

  it('does not duplicate an existing full-width marker', () => {
    const source = sourceFromChunk(chunk('## 物件A\n公式ページ: https://orijyu.com/buy/a/\n\nA'), 0);
    expect(attachMissingSourceMarkers('物件Aです。【1】', [source])).toBe('物件Aです。【1】');
  });

  it('distributes missing links across multiple property detail blocks', () => {
    const answer = '物件Aにゃん。\n- 価格：3,000万円にゃん\n- 間取り：3LDKにゃん\n\n物件Bにゃん。\n- 価格：4,000万円にゃん\n- 間取り：4LDKにゃん';
    const sources = [
      sourceFromChunk(chunk('## 別名A\n公式ページ: https://orijyu.com/buy/a/\n\nA'), 0),
      sourceFromChunk(chunk('## 別名B\n公式ページ: https://orijyu.com/buy/b/\n\nB'), 1),
    ];
    expect(attachMissingSourceMarkers(answer, sources)).toBe(
      '物件Aにゃん。\n- 価格：3,000万円にゃん\n- 間取り：3LDKにゃん [1]\n\n物件Bにゃん。\n- 価格：4,000万円にゃん\n- 間取り：4LDKにゃん [2]',
    );
  });

  it('rejects non-official links', () => {
    expect(safeSourceUrl('https://example.com/property/1')).toBeUndefined();
  });

  it('rejects the Chinese site', () => {
    expect(safeSourceUrl('https://cn.orijyu.com/buy/123/')).toBeUndefined();
  });

  it('removes property chunks that do not have a Japanese detail page', () => {
    const chunks = [
      chunk('## 物件A 1号棟\n公式ページ: https://orijyu.com/buy/a/\n\n販売価格 3,000万円\n間取り 3LDK'),
      chunk('## 物件B 2号棟\n公式ページ: https://cn.orijyu.com/buy/b/\n\n販売価格 4,000万円\n間取り 4LDK'),
      chunk('店舗へのアクセス方法'),
    ];
    expect(filterAnswerableChunks(chunks, '物件を紹介して')).toEqual([chunks[0], chunks[2]]);
  });

  it('removes Chinese content even when metadata points to a Japanese root', () => {
    const chinese = chunk('## 房产信息\n销售价格: 3,480万日元\n格局: 3LDK');
    expect(filterAnswerableChunks([chinese], '賃貸を探して')).toEqual([]);
  });

  it('keeps only Japanese rental detail pages in rental consultation mode', () => {
    const rental = chunk('## 【賃貸】物件A\n公式ページ: https://orijyu.com/rent/a/\n\n賃料 8万円\n間取り 1K');
    const sale = chunk('## 新築物件B\n公式ページ: https://orijyu.com/buy/b/\n\n販売価格 3,000万円\n間取り 3LDK');
    expect(filterAnswerableChunks([rental, sale], '大阪市で家賃8万円の1K', { rentalOnly: true })).toEqual([rental]);
  });
});
