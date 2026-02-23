CREATE TABLE IF NOT EXISTS user_modules (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_user_modules_user ON user_modules(user_id);
