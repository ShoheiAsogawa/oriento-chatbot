import { describe, expect, it, vi } from 'vitest';
import { buildSearchMessages, loadConversationContext } from '../src/conversation-context';

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

    expect(bind).toHaveBeenCalledWith('conversation-a', 10);
    expect(prepare.mock.calls[0]?.[0]).toContain('WHERE conversation_id = ?');
    expect(history).toEqual([
      { role: 'user', content: 'この物件の価格は？' },
      { role: 'assistant', content: '価格は5,899万円ですにゃん。' },
    ]);
  });

  it('uses only recent history for conversational search', () => {
    const history = Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `message-${index}`,
    }));

    expect(buildSearchMessages(history, 'その物件の間取りは？')).toEqual([{ role: 'user', content: [
      'これまでの会話:',
      '利用者: message-0',
      '案内: message-1',
      '利用者: message-2',
      '案内: message-3',
      '利用者: message-4',
      '案内: message-5',
      '現在の質問: その物件の間取りは？',
    ].join('\n') }]);
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
