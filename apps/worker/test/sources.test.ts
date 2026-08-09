import { describe, expect, it } from 'vitest';
import { safeSourceUrl, selectAnswerSources, sourceFromChunk } from '../src/sources';
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

  it('rejects non-official links', () => {
    expect(safeSourceUrl('https://example.com/property/1')).toBeUndefined();
  });
});
