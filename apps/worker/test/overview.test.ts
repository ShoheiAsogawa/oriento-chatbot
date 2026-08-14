import { describe, expect, it, vi } from 'vitest';
import {
  addCalendarDays,
  buildPropertyAnalytics,
  fillDailySeries,
  fillHourlySeries,
  fillUsageSeries,
  inferPropertyPrefecture,
  loadOverview,
  normalizeTrackedPropertyUrl,
} from '../src/overview';

type QueryResult = { first?: unknown; all?: unknown[] };

function mockDb(handlers: Array<{ match: string; result: QueryResult }>) {
  const prepare = vi.fn((sql: string) => {
    const handler = handlers.find((item) => sql.includes(item.match));
    const api = {
      bind: vi.fn(() => api),
      first: vi.fn(async () => handler?.result.first ?? null),
      all: vi.fn(async () => ({ results: handler?.result.all ?? [] })),
    };
    return api;
  });
  return { db: { prepare } as unknown as D1Database, prepare };
}

describe('overview series helpers', () => {
  it('adds calendar days without shifting the date by timezone', () => {
    expect(addCalendarDays('2026-08-13', -1)).toBe('2026-08-12');
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addCalendarDays('2026-08-01', 0)).toBe('2026-08-01');
  });

  it('fills missing Japan-calendar days for a 30-day conversation series', () => {
    const series = fillDailySeries('2026-08-13', [
      { day: '2026-08-13', conversations: 12, visitors: 9 },
      { day: '2026-07-15', conversations: 4, visitors: 3 },
    ]);

    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ day: '2026-07-15', conversations: 4, visitors: 3 });
    expect(series[1]).toEqual({ day: '2026-07-16', conversations: 0, visitors: 0 });
    expect(series.at(-1)).toEqual({ day: '2026-08-13', conversations: 12, visitors: 9 });
  });

  it('fills 24 hourly buckets and usage counters', () => {
    expect(fillHourlySeries([{ hour: '09', count: '4' }, { hour: 21, count: 7 }])).toEqual([
      ...Array.from({ length: 9 }, (_, hour) => ({ hour, count: 0 })),
      { hour: 9, count: 4 },
      ...Array.from({ length: 11 }, (_, index) => ({ hour: 10 + index, count: 0 })),
      { hour: 21, count: 7 },
      { hour: 22, count: 0 },
      { hour: 23, count: 0 },
    ]);

    const usage = fillUsageSeries('2026-08-13', [
      { day: '2026-08-13', metric: 'chat_sessions', count: 18 },
      { day: '2026-08-13', metric: 'ai_requests', count: 41 },
    ], 2);
    expect(usage).toEqual([
      { day: '2026-08-12', sessions: 0, aiRequests: 0 },
      { day: '2026-08-13', sessions: 18, aiRequests: 41 },
    ]);
  });

  it('normalizes official property URLs and infers prefectures', () => {
    expect(normalizeTrackedPropertyUrl('https://www.orijyu.com/buy/post-128562.html?from=chat#top'))
      .toBe('https://orijyu.com/buy/post-128562.html');
    expect(normalizeTrackedPropertyUrl('https://example.com/buy/post-128562.html')).toBeUndefined();
    expect(inferPropertyPrefecture('堺市堺区北旅籠町西1丁')).toBe('大阪府');
    expect(inferPropertyPrefecture('西宮市仁川町6丁目')).toBe('兵庫県');
    expect(inferPropertyPrefecture('和歌山県海南市下津町')).toBe('和歌山県');
  });

  it('summarizes active property inventory and maps view counts to names', () => {
    const analytics = buildPropertyAnalytics([
      { sourceUrl: 'https://orijyu.com/buy/post-1.html', title: '大阪の家', address: '堺市堺区', prefecture: '大阪府', category: 'properties_for_sale' },
      { sourceUrl: 'https://orijyu.com/rent/post-2.html', title: '兵庫の賃貸', address: '西宮市仁川町', prefecture: '兵庫県', category: 'properties_for_rent' },
    ], [
      { source_url: 'https://orijyu.com/buy/post-3.html', title: '和歌山の土地', address: '和歌山市中', category: 'properties_for_sale' },
    ], ['https://orijyu.com/rent/post-2.html'], [
      { source_url: 'https://orijyu.com/buy/post-3.html', count: 12 },
    ]);

    expect(analytics.propertyPrefectures).toEqual([
      { prefecture: '大阪府', total: 1, sale: 1, rent: 0 },
      { prefecture: '和歌山県', total: 1, sale: 1, rent: 0 },
    ]);
    expect(analytics.topProperties).toEqual([
      { title: '和歌山の土地', address: '和歌山市中', sourceUrl: 'https://orijyu.com/buy/post-3.html', count: 12 },
    ]);
  });
});

