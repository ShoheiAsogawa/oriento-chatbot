export type ConversationContextMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const HISTORY_MESSAGE_LIMIT = 6;
const HISTORY_MESSAGE_CHAR_LIMIT = 500;

type StoredMessage = {
  role: 'user' | 'assistant';
  content_redacted: string;
};

function sanitizeHistoryContent(content: string) {
  return content
    .replace(/\s*(?:\[\d+\]|【\d+】)/gu, '')
    .trim()
    .slice(0, HISTORY_MESSAGE_CHAR_LIMIT);
}

export async function loadConversationContext(
  database: D1Database,
  conversationId: string,
): Promise<ConversationContextMessage[]> {
  const result = await database.prepare(`
    SELECT role, content_redacted
    FROM messages
    WHERE conversation_id = ?
      AND role IN ('user', 'assistant')
      AND policy_action = 'allow'
    ORDER BY rowid DESC
    LIMIT ?
  `).bind(conversationId, HISTORY_MESSAGE_LIMIT).all<StoredMessage>();

  return (result.results || [])
    .reverse()
    .map((message) => ({
      role: message.role,
      content: sanitizeHistoryContent(message.content_redacted),
    }))
    .filter((message) => message.content.length > 0);
}

export function buildSearchMessages(
  history: ConversationContextMessage[],
  currentMessage: string,
): AiSearchMessage[] {
  return [
    ...history.slice(-4),
    { role: 'user', content: currentMessage } as const,
  ];
}
