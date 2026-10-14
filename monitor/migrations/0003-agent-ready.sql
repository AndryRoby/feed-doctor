-- Optional Agent Ready. Apply only after review; feature is off by default.
-- No product contents or email copies. Stable monitor ID and week key.
CREATE TABLE IF NOT EXISTS agent_ready_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_ready_settings (
  monitor_id TEXT PRIMARY KEY,
  store_url TEXT NOT NULL,
  product_url TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_ready_reports (
  monitor_id TEXT NOT NULL,
  week TEXT NOT NULL,
  revision INTEGER NOT NULL,
  token TEXT NOT NULL,
  lease_until TEXT NOT NULL,
  status TEXT NOT NULL,
  report_json TEXT,
  error TEXT,
  PRIMARY KEY (monitor_id, week)
);
CREATE TRIGGER IF NOT EXISTS agent_ready_delete AFTER DELETE ON monitors BEGIN
  DELETE FROM agent_ready_settings WHERE monitor_id = OLD.id;
  DELETE FROM agent_ready_reports WHERE monitor_id = OLD.id;
END;
