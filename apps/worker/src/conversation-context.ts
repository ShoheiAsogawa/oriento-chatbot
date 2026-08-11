export type ConversationContextMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// Three short turns are enough to resolve pronouns and keep the search/LLM payload small.
const HISTORY_MESSAGE_LIMIT = 6;
const HISTORY_MESSAGE_CHAR_LIMIT = 300;

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
  rentalOnly = false,
): AiSearchMessage[] {
  return [{
    role: 'user',
    content: buildContextualQuestion(history, currentMessage, rentalOnly),
  }];
}

export function buildContextualQuestion(
  history: ConversationContextMessage[],
  currentMessage: string,
  rentalOnly = false,
) {
  if (rentalOnly) {
    const userCriteria = [
      ...history.filter((message) => message.role === 'user').map((message) => message.content),
      currentMessage,
    ].slice(-4);
    return `賃貸物件 希望条件: ${userCriteria.join(' / ')}`;
  }
  const transcript = history.slice(-4).map((message) => {
    const speaker = message.role === 'user' ? '利用者' : '案内';
    return `${speaker}: ${message.content}`;
  }).join('\n');
  if (!transcript) return currentMessage;
  return `これまでの会話:\n${transcript}\n現在の質問: ${currentMessage}`;
}
