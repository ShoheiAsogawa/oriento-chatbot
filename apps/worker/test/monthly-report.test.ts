import { describe, expect, it, vi } from 'vitest';
import {
  attachOrinyanCommentary,
  commentaryPromptPayload,
  japanMonth,
  japanMonthBounds,
  listAvailableReportMonths,
  loadMonthlyReport,
  mergePropertyInterests,
  readStoredCommentary,
  reportStatusForMonth,
  shiftJapanMonth,
} from '../src/monthly-report';

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

describe('monthly report calendar', () => {
  it('uses Japan calendar month bounds in UTC for SQLite', () => {
    expect(japanMonthBounds('2026-08')).toEqual({
      startIso: '2026-07-31T15:00:00.000Z',
      endIso: '2026-08-31T15:00:00.000Z',
      startSql: '2026-07-31 15:00:00',
      endSql: '2026-08-31 15:00:00',
    });
    expect(shiftJapanMonth('2026-01', -1)).toBe('2025-12');
  });

  it('treats the current Japan month as in-progress and lists it even without R2 files', () => {
    const now = new Date('2026-08-20T08:00:00+09:00');
    expect(japanMonth(now)).toBe('2026-08');
    expect(reportStatusForMonth('2026-08', now)).toBe('in_progress');
    expect(reportStatusForMonth('2026-07', now)).toBe('final');
    expect(listAvailableReportMonths(now, ['2025-12'])[0]).toBe('2026-08');
    expect(listAvailableReportMonths(now, ['2025-12'])).toContain('2025-12');
  });
});

describe('monthly report insights', () => {
  it('merges property page starts and citations onto inventory titles', () => {
    const interests = mergePropertyInterests(
      [{ gender: 'female', ageDecade: '20s', sourcePage: 'https://www.orijyu.com/rent/post-12.html?from=chat', count: 4 }],
      [{ gender: 'female', ageDecade: '20s', title: '古い名前', sourceUrl: 'https://orijyu.com/rent/post-12.html', count: 2 }],
      [{ source_url: 'https://orijyu.com/rent/post-12.html', title: '堺のワンルーム', category: 'properties_for_rent' }],
    );
    expect(interests).toEqual([{
      gender: 'female',
      ageDecade: '20s',
      title: '堺のワンルーム',
      sourceUrl: 'https://orijyu.com/rent/post-12.html',
      category: 'properties_for_rent',
      count: 6,
    }]);
  });

  it('loads a live in-progress month from D1 and keeps Orinyan commentary optional', async () => {
    const now = new Date('2026-08-20T12:00:00+09:00');
    const { db } = mockDb([
      { match: 'monthly.funnel', result: { first: { conversations: 12, visitors: 9, consented: 2 } } },
      { match: 'monthly.question_count', result: { first: { count: 31 } } },
      { match: 'monthly.policy', result: { all: [{ action: 'allow', count: 28 }] } },
      { match: 'monthly.question_trends', result: { all: [{ question: '堺市の賃貸', count: 5 }] } },
      { match: 'monthly.genders', result: { all: [{ gender: 'female', count: 7 }] } },
      { match: 'monthly.ages', result: { all: [{ ageDecade: '20s', count: 6 }] } },
      { match: 'monthly.demographics', result: { all: [{ gender: 'female', ageDecade: '20s', count: 5 }] } },
      { match: 'monthly.intent_totals', result: { all: [{ intent: 'rent', count: 8 }] } },
      {
        match: 'monthly.intents_by_demographic',
        result: { all: [{ gender: 'female', ageDecade: '20s', intent: 'rent', count: 5 }] },
      },
      {
        match: 'monthly.source_pages',
        result: { all: [{ gender: 'female', ageDecade: '20s', sourcePage: 'https://orijyu.com/rent/post-12.html', count: 3 }] },
      },
      { match: 'monthly.citations', result: { all: [] } },
      {
        match: 'monthly.inventory',
        result: { all: [{ source_url: 'https://orijyu.com/rent/post-12.html', title: '堺のワンルーム', category: 'properties_for_rent' }] },
      },
    ]);

    const report = await loadMonthlyReport(db, '2026-08', now);
    expect(report.status).toBe('in_progress');
    expect(report.conversations).toBe(12);
    expect(report.funnel).toEqual({ conversations: 12, consented_conversations: 2 });
    expect(report.intents.find((item) => item.intent === 'rent')?.count).toBe(8);
    expect(report.propertyInterests[0]?.title).toBe('堺のワンルーム');
    expect(report.orinyanCommentary).toBeNull();

    const withCommentary = attachOrinyanCommentary(report, {
      text: '20代の女性は賃貸が人気にゃん。',
      generatedAt: '2026-08-20T03:00:00.000Z',
      model: 'gpt-5.4-nano',
    });
    const payload = commentaryPromptPayload(withCommentary);
    expect(payload.status).toBe('in_progress');
    expect(payload.topDemographics[0]).toEqual({ label: '20代の女性', count: 5 });
    expect(payload.popularPropertiesByDemographic[0]?.properties[0]?.title).toBe('堺のワンルーム');
  });

  it('reads stored Orinyan commentary without treating old report JSON as a review', () => {
    expect(readStoredCommentary({
      month: '2026-07',
      generatedAt: '2026-08-01T18:27:00Z',
      questionTrends: [],
      funnel: { conversations: 10 },
    })).toBeNull();
    expect(readStoredCommentary({
      orinyanCommentary: { text: '総評にゃん', generatedAt: '2026-08-20T01:00:00Z', model: 'gpt-5.4-nano' },
    })).toEqual({
      text: '総評にゃん',
      generatedAt: '2026-08-20T01:00:00Z',
      model: 'gpt-5.4-nano',
    });
  });
});
