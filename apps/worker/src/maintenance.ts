import { DurableObject } from 'cloudflare:workers';
import { appendAudit } from './audit';
import { isMonthlyMaintenance, nextMaintenanceTime, previousJapanMonth } from './maintenance-schedule';

const RETRY_DELAY_MS = 15 * 60 * 1000;

async function generateMonthlyReport(env: Env, scheduledTime: number) {
  const [policySummary, questionTrends, funnel] = await Promise.all([
    env.DB.prepare(
      `SELECT policy_action, COUNT(*) AS count FROM messages
       WHERE role = 'assistant' AND created_at >= datetime('now','start of month','-1 month')
         AND created_at < datetime('now','start of month') GROUP BY policy_action ORDER BY count DESC`,
    ).all(),
    env.DB.prepare(
      `SELECT substr(content_redacted, 1, 120) AS question, COUNT(*) AS count
       FROM messages WHERE role = 'user'
         AND created_at >= datetime('now','start of month','-1 month')
         AND created_at < datetime('now','start of month')
       GROUP BY substr(content_redacted, 1, 120) ORDER BY count DESC LIMIT 50`,
    ).all(),
    env.DB.prepare(
      `SELECT COUNT(*) AS conversations,
        SUM(CASE WHEN marketing_consent = 1 THEN 1 ELSE 0 END) AS consented_conversations
       FROM conversations WHERE created_at >= datetime('now','start of month','-1 month')
         AND created_at < datetime('now','start of month')`,
    ).first(),
  ]);
  const month = previousJapanMonth(scheduledTime);
  const key = `reports/${month}.json`;
  await env.AUDIT_ARCHIVE.put(key, JSON.stringify({
    month,
    generatedAt: new Date().toISOString(),
    policySummary: policySummary.results,
    questionTrends: questionTrends.results,
    funnel,
  }, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
  await appendAudit(env, {
    eventType: 'report.monthly_generated',
    actorType: 'system',
    subjectType: 'report',
    subjectId: key,
  });
}

async function runDailyRetention(env: Env) {
  const setting = await env.DB.prepare(`SELECT value_json FROM settings WHERE key = 'retention'`).first<{ value_json: string }>();
  const retention = JSON.parse(setting?.value_json || '{}') as { conversation_days?: number; customer_days?: number };
  const conversationDays = Number(retention.conversation_days || 365);
  const customerDays = Number(retention.customer_days || 1095);
  const expired = await env.DB.prepare(
    `SELECT id FROM conversations WHERE updated_at < datetime('now', '-' || ? || ' days') LIMIT 500`,
  ).bind(conversationDays).all<{ id: string }>();
  if (expired.results.length) {
    await env.DB.batch(expired.results.map((row) => env.DB.prepare(`DELETE FROM conversations WHERE id = ?`).bind(row.id)));
    await appendAudit(env, {
      eventType: 'retention.conversations_deleted',
      actorType: 'system',
      metadata: { count: expired.results.length, days: conversationDays },
    });
  }
  const expiredCustomers = await env.DB.prepare(
    `SELECT id FROM customers WHERE updated_at < datetime('now', '-' || ? || ' days') LIMIT 500`,
  ).bind(customerDays).all<{ id: string }>();
  if (expiredCustomers.results.length) {
    await env.DB.batch(expiredCustomers.results.map((row) => env.DB.prepare(`DELETE FROM customers WHERE id = ?`).bind(row.id)));
    await appendAudit(env, {
      eventType: 'retention.customers_deleted',
      actorType: 'system',
      metadata: { count: expiredCustomers.results.length, days: customerDays },
    });
  }
  await env.DB.prepare(`DELETE FROM usage_counters WHERE day < date('now', '+9 hours', '-90 days')`).run();
}

type MaintenanceStatus = {
  nextRunAt: number | null;
  lastRunAt: string | null;
  lastResult: 'ok' | 'error' | null;
  lastError: string | null;
};

export class MaintenanceScheduler extends DurableObject<Env> {
  async start() {
    const existing = await this.ctx.storage.getAlarm();
    const nextRunAt = existing && existing > Date.now() ? existing : nextMaintenanceTime();
    if (nextRunAt !== existing) await this.ctx.storage.setAlarm(nextRunAt);
    return { ok: true, nextRunAt: new Date(nextRunAt).toISOString() };
  }

  async status(): Promise<MaintenanceStatus> {
    const [nextRunAt, lastRunAt, lastResult, lastError] = await Promise.all([
      this.ctx.storage.getAlarm(),
      this.ctx.storage.get<string>('lastRunAt'),
      this.ctx.storage.get<'ok' | 'error'>('lastResult'),
      this.ctx.storage.get<string>('lastError'),
    ]);
    return {
      nextRunAt,
      lastRunAt: lastRunAt || null,
      lastResult: lastResult || null,
      lastError: lastError || null,
    };
  }

  async alarm() {
    const scheduledTime = Date.now();
    try {
      await runDailyRetention(this.env);
      if (isMonthlyMaintenance(scheduledTime)) await generateMonthlyReport(this.env, scheduledTime);
      await this.ctx.storage.put({
        lastRunAt: new Date(scheduledTime).toISOString(),
        lastResult: 'ok',
        lastError: '',
      });
      await this.ctx.storage.setAlarm(nextMaintenanceTime(scheduledTime));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown maintenance error';
      console.error(JSON.stringify({ level: 'error', event: 'maintenance.failed', message }));
      await this.ctx.storage.put({
        lastRunAt: new Date(scheduledTime).toISOString(),
        lastResult: 'error',
        lastError: message.slice(0, 500),
      });
      await this.ctx.storage.setAlarm(Date.now() + RETRY_DELAY_MS);
    }
  }
}
