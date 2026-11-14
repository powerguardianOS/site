-- EU-1: the site's key-value store in D1 (database created with jurisdiction "eu"). app/lib/kv.ts is the only reader.
-- expires_at: unix seconds (like Workers KV "expiration"), NULL = never. Idempotent: safe to apply twice.
CREATE TABLE IF NOT EXISTS kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS kv_expires_at ON kv (expires_at) WHERE expires_at IS NOT NULL;
