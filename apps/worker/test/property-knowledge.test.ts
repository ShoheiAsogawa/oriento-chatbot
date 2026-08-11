import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
}));

import {
  excludeInitialPropertiesCoveredByManualItems,
  propertyKnowledgeCategory,
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
