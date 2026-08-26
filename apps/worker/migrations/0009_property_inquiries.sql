CREATE TABLE IF NOT EXISTS property_inquiries (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('document_request', 'phone', 'viewing')),
  contact_name_enc TEXT,
  address_enc TEXT,
  preferred_datetime TEXT,
  property_summary TEXT,
  notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('collecting', 'pending', 'processing', 'sent', 'failed')),
  notification_attempts INTEGER NOT NULL DEFAULT 0,
  notification_last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_inquiries_status
  ON property_inquiries(notification_status, created_at);

CREATE INDEX IF NOT EXISTS idx_property_inquiries_conversation
  ON property_inquiries(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_property_inquiries_customer
  ON property_inquiries(customer_id, created_at);
