-- Migration: Approval Ledger
--
-- Purpose:
--   - Persist approval decisions with idempotency, fingerprints, and uniqueness constraints
--   - Support conflict semantics for same-key/different-fingerprint attempts
--   - Track TTL for tombstones for approval lifecycle
--   - Enable corruption detection and recovery flows

PRAGMA foreign_keys = ON;

-- The approval_decisions table stores durable records of approval decisions
-- thread_id identifies which thread for the approval request
-- request_id: unique identifier for the approval request (from ApprovalRequest.event.payload.requestId)
-- request_fingerprint: canonical JSON fingerprint of the original request payload (for idempotency)
-- decided_at: when the decision was made
-- approved: boolean indicating approval (true) or rejection (false)
-- ttl_days: time in days until the approval expires
-- tombstone: soft-delete marker for expired entries
-- schema_version: version for future migrations

CREATE TABLE IF NOT EXISTS trust_approval_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    thread_id TEXT NOT NULL,
    request_id TEXT NOT NULL UNIQUE,
    request_fingerprint TEXT NOT NULL,
    decided_at TEXT NOT NULL,
    approved INTEGER NOT NULL CHECK(approved IN (0, 1)),
    ttl_days INTEGER NOT NULL DEFAULT 30,
    tombstone INTEGER NOT NULL default 0 check(tombstone in (0, 1)),
    schema_version INTEGER NOT NULL DEFAULT 1
);

-- Index for fast lookups by request_id
CREATE INDEX IF NOT EXISTS idx_approval_decisions_request_id ON trust_approval_decisions(request_id);

-- Index for tombstone cleanup queries
create index IF NOT EXISTS idx_approval_decisions_tombstone_decided_at ON trust_approval_decisions(tombstone, decided_at);

-- Version marker
INSERT OR IGNORE INTO trust_schema_versions (component, version) VALUES ('approval_ledger', 1);
