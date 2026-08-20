ALTER TABLE conversations ADD COLUMN visitor_gender TEXT
  CHECK (visitor_gender IS NULL OR visitor_gender IN ('male', 'female'));

ALTER TABLE conversations ADD COLUMN visitor_age_decade TEXT
  CHECK (visitor_age_decade IS NULL OR visitor_age_decade IN ('teens', '20s', '30s', '40s', '50s', '60s_plus'));

CREATE INDEX IF NOT EXISTS idx_conversations_demographics
  ON conversations(created_at, visitor_gender, visitor_age_decade);
