PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS chat_turn_requests (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  client_turn_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'abandoned')),
  response_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, client_turn_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_turn_processing_conversation
  ON chat_turn_requests(conversation_id)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_chat_turn_requests_updated
  ON chat_turn_requests(status, updated_at);
