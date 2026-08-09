PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  visitor_hash TEXT NOT NULL,
  source_page TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  operational_consent INTEGER NOT NULL DEFAULT 1,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content_redacted TEXT NOT NULL,
  model TEXT,
  latency_ms INTEGER,
  policy_action TEXT NOT NULL DEFAULT 'allow',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS citations (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  source_title TEXT,
  source_url TEXT,
  score REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name_enc TEXT,
  email_enc TEXT,
  phone_enc TEXT,
  email_hash TEXT,
  phone_hash TEXT,
  email_last4 TEXT,
  phone_last4 TEXT,
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_hash
  ON customers(email_hash) WHERE email_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_hash
  ON customers(phone_hash) WHERE phone_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversation_customers (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, customer_id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating IN (-1, 1)),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  ledger_id TEXT NOT NULL,
  ledger_sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  subject_type TEXT,
  subject_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  previous_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_ledger_sequence
  ON audit_events(ledger_id, ledger_sequence);

CREATE TABLE IF NOT EXISTS usage_counters (
  day TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('chat_sessions', 'ai_requests')),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, metric)
);

INSERT OR IGNORE INTO settings(key, value_json) VALUES
  ('answer_policy', '{"domain":"不動産・住まい・物件・家づくり・店舗案内・問い合わせ方法","refuse_price_negotiation":true,"refuse_legal_judgment":true,"refuse_important_matters":true,"min_retrieval_score":0.48}'),
  ('retention', '{"conversation_days":365,"customer_days":1095}'),
  ('appearance', '{"primary":"#ff680b","ink":"#29293a","muted":"#74757f"}'),
  ('escalation', '{"line_url":"","contact_url":"https://orijyu.com/contact/"}');
