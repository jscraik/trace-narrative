---
title: "Narrative Truth Loop Phase 1 SQLite Decision Gate"
date: 2026-02-24
status: approved
---

# Narrative Truth Loop Phase 1 SQLite Decision Gate

## Table of Contents
- [Decision](#decision)
- [Migration Verification](#migration-verification)
- [Persistence Hardening Verification](#persistence-hardening-verification)
- [Index and Query-Plan Verification](#index-and-query-plan-verification)
- [Write-Path Contention Controls](#write-path-contention-controls)
- [Enablement Gate Outcome](#enablement-gate-outcome)

## Decision
- Canonical persistence for v1 is **SQLite (`sqlite:narrative.db`)**.
- `.narrative/meta` remains out-of-scope for canonical writes in v1.

## Migration Verification
- Added migration: `src-tauri/migrations/013_narrative_feedback.sql`
- Added migration: `src-tauri/migrations/014_narrative_feedback_hardening.sql`
- Registered migration version 13 in: `src-tauri/src/lib.rs`
- Registered migration version 14 in: `src-tauri/src/lib.rs`
- Rust compile validation run:
  - `cargo test --manifest-path src-tauri/Cargo.toml --no-run` ✅

## Persistence Hardening Verification
- DB hardening PRAGMAs are applied at connection open in `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/db.ts`:
  - `foreign_keys = ON`
  - `journal_mode = WAL`
  - `synchronous = NORMAL`
  - `busy_timeout = 5000`
  - `trusted_schema = OFF`
- Immutable audit stream added via `narrative_calibration_audit_events` table and append-only insert path in `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts`.
- Validation run:
  - `pnpm exec vitest run src/core/repo/__tests__/narrativeFeedback.test.ts` ✅

## Index and Query-Plan Verification
Validation method: apply `001_init.sql` + `013_narrative_feedback.sql` + `014_narrative_feedback_hardening.sql` to an ephemeral SQLite database and run `EXPLAIN QUERY PLAN` for target read paths.

### Verified query plans
1. Trend window query
```sql
EXPLAIN QUERY PLAN
SELECT *
FROM narrative_feedback_events
WHERE repo_id = 1
ORDER BY created_at DESC
LIMIT 20;
```
Result:
- `SEARCH narrative_feedback_events USING INDEX idx_narrative_feedback_repo_created (repo_id=?)`

2. Target aggregation query
```sql
EXPLAIN QUERY PLAN
SELECT target_id, COUNT(*)
FROM narrative_feedback_events
WHERE repo_id = 1
  AND target_id IS NOT NULL
GROUP BY target_id;
```
Result:
- `SEARCH narrative_feedback_events USING COVERING INDEX idx_narrative_feedback_repo_target_type (repo_id=? AND target_id>?)`

3. Windowed totals query
```sql
EXPLAIN QUERY PLAN
SELECT
  SUM(CASE WHEN feedback_type = "branch_missing_decision" THEN 1 ELSE 0 END) AS missing_count,
  COUNT(*) AS total_count,
  SUM(CASE WHEN feedback_type = "highlight_key" THEN 1 ELSE 0 END) AS key_count,
  SUM(CASE WHEN feedback_type = "highlight_wrong" THEN 1 ELSE 0 END) AS wrong_count
FROM narrative_feedback_events
WHERE repo_id = 1
  AND created_at >= "2026-01-25T12:00:00.000Z";
```
Result:
- `SEARCH narrative_feedback_events USING INDEX idx_narrative_feedback_repo_created (repo_id=? AND created_at>?)`

4. Feedback-type + actor-role filter query
```sql
EXPLAIN QUERY PLAN
SELECT COUNT(*)
FROM narrative_feedback_events
WHERE repo_id = 1
  AND feedback_type = "highlight_key"
  AND actor_role = "reviewer";
```
Result:
- `SEARCH narrative_feedback_events USING COVERING INDEX idx_narrative_feedback_repo_type_role (repo_id=? AND feedback_type=? AND actor_role=?)`

5. Audit stream read query
```sql
EXPLAIN QUERY PLAN
SELECT event_type, created_at
FROM narrative_calibration_audit_events
WHERE repo_id = 1
ORDER BY created_at DESC
LIMIT 20;
```
Result:
- `SEARCH narrative_calibration_audit_events USING INDEX idx_narrative_calibration_audit_repo_created (repo_id=?)`

## Write-Path Contention Controls
- Retry contract: max 2 retries with exponential backoff + bounded jitter in `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts`.
- Idempotency policy now includes `detailLevel` in key derivation to avoid semantic collisions.
- Duplicate submissions no longer force profile recomputation; path reuses stored profile when available.
- Validation run:
  - `pnpm exec vitest run src/core/repo/__tests__/narrativeFeedback.test.ts` ✅

## Enablement Gate Outcome
- [x] SQLite schema migration created and wired.
- [x] Required indexes created.
- [x] Query plans confirm index usage for core read paths.
- [x] Persistence hardening controls applied (PRAGMAs + audit table + append-only audit writes).
- [x] Duplicate-write path avoids unnecessary recomputation under contention.
- [x] Safe to enable calibration logic behind feature flag path.
