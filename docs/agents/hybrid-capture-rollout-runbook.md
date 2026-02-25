# Hybrid Capture Reliability Release runbook

## Table of Contents

- [Purpose](#purpose)
- [Scope](#scope)
- [Capture Modes](#capture-modes)
- [Go / No-Go Thresholds](#go--no-go-thresholds)
- [Release Phases](#release-phases)
- [Command Compatibility Matrix (2026-02-25)](#command-compatibility-matrix-2026-02-25)
- [Sidecar Supply-Chain Controls](#sidecar-supply-chain-controls)
- [Signer Rotation and Revocation Policy](#signer-rotation-and-revocation-policy)
- [Emergency OTEL-Only Fallback](#emergency-otel-only-fallback)
- [Recovery Back to Hybrid](#recovery-back-to-hybrid)
- [Migration Operations](#migration-operations)
- [Verification Checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)

## Purpose

Provide a deterministic, operator-friendly release process for hybrid Codex+Claude capture reliability.

## Scope

This runbook covers:

- canonical collector migration (`~/.agents/otel-collector`)
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

## Command Compatibility Matrix (2026-02-25)

| Surface | Previous command | Current command / behavior | Migration status |
| --- | --- | --- | --- |
| Auth mutation (renderer) | `codex_app_server_account_login_completed` | Removed from invoke surface. Sidecar notifications (`account/login/completed`) are authoritative. | ✅ Complete |
| Auth mutation (renderer) | `codex_app_server_account_updated` | Removed from invoke surface. Sidecar notifications (`account/updated`) are authoritative. | ✅ Complete |
| Stream mutation (renderer) | `codex_app_server_set_stream_health` | Removed from invoke surface. Runtime health is derived from protocol + telemetry. | ✅ Complete |
| Event injection (renderer) | `ingest_codex_stream_event` | Removed from invoke surface. Sidecar stdout JSON-RPC is the only live-event ingress. | ✅ Complete |
| Event injection (renderer) | `codex_app_server_receive_live_event` | Removed from invoke surface. Live events are backend-internal only. | ✅ Complete |
| Approval decision | `codex_app_server_submit_approval(requestId, approved, reason?)` | `codex_app_server_submit_approval(requestId, threadId, decisionToken, approved, reason?)` | ✅ Complete |
| Thread snapshot | local stub response | protocol-backed `thread/read` request with RPC correlation/timeout handling | ✅ Complete |

## Sidecar Supply-Chain Controls

- Sidecar binaries are pinned in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/bin/` and validated against `/Users/jamiecraik/dev/firefly-narrative/src-tauri/bin/codex-app-server-manifest.json`.
- Verification command (required in CI/build):  
  `node scripts/verify-codex-sidecar-manifest.mjs --manifest src-tauri/bin/codex-app-server-manifest.json --require-signature --require-checksum --enforce-min-version`
- Production runtime policy:
  - ignores `NARRATIVE_CODEX_APP_SERVER_BIN` overrides;
  - requires manifest validation (schema, anti-rollback version floor, signer trust, checksum);
  - fails sidecar startup if trust checks fail.
- Development policy:
  - allows `NARRATIVE_CODEX_APP_SERVER_BIN` override for local testing only.

## Signer Rotation and Revocation Policy

- **Trusted signer set:** `narrative-codex-sidecar-2026q1`, `narrative-codex-sidecar-2026q2`.
- **Revoked signer set:** `narrative-codex-sidecar-2025q4`.
- Rotation workflow:
  1. Add new signer ID to trusted set.
  2. Generate new manifest signature with new signer ID.
  3. Update CI gate to require signature/checksum pass.
  4. Promote rollout only after canary pass.
- Emergency revocation workflow:
  1. Add compromised signer to revoked set.
  2. Re-sign manifest with healthy signer.
  3. Ship hotfix; production runtime rejects revoked signer immediately.

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
   - `codex_app_server_account_login_start(auth_mode="chatgpt")`
   - wait for sidecar `account/login/completed` + `account/updated` notifications
   - optionally verify with `codex_app_server_account_read`
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
- Operator note: do not pre-create collector directories manually. Narrative creates and manages the canonical root during configure/migration.

## Verification Checklist

- [ ] Migration status resolved (`migrated` or `deferred`)
- [ ] Capture mode visible in UI and in command output
- [ ] OTEL fallback works when stream is disabled
- [ ] Crash-loop degrades safely without data-loss escalation
- [ ] Stream duplicate-resolution decisions are logged and visible
- [ ] `session:live:event` observed for SessionDelta/ApprovalRequest/ApprovalResult/ParserValidationError paths
- [ ] No UI path can call removed stream/auth mutation commands (`set_stream_health`, `ingest_codex_stream_event`, `codex_app_server_receive_live_event`)
- [ ] `live_sessions` retention policy verified (TTL + MAX_ROWS bounded cleanup)

## Troubleshooting

- **Symptom:** `Capture reliability check failed`
  - Verify tauri command wiring and restart app.
- **Symptom:** `Unsupported auth mode`
  - Ensure `appServerAuthMode` is `chatgpt`.
- **Symptom:** perpetual `DEGRADED_STREAMING`
  - Check sidecar binary presence and permissions, then re-run handshake/auth.
