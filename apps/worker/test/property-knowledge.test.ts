import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
}));

import {
  canonicalInitialKnowledgeItem,
  excludeInitialGeneralKnowledgeOverriddenByManualItems,
  excludeInitialPropertiesCoveredByManualItems,
  generalKnowledgeMetadata,
  generalKnowledgeReplacementItemKey,
  initialKnowledgeItemKey,
  initialKnowledgePruneSafety,
  isFreshPendingInitialItem,
  isPlainTextKnowledgeItem,
  knowledgeContentRevision,
  matchingInitialKnowledgeItems,
  propertyKnowledgeCategory,
  propertyKnowledgeFromMarkdown,
  propertyKnowledgeItemKey,
  propertyKnowledgeMarkdown,
  propertyKnowledgeSchema,
  syncInitialKnowledgeFiles,
  upsertGeneralKnowledgeItem,
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
    expect(result.remaining).toBe(0);
    expect(result.failed).toEqual([]);
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
    expect(result.remaining).toBe(0);
    expect(result.failed).toEqual([]);
  });

  it('uploads only a mutation batch and reports how many files remain', async () => {
    const entries = [1, 2, 3].map((index) => ({
      file: `properties_for_rent/post-${index}.md`,
      category: 'properties_for_rent',
      source_url: `https://orijyu.com/rent/post-${index}.html`,
      sha256: 'b'.repeat(64),
    }));
    const upload = vi.fn().mockImplementation(async (key: string) => ({
      id: key,
      key,
      status: 'queued',
    }));
    const items = { upload, get: vi.fn() } as unknown as AiSearchItems;
    const env = {
      STATIC_ASSETS: {
        fetch: vi.fn().mockImplementation(async () => new Response('# 物件', { status: 200 })),
      },
    } as unknown as Env;

    const result = await syncInitialKnowledgeFiles(
      env,
      new URL('https://example.test'),
      items,
      entries,
      [],
      { maxMutations: 2 },
    );

    expect(upload).toHaveBeenCalledTimes(2);
    expect(result.accepted).toHaveLength(2);
    expect(result.remaining).toBe(1);
    expect(result.failed).toEqual([]);
  });

  it('keeps uploading other files when one asset cannot be read', async () => {
    const entries = [1, 2].map((index) => ({
      file: `properties_for_rent/post-${index}.md`,
      category: 'properties_for_rent',
      source_url: `https://orijyu.com/rent/post-${index}.html`,
      sha256: 'b'.repeat(64),
    }));
    const upload = vi.fn().mockResolvedValue({ id: 'ok', key: 'ok.md', status: 'queued' });
    const items = { upload, get: vi.fn() } as unknown as AiSearchItems;
    const env = {
      STATIC_ASSETS: {
        fetch: vi.fn().mockImplementation(async (request: Request) => {
          if (String(request.url).includes('post-1.md')) return new Response('missing', { status: 404 });
          return new Response('# 物件', { status: 200 });
        }),
      },
    } as unknown as Env;

    const result = await syncInitialKnowledgeFiles(
      env,
      new URL('https://example.test'),
      items,
      entries,
      [],
    );

    expect(result.failed).toEqual([{ file: 'properties_for_rent/post-1.md', error: '初期ナレッジを読み込めません: properties_for_rent/post-1.md' }]);
    expect(result.accepted).toHaveLength(1);
    expect(result.remaining).toBe(0);
  });

  it('updates a seeded general document without a replacement, preserving its stored content and excluding its manual override from later reseeds', async () => {
    const existing: AiSearchItemInfo = {
      id: 'general-item-123',
      key: 'company-guide.pdf',
      status: 'completed',
      metadata: {
        category: 'general',
        language: 'ja',
        source_url: 'https://orijyu.com/company/',
        title: '旧会社案内',
        manifest_sha256: 'a'.repeat(64),
      },
    };
    const originalContent = new Response('以前の資料内容').body!;
    const download = vi.fn().mockResolvedValue({ body: originalContent });
    const upload = vi.fn().mockResolvedValue({ ...existing, status: 'queued' });
    const remove = vi.fn();
    const items = {
      get: vi.fn(() => ({ download })),
      upload,
      delete: remove,
    } as unknown as AiSearchItems;

    const metadata = generalKnowledgeMetadata(existing, {
      title: '最新の会社案内',
      sourceUrl: 'https://orijyu.com/company/',
    }, 'general/company-guide.md');
    const result = await upsertGeneralKnowledgeItem(items, existing, {
      title: '最新の会社案内',
      sourceUrl: 'https://orijyu.com/company/',
    }, undefined, 'general/company-guide.md');

    expect(metadata).toEqual({
      category: 'general',
      language: 'ja',
      source_url: 'https://orijyu.com/company/',
      title: '最新の会社案内',
      manifest_sha256: 'manual:general/company-guide.md',
    });
    expect(download).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledWith('company-guide.pdf', originalContent, { metadata });
    expect(remove).not.toHaveBeenCalled();
    expect(result).toMatchObject({ itemKey: 'company-guide.pdf', replacedItemCount: 0 });
    const initialEntry = { file: 'general/company-guide.md', category: 'general', sha256: 'a'.repeat(64) };
    const manualOverride = { ...existing, metadata };
    const remainingInitialEntries = excludeInitialGeneralKnowledgeOverriddenByManualItems(
      [initialEntry],
      [manualOverride],
    );
    expect(matchingInitialKnowledgeItems(initialEntry, [manualOverride])).toEqual([]);
    expect(remainingInitialEntries).toEqual([]);
    upload.mockClear();
    await expect(syncInitialKnowledgeFiles(
      {} as Env,
      new URL('https://example.test'),
      items,
      remainingInitialEntries,
      [manualOverride],
    )).resolves.toEqual({ accepted: [], skipped: [], remaining: 0, failed: [] });
    expect(upload).not.toHaveBeenCalled();
  });

  it('uses a new item key for a general-document replacement with a different extension, then removes the old item', async () => {
    const existing: AiSearchItemInfo = {
      id: 'general-item-123',
      key: 'company-guide.pdf',
      status: 'completed',
      metadata: { category: 'general', language: 'ja', title: '会社案内' },
    };
    const replacement = new File(['最新版'], 'company-guide.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const replacementKey = generalKnowledgeReplacementItemKey(existing, replacement.name);
    const upload = vi.fn().mockResolvedValue({
      id: 'general-item-456',
      key: replacementKey,
      status: 'queued',
    });
    const remove = vi.fn();
    const items = {
      get: vi.fn(),
      upload,
      delete: remove,
    } as unknown as AiSearchItems;

    const result = await upsertGeneralKnowledgeItem(items, existing, {
      title: '会社案内（最新版）',
      sourceUrl: '',
    }, replacement);

    expect(replacementKey).toMatch(/^general-general-item-123-company-guide\.docx$/u);
    expect(upload).toHaveBeenCalledWith(replacementKey, replacement, {
      metadata: {
        category: 'general',
        language: 'ja',
        source_url: '',
        title: '会社案内（最新版）',
      },
    });
    expect(remove).toHaveBeenCalledWith('general-item-123');
    expect(result).toMatchObject({ itemKey: replacementKey, replacedItemCount: 1 });
  });

  it('updates markdown content in place and preserves a manual initial-document marker', async () => {
    const existing: AiSearchItemInfo = {
      id: 'general-md-1',
      key: 'initial-guide.md',
      status: 'completed',
      metadata: { category: 'general', manifest_sha256: 'manual:general/guide.md' },
    };
    const upload = vi.fn().mockResolvedValue({ ...existing, status: 'queued' });
    const items = { upload, get: vi.fn(), delete: vi.fn() } as unknown as AiSearchItems;

    expect(isPlainTextKnowledgeItem(existing)).toBe(true);
    await upsertGeneralKnowledgeItem(items, existing, { title: 'Guide', sourceUrl: '' }, undefined, undefined, '# Updated\n');

    expect(upload).toHaveBeenCalledWith('initial-guide.md', '# Updated\n', {
      metadata: {
        category: 'general',
        language: 'ja',
        source_url: '',
        title: 'Guide',
        manifest_sha256: 'manual:general/guide.md',
      },
    });
  });

  it('only identifies markdown and plain-text keys as editable content', () => {
    const item = (key: string) => ({ id: key, key, status: 'completed', metadata: { category: 'general' } } as AiSearchItemInfo);
    expect(isPlainTextKnowledgeItem(item('guide.md'))).toBe(true);
    expect(isPlainTextKnowledgeItem(item('guide.TXT'))).toBe(true);
    expect(isPlainTextKnowledgeItem(item('guide.pdf'))).toBe(false);
    expect(isPlainTextKnowledgeItem(item('guide.docx'))).toBe(false);
  });

  it('computes a stable revision from the exact UTF-8 text', async () => {
    const revision = await knowledgeContentRevision('見出し\n本文');
    expect(revision).toBe(await knowledgeContentRevision('見出し\n本文'));
    expect(revision).not.toBe(await knowledgeContentRevision('見出し\r\n本文'));
  });
});
