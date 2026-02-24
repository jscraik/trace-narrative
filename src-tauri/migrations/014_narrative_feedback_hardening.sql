PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_narrative_feedback_repo_type_role
  ON narrative_feedback_events(repo_id, feedback_type, actor_role);

CREATE TABLE IF NOT EXISTS narrative_calibration_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_narrative_calibration_audit_repo_created
  ON narrative_calibration_audit_events(repo_id, created_at);