describe('loadOverview', () => {
  it('aggregates real-estate consultation charts for the admin dashboard', async () => {
    const { db, prepare } = mockDb([
      {
        match: 'overview.summary',
        result: {
          first: {
            conversations30d: 40,
            visitors30d: 28,
            conversationsToday: 6,
            conversationsYesterday: 4,
            consented30d: 3,
          },
        },
      },
      { match: 'overview.refused', result: { first: { count: 5 } } },
      { match: 'overview.questions', result: { first: { count: 91 } } },
      {
        match: 'overview.daily',
        result: { all: [{ day: '2026-08-13', conversations: 6, visitors: 5 }] },
      },
      {
        match: 'overview.pages',
        result: { all: [{ page: '/property/osaka/', count: 11 }, { page: '/', count: 8 }] },
      },
      {
        match: 'overview.policy',
        result: { all: [{ action: 'allow', count: 80 }, { action: 'out_of_scope', count: 5 }] },
      },
      {
        match: 'overview.intents',
        result: { all: [{ intent: 'rent', count: 18 }, { intent: 'buy', count: 9 }] },
      },
      { match: 'overview.hours', result: { all: [{ hour: 10, count: 7 }] } },
      {
        match: 'overview.usage',
        result: { all: [{ day: '2026-08-13', metric: 'chat_sessions', count: 6 }] },
      },
      {
        match: 'overview.property_views',
        result: { all: [{ source_url: 'https://orijyu.com/buy/post-128562.html', count: 14 }] },
      },
      { match: 'overview.managed_properties', result: { all: [] } },
      { match: 'overview.property_exclusions', result: { all: [] } },
      {
        match: 'metric, count FROM usage_counters WHERE day = ?',
        result: { all: [{ metric: 'chat_sessions', count: 6 }, { metric: 'ai_requests', count: 19 }] },
      },
    ]);

    const overview = await loadOverview(db, {
      knowledgeItems: 28,
      propertyCatalog: [{
        sourceUrl: 'https://orijyu.com/buy/post-128562.html',
        title: 'OrientCity 七道',
        address: '堺市堺区北旅籠町西1丁',
        prefecture: '大阪府',
        category: 'properties_for_sale',
      }],
      sessionLimit: '500',
      aiRequestLimit: '500',
      now: new Date('2026-08-13T03:00:00Z'),
    });

    expect(overview.conversations30d).toBe(40);
    expect(overview.conversationsToday).toBe(6);
    expect(overview.visitors30d).toBe(28);
    expect(overview.refused30d).toBe(5);
    expect(overview.questions30d).toBe(91);
    expect(overview.consented30d).toBe(3);
    expect(overview.knowledgeItems).toBe(28);
    expect(overview.daily).toHaveLength(30);
    expect(overview.daily.at(-1)).toEqual({ day: '2026-08-13', conversations: 6, visitors: 5 });
    expect(overview.topPages).toEqual([
      { page: '/property/osaka/', count: 11 },
      { page: '/', count: 8 },
    ]);
    expect(overview.policy).toEqual([
      { action: 'allow', count: 80 },
      { action: 'out_of_scope', count: 5 },
    ]);
    expect(overview.propertyPrefectures).toEqual([
      { prefecture: '大阪府', total: 1, sale: 1, rent: 0 },
    ]);
    expect(overview.topProperties).toEqual([{
      title: 'OrientCity 七道',
      address: '堺市堺区北旅籠町西1丁',
      sourceUrl: 'https://orijyu.com/buy/post-128562.html',
      count: 14,
    }]);
    expect(overview.intents).toEqual([
      { intent: 'rent', count: 18 },
      { intent: 'buy', count: 9 },
    ]);
    expect(overview.hours[10]).toEqual({ hour: 10, count: 7 });
    expect(overview.usage.at(-1)).toEqual({ day: '2026-08-13', sessions: 6, aiRequests: 0 });
    expect(overview.costGuard).toEqual({
      day: '2026-08-13',
      sessions: 6,
      sessionLimit: 500,
      aiRequests: 19,
      aiRequestLimit: 500,
    });
    expect(prepare).toHaveBeenCalled();
  });
});
