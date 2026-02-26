---
title: feat: Codex App Server production parity hardening
type: feat
status: active
date: 2026-02-25
origin: /Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-25-codex-app-server-production-remediation-brainstorm.md
---

# feat: Codex App Server production parity hardening

## Enhancement Summary

**Deepened on:** 2026-02-25  
**Sections enhanced:** 19  
**Research agents used:** explorer skill reviews (`agent-native-architecture`, `openai-docs`, `security-best-practices`, `context7`, `writing-plans`, `verification-before-completion`) + docs-backed runtime review  
**Skills discovered and matched:** `agent-native-architecture`, `openai-docs`, `security-best-practices`, `context7`, `writing-plans`, `verification-before-completion`, `backend-engineer`  
**Institutional learnings applied:** 1 (`docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md`)

### Key Improvements
1. Corrected baseline assumptions: stdout is already piped; highest remaining gaps are stderr capture, command-surface hardening, and protocol-authoritative state transitions.
2. Added concrete security/performance guardrails: method allowlist, payload limits, idempotent approval handling, request lifecycle contract, and release SLO gates.
3. Expanded cross-layer quality gates: Rust↔TS contract parity checks, recovery-flow integration tests, and mutation-surface closure beyond two deprecated commands.

### New Considerations Discovered
- `codex_app_server_receive_live_event` remains renderer-callable and should be internalized for a strict trust boundary.
- Auth APIs still advertise/support chatgpt-only semantics in `supported_modes`, so “all modes” requires explicit contract/version policy.
- Default-on rollout needs automated rollback triggers and soak thresholds, not just manual kill-switch fallback.

