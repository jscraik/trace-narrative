PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS narrative_feedback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  branch_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT,
  detail_level TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(repo_id, idempotency_key),
  FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_narrative_feedback_repo_created
  ON narrative_feedback_events(repo_id, created_at);

CREATE INDEX IF NOT EXISTS idx_narrative_feedback_repo_target_type
  ON narrative_feedback_events(repo_id, target_id, feedback_type);

CREATE TABLE IF NOT EXISTS narrative_calibration_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL UNIQUE,
  ranking_bias REAL NOT NULL DEFAULT 0,
  confidence_offset REAL NOT NULL DEFAULT 0,
  confidence_scale REAL NOT NULL DEFAULT 1,
  sample_count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT,
  window_end TEXT,
  actor_weight_policy_version TEXT NOT NULL DEFAULT 'v1',
  branch_missing_decision_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
);
