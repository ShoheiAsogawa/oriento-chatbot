PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  password_iterations INTEGER,
  password_set_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry
  ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_password_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('setup', 'reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_password_tokens_lookup
  ON admin_password_tokens(token_hash, expires_at);

INSERT OR IGNORE INTO admin_users (id, email)
VALUES ('admin-s-asogawa', 's_asogawa@amalink.co.jp');

CREATE TABLE IF NOT EXISTS managed_property_inventory (
  source_url TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('properties_for_sale', 'properties_for_rent')),
  title TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  line_station TEXT NOT NULL DEFAULT '',
  price_or_rent TEXT NOT NULL DEFAULT '',
  management_fee TEXT NOT NULL DEFAULT '',
  layout TEXT NOT NULL DEFAULT '',
  building_type TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_managed_property_inventory_category
  ON managed_property_inventory(category, updated_at DESC);
