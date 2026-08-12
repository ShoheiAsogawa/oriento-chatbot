import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiGatewayError, generateGroundedAnswer } from '../src/openai';
import type { SearchChunk } from '../src/types';

const env = {
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  AI_GATEWAY_ID: 'orient-chat',
  AI_GATEWAY_TOKEN: 'gateway-token',
  GENERATION_MODEL: 'gpt-5.4-nano',
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
      model: 'gpt-5.4-nano',
      choices: [{ message: { content: '営業時間は9時から18時までです。[1]' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await generateGroundedAnswer(env, '営業時間は？', chunks, 'system prompt', [
      { role: 'user', content: '大阪市の物件を探しています' },
      { role: 'assistant', content: 'ご希望の地域を教えてくださいにゃん。' },
    ]);

    expect(result.answer).toContain('[1]');
    expect(fetchMock).toHaveBeenCalledOnce();
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall!;
    expect(url).toBe('https://gateway.ai.cloudflare.com/v1/account-id/orient-chat/openai/chat/completions');
    expect(new Headers(init?.headers).get('cf-aig-authorization')).toBe('Bearer gateway-token');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: 'gpt-5.4-nano', store: false, reasoning_effort: 'none', max_completion_tokens: 280 });
    expect(body.messages[1]).toEqual({ role: 'user', content: '大阪市の物件を探しています' });
    expect(body.messages[2]).toEqual({ role: 'assistant', content: 'ご希望の地域を教えてくださいにゃん。' });
    expect(body.messages[3].content).toContain('直前の会話履歴は同じ訪問者との時系列の会話です。');
    expect(body.messages[3].content).toContain('営業時間は午前9時から午後6時までです。');
  });

  it('bounds the history sent to the generation model while retaining the newest turns', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '回答です。[1]' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `history-${index}`,
    }));

    await generateGroundedAnswer(env, '質問', chunks, 'system prompt', history);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.messages).toHaveLength(10);
    expect(body.messages[1].content).toBe('history-4');
    expect(body.messages[8].content).toBe('history-11');
  });

  it('preserves the gateway status without exposing provider response text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { type: 'spend_limit_exceeded', message: 'sensitive upstream detail' },
    }), { status: 429, headers: { 'Content-Type': 'application/json' } }));

    await expect(generateGroundedAnswer(env, '質問', chunks, 'system prompt'))
      .rejects.toEqual(expect.objectContaining<Partial<AiGatewayError>>({ status: 429, message: 'spend_limit_exceeded' }));
  });
});
