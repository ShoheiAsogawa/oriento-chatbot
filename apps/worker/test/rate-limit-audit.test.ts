import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
}));

import { appendRateLimitAudit } from '../src/rate-limit-audit';
import type { AuditInput } from '../src/types';

const env = {} as Env;

describe('appendRateLimitAudit', () => {
  it('writes only a scoped visitor conversation event', async () => {
    const append = vi.fn(async () => undefined);

    await appendRateLimitAudit(env, 'message', 'conversation-123', append);

    expect(append).toHaveBeenCalledOnce();
    const call = append.mock.calls[0] as unknown as [Env, Record<string, unknown>];
    expect(call[0]).toBe(env);
    expect(call[1]).toEqual({
      eventType: 'chat.rate_limited',
      actorType: 'visitor',
      subjectType: 'conversation',
      subjectId: 'conversation-123',
      metadata: { scope: 'message' },
    });
    expect(JSON.stringify(call[1])).not.toContain('content');
  });

  it('keeps the rate-limit response path alive if auditing fails', async () => {
    const append = vi.fn(async () => { throw new Error('ledger unavailable'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(appendRateLimitAudit(env, 'lead', 'conversation-456', append)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect((warn.mock.calls[0] as unknown as [string])[0]).toContain('chat.rate_limited');
    warn.mockRestore();
  });

  it('does not label a rejected session as an existing conversation', async () => {
    const append = vi.fn(async (_env: Env, _input: AuditInput) => undefined);

    await appendRateLimitAudit(env, 'session', 'session-attempt-123', append);

    expect(append.mock.calls[0]?.[1]).toMatchObject({
      subjectType: 'session',
      subjectId: 'session-attempt-123',
      metadata: { scope: 'session' },
    });
  });
});
