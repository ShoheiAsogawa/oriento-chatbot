import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
}));

import {
  excludeInitialPropertiesCoveredByManualItems,
  propertyKnowledgeCategory,
  propertyKnowledgeFromMarkdown,
  propertyKnowledgeItemKey,
  propertyKnowledgeMarkdown,
  propertyKnowledgeSchema,
} from '../src/index';

const sourceUrl = 'https://orijyu.com/rent/post-123456.html';

describe('property knowledge registration', () => {
  it('accepts the admin form shape and produces structured Japanese Markdown', async () => {
    const input = propertyKnowledgeSchema.parse({
      title: 'オリエントコート 101号室',
      category: 'properties_for_rent',
      sourceUrl,
      address: '大阪市北区',
      lineStation: '御堂筋線 梅田駅 徒歩8分',
      priceOrRent: '8.2万円',
      managementFee: '8,000円',
      layout: '1LDK',
      floorArea: '38.2㎡',
      buildingType: 'マンション',
      builtYear: '2020年',
      floor: '3階 / 10階建',
      availability: '募集中',
      features: ['オートロック', '宅配ボックス', 'オートロック'],
      notes: '内見は事前予約制です。',
    });

    expect(propertyKnowledgeCategory(input)).toBe('properties_for_rent');
    expect(propertyKnowledgeMarkdown(input, propertyKnowledgeCategory(input), sourceUrl)).toContain('## 物件情報');
    expect(propertyKnowledgeMarkdown(input, propertyKnowledgeCategory(input), sourceUrl)).toContain('- 公式物件詳細ページ: https://orijyu.com/rent/post-123456.html');
    expect(input.features).toEqual(['オートロック', '宅配ボックス']);
    await expect(propertyKnowledgeItemKey(sourceUrl)).resolves.toMatch(/^property-[A-Za-z0-9_-]+\.md$/u);
  });

  it('rejects non-official URLs, inconsistent types, and oversized feature lists', () => {
    expect(propertyKnowledgeSchema.safeParse({
      title: 'テスト物件',
      category: 'properties_for_sale',
      sourceUrl: 'http://example.com/property',
    }).success).toBe(false);
    expect(propertyKnowledgeSchema.safeParse({
      title: 'テスト物件',
      category: 'properties_for_sale',
      type: 'rent',
      sourceUrl,
    }).success).toBe(false);
    expect(propertyKnowledgeSchema.safeParse({
      title: 'テスト物件',
      type: 'sale',
      sourceUrl,
      features: Array.from({ length: 31 }, (_, index) => `設備${index}`),
    }).success).toBe(false);
  });

  it('converts legacy scraped property Markdown into the edit form shape', () => {
    const parsed = propertyKnowledgeFromMarkdown(`# 【賃貸】HOUSE EGRET 405号室

Source URL: ${sourceUrl}
Knowledge category: properties_for_rent

物件概要
物件種別
マンション
賃料
40,000円
所在地
大阪市港区波除5丁目
交通
JR大阪環状線「弁天町」徒歩6分
地下鉄中央線「弁天町」徒歩9分
共益費
5,000円
タイプ
1K
専有面積
15.00m2
賃貸状況
即入居可
備考1
内見は事前予約制です。`, {
      title: 'fallback',
      category: 'properties_for_rent',
      sourceUrl,
    });

    expect(parsed).toMatchObject({
      title: '【賃貸】HOUSE EGRET 405号室',
      category: 'properties_for_rent',
      sourceUrl,
      address: '大阪市港区波除5丁目',
      lineStation: 'JR大阪環状線「弁天町」徒歩6分 / 地下鉄中央線「弁天町」徒歩9分',
      priceOrRent: '40,000円',
      managementFee: '5,000円',
      layout: '1K',
      floorArea: '15.00m2',
      buildingType: 'マンション',
      availability: '即入居可',
    });
    expect(parsed.notes).toContain('備考1: 内見は事前予約制です。');
  });

  it('keeps a manually registered property URL out of subsequent static reseeds', () => {
    const initialEntry = {
      file: 'properties/rent/test-property.md',
      category: 'properties_for_rent',
      sha256: 'a'.repeat(64),
      source_url: sourceUrl,
    };
    const manualItem: AiSearchItemInfo = {
      id: 'manual-item',
      key: 'property-test.md',
      status: 'completed',
      metadata: {
        category: 'properties_for_rent',
        source_url: sourceUrl,
        title: 'テスト物件',
      },
    };
    const managedStaticItem: AiSearchItemInfo = {
      ...manualItem,
      id: 'static-item',
      metadata: { ...manualItem.metadata, manifest_sha256: 'a'.repeat(64) },
    };

    expect(excludeInitialPropertiesCoveredByManualItems([initialEntry], [manualItem])).toEqual([]);
    expect(excludeInitialPropertiesCoveredByManualItems([initialEntry], [managedStaticItem])).toEqual([initialEntry]);
  });
});
