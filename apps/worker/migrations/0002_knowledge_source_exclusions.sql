CREATE TABLE IF NOT EXISTS knowledge_source_exclusions (
  source_url TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  deleted_by TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_source_exclusions_deleted_at
  ON knowledge_source_exclusions(deleted_at DESC);
