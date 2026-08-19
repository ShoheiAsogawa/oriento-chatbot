import { appendAudit } from './audit';
import type { AuditInput } from './types';

export type RateLimitScope = 'session' | 'message' | 'lead';

/**
 * Records a rate-limit rejection without retaining the request body or any
 * other visitor-provided data. Audit failure must not change the user-facing
 * rate-limit response, so the rejection remains best-effort and observable.
 */
export async function appendRateLimitAudit(
  env: Env,
  scope: RateLimitScope,
  conversationId: string,
  append: (env: Env, input: AuditInput) => Promise<unknown> = appendAudit,
): Promise<void> {
  try {
    await append(env, {
      eventType: 'chat.rate_limited',
      actorType: 'visitor',
      // A session rejection happens before a conversation row exists. Keep
      // its audit subject distinct so it cannot be mistaken for a real chat.
      subjectType: scope === 'session' ? 'session' : 'conversation',
      subjectId: conversationId,
      metadata: { scope },
    });
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'audit.append_failed',
      auditEventType: 'chat.rate_limited',
      scope,
      errorType: error instanceof Error ? error.name : 'unknown',
    }));
  }
}
