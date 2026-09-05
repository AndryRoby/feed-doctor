-- 0001.sql
-- Initial schema for feed-monitor (Feed Doctor Monitor). Apply with:
--   wrangler d1 migrations apply feedmonitor --remote
--   wrangler d1 migrations apply feedmonitor --local   (for `wrangler dev`)
--
-- Two tables only. Feed content itself is never stored: checks keeps score
-- and per-rule counts (top_issues_json), never the feed body or per-product
-- data, matching the honest-copy promise in the product UI.

CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_confirmed INTEGER NOT NULL DEFAULT 0,
  feed_url TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'pending_confirmation', -- pending_confirmation | active
  manage_key TEXT NOT NULL,
  confirm_token TEXT NOT NULL,
  billing_ref TEXT,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  last_check_at TEXT,
  next_check_at TEXT,
  last_manual_check_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitors_email ON monitors (email);

-- Checks: one row per fetch attempt (successful or failed). Never stores
-- feed content or per-product data, only aggregate counts and a small list
-- of {rule, severity, count} for the top offending rules.
CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL,
  at TEXT NOT NULL,
  status TEXT NOT NULL, -- 'ok' | 'fetch_failed'
  score INTEGER,
  errors INTEGER NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0,
  infos INTEGER NOT NULL DEFAULT 0,
  top_issues_json TEXT,
  fetch_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_checks_monitor_at ON checks (monitor_id, at);
