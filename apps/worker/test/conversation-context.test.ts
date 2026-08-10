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

    expect(bind).toHaveBeenCalledWith('conversation-a', 6);
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

    expect(buildSearchMessages(history, 'その物件の間取りは？')).toEqual([
      { role: 'user', content: 'message-2' },
      { role: 'assistant', content: 'message-3' },
      { role: 'user', content: 'message-4' },
      { role: 'assistant', content: 'message-5' },
      { role: 'user', content: 'その物件の間取りは？' },
    ]);
  });
});
