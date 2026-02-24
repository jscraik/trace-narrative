# Hybrid Capture Reliability Release runbook

## Table of Contents

- [Purpose](#purpose)
- [Scope](#scope)
- [Capture Modes](#capture-modes)
- [Go / No-Go Thresholds](#go--no-go-thresholds)
- [Release Phases](#release-phases)
- [Emergency OTEL-Only Fallback](#emergency-otel-only-fallback)
- [Recovery Back to Hybrid](#recovery-back-to-hybrid)
- [Migration Operations](#migration-operations)
- [Verification Checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)

## Purpose

Provide a deterministic, operator-friendly release process for hybrid Codex+Claude capture reliability.

## Scope

This runbook covers:

- canonical collector migration (`~/.agents/otel/collector`)
- Codex App Server streaming enrichment
- crash-loop safeguards and OTEL-only fallback
- recovery criteria for re-enabling hybrid mode

## Capture Modes

- `OTEL_ONLY`: baseline ingestion only (safe fallback mode)
- `HYBRID_ACTIVE`: OTEL baseline + Codex stream enrichment healthy
- `DEGRADED_STREAMING`: OTEL healthy, streaming unavailable
- `FAILURE`: OTEL and streaming unavailable

## Go / No-Go Thresholds

Use these gates before widening release:

- No-Go if `FAILURE` appears for any validation repo.
- No-Go if migration command returns `failed`.
- No-Go if stream crash-loop state (`crash_loop`) appears.
- Go only when:
  - capture mode stabilizes at `HYBRID_ACTIVE` or `OTEL_ONLY`
  - migration status is `migrated` or `deferred` (never unknown/failed)
  - duplicate handling remains deterministic (no ambiguous source state)

## Release Phases

1. **Phase A (internal validation)**
   - Keep stream enrichment enabled for internal repos only.
   - Run migration dry-run and actual migration checks.
2. **Phase B (limited beta)**
   - Enable hybrid for selected users.
   - Track `DEGRADED_STREAMING` and crash-loop signals.
3. **Phase C (broader release)**
   - Expand after stable behavior in Phase B and zero `FAILURE` events.

## Emergency OTEL-Only Fallback

When to trigger:

- app server crash-loop
- auth-mode mismatch (`chatgpt` required in v1)
- repeated stream instability

Immediate actions:

1. Disable stream enrichment via kill switch:
   - invoke `codex_app_server_set_stream_kill_switch` with `enabled=true`
2. Stop sidecar:
   - invoke `stop_codex_app_server`
3. Keep OTEL baseline running:
   - ensure `autoIngestEnabled=true`
4. Confirm mode:
   - invoke `get_capture_reliability_status`
   - expected mode: `OTEL_ONLY` or `DEGRADED_STREAMING` (never `FAILURE`)

## Recovery Back to Hybrid

Only recover when all are true:

- migration status healthy (`migrated` or valid `deferred`)
- auth mode confirmed as `chatgpt`
- no crash-loop in recent restart window

Recovery sequence:

1. Set stream kill-switch to false.
2. Start sidecar (`start_codex_app_server`).
3. Run handshake in order:
   - `codex_app_server_initialize`
   - `codex_app_server_initialized`
4. Complete auth state:
   - `codex_app_server_account_login_start`
   - `codex_app_server_account_login_completed(success=true)`
   - `codex_app_server_account_updated(auth_mode="chatgpt", authenticated=true)`
5. Re-check reliability mode.
6. Validate event-driven stream lifecycle:
   - listen for `session:live:event`
   - verify at least one `SessionDelta` frame after handshake/auth
   - verify approval request/result round-trip emits `ApprovalRequest` then `ApprovalResult`

## Migration Operations

- Check status: `get_collector_migration_status`
- Preview migration: `run_collector_migration(dry_run=true)`
- Execute migration: `run_collector_migration(dry_run=false)`
- Roll back from backup: `rollback_collector_migration`

## Verification Checklist

- [ ] Migration status resolved (`migrated` or `deferred`)
- [ ] Capture mode visible in UI and in command output
- [ ] OTEL fallback works when stream is disabled
- [ ] Crash-loop degrades safely without data-loss escalation
- [ ] Stream duplicate-resolution decisions are logged and visible
- [ ] `session:live:event` observed for SessionDelta/ApprovalRequest/ApprovalResult/ParserValidationError paths
- [ ] No UI path writes stream health directly; deprecated mutation commands return `command-not-exposed`
- [ ] `live_sessions` retention policy verified (TTL + MAX_ROWS bounded cleanup)

## Troubleshooting

- **Symptom:** `Capture reliability check failed`
  - Verify tauri command wiring and restart app.
- **Symptom:** `Unsupported auth mode`
  - Ensure `appServerAuthMode` is `chatgpt`.
- **Symptom:** perpetual `DEGRADED_STREAMING`
  - Check sidecar binary presence and permissions, then re-run handshake/auth.
