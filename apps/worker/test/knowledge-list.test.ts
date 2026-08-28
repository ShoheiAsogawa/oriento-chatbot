import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
}));

import {
  listAllKnowledgeItems,
  matchingInitialKnowledgeItems,
  projectKnowledgeItem,
  syncInitialKnowledgeFiles,
} from '../src/index';

function item(id: string, extras: Partial<AiSearchItemInfo> = {}): AiSearchItemInfo {
  return {
    id,
    key: `${id}.md`,
    status: 'completed',
    chunks_count: 1,
    file_size: 12,
    created_at: '2026-08-28T00:00:00Z',
    last_seen_at: '2026-08-28T00:00:00Z',
    metadata: {
      category: 'properties_for_rent',
      source_url: `https://orijyu.com/rent/${id}.html`,
      manifest_sha256: 'a'.repeat(64),
      title: id,
    },
    ...extras,
  };
}

describe('knowledge list and reseed helpers', () => {
  it('lists AI Search items 50 at a time and stops on a short page', async () => {
    const pages = [
      Array.from({ length: 50 }, (_, index) => item(`p1-${index}`)),
      Array.from({ length: 12 }, (_, index) => item(`p2-${index}`)),
    ];
    const list = vi.fn(async ({ page }: { page: number }) => ({
      result: pages[page - 1] || [],
      result_info: { count: pages[page - 1]?.length || 0, page, per_page: 50, total_count: 62 },
    }));

    const result = await listAllKnowledgeItems({ list } as unknown as AiSearchItems);

    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[0]?.[0]).toEqual({ page: 1, per_page: 50 });
    expect(list.mock.calls[1]?.[0]).toEqual({ page: 2, per_page: 50 });
    expect(result).toHaveLength(62);
  });

  it('omits an empty status filter so AI Search does not receive status: undefined', async () => {
    const list = vi.fn(async () => ({
      result: [item('one')],
      result_info: { count: 1, page: 1, per_page: 50, total_count: 1 },
    }));

    await listAllKnowledgeItems({ list } as unknown as AiSearchItems);

    expect(list.mock.calls[0]?.[0]).toEqual({ page: 1, per_page: 50 });
    expect(list.mock.calls[0]?.[0]).not.toHaveProperty('status');
  });

  it('keeps items already fetched when a later page fails', async () => {
    const list = vi.fn(async ({ page }: { page: number }) => {
      if (page === 1) {
        return {
          result: Array.from({ length: 50 }, (_, index) => item(`ok-${index}`)),
          result_info: { count: 50, page: 1, per_page: 50, total_count: 80 },
        };
      }
      throw new Error('503');
    });

    const result = await listAllKnowledgeItems({ list } as unknown as AiSearchItems);
    expect(result).toHaveLength(50);
  });

  it('throws when the first list page fails', async () => {
    const list = vi.fn(async () => {
      throw new Error('401');
    });
    await expect(listAllKnowledgeItems({ list } as unknown as AiSearchItems))
      .rejects.toThrow('401');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('retries a blank AI Search error then succeeds', async () => {
    const list = vi.fn()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValueOnce({
        result: [item('recovered')],
        result_info: { count: 1, page: 1, per_page: 50, total_count: 1 },
      });

    const result = await listAllKnowledgeItems({ list } as unknown as AiSearchItems);
    expect(list).toHaveBeenCalledTimes(2);
    expect(result.map((entry) => entry.id)).toEqual(['recovered']);
  });

  it('projects only serializable admin fields', () => {
    const projected = projectKnowledgeItem({
      ...item('keep'),
      body: { pipeTo: () => undefined },
    } as AiSearchItemInfo);

    expect(projected).toMatchObject({
      id: 'keep',
      title: 'keep',
      category: 'properties_for_rent',
      source_url: 'https://orijyu.com/rent/keep.html',
    });
    expect(projected).not.toHaveProperty('body');
  });

  it('matches a property by official URL without scanning unrelated keys', () => {
    const target = item('target', {
      metadata: {
        category: 'properties_for_rent',
        source_url: 'https://orijyu.com/rent/post-123456.html',
        manifest_sha256: 'b'.repeat(64),
      },
    });
    const decoys = Array.from({ length: 300 }, (_, index) => item(`decoy-${index}`));
    expect(matchingInitialKnowledgeItems({
      file: 'properties_for_rent/post-123456.md',
      category: 'properties_for_rent',
      source_url: 'https://orijyu.com/rent/post-123456.html',
      sha256: 'b'.repeat(64),
    }, [...decoys, target]).map((entry) => entry.id)).toEqual(['target']);
  });

  it('reseeds a short batch and leaves remaining files for the next request', async () => {
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
    const env = {
      STATIC_ASSETS: {
        fetch: vi.fn().mockImplementation(async () => new Response('# 物件', { status: 200 })),
      },
    } as unknown as Env;

    const result = await syncInitialKnowledgeFiles(
      env,
      new URL('https://example.test'),
      { upload, get: vi.fn() } as unknown as AiSearchItems,
      entries,
      [],
      { maxMutations: 2 },
    );

    expect(upload).toHaveBeenCalledTimes(2);
    expect(result.accepted).toHaveLength(2);
    expect(result.remaining).toBe(1);
    expect(result.failed).toEqual([]);
  });
});
