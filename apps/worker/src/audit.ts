import { DurableObject } from 'cloudflare:workers';
import type { AuditArchiveEvent, AuditInput } from './types';
import { sha256 } from './security';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function auditLedgerId(createdAt: string) {
  const month = createdAt.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(month) ? `orient-audit-${month}` : 'orient-audit-invalid-date';
}

export async function verifyAuditEvent(event: AuditArchiveEvent, expectedPreviousHash: string) {
  const { eventHash, ...canonicalEvent } = event;
  if (canonicalEvent.previousHash !== expectedPreviousHash) return false;
  return eventHash === await sha256(`${expectedPreviousHash}:${stableStringify(canonicalEvent)}`);
}

export async function appendAudit(env: Env, input: AuditInput) {
  const createdAt = input.createdAt || new Date().toISOString();
  const ledgerId = auditLedgerId(createdAt);
  return env.AUDIT_LEDGER.getByName(ledgerId).append({ ...input, createdAt });
}

type OutboxRow = { id: string; event_json: string };

export class AuditLedger extends DurableObject<Env> {
  private appendTail: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS ledger_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ledger_events (
          ledger_sequence INTEGER PRIMARY KEY,
          id TEXT NOT NULL UNIQUE,
          event_json TEXT NOT NULL,
          event_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_outbox (
          id TEXT PRIMARY KEY,
          event_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO ledger_meta(key, value) VALUES ('last_hash', 'GENESIS');
        INSERT OR IGNORE INTO ledger_meta(key, value) VALUES ('last_sequence', '0');
        PRAGMA optimize;
      `);
    });
  }

  append(input: AuditInput): Promise<AuditArchiveEvent> {
    const operation = this.appendTail.then(() => this.persist(input));
    this.appendTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async persist(input: AuditInput): Promise<AuditArchiveEvent> {
    const previousHash = this.metaValue('last_hash') || 'GENESIS';
    const ledgerSequence = Number(this.metaValue('last_sequence') || '0') + 1;
    const createdAt = input.createdAt || new Date().toISOString();
    const ledgerId = auditLedgerId(createdAt);
    const id = crypto.randomUUID();
    const canonical = stableStringify({ ...input, id, ledgerId, ledgerSequence, createdAt, previousHash });
    const eventHash = await sha256(`${previousHash}:${canonical}`);
    const event: AuditArchiveEvent = {
      ...input,
      id,
      ledgerId,
      ledgerSequence,
      createdAt,
      previousHash,
      eventHash,
    };

    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `INSERT INTO ledger_events (ledger_sequence, id, event_json, event_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        ledgerSequence,
        id,
        JSON.stringify(event),
        eventHash,
        createdAt,
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO audit_outbox (id, event_json, created_at) VALUES (?, ?, ?)`,
        id,
        JSON.stringify(event),
        createdAt,
      );
      this.ctx.storage.sql.exec(`UPDATE ledger_meta SET value = ? WHERE key = 'last_hash'`, eventHash);
      this.ctx.storage.sql.exec(`UPDATE ledger_meta SET value = ? WHERE key = 'last_sequence'`, String(ledgerSequence));
    });

    // The ledger and outbox are already committed atomically. Queue delivery is
    // retried by the alarm so a slow downstream archive never delays chat replies.
    await this.ctx.storage.setAlarm(Date.now() + 1_000);
    return event;
  }

  async alarm(): Promise<void> {
    try {
      await this.flushOutboxBatch();
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'audit.outbox_deferred',
        message: error instanceof Error ? error.message : 'Unknown queue error',
      }));
    } finally {
      if (this.pendingOutboxCount() > 0) await this.ctx.storage.setAlarm(Date.now() + 60_000);
    }
  }

  private metaValue(key: string) {
    return this.ctx.storage.sql.exec<{ value: string }>(`SELECT value FROM ledger_meta WHERE key = ?`, key).toArray()[0]?.value;
  }

  private pendingOutboxCount() {
    return this.ctx.storage.sql.exec<{ count: number }>(`SELECT COUNT(*) AS count FROM audit_outbox`).one().count;
  }

  private async flushOutboxBatch() {
    const rows = this.ctx.storage.sql.exec<OutboxRow>(
      `SELECT id, event_json FROM audit_outbox ORDER BY created_at, id LIMIT 100`,
    ).toArray();
    for (const row of rows) {
      await this.env.AUDIT_QUEUE.send(JSON.parse(row.event_json) as AuditArchiveEvent);
      this.ctx.storage.sql.exec(`DELETE FROM audit_outbox WHERE id = ?`, row.id);
    }
  }
}

export async function archiveAuditBatch(batch: MessageBatch<AuditArchiveEvent>, env: Env) {
  const events = batch.messages.map((message) => message.body);
  if (events.length === 0) return;

  await env.DB.batch(events.map((event) => env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events
      (id, ledger_id, ledger_sequence, event_type, actor_type, actor_id, subject_type, subject_id,
       metadata_json, previous_hash, event_hash, event_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    event.id,
    event.ledgerId,
    event.ledgerSequence,
    event.eventType,
    event.actorType,
    event.actorId || null,
    event.subjectType || null,
    event.subjectId || null,
    JSON.stringify(event.metadata || {}),
    event.previousHash,
    event.eventHash,
    JSON.stringify(event),
    event.createdAt,
  )));

  const day = events[0]?.createdAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const key = `audit/${day}/${Date.now()}-${crypto.randomUUID()}.jsonl`;
  await env.AUDIT_ARCHIVE.put(key, events.map((event) => JSON.stringify(event)).join('\n'), {
    httpMetadata: { contentType: 'application/x-ndjson' },
    customMetadata: { eventCount: String(events.length) },
  });
  batch.ackAll();
}