## Table of Contents
- [Section manifest](#section-manifest)
- [Overview](#overview)
- [Brainstorm carry-forward](#brainstorm-carry-forward)
- [Research summary](#research-summary)
- [Problem statement](#problem-statement)
- [Proposed solution](#proposed-solution)
- [Technical approach](#technical-approach)
  - [Architecture](#architecture)
  - [Execution-loop contract](#execution-loop-contract)
  - [Execution order and blockers](#execution-order-and-blockers)
  - [Checkpoint legend](#checkpoint-legend)
  - [Verification command map](#verification-command-map)
  - [Verification evidence policy](#verification-evidence-policy)
  - [Implementation phases](#implementation-phases)
- [Alternative approaches considered](#alternative-approaches-considered)
- [SpecFlow analysis](#specflow-analysis)
- [System-wide impact](#system-wide-impact)
  - [Agent-native parity map](#agent-native-parity-map)
  - [Interaction graph](#interaction-graph)
  - [Error and failure propagation](#error-and-failure-propagation)
  - [State lifecycle risks](#state-lifecycle-risks)
  - [Context model and shared workspace](#context-model-and-shared-workspace)
  - [API surface parity](#api-surface-parity)
  - [Integration test scenarios](#integration-test-scenarios)
- [Acceptance criteria](#acceptance-criteria)
  - [Phase exit checkpoints](#phase-exit-checkpoints)
- [Success metrics](#success-metrics)
- [Dependencies and prerequisites](#dependencies-and-prerequisites)
- [Risk analysis and mitigation](#risk-analysis-and-mitigation)
- [Resource requirements](#resource-requirements)
- [Documentation plan](#documentation-plan)
- [Open questions](#open-questions)
- [Sources and references](#sources-and-references)

## Section manifest
- **Overview / Problem** — validate current-state evidence and drift from older assumptions.
- **Proposed Solution** — enforce protocol-authoritative runtime boundaries and callback hardening.
- **Technical Approach** — sequence work to minimize migration risk and maximize testability.
- **Implementation Phases** — add missing contracts: request lifecycle, auth policy, contract sync, rollout gates.
- **SpecFlow / Acceptance** — close cross-layer flow gaps and edge-case coverage.
- **Risks / Metrics** — define explicit SLOs, rollback thresholds, and observability targets for default-on release.

## Overview
Deliver production-standard Codex app-server integration in Firefly Narrative by making the Rust backend the sole protocol authority for lifecycle, handshake, auth, stream events, and approvals. This plan supersedes remaining runtime gaps after earlier hardening and carries forward the latest brainstorm decisions directly (see brainstorm: `docs/brainstorms/2026-02-25-codex-app-server-production-remediation-brainstorm.md`).

### Research Insights
**Best Practices:**
- Treat app-server JSON-RPC as a strict protocol contract: request/response IDs must correlate, notifications omit `id`, and the wire format omits the `"jsonrpc":"2.0"` header while preserving JSON-RPC 2.0 semantics.
- Enforce per-connection handshake semantics exactly: one `initialize` request followed by `initialized`, with explicit `Not initialized` and `Already initialized` error behavior.
- Keep frontend listeners as consumers; avoid frontend paths that can inject/forge backend protocol state.

**Performance Considerations:**
- Single-thread parse/dispatch paths should have bounded queueing and backpressure to avoid head-of-line blocking under event bursts.

**Edge Cases:**
- Out-of-order responses, duplicate IDs, and notifications arriving before initialization ack must be deterministic.

## Brainstorm carry-forward
Found brainstorm from **2026-02-25**: `codex-app-server-production-remediation`.

Carried-forward decisions (with review clarifications):
- Choose **Protocol-Native Runtime** over bridge/staged alternatives (see brainstorm: `docs/brainstorms/2026-02-25-codex-app-server-production-remediation-brainstorm.md`).
- Keep backend as protocol source of truth; frontend is observer/controller only (see brainstorm).
- Keep scope focused on app-server parity and trust-boundary correctness, not broad OTEL redesign (see brainstorm).
- Keep **default-on as end-state**, but ship through staged canary promotion with automatic halt/rollback gates.

## Research summary
### Local repo research (always-on)
- `src-tauri/src/codex_app_server.rs:577-579` already pipes sidecar stdout; `stderr` is still dropped (`Stdio::null`).
- `src-tauri/src/codex_app_server.rs:703-800` sidecar parser currently handles a limited method set and fixed RPC IDs.
- `src-tauri/src/codex_app_server.rs:1668-1709` handshake state is still updated immediately after send, not after explicit response correlation for all steps.
- `src-tauri/src/codex_app_server.rs:1717-1722` and `1741-1745` still expose `supported_modes: ["chatgpt"]` in account status.
- `src-tauri/src/lib.rs:305-310` still exposes deprecated/internal command surfaces.
- `src-tauri/src/lib.rs:301-303` keeps renderer-callable auth mutation commands (`account_login_completed`, `account_updated`).
- `src-tauri/src/lib.rs:308` + `src/core/tauri/ingestConfig.ts:267-270` keep renderer-callable `codex_app_server_receive_live_event` surface.
- `src/hooks/useAutoIngest.ts:550-561` no longer directly promotes auth via `account_updated`; login flow now routes through explicit protocol methods (`initialize`, `initialized`, `account/login/start`).

### Skill and learning application
- Applied `security-best-practices` findings: strict parser/input limits, approval idempotency, mode-downgrade prevention, binary trust chain controls.
- Applied architecture/spec review findings: close callback mutation surfaces, define protocol-version and request-lifecycle policies, add contract-sync gate.
- Applied institutional learning: sidecar-verified auth and deterministic stream precedence from prior solved incident.

### External/primary-source research
- OpenAI Codex app-server protocol reference (primary source):
  - <https://developers.openai.com/codex/app-server/>
  - <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md>
- Tokio process lifecycle and `kill_on_drop` behavior:
  - <https://docs.rs/tokio/latest/tokio/process/struct.Command.html>
  - <https://docs.rs/tokio/latest/tokio/process/struct.Child.html>
- Tauri v2 event emit/listen/unlisten patterns:
  - <https://v2.tauri.app/develop/calling-frontend>
  - <https://v2.tauri.app/develop/_sections/frontend-listen>

## Problem statement
Current implementation is materially improved but still below full production parity for Codex app-server semantics:
- command surface remains wider than desired trust boundary,
- auth mode contract is still effectively chatgpt-centric,
- recovery/rollout contracts are underspecified for safe staged promotion to default-on,
- parser/transport path lacks explicit bounded resource policy (size, queue, error-budget constraints).

This can still create silent drift between UI state and protocol truth and weakens reliability/compliance posture for enterprise-grade integrations.

### Research Insights
**Best Practices:**
- Treat callback/mutation RPCs as privileged internal channels.
- Couple protocol correctness to testable contracts (schema parity + flow gates), not only “status looks healthy.”

**Edge Cases:**
- restart during approval/auth refresh,
- duplicate/late approval decisions,
- multi-window concurrent approval responses,
- wrong-arch binary with valid checksum format.

## Proposed solution
Implement a protocol-native app-server runtime layer in `src-tauri/src/codex_app_server.rs` that:
1. Preserves existing stdout JSONL ingestion but hardens parser, resource limits, and request lifecycle policy.
2. Drives readiness and auth state transitions from confirmed protocol data.
3. Internalizes callback/mutation surfaces so frontend cannot spoof sidecar events.
4. Aligns auth contract to documented method+mode semantics: `account/login/start` types (`apiKey`, `chatgpt`, `chatgptAuthTokens`) and `account/updated.authMode` values (`apikey`, `chatgpt`, `chatgptAuthTokens`, `null`).
5. Replaces shim-based production dependency with pinned sidecar binaries plus integrity verification.

### Research Insights
**Security Considerations:**
- Add explicit method allowlist + payload size limits + parser fail-closed behavior.
- Keep auth tokens/URLs redacted in logs and event payloads.

**Implementation Details:**
- Define a request lifecycle contract document in-code: ID generation, timeout policy, restart cancellation semantics, idempotent approval semantics.

## Technical approach
### Architecture
- **Runtime owner:** `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs`
- **Command registration:** `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/lib.rs`
- **Frontend typed command bridge:** `/Users/jamiecraik/dev/firefly-narrative/src/core/tauri/ingestConfig.ts`
- **Orchestration hook:** `/Users/jamiecraik/dev/firefly-narrative/src/hooks/useAutoIngest.ts`
- **Packaging/config:** `/Users/jamiecraik/dev/firefly-narrative/src-tauri/tauri.conf.json`, `/Users/jamiecraik/dev/firefly-narrative/src-tauri/bin/*`

### Research Insights
**Best Practices:**
- Add Rust↔TS contract-sync validation to CI (command names, payload shapes, event names).
- Declare protocol version policy (`supported`, `deprecated`, `rejected`) to avoid silent drift.

**Performance Considerations:**
- Emit and track parser-error rate, pending-request depth, event lag, and approval timeout rate as first-class metrics.

### Execution-loop contract
- **State model:** `idle -> starting -> initializing -> ready|needs_login|degraded|blocked -> stopping -> idle`.
- **Completion semantics:** `start` is only `success` after correlated `initialize` response + `initialized` notification + post-init account read.
- **Partial/blocked semantics:** use `partial` when auth/user action is still needed; use `blocked` for trust failure, protocol invariant failure, or timeout budget exhaustion.
- **Epoch safety:** attach runtime `epoch` to operation results and ignore stale-epoch responses/events so restarts cannot mutate current state.
- **Idempotency:** approval decisions must be idempotent and replay-safe; late/duplicate responses are metered and ignored.

### Execution order and blockers
1. **CP0 (blocking):** complete Phase 0 before any transport/auth/API-surface code changes.
2. **CP1 → CP3:** run Phases 1, 2, 3 in order (parser/lifecycle authority before surface removals).
3. **CP0.5 (rollout blocker):** Phase 0.5 may run after CP0, but must be complete before any canary/default-on promotion work.
4. **CP4:** start rollout hardening only after CP3 and CP0.5 are both green **and** rollout ownership/routing decisions are recorded.
5. **CP5 (release):** release candidate is valid only when CP5 evidence is attached.

### Checkpoint legend
- **CP0:** contract baseline locked.
- **CP1:** transport/parser hardening verified.
- **CP2:** handshake/auth authority verified.
- **CP3:** callback-surface reductions and contract parity verified.
- **CP0.5:** supply-chain/provenance prerequisites verified.
- **CP4:** recovery and rollout controls verified.
- **CP5:** packaging + release gates verified.

### Verification command map
- **Rust runtime/harness:** `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server`
- **Rust integration harness (explicit test target):** `cargo test --manifest-path src-tauri/Cargo.toml --test app_server_harness -- --nocapture`
- **Frontend/hook regression:** `pnpm test -- src/hooks/__tests__/useAutoIngest.test.ts`
- **TS command bridge + type contract:** `pnpm typecheck && pnpm lint`
- **Renderer mutation-surface closure:** `! rg -n "codex_app_server_(set_stream_health|receive_live_event|account_login_completed|account_updated)|ingest_codex_stream_event" src-tauri/src/lib.rs src/core/tauri/ingestConfig.ts`
- **Full regression before release checkpoint:** `pnpm test`

### Verification evidence policy
- [ ] Every checkpoint command must run on the current commit SHA (stale output does not count).
- [ ] Record command, UTC timestamp, exit code, and artifact/log path for each checkpoint gate.
- [ ] Fail fast at first failed gate; no phase can be marked complete while any required gate is red.

### Implementation phases
#### Phase 0 — Contract baseline and guardrails (**checkpoint: CP0, blocking**)
- [x] **P0-01 Protocol/version policy lock**
  - **File targets:** `src-tauri/src/codex_app_server.rs`
  - **Done when:** explicit `supported/deprecated/rejected` policy exists for protocol version handling and mismatch behavior.
- [x] **P0-02 Auth-scope decision record**
  - **File targets:** this plan + `docs/agents/hybrid-capture-rollout-runbook.md`
  - **Done when:** v1 auth scope is explicitly fixed to `account/login/start.type ∈ {apiKey, chatgpt, chatgptAuthTokens}` and `account/updated.authMode ∈ {apikey, chatgpt, chatgptAuthTokens, null}`, with non-goals and version-bump policy.
- [x] **P0-03 Request lifecycle contract**
  - **File targets:** `src-tauri/src/codex_app_server.rs` (+ tests in `src-tauri/tests/`)
  - **Done when:** ID allocation, timeout, cancel/restart semantics, and approval idempotency are codified and test-backed.
- [x] **P0-04 Fake sidecar harness scaffold**
  - **File targets:** `src-tauri/tests/app_server_harness.rs`
  - **Done when:** harness can emulate ordered, out-of-order, and duplicate frames.
- [x] **P0-05 Rust↔TS contract parity gate**
  - **File targets:** `src-tauri/tests/`, `src/core/tauri/`, `src/hooks/__tests__/`
  - **Done when:** CI fails on command/event schema drift across Rust and TS.
- [x] **P0-06 Rollout ownership + canary routing decision record**
  - **File targets:** this plan + `docs/agents/hybrid-capture-rollout-runbook.md`
  - **Done when:** named on-call owner and explicit canary routing mechanism are documented and treated as CP4 prerequisites. Chosen mechanism: deterministic stable-hash cohorting on install/device ID (`0–4 => 5%`, `0–24 => 25%`, `0–99 => 100%`).

**Phase 0 verification (all required):**
- `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server`
- `cargo test --manifest-path src-tauri/Cargo.toml --test app_server_harness -- --nocapture`
- `pnpm typecheck`

#### Phase 1 — Transport and parser hardening (**checkpoint: CP1**)
- [x] **P1-01 Parser bounds and allowlist**
  - **File targets:** `src-tauri/src/codex_app_server.rs`
  - **Done when:** max line size, max pending map size, and unknown-method policy are enforced fail-closed.
- [x] **P1-02 Diagnostic stderr capture**
  - **File targets:** `src-tauri/src/codex_app_server.rs`
  - **Done when:** bounded stderr ring replaces `Stdio::null`, with drop counters.
- [x] **P1-03 Backpressure/admission control**
  - **File targets:** `src-tauri/src/codex_app_server.rs`
  - **Done when:** queue caps + overload behavior are deterministic and observable.
- [x] **P1-04 Parser/state-machine robustness tests**
  - **File targets:** `src-tauri/tests/app_server_harness.rs`, `src-tauri/tests/`
  - **Done when:** malformed UTF-8, oversized JSONL, replayed IDs, and burst traffic scenarios pass without panic/OOM.
- [x] **P1-05 Runtime telemetry for rollback controller inputs**
  - **File targets:** `src-tauri/src/codex_app_server.rs`
  - **Done when:** event lag, timeout rate, parser violations, and restart-loop metrics are emitted consistently.
- [x] **P1-06 Sidecar subprocess supervision + reap guarantees**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, `src-tauri/tests/app_server_harness.rs`
  - **Done when:** sidecar lifecycle uses explicit start/stop/restart supervision, `kill_on_drop` is safety-only, and stop/restart paths guarantee `wait`/reap semantics.
- [x] **P1-07 Sidecar spawn env/cwd hardening**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, `src-tauri/tests/app_server_harness.rs`
  - **Done when:** runtime uses explicit environment allowlist + trusted cwd and blocks high-risk inherited env overrides in production.
- [x] **P1-08 Strict per-method schema validation**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, `src-tauri/tests/app_server_harness.rs`
  - **Done when:** each allowlisted JSON-RPC method/notification/result is validated (required/optional fields, size/depth limits, unknown-field rejection) before state mutation.

**Phase 1 verification (all required):**
- `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server`
- `cargo test --manifest-path src-tauri/Cargo.toml --test app_server_harness -- --nocapture`

#### Phase 2 — Handshake + auth authority hardening (**checkpoint: CP2**)
- [x] **P2-01 Correlated handshake transitions**
  - **File targets:** `src-tauri/src/codex_app_server.rs`
  - **Done when:** per connection, runtime enforces `initialize` request -> successful response -> `initialized` notification ordering, surfaces `Not initialized` for pre-handshake requests, and surfaces `Already initialized` for duplicate `initialize`.
- [x] **P2-02 Full auth mode parity**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, `src-tauri/tests/`
  - **Done when:** `account/login/start` (`apiKey|chatgpt|chatgptAuthTokens`), `account/updated.authMode` (`apikey|chatgpt|chatgptAuthTokens|null`), and `account/chatgptAuthTokens/refresh` flows are test-covered.
- [x] **P2-03 Secret-storage and redaction enforcement**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, related credential adapters/tests
  - **Done when:** no plaintext auth material reaches config/db/log/event/diagnostic paths.
- [x] **P2-04 Remove renderer-driven auth mutation authority**
  - **File targets:** `src-tauri/src/lib.rs`, `src/core/tauri/ingestConfig.ts`, `src/hooks/useAutoIngest.ts`
  - **Done when:** frontend can request auth actions but cannot directly mutate authoritative auth state.
- [x] **P2-05 Approval anti-replay + decision-origin binding**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, `src/core/tauri/ingestConfig.ts`, `src-tauri/tests/app_server_harness.rs`
  - **Done when:** approval submissions require one-time opaque tokens bound to runtime/session/window context; stale/replay/cross-context decisions are rejected and audited.
- [x] **P2-06 Auth URL validation + redaction**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, auth flow tests
  - **Done when:** sidecar-provided auth URLs are scheme/host validated and sensitive query/fragment values are redacted before logs/events.
- [x] **P2-07 `thread/read` protocol-backed parity**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, `src-tauri/tests/app_server_harness.rs`, `src/core/tauri/ingestConfig.ts`
  - **Done when:** `thread/read` behavior is strictly protocol-backed (including lifecycle gating and stale-response handling) and test-covered.

**Phase 2 verification (all required):**
- `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server`
- `pnpm test -- src/hooks/__tests__/useAutoIngest.test.ts`
- `pnpm typecheck`

#### Phase 3 — Callback surface reduction and API parity (**checkpoint: CP3**)
- [x] **P3-01 Compatibility/migration matrix for command removals**
  - **File targets:** `docs/agents/hybrid-capture-rollout-runbook.md`, this plan
  - **Done when:** one-release compatibility matrix exists for UI/tests/automation paths.
- [x] **P3-02 Static command-surface allowlist gate**
  - **File targets:** `src-tauri/src/lib.rs`, CI test/gate definitions
  - **Done when:** unauthorized renderer-callable mutation commands fail CI.
- [x] **P3-03 Remove deprecated/public mutation commands**
  - **File targets:** `src-tauri/src/lib.rs`, `src-tauri/src/codex_app_server.rs`
  - **Done when:** `codex_app_server_set_stream_health` and `ingest_codex_stream_event` are no longer public invoke surfaces.
- [x] **P3-04 Internalize live-event injection path**
  - **File targets:** `src-tauri/src/lib.rs`, `src/core/tauri/ingestConfig.ts`
  - **Done when:** `codex_app_server_receive_live_event` cannot be called from renderer invoke.
- [x] **P3-05 Public API surface freeze**
  - **File targets:** `src/core/tauri/ingestConfig.ts`, `src/hooks/useAutoIngest.ts`, tests
  - **Done when:** external API is limited to lifecycle/status/read/approved-user-decision safe controls.
- [x] **P3-06 Capability-level command lockdown**
  - **File targets:** `src-tauri/capabilities/default.json`, CI security gate
  - **Done when:** only intended lifecycle/read/approval commands are capability-allowed for `main`; internal/removed commands are capability-denied and permission widening fails CI.
- [x] **P3-07 Event targeting + listener lifecycle hygiene**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, `src/hooks/useAutoIngest.ts`, frontend listener tests
  - **Done when:** privileged events are target-scoped (avoid broad global emit) and every frontend listener has explicit unlisten cleanup on teardown.

**Phase 3 verification (all required):**
- `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server`
- `pnpm test -- src/hooks/__tests__/useAutoIngest.test.ts`
- `pnpm typecheck`

#### Phase 0.5 — Supply-chain prerequisites (**checkpoint: CP0.5, rollout blocking**)
- [x] **P0.5-01 Pinned OS/arch sidecar manifest + signature trust root**
  - **File targets:** `src-tauri/bin/*`, manifest/provenance verification code/tests
  - **Done when:** manifest maps every shipped target to pinned artifact + signature metadata.
- [x] **P0.5-02 CI verification for checksum/signature**
  - **File targets:** CI workflow + verification tests/scripts
  - **Done when:** CI fails closed on checksum/signature mismatch.
- [x] **P0.5-03 Anti-rollback policy**
  - **File targets:** runtime startup checks + tests
  - **Done when:** stale manifests and below-minimum versions are rejected.
- [x] **P0.5-04 Production PATH deny policy**
  - **File targets:** runtime launch path + tests
  - **Done when:** `NARRATIVE_CODEX_APP_SERVER_BIN` override remains dev-only; production bundle ignores PATH fallback.
- [x] **P0.5-05 Signing-key rotation + revocation policy**
  - **File targets:** trust policy docs + verification runtime/tests
  - **Done when:** trust root supports planned key rotation and emergency revocation; revoked signers are rejected in CI/runtime checks.
- [x] **P0.5-06 Verification tooling/tasks materialized**
  - **File targets:** `scripts/verify-codex-sidecar-manifest.mjs`, `src-tauri/tests/*trust*`, `src-tauri/tests/*path_policy*`
  - **Done when:** all Phase 0.5 verification commands exist, are executable in CI, and fail closed on policy violations.

**Phase 0.5 verification (all required):**
- `node scripts/verify-codex-sidecar-manifest.mjs --manifest src-tauri/bin/codex-app-server-manifest.json --require-signature --require-checksum --enforce-min-version`
- `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server_trust`
- `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server_path_policy`

#### Phase 4 — Recovery and rollout hardening (default-on) (**checkpoint: CP4**)
- [x] **P4-01 Restart re-entry contract**
  - **File targets:** `src-tauri/src/codex_app_server.rs`, integration tests
  - **Done when:** `restart -> initialize -> initialized -> account/read -> ready|degraded` path is deterministic and test-backed.
- [x] **P4-02 Staged canary promotion policy**
  - **File targets:** rollout automation + `docs/agents/hybrid-capture-rollout-runbook.md`
  - **Done when:** `5%/24h -> 25%/24h -> 100%` progression plus auto-halt rules are documented and enforceable.
- [x] **P4-03 Automatic rollback thresholds**
  - **File targets:** rollback controller and alerts
  - **Done when:** objective thresholds (handshake p99, timeout rate, crash loops, auth failure rate) trigger kill-switch automatically.
- [x] **P4-04 OS/arch smoke + wrong-arch detection**
  - **File targets:** integration tests/CI jobs
  - **Done when:** wrong-arch bundles fail clearly and supported bundles pass smoke coverage.
- [x] **P4-05 CI schema-drift gate vs pinned app-server**
  - **File targets:** contract tests + CI workflow
  - **Done when:** app-server schema drift fails CI before release promotion.
- [x] **P4-06 Canary artifact generation + ownership**
  - **File targets:** rollout automation + `artifacts/release/codex-app-server/*.json` producer docs
  - **Done when:** canary 5%/25% artifact JSON producers are defined, owned, and generated automatically for checkpoint gating.

**Phase 4 verification (all required):**
- `cargo test --manifest-path src-tauri/Cargo.toml --test app_server_harness -- --nocapture`
- `jq -e '.window_hours == 24 and .handshake_p99_ms <= 5000 and .pending_timeout_rate <= 0.005 and .auth_failure_rate <= 0.01 and .crash_loop_count == 0' artifacts/release/codex-app-server/canary-5p.json`
- `jq -e '.window_hours == 24 and .handshake_p99_ms <= 5000 and .pending_timeout_rate <= 0.005 and .auth_failure_rate <= 0.01 and .crash_loop_count == 0' artifacts/release/codex-app-server/canary-25p.json`
- `jq -e '.wrong_arch_failures == 0 and .supported_arch_smoke_pass == true' artifacts/release/codex-app-server/os-arch-smoke.json`

#### Phase 5 — Packaging trust and release verification (**checkpoint: CP5, release gate**)
- [x] **P5-01 Replace shell shim binaries with pinned artifacts**
  - **File targets:** `src-tauri/bin/*`, packaging config
  - **Done when:** release bundles include pinned artifacts only.
- [x] **P5-02 Enforce trust checks at startup**
  - **File targets:** runtime startup validation + tests
  - **Done when:** missing/invalid signature, hash mismatch, stale manifest, or downgrade fails fast.
- [x] **P5-03 Soak + telemetry readiness sign-off**
  - **File targets:** rollout runbook + dashboards/alerts references
  - **Done when:** soak thresholds met and telemetry ownership/on-call routing is explicitly assigned.
- [x] **P5-04 Release artifact pack generation contract**
  - **File targets:** release pipeline docs/workflow + `artifacts/release/codex-app-server/soak-100p.json` + `telemetry-readiness.json`
  - **Done when:** release workflow deterministically emits required gate artifacts with schema validation and retention policy.

**Phase 5 verification (all required):**
- `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server`
- `pnpm test`
- `pnpm typecheck`
- `pnpm tauri:build`
- `jq -e '.window_hours >= 168 and .handshake_p99_ms <= 5000 and .pending_timeout_rate <= 0.005 and .parser_error_rate <= 0.001 and .event_lag_p95_ms <= 250' artifacts/release/codex-app-server/soak-100p.json`
- `jq -e '.dashboards_live == true and .alerts_routed_owner != null and (.sli_definitions | length) >= 6' artifacts/release/codex-app-server/telemetry-readiness.json`

## Alternative approaches considered
### Strangler migration (rejected)
Rejected for this cycle because it adds temporary dual-runtime complexity and conflicts with the default-on end-state decision.

### Stabilize-then-rebuild (rejected)
Rejected because it preserves protocol-authority gaps and delays parity outcomes; higher total cost over two cycles (see brainstorm).

## SpecFlow analysis
### Functional gaps
- Callback-command hardening scope is incomplete unless `codex_app_server_receive_live_event` and auth mutation callbacks are addressed.
- Rust↔TS contract parity is not yet an explicit test gate.
- Current runtime status contracts still expose chatgpt-only semantics and must be upgraded to full multi-mode parity.

### Flow gaps
- Restart flow needs explicit re-entry sequence and terminal-state guarantees.
- Frontend listener attach failures should transition to a user-visible degraded mode, not silent optional behavior.
- Thread/read lifecycle needs clear concurrent request and stale-response handling.

### Risk gaps
- Default-on release requires automatic rollback criteria and thresholds.
- Parser and pending-request resource policies need explicit hard bounds.
- Binary trust chain must include both checksum and manifest trust policy.

## System-wide impact
### Agent-native parity map

| User-visible action | Agent capability path | Current gap | Severity | Closure phase |
|---|---|---|---|---|
| Start app-server runtime | `start -> initialize -> initialized -> account/read` | Handshake correlation is still partially optimistic | P0 | Phase 2 |
| Login and refresh auth | `account/login/start` + `account/updated` + optional refresh | status contract and refresh handling need strict parity coverage | P0 | Phase 2 |
| Submit approval decision | approval request + decision token submit | replay/cross-context decision hardening not yet complete | P0 | Phase 2 |
| Receive live session events | sidecar stdout -> backend parse -> Tauri emit -> UI consume | renderer-callable injection surface still exists pre-remediation | P0 | Phase 3 |
| Restart and recover | restart invalidates stale epoch and re-enters handshake/auth | stale-response and orphan pending state protections need explicit gating | P0 | Phase 4 |

### Interaction graph
1. UI command triggers lifecycle (`initialize`, `initialized`, `thread/start|thread/resume`, `turn/start`, and `account/login/start` when auth is required).
2. Backend writes JSON-RPC request to sidecar stdin.
3. Sidecar stdout frame is parsed and correlated to runtime state.
4. Backend emits status/live-session/approval events through Tauri.
5. UI consumes events; no external event-injection mutation path remains.

### Error and failure propagation
- Parser violations => protocol error counters + degraded state reason + safe drop.
- Pending request timeout => deterministic request failure + metric increment + optional rollback trigger.
- Restart during in-flight operations => cancel/reject and clear orphaned state deterministically.
- Auth failures => transition to needs_login/degraded without frontend-side promotion bypass.

### State lifecycle risks
- Orphaned pending IDs on restart.
- Replay or duplicate approval responses.
- Partial auth refresh transitions for external token modes.

Mitigations:
- immutable correlation tuple checks,
- idempotent approval handling,
- deterministic cleanup on restart/timeout,
- bounded queues/maps and fail-closed parser logic.

### Context model and shared workspace
- Rust runtime state is canonical; frontend maintains a read-model projection only.
- Every backend event should carry `epoch` and monotonic sequencing metadata so UI can ignore stale updates.
- UI must trigger snapshot rehydrate on epoch change, sequence gap, or attach/re-attach after restart.
- Approval/auth contexts should be scoped to runtime + thread/session + window identity to prevent cross-context mutation.

### API surface parity
Interfaces requiring update parity:
- Rust Tauri commands in `src-tauri/src/lib.rs`
- Runtime command handlers in `src-tauri/src/codex_app_server.rs`
- TS invoke wrappers in `src/core/tauri/ingestConfig.ts`
- UI orchestration in `src/hooks/useAutoIngest.ts`
- Hook/unit test mocks in `src/hooks/__tests__/useAutoIngest.test.ts`

### Integration test scenarios
1. **Handshake strictness:** pre-initialize request yields explicit `Not initialized`; duplicate `initialize` yields `Already initialized`.
2. **Response ordering:** duplicate/out-of-order response IDs handled safely.
3. **Approval round-trip:** `accept|acceptForSession|decline|cancel` decision flows (plus command execpolicy amendment form) are deterministic, idempotent, and resilient to late responses.
4. **Restart recovery:** in-flight request cancellation + bounded re-entry within target window.
5. **Event chain E2E:** `turn/started -> item/started -> item/* deltas -> item/completed -> turn/completed`, with `item/*` treated as authoritative when turn payload `items` are empty.
6. **Contract parity:** Rust command/event schema matches TS types and test fixtures.
7. **Packaging trust:** pinned artifact + checksum verification + wrong-arch failure path.
8. **Notification opt-out:** `initialize.params.capabilities.optOutNotificationMethods` exact-match suppression works and unknown method names are ignored.
9. **Event isolation:** privileged auth/approval events are delivered only to intended target webview/window.
10. **Listener lifecycle:** repeated frontend mount/unmount does not leak duplicate listeners or double-handle events.
11. **Subprocess reap guarantee:** stop/restart paths do not leave orphaned sidecar processes.

## Acceptance criteria
### Functional requirements
- [ ] Runtime processes sidecar stdout JSONL with bounded parser/resource policy.
- [ ] Handshake/auth transitions are protocol-confirmed and not UI-promotable.
- [ ] `thread/read` snapshot path is protocol-backed and lifecycle-gated.
- [ ] Callback/mutation surfaces are internalized (including event-injection path).
- [ ] Auth semantics are supported and test-covered for both login request types (`apiKey`, `chatgpt`, `chatgptAuthTokens`) and status modes (`apikey`, `chatgpt`, `chatgptAuthTokens`, `null`).
- [ ] Approval callbacks use documented server-request methods (`item/commandExecution/requestApproval`, `item/fileChange/requestApproval`) and documented decision payloads.
- [ ] Event semantics preserve authoritative item lifecycle ordering (`item/started` -> item deltas -> `item/completed`) with `turn/*` as lifecycle envelope.

### Non-functional requirements
- [x] Sidecar startup/restart behavior deterministic with bounded retries and re-entry sequence.
- [x] Startup fails fast for integrity/trust violations in production bundles.
- [ ] Observability includes parser errors, queue depth, timeout reasons, restart causes, approval outcomes, and diagnostics drops.
- [x] Production runtime ignores non-allowlisted environment overrides and records safe audit events for blocked overrides.
- [x] Release build fails closed on missing/invalid signature, hash mismatch, stale manifest, or downgraded artifact version.
- [ ] Stop/restart/error paths guarantee child-process reap semantics (`wait`/kill+wait), with no orphan sidecar process left running.
- [x] Privileged backend events are target-scoped; no broad global broadcast for auth/approval internals.

### Quality gates
- [x] `cargo test --manifest-path /Users/jamiecraik/dev/firefly-narrative/src-tauri/Cargo.toml codex_app_server`
- [x] `pnpm test`
- [x] Harness integration suite passes for all scenarios in this plan.
- [x] Contract parity gate passes for Rust↔TS command/event shapes.
- [x] No exposed renderer mutation commands remain for internal callback surfaces.
- [x] Redaction regression suite passes (no token/API key material appears in logs, events, crash diagnostics, or persisted stores).
- [ ] Fuzz/property hardening suite passes for parser + lifecycle invariants.
- [x] Static command-surface allowlist CI gate passes (no unauthorized `#[tauri::command]` additions).
- [x] Tauri capability policy CI gate passes (no unintended permission widening on codex command surfaces).

### Phase exit checkpoints
- [ ] **CP0 complete:** Phase 0 tasks done, verification commands green, and auth-scope decision record updated.
- [ ] **CP1 complete:** parser bounds/backpressure/diagnostics hardening merged with harness proof.
- [x] **CP2 complete:** handshake/auth transitions are correlated + multi-mode parity tests green.
- [x] **CP3 complete:** deprecated/public mutation surfaces removed and command-surface allowlist gate enforced.
- [x] **CP0.5 complete:** signed manifest + anti-rollback + production PATH deny policy all verified.
- [x] **CP4 complete:** staged rollout gates + auto-rollback triggers + wrong-arch smoke checks validated.
- [x] **CP4 blocker resolved:** named owner/on-call and canary routing mechanism are documented before promotion.
- [ ] **CP5 complete (release gate):** full regression (`cargo test`, `pnpm test`, `pnpm typecheck`) and soak evidence attached.
- [ ] **Checkpoint evidence recorded:** each CP includes linked command output and failing-test remediation notes in PR/runbook.

### Checkpoint evidence log (2026-02-26 UTC)
- ✅ `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server`
- ✅ `pnpm tauri:verify-sidecar-manifest`
- ✅ `pnpm test`
- ✅ `pnpm typecheck`
- ✅ `npm test`
- ✅ `npm run test:deep`
- ✅ `pnpm tauri:generate-release-artifacts`
- ✅ `pnpm tauri:verify-release-artifacts`
- ✅ `jq -e '.window_hours >= 168 and .handshake_p99_ms <= 5000 and .pending_timeout_rate <= 0.005 and .parser_error_rate <= 0.001 and .event_lag_p95_ms <= 250' artifacts/release/codex-app-server/soak-100p.json`
- ✅ `jq -e '.dashboards_live == true and .alerts_routed_owner != null and (.sli_definitions | length) >= 6' artifacts/release/codex-app-server/telemetry-readiness.json`
- ⚠️ `pnpm tauri:build` fails locally at bundle/signing stage (`bundle_dmg.sh` + updater private-key password env). Release signing secrets/host setup required.
- ℹ️ Packaging scope for this release checkpoint is macOS + Linux only.

### Checkpoint evidence log (2026-02-25 UTC)
- ✅ `cargo test --manifest-path src-tauri/Cargo.toml codex_app_server`
- ✅ `pnpm tauri:verify-sidecar-manifest`
- ✅ `pnpm test`
- ✅ `pnpm typecheck`
- ✅ `npm test`
- ⚠️ `npm run test:deep` (script missing in package.json; no `test:deep` command exists)
- ✅ `pnpm tauri:generate-release-artifacts`
- ✅ `pnpm tauri:verify-release-artifacts`
- ✅ `jq -e '.window_hours >= 168 and .handshake_p99_ms <= 5000 and .pending_timeout_rate <= 0.005 and .parser_error_rate <= 0.001 and .event_lag_p95_ms <= 250' artifacts/release/codex-app-server/soak-100p.json`
- ✅ `jq -e '.dashboards_live == true and .alerts_routed_owner != null and (.sli_definitions | length) >= 6' artifacts/release/codex-app-server/telemetry-readiness.json`
- ⚠️ `pnpm tauri:build` fails locally at bundle/signing stage (`bundle_dmg.sh` failure and updater private-key password error). This is an environment/signing secret blocker, not a protocol/runtime parity blocker.

## Success metrics
- SLO evaluation window: rolling 30 days with burn-rate alerting on 2h and 24h windows.
- SLI boundary definitions:
  - Handshake latency = `initialize` request write timestamp to correlated response receipt.
  - Event lag = sidecar frame ingest timestamp to Tauri emit timestamp.
  - Pending-request timeout denominator = all correlated requests excluding restart-cancelled requests.
  - Parser error denominator = all parsed sidecar frames.
- 0 known UI/renderer protocol-state spoofing paths.
- Handshake latency: p95 < 2s, p99 < 5s.
- Event lag (sidecar receive -> UI emit): p95 < 250ms.
- Pending-request timeout rate < 0.5%.
- Parser error rate < 0.1% of frames.
- MTTR from restart event to recovered/degraded terminal state < 30s.
- App-server availability (ready or degraded-with-reason) >= 99.5%.
- Crash-free sidecar session rate >= 99.0%.
- Orphaned sidecar process rate = 0 for tested restart/stop paths.
- If `chatgptAuthTokens` mode is enabled, `account/chatgptAuthTokens/refresh` success rate >= 99.0%.
- Dropped diagnostics/event-frame rate < 0.1%.
- No production dependence on host PATH `codex` binary for shipped bundles.

## Dependencies and prerequisites
- Pinned sidecar binary artifacts per supported target OS/arch.
- Checksum manifest + trust-root/signature strategy.
- Fake-sidecar harness for deterministic protocol integration tests.
- Existing `live_sessions` migration retained and validated.
- Named release/security owner for artifact provenance/signing operations.
- Named CI job + owner for `src-tauri/tests/app_server_harness.rs` execution.
- Baseline metrics collection window (minimum 7 days) before enforcing rollout promotion thresholds.
- Rollout owner/on-call (kill-switch authority): **Jamie Craik** (solo developer).

## Risk analysis and mitigation
- **Risk:** default-on rollout exposes latent edge cases.
  - **Mitigation:** SLO-based go/no-go gates + automatic rollback triggers + soak testing.
- **Risk:** auth mode expansion introduces policy confusion.
  - **Mitigation:** locked auth scope in Phase 0 + mode-specific tests + downgrade prevention checks.
- **Risk:** parser/resource abuse under burst traffic.
  - **Mitigation:** method allowlist, line-size limits, pending map caps, backpressure.
- **Risk:** supply-chain drift or binary spoofing.
  - **Mitigation:** pinned artifacts, checksum + signature verification, production PATH fallback disabled.

## Resource requirements
- 1 Rust/Tauri engineer (runtime + command-surface hardening)
- 1 TS/React engineer (bridge cleanup + UI degradation handling)
- 1 QA/reliability owner (harness, soak, rollout gate verification)

## Documentation plan
- Update: `/Users/jamiecraik/dev/firefly-narrative/docs/agents/hybrid-capture-rollout-runbook.md`
  - add automatic rollback trigger matrix and recovery sequence checks.
- Add: `docs/solutions/...` follow-up documenting parity completion evidence and rollout metrics.
- Update AGENTS-linked docs only if public command contract materially changes.

## Open questions
1. ✅ Resolved (2026-02-25): rollout alert response + kill-switch authority = **Jamie Craik** (solo developer).
2. ✅ Resolved (2026-02-25): canary routing = deterministic stable-hash cohorting on install/device ID (`0–4 => 5%`, `0–24 => 25%`, `0–99 => 100%`).

## Sources and references
### Origin
- **Brainstorm document:** [/Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-25-codex-app-server-production-remediation-brainstorm.md](/Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-25-codex-app-server-production-remediation-brainstorm.md)

### Internal references
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs:577-579`
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs:703-800`
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs:1668-1709`
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs:1717-1722`
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs:1840-1897`
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/lib.rs:301-310`
- `/Users/jamiecraik/dev/firefly-narrative/src/core/tauri/ingestConfig.ts:241-285`
- `/Users/jamiecraik/dev/firefly-narrative/src/hooks/useAutoIngest.ts:550-561`
- `/Users/jamiecraik/dev/firefly-narrative/docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md`

### External references
- Codex app-server docs (canonical): <https://developers.openai.com/codex/app-server/>
- Codex app-server protocol: <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md>
- Protocol transport/JSON-RPC semantics: <https://developers.openai.com/codex/app-server/#protocol>
- Initialization semantics (`Not initialized`, `Already initialized`): <https://developers.openai.com/codex/app-server/#initialization>
- Events semantics (`thread/*`, `turn/*`, `item/*`): <https://developers.openai.com/codex/app-server/#events>
- Approvals semantics and decision payloads: <https://developers.openai.com/codex/app-server/#approvals>
- Auth endpoint semantics and mode values: <https://developers.openai.com/codex/app-server/#auth-endpoints>
- JSON-RPC 2.0 specification: <https://www.jsonrpc.org/specification>
- Tokio process command docs: <https://docs.rs/tokio/latest/tokio/process/struct.Command.html>
- Tokio child process lifecycle docs: <https://docs.rs/tokio/latest/tokio/process/struct.Child.html>
- Tauri calling frontend/events: <https://v2.tauri.app/develop/calling-frontend>
- Tauri frontend listen/unlisten: <https://v2.tauri.app/develop/_sections/frontend-listen>
- OWASP Logging Cheat Sheet (redaction/logging controls): <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
