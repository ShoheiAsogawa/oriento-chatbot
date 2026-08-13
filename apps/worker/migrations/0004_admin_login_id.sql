ALTER TABLE admin_users ADD COLUMN login_id TEXT COLLATE NOCASE;

UPDATE admin_users
SET login_id = 's_asogawa'
WHERE id = 'admin-s-asogawa';

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_login_id
  ON admin_users(login_id COLLATE NOCASE)
  WHERE login_id IS NOT NULL;

DROP TABLE IF EXISTS admin_password_tokens;
