import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiGatewayError, generateGroundedAnswer } from '../src/openai';
import type { SearchChunk } from '../src/types';

const env = {
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  AI_GATEWAY_ID: 'orient-chat',
  AI_GATEWAY_TOKEN: 'gateway-token',
  GENERATION_MODEL: 'gpt-5-mini-2025-08-07',
} as Env;

const chunks = [{
  id: 'chunk-1',
  type: 'text',
  score: 0.91,
  text: '営業時間は午前9時から午後6時までです。',
  item: { key: 'hours.pdf', metadata: { title: '営業時間' } },
}] as SearchChunk[];

afterEach(() => vi.restoreAllMocks());

describe('generateGroundedAnswer', () => {
  it('calls OpenAI through authenticated Cloudflare AI Gateway without storage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      choices: [{ message: { content: '営業時間は9時から18時までです。[1]' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await generateGroundedAnswer(env, '営業時間は？', chunks, 'system prompt');

    expect(result.answer).toContain('[1]');
    expect(fetchMock).toHaveBeenCalledOnce();
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall!;
    expect(url).toBe('https://gateway.ai.cloudflare.com/v1/account-id/orient-chat/openai/chat/completions');
    expect(new Headers(init?.headers).get('cf-aig-authorization')).toBe('Bearer gateway-token');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: 'gpt-5-mini-2025-08-07', store: false, max_completion_tokens: 500 });
    expect(body.messages[1].content).toContain('営業時間は午前9時から午後6時までです。');
  });

  it('preserves the gateway status without exposing provider response text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { type: 'spend_limit_exceeded', message: 'sensitive upstream detail' },
    }), { status: 429, headers: { 'Content-Type': 'application/json' } }));

    await expect(generateGroundedAnswer(env, '質問', chunks, 'system prompt'))
      .rejects.toEqual(expect.objectContaining<Partial<AiGatewayError>>({ status: 429, message: 'spend_limit_exceeded' }));
  });
});
