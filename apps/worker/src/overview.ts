import { japanDay, parseDailyLimit, readDailyUsage } from './cost-controls';

export interface OverviewDailyPoint {
  day: string;
  conversations: number;
  visitors: number;
}

export interface OverviewPageCount {
  page: string;
  count: number;
}

export interface OverviewPolicyCount {
  action: string;
  count: number;
}

export interface OverviewHourCount {
  hour: number;
  count: number;
}

export interface OverviewUsagePoint {
  day: string;
  sessions: number;
  aiRequests: number;
}

export interface OverviewData {
  conversations30d: number;
  conversationsToday: number;
  conversationsYesterday: number;
  visitors30d: number;
  questions30d: number;
  refused30d: number;
  consented30d: number;
  knowledgeItems: number;
  daily: OverviewDailyPoint[];
  topPages: OverviewPageCount[];
  policy: OverviewPolicyCount[];
  hours: OverviewHourCount[];
  usage: OverviewUsagePoint[];
  costGuard: {
    day: string;
    sessions: number;
    sessionLimit: number;
    aiRequests: number;
    aiRequestLimit: number;
  };
}

const SERIES_DAYS = 30;

export function addCalendarDays(isoDate: string, delta: number) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year || 0, (month || 1) - 1, (day || 1) + delta));
  return date.toISOString().slice(0, 10);
}

export function fillDailySeries(
  today: string,
  rows: Array<{ day: string; conversations?: number | string | null; visitors?: number | string | null }>,
  length = SERIES_DAYS,
): OverviewDailyPoint[] {
  const counts = new Map(rows.map((row) => [row.day, {
    conversations: Number(row.conversations || 0),
    visitors: Number(row.visitors || 0),
  }]));
  return Array.from({ length }, (_, index) => {
    const day = addCalendarDays(today, index - (length - 1));
    const point = counts.get(day);
    return {
      day,
      conversations: point?.conversations || 0,
      visitors: point?.visitors || 0,
    };
  });
}

export function fillHourlySeries(
  rows: Array<{ hour: number | string; count?: number | string | null }>,
): OverviewHourCount[] {
  const counts = new Map(rows.map((row) => [Number(row.hour), Number(row.count || 0)]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, count: counts.get(hour) || 0 }));
}

export function fillUsageSeries(
  today: string,
  rows: Array<{ day: string; metric: string; count?: number | string | null }>,
  length = SERIES_DAYS,
): OverviewUsagePoint[] {
  const byDay = new Map<string, OverviewUsagePoint>();
  for (const row of rows) {
    const current = byDay.get(row.day) || { day: row.day, sessions: 0, aiRequests: 0 };
    const count = Number(row.count || 0);
    if (row.metric === 'chat_sessions') current.sessions = count;
    if (row.metric === 'ai_requests') current.aiRequests = count;
    byDay.set(row.day, current);
  }
  return Array.from({ length }, (_, index) => {
    const day = addCalendarDays(today, index - (length - 1));
    return byDay.get(day) || { day, sessions: 0, aiRequests: 0 };
  });
}

function asCount(value: number | string | null | undefined) {
  return Number(value || 0);
}

