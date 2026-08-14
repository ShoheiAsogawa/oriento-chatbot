import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
}));

import {
  canonicalInitialKnowledgeItem,
  excludeInitialPropertiesCoveredByManualItems,
  initialKnowledgeItemKey,
  initialKnowledgePruneSafety,
  isFreshPendingInitialItem,
  matchingInitialKnowledgeItems,
  propertyKnowledgeCategory,
  propertyKnowledgeFromMarkdown,
  propertyKnowledgeItemKey,
  propertyKnowledgeMarkdown,
  propertyKnowledgeSchema,
  syncInitialKnowledgeFiles,
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

  it('round-trips feature bullets without erasing them during admin edits', () => {
    const input = propertyKnowledgeSchema.parse({
      title: 'オリエントコート 101号室',
      category: 'properties_for_rent',
      sourceUrl,
      features: ['オートロック', 'ペット相談可', '南向き'],
    });
    const markdown = propertyKnowledgeMarkdown(input, propertyKnowledgeCategory(input), sourceUrl);
    const parsed = propertyKnowledgeFromMarkdown(markdown, {
      title: input.title,
      category: propertyKnowledgeCategory(input),
      sourceUrl,
    });

    expect(parsed.features).toEqual(['オートロック', 'ペット相談可', '南向き']);
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

  it('uses a new item key when document content changes', () => {
    const entry = {
      file: 'properties_for_rent/post-123456.md',
      category: 'properties_for_rent',
      source_url: sourceUrl,
      sha256: 'a'.repeat(64),
    };
    expect(initialKnowledgeItemKey(entry)).toBe(`initial-${'a'.repeat(16)}-properties_for_rent__post-123456.md`);
    expect(initialKnowledgeItemKey({ ...entry, sha256: 'b'.repeat(64) }))
      .not.toBe(initialKnowledgeItemKey(entry));
  });

  it('groups only managed duplicates with the same official property URL', () => {
    const entry = {
      file: 'properties_for_rent/post-123456.md',
      category: 'properties_for_rent',
      source_url: sourceUrl,
      sha256: 'b'.repeat(64),
    };
    const oldItem: AiSearchItemInfo = {
      id: 'old',
      key: `oldhash-${entry.file.replaceAll('/', '__')}`,
      status: 'completed',
      metadata: { category: entry.category, source_url: sourceUrl, manifest_sha256: 'a'.repeat(64) },
    };
    const currentItem: AiSearchItemInfo = {
      ...oldItem,
      id: 'current',
      key: initialKnowledgeItemKey(entry),
      metadata: { ...oldItem.metadata, manifest_sha256: entry.sha256 },
    };
    const sameTitleDifferentUrl: AiSearchItemInfo = {
      ...oldItem,
      id: 'different-url',
      metadata: { ...oldItem.metadata, source_url: 'https://orijyu.com/rent/post-999999.html' },
    };
    const manualItem: AiSearchItemInfo = {
      ...oldItem,
      id: 'manual',
      metadata: { category: entry.category, source_url: sourceUrl },
    };

    expect(matchingInitialKnowledgeItems(entry, [oldItem, currentItem, sameTitleDifferentUrl, manualItem]))
      .toEqual([oldItem, currentItem]);
    expect(canonicalInitialKnowledgeItem(entry, [oldItem, currentItem])?.id).toBe('current');
  });

  it('retries stale pending initial items but leaves fresh processing alone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T08:00:00Z'));
    const item: AiSearchItemInfo = {
      id: 'pending',
      key: 'initial-test.md',
      status: 'running',
      last_seen_at: '2026-08-14T07:50:00Z',
      metadata: { manifest_sha256: 'a'.repeat(64) },
    };
    expect(isFreshPendingInitialItem(item, 'a'.repeat(64))).toBe(true);
    expect(isFreshPendingInitialItem({ ...item, last_seen_at: '2026-08-14T07:30:00Z' }, 'a'.repeat(64))).toBe(false);
    expect(isFreshPendingInitialItem({ ...item, status: 'error' }, 'a'.repeat(64))).toBe(false);
    vi.useRealTimers();
  });

  it('blocks pruning for an empty or unexpectedly shrunken property manifest', () => {
    const existing = Array.from({ length: 20 }, (_, index): AiSearchItemInfo => ({
      id: `existing-${index}`,
      key: `old-${index}.md`,
      status: 'completed',
      metadata: {
        category: 'properties_for_sale',
        source_url: `https://orijyu.com/buy/post-${100000 + index}.html`,
        manifest_sha256: 'a'.repeat(64),
      },
    }));
    const desired = Array.from({ length: 18 }, (_, index) => ({
      file: `properties_for_sale/post-${100000 + index}.md`,
      category: 'properties_for_sale',
      source_url: `https://orijyu.com/buy/post-${100000 + index}.html`,
      sha256: 'b'.repeat(64),
    }));

    expect(initialKnowledgePruneSafety([], existing)).toEqual({ safe: false, reason: 'manifest_empty' });
    expect(initialKnowledgePruneSafety(desired, existing)).toEqual({
      safe: false,
      reason: 'property_count_dropped_unexpectedly',
    });
    expect(initialKnowledgePruneSafety([
      ...desired,
      {
        file: 'properties_for_sale/post-100018.md',
        category: 'properties_for_sale',
        source_url: 'https://orijyu.com/buy/post-100018.html',
        sha256: 'b'.repeat(64),
      },
    ], existing)).toEqual({ safe: true, reason: null });
  });

  it('retries a stale same-version item with sync instead of a duplicate-key upload', async () => {
    const entry = {
      file: 'properties_for_rent/post-123456.md',
      category: 'properties_for_rent',
      source_url: sourceUrl,
      sha256: 'b'.repeat(64),
    };
    const stale: AiSearchItemInfo = {
      id: 'stale',
      key: initialKnowledgeItemKey(entry),
      status: 'running',
      last_seen_at: '2000-01-01T00:00:00Z',
      metadata: { category: entry.category, source_url: sourceUrl, manifest_sha256: entry.sha256 },
    };
    const sync = vi.fn().mockResolvedValue({ ...stale, status: 'queued' });
    const upload = vi.fn();
    const items = {
      get: vi.fn(() => ({ sync })),
      upload,
    } as unknown as AiSearchItems;

    const result = await syncInitialKnowledgeFiles(
      {} as Env,
      new URL('https://example.test'),
      items,
      [entry],
      [stale],
    );

    expect(sync).toHaveBeenCalledOnce();
    expect(upload).not.toHaveBeenCalled();
    expect(result.accepted).toEqual([{ file: entry.file, key: stale.key, id: stale.id, status: 'queued' }]);
  });

  it('uploads changed content under a new version key and keeps the completed old item', async () => {
    const entry = {
      file: 'properties_for_rent/post-123456.md',
      category: 'properties_for_rent',
      source_url: sourceUrl,
      sha256: 'b'.repeat(64),
    };
    const oldItem: AiSearchItemInfo = {
      id: 'old',
      key: `initial-${'a'.repeat(16)}-properties_for_rent__post-123456.md`,
      status: 'completed',
      metadata: { category: entry.category, source_url: sourceUrl, manifest_sha256: 'a'.repeat(64) },
    };
    const upload = vi.fn().mockResolvedValue({
      id: 'new',
      key: initialKnowledgeItemKey(entry),
      status: 'queued',
    });
    const items = { upload, get: vi.fn() } as unknown as AiSearchItems;
    const env = {
      STATIC_ASSETS: {
        fetch: vi.fn().mockResolvedValue(new Response('# 最新物件情報', { status: 200 })),
      },
    } as unknown as Env;

    const result = await syncInitialKnowledgeFiles(
      env,
      new URL('https://example.test'),
      items,
      [entry],
      [oldItem],
    );

    expect(upload).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0]?.[0]).toBe(initialKnowledgeItemKey(entry));
    expect(upload.mock.calls[0]?.[0]).not.toBe(oldItem.key);
    expect(result.accepted[0]).toMatchObject({ id: 'new', status: 'queued' });
  });
});
