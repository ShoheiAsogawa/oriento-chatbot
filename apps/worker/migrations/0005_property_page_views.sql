CREATE TABLE IF NOT EXISTS property_page_views (
  day TEXT NOT NULL,
  source_url TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (day, source_url, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_property_page_views_recent
  ON property_page_views(day DESC, source_url);