export async function loadOverview(
  db: D1Database,
  options: {
    knowledgeItems: number;
    sessionLimit?: string;
    aiRequestLimit?: string;
    now?: Date;
  },
): Promise<OverviewData> {
  const now = options.now || new Date();
  const today = japanDay(now);
  const usageFrom = addCalendarDays(today, 1 - SERIES_DAYS);
  const [
    summary,
    unanswered,
    questions,
    dailyRows,
    pageRows,
    policyRows,
    hourRows,
    usageRows,
    dailyUsage,
  ] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS conversations30d,
        COUNT(DISTINCT visitor_hash) AS visitors30d,
        SUM(CASE WHEN date(created_at, '+9 hours') = date('now', '+9 hours') THEN 1 ELSE 0 END) AS conversationsToday,
        SUM(CASE WHEN date(created_at, '+9 hours') = date('now', '+9 hours', '-1 day') THEN 1 ELSE 0 END) AS conversationsYesterday,
        SUM(CASE WHEN marketing_consent = 1 THEN 1 ELSE 0 END) AS consented30d
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days') -- overview.summary`,
    ).first<{
      conversations30d: number;
      visitors30d: number;
      conversationsToday: number | null;
      conversationsYesterday: number | null;
      consented30d: number | null;
    }>(),
    db.prepare(
      `SELECT COUNT(*) AS count FROM messages
       WHERE role = 'assistant' AND policy_action != 'allow'
         AND created_at >= datetime('now', '-30 days') -- overview.refused`,
    ).first<{ count: number }>(),
    db.prepare(
      `SELECT COUNT(*) AS count FROM messages
       WHERE role = 'user' AND created_at >= datetime('now', '-30 days') -- overview.questions`,
    ).first<{ count: number }>(),
    db.prepare(
      `SELECT date(created_at, '+9 hours') AS day,
        COUNT(*) AS conversations,
        COUNT(DISTINCT visitor_hash) AS visitors
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days') -- overview.daily
       GROUP BY date(created_at, '+9 hours')
       ORDER BY day`,
    ).all<{ day: string; conversations: number; visitors: number }>(),
    db.prepare(
      `SELECT CASE
          WHEN source_page IS NULL OR trim(source_page) = '' THEN '/'
          ELSE source_page
        END AS page,
        COUNT(*) AS count
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days') -- overview.pages
       GROUP BY page
       ORDER BY count DESC
       LIMIT 8`,
    ).all<{ page: string; count: number }>(),
    db.prepare(
      `SELECT policy_action AS action, COUNT(*) AS count
       FROM messages
       WHERE role = 'assistant' AND created_at >= datetime('now', '-30 days') -- overview.policy
       GROUP BY policy_action
       ORDER BY count DESC`,
    ).all<{ action: string; count: number }>(),
    db.prepare(
      `SELECT CAST(strftime('%H', datetime(created_at, '+9 hours')) AS INTEGER) AS hour,
        COUNT(*) AS count
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days') -- overview.hours
       GROUP BY hour
       ORDER BY hour`,
    ).all<{ hour: number; count: number }>(),
    db.prepare(
      `SELECT day, metric, count FROM usage_counters
       WHERE day >= ? -- overview.usage
       ORDER BY day`,
    ).bind(usageFrom).all<{ day: string; metric: string; count: number }>(),
    readDailyUsage(db, now),
  ]);

  return {
    conversations30d: asCount(summary?.conversations30d),
    conversationsToday: asCount(summary?.conversationsToday),
    conversationsYesterday: asCount(summary?.conversationsYesterday),
    visitors30d: asCount(summary?.visitors30d),
    questions30d: asCount(questions?.count),
    refused30d: asCount(unanswered?.count),
    consented30d: asCount(summary?.consented30d),
    knowledgeItems: asCount(options.knowledgeItems),
    daily: fillDailySeries(today, dailyRows.results || []),
    topPages: (pageRows.results || []).map((row) => ({
      page: row.page || '/',
      count: asCount(row.count),
    })),
    policy: (policyRows.results || []).map((row) => ({
      action: row.action || 'allow',
      count: asCount(row.count),
    })),
    hours: fillHourlySeries(hourRows.results || []),
    usage: fillUsageSeries(today, usageRows.results || []),
    costGuard: {
      day: dailyUsage.day,
      sessions: asCount(dailyUsage.counts.chat_sessions),
      sessionLimit: parseDailyLimit(options.sessionLimit, 500),
      aiRequests: asCount(dailyUsage.counts.ai_requests),
      aiRequestLimit: parseDailyLimit(options.aiRequestLimit, 500),
    },
  };
}
