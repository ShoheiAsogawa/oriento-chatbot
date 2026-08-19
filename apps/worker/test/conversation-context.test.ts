import { describe, expect, it, vi } from 'vitest';
import {
  buildSearchMessages,
  INTAKE_HISTORY_MESSAGE_LIMIT,
  loadConversationContext,
} from '../src/conversation-context';

describe('conversation context', () => {
  it('loads only the requested conversation and returns chronological redacted history', async () => {
    const all = vi.fn().mockResolvedValue({
      results: [
        { role: 'assistant', content_redacted: '価格は5,899万円ですにゃん。[1]' },
        { role: 'user', content_redacted: 'この物件の価格は？' },
      ],
    });
    const bind = vi.fn().mockReturnValue({ all });
    const prepare = vi.fn().mockReturnValue({ bind });

    const history = await loadConversationContext(
      { prepare } as unknown as D1Database,
      'conversation-a',
    );

    expect(bind).toHaveBeenCalledWith('conversation-a', 16);
    expect(prepare.mock.calls[0]?.[0]).toContain('WHERE conversation_id = ?');
    expect(history).toEqual([
      { role: 'user', content: 'この物件の価格は？' },
      { role: 'assistant', content: '価格は5,899万円ですにゃん。' },
    ]);
  });

  it('allows the bounded intake window required by a full custom-home consultation', async () => {
    const all = vi.fn().mockResolvedValue({ results: [] });
    const bind = vi.fn().mockReturnValue({ all });
    const prepare = vi.fn().mockReturnValue({ bind });

    await loadConversationContext(
      { prepare } as unknown as D1Database,
      'conversation-custom-home',
      INTAKE_HISTORY_MESSAGE_LIMIT,
    );

    expect(bind).toHaveBeenCalledWith('conversation-custom-home', 48);
  });

  it('uses the latest three turns for conversational search', () => {
    const history = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `message-${index}`,
    }));

    const [query] = buildSearchMessages(history, 'その物件の間取りは？');
    expect(query?.role).toBe('user');
    expect(query?.content).not.toContain('message-1');
    expect(query?.content).toContain('message-2');
    expect(query?.content).toContain('message-7');
    expect(query?.content).toContain('その物件の間取りは？');
  });

  it('builds a concise rental search query from visitor criteria only', () => {
    const history = [
      { role: 'user' as const, content: '一人暮らししたい' },
      { role: 'assistant' as const, content: '住みたい地域を教えてにゃん。' },
      { role: 'user' as const, content: '大阪市がいい' },
      { role: 'assistant' as const, content: '家賃上限を教えてにゃん。' },
      { role: 'user' as const, content: '家賃5万円まで' },
    ];

    expect(buildSearchMessages(history, '1Kで駅徒歩10分以内', true)).toEqual([{
      role: 'user',
      content: '賃貸物件 希望条件: 一人暮らししたい / 大阪市がいい / 家賃5万円まで / 1Kで駅徒歩10分以内',
    }]);
  });
});
