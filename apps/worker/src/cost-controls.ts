export type DailyUsageMetric = 'chat_sessions' | 'ai_requests';

export interface DailyAllowance {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  day: string;
}

export function parseDailyLimit(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function japanDay(now: Date) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function consumeDailyAllowance(
  db: D1Database,
  metric: DailyUsageMetric,
  configuredLimit: string | undefined,
  fallbackLimit: number,
  now = new Date(),
): Promise<DailyAllowance> {
  const day = japanDay(now);
  const limit = parseDailyLimit(configuredLimit, fallbackLimit);
  const row = await db.prepare(
    `INSERT INTO usage_counters (day, metric, count) VALUES (?, ?, 1)
     ON CONFLICT(day, metric) DO UPDATE SET count = usage_counters.count + 1
       WHERE usage_counters.count < ?
     RETURNING count`,
  ).bind(day, metric, limit).first<{ count: number }>();
  const count = row?.count ?? limit;
  return {
    allowed: Boolean(row),
    count,
    limit,
    remaining: Math.max(0, limit - count),
    day,
  };
}

export async function readDailyUsage(db: D1Database, now = new Date()) {
  const day = japanDay(now);
  const result = await db.prepare(
    `SELECT metric, count FROM usage_counters WHERE day = ?`,
  ).bind(day).all<{ metric: DailyUsageMetric; count: number }>();
  return { day, counts: Object.fromEntries(result.results.map((row) => [row.metric, row.count])) };
}
