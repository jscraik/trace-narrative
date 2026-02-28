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
- [Staged Canary Promotion Policy](#staged-canary-promotion-policy)
- [Automatic Rollback Threshold Matrix](#automatic-rollback-threshold-matrix)
- [Canary Artifact Contract](#canary-artifact-contract)
- [Release Gate Artifact Pack (CP5)](#release-gate-artifact-pack-cp5)
- [Post-Deploy Monitoring & Validation](#post-deploy-monitoring--validation)
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

- Sidecar binaries are pinned in `src-tauri/bin/` and validated against `src-tauri/bin/codex-app-server-manifest.json`.
- Current pinned artifact source: `openai/codex` stable release `rust-v0.105.0` (Codex CLI binaries). Runtime launches these artifacts with the `app-server` subcommand.
- Supported sidecar packaging scope for this release: macOS + Linux targets only (no Windows bundle target in scope).
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

## Staged Canary Promotion Policy

- Promotion path is fixed and automated:
  1. **5% cohort for 24h**
  2. **25% cohort for 24h**
  3. **100% rollout**
- Promotion preconditions:
  - all CP0.5 trust checks are green;
  - canary artifacts pass `pnpm tauri:verify-rollout-artifacts`;
  - no rollback triggers are active.
- Cohort assignment uses deterministic stable-hash routing (`install/device ID`):
  - hash `0–4` => 5%
  - hash `0–24` => 25%
  - hash `0–99` => 100%

## Automatic Rollback Threshold Matrix

Auto-halt and rollback are mandatory when any threshold is breached in the 24h canary window:

| Signal | Threshold | Action |
| --- | --- | --- |
| `handshake_p99_ms` | `> 5000` | Halt promotion + rollback to prior cohort |
| `pending_timeout_rate` | `> 0.005` | Halt promotion + rollback |
| `auth_failure_rate` | `> 0.01` | Halt promotion + rollback |
| `crash_loop_count` | `> 0` | Immediate rollback and disable stream enrichment |

Owner/on-call and rollback authority: **Jamie Craik**.

## Canary Artifact Contract

Generated by:

- `pnpm tauri:generate-rollout-artifacts`
- `pnpm tauri:verify-rollout-artifacts`

Required files (all under `artifacts/release/codex-app-server/`):

- `canary-5p.json`
- `canary-25p.json`
- `os-arch-smoke.json`

Contract requirements:

- each artifact contains `owner` (must be non-empty);
- canary artifacts include rollback fields (`rollback_recommended`, `rollback_reasons`);
- OS/arch artifact must report `supported_arch_smoke_pass=true` and `wrong_arch_failures=0`.

## Release Gate Artifact Pack (CP5)

Generated by:

- `pnpm tauri:generate-release-artifacts`
- `pnpm tauri:verify-release-artifacts`

Required files:

- `artifacts/release/codex-app-server/soak-100p.json`
- `artifacts/release/codex-app-server/telemetry-readiness.json`

Hard gate checks:

- `soak-100p.json`:
  - `window_hours >= 168`
  - `handshake_p99_ms <= 5000`
  - `pending_timeout_rate <= 0.005`
  - `parser_error_rate <= 0.001`
  - `event_lag_p95_ms <= 250`
- `telemetry-readiness.json`:
  - `dashboards_live=true`
  - non-empty `alerts_routed_owner`
  - `sli_definitions.length >= 6`

## Post-Deploy Monitoring & Validation

- **Logs/search terms**
  - `codex_app_server status.state:(degraded OR crash_loop)`
  - `codex_app_server parse_error_total:*`
  - `codex_app_server rpc_timeout_total:*`
- **Metrics/dashboards**
  - `capture-reliability-overview`
  - `codex-app-server-runtime`
  - `rollout-gates`
- **Expected healthy signals**
  - handshake p99 below 5s
  - timeout and parser-error rates below thresholds
  - zero crash-loop count
- **Failure signals / rollback trigger**
  - any threshold violation in canary/soak artifact checks
  - immediate action: halt promotion, enable kill-switch fallback, roll back cohort
- **Validation window & owner**
  - window: minimum 24h per canary stage, 168h soak for 100%
  - owner: Jamie Craik

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

### Recorded drill sequence (manual fallback test)

Use this exact sequence in the app DevTools console while running a built app:

```js
// In App window console (Tauri window)
(async () => {
  const invoke = window.__TAURI__?.core?.invoke
    ?? (await import('@tauri-apps/api/core')).invoke;
  const { listen } = window.__TAURI__?.event
    ? window.__TAURI__.event
    : await import('@tauri-apps/api/event');

  const seen = { transitions: [], statuses: [] };
  const unlisten = await listen('capture-reliability-transition', (evt) => {
    seen.transitions.push({ at: new Date().toISOString(), ...evt.payload });
    console.log('[transition]', evt.payload);
  });

  const snapshot = async (label) => {
    const status = await invoke('get_capture_reliability_status');
    seen.statuses.push({
      label,
      at: new Date().toISOString(),
      mode: status.mode,
      app: status.appServer,
    });
    console.log(label, status.mode, status);
    return status;
  };

  try {
    await snapshot('baseline');
    await invoke('codex_app_server_set_stream_kill_switch', { enabled: true });
    await snapshot('kill-switch-enabled');
    await invoke('stop_codex_app_server');
    await snapshot('sidecar-stopped');

    // Expected: OTEL_ONLY or DEGRADED_STREAMING with app server state not running.

    await invoke('codex_app_server_set_stream_kill_switch', { enabled: false });
    await invoke('start_codex_app_server');
    await invoke('codex_app_server_initialize');
    await invoke('codex_app_server_initialized');
    await invoke('codex_app_server_account_login_start', { authMode: 'chatgpt' });
    await snapshot('recovery-started');
    // Complete browser login flow if prompted.
    await snapshot('recovered-check');

    const log = {
      capturedAt: new Date().toISOString(),
      sequence: seen,
      expectedFinal: 'HYBRID_ACTIVE',
      observedFinal: (await snapshot('final-check')).mode,
    };
    const payload = JSON.stringify(log, null, 2);
    console.log('CAPTURED_RECOVERY_DRILL_LOG', payload);
    await navigator.clipboard?.writeText?.(payload);
    console.log('Recovery log copied to clipboard (if permitted).');
  } finally {
    await unlisten();
  }
})();
```

Expected success state is `HYBRID_ACTIVE` in the final `snapshot`.

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
- [ ] Canary artifacts generated (`canary-5p.json`, `canary-25p.json`, `os-arch-smoke.json`) with owner metadata
- [ ] Rollout thresholds validated via `pnpm tauri:verify-rollout-artifacts`

## Troubleshooting

- **Symptom:** `Capture reliability check failed`
  - Verify tauri command wiring and restart app.
- **Symptom:** `Unsupported auth mode`
  - Ensure `appServerAuthMode` is `chatgpt`.
- **Symptom:** perpetual `DEGRADED_STREAMING`
  - Check sidecar binary presence and permissions, then re-run handshake/auth.
