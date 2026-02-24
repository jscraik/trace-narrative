-- Migration 015: bounded live Codex stream session persistence

CREATE TABLE IF NOT EXISTS live_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'failed')),
  payload TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_identity
  ON live_sessions(thread_id, turn_id, item_id, event_type);

CREATE INDEX IF NOT EXISTS idx_live_sessions_last_activity
  ON live_sessions(last_activity_at);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status
  ON live_sessions(status);
