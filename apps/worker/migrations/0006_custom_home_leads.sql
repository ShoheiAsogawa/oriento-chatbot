CREATE TABLE IF NOT EXISTS custom_home_leads (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  contact_name_enc TEXT,
  intake_enc TEXT NOT NULL,
  notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('collecting', 'pending', 'processing', 'sent', 'failed')),
  notification_attempts INTEGER NOT NULL DEFAULT 0,
  notification_last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_custom_home_leads_status
  ON custom_home_leads(notification_status, created_at);

CREATE INDEX IF NOT EXISTS idx_custom_home_leads_customer
  ON custom_home_leads(customer_id, created_at);
