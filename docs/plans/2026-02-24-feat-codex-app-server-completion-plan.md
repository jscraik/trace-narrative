---
title: feat: Complete Codex App Server runtime
type: feat
status: active
date: 2026-02-24
origin: /Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-24-codex-app-server-completion-brainstorm.md
---

# feat: Complete Codex App Server runtime


## Enhancement Summary

**Deepened on:** 2026-02-24
**Sections enhanced:** 15
**Research inputs used:**
- `/Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-24-codex-app-server-completion-brainstorm.md`
- `/Users/jamiecraik/dev/firefly-narrative/docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md`
- [Tauri event system](https://v2.tauri.app/develop/calling-rust/)
- [Tauri frontend listen API](https://v2.tauri.app/develop/_sections/frontend-listen/)
- [Tokio process/task docs](https://docs.rs/tokio)

### Section Manifest
- Overview, Problem, Scope, Brainstorm carry-over, Stakeholder Impact
- Proposed Solution + Technical Approach
- SpecFlow and risks
- Phase plan and system-wide impact
- Acceptance/metrics/testing/quality gates

### Key Improvements
- Internalized stream-state mutation model for Codex App Server
- Sidecar process lifecycle ownership in backend actor path
- Bounded persistence + event-driven approval behavior updates

### New Considerations Discovered
- Renderer direct stream-state writes are a compliance/reliability risk to remove before rollout.
- Completion persistence requires migration/version-safe cleanup policy under reconnect.
- Approval and protocol callbacks should be explicit event contracts.


## Table of Contents
- [Technical Review Addendum (2026-02-24)](#technical-review-addendum-2026-02-24)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Scope and Boundaries](#scope-and-boundaries)
- [What Was Carried From Brainstorm](#what-was-carried-from-brainstorm)
- [Stakeholder Impact](#stakeholder-impact)
- [Proposed Solution](#proposed-solution)
- [Technical Approach](#technical-approach)
  - [Architecture](#architecture)
  - [State Machine and Lifecycle](#state-machine-and-lifecycle)
  - [Sidecar Supervision](#sidecar-supervision)
  - [Stream Event Handling](#stream-event-handling)
  - [Persistence and Cleanup](#persistence-and-cleanup)
  - [Security and Recovery](#security-and-recovery)
  - [Frontend/TS Contract Updates](#frontendts-contract-updates)
- [SpecFlow Analysis](#specflow-analysis)
  - [Functional Gaps](#functional-gaps)
  - [Flow Gaps](#flow-gaps)
  - [Risk Gaps](#risk-gaps)
- [Implementation Plan](#implementation-plan)
  - [Execution Owner Map](#execution-owner-map)
  - [Prioritized Execute-First Phase Order](#prioritized-execute-first-phase-order)
  - [Phase 0 — Baseline Hardening](#phase-0--baseline-hardening)
  - [Phase 1 — Sidecar actor + lifecycle](#phase-1--sidecar-actor--lifecycle)
  - [Phase 2 — Protocol handshake and approvals](#phase-2--protocol-handshake-and-approvals)
  - [Phase 3 — Stream completion + persistence](#phase-3--stream-completion--persistence)
  - [Phase 4 — Security and operations hardening](#phase-4--security-and-operations-hardening)
  - [Phase 5 — Verification and release gates](#phase-5--verification-and-release-gates)
- [System-wide Impact](#system-wide-impact)
  - [Interaction graph](#interaction-graph)
  - [Error propagation](#error-propagation)
  - [State lifecycle risks](#state-lifecycle-risks)
  - [API surface parity](#api-surface-parity)
- [Acceptance Criteria](#acceptance-criteria)
- [Success Metrics](#success-metrics)
- [Dependencies and Risks](#dependencies-and-risks)
- [Testing Strategy](#testing-strategy)
- [Open Questions](#open-questions)
- [Resources and References](#resources-and-references)

## Technical Review Addendum (2026-02-24)

### Actionable fixes from technical review

- [x] Introduce a **migration-safe deprecation path** for internal-only command removal:
  - Keep `codex_app_server_set_stream_health` and `ingest_codex_stream_event` available for one release via internal aliases.
  - Add `#[deprecated]`-style TODO in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs` and `/Users/jamiecraik/dev/firefly-narrative/src/lib.rs`.
  - Remove renderer calls from TS/React in `/Users/jamiecraik/dev/firefly-narrative/src/core/tauri/ingestConfig.ts` and `/Users/jamiecraik/dev/firefly-narrative/src/hooks/useAutoIngest.ts` only after event-path is in place.
  - Delete public commands in a follow-up step once no runtime path depends on them.
- [x] Define explicit event contracts for all new server-emitted events and publish exact payloads.
- [x] Expand sidecar supervisor architecture with explicit async lifecycle ownership and shutdown semantics (start/monitor/terminate/join behavior).
- [x] Add `live_sessions` migration details (table, indexes, backfill, cleanup policy) before implementation begins.
- [x] Add concrete observability and recovery metrics for parser failures, approval outcomes, restart causes, and dropped-completion events.
- [x] Update rollout runbook checklist to remove references to UI-driven stream-health writes and add assertions for event-driven flow.

### Event Contract (must align frontend + backend)

Recommended payload schema to reduce implementation ambiguity:

```rust
// Backend event: session lifecycle updates
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LiveSessionEventPayload {
  SessionDelta {
    thread_id: String,
    turn_id: String,
    item_id: String,
    event_type: String,          // e.g. item/delta, item/completed
    source: String,              // app_server_stream | otel
    sequence_id: u64,
    received_at_iso: String,
    payload: serde_json::Value,
  },
  ApprovalRequest {
    request_id: String,
    thread_id: String,
    turn_id: String,
    command: String,
    options: Vec<String>,
    timeout_ms: u64,
  },
  ApprovalResult {
    request_id: String,
    thread_id: String,
    approved: bool,
    decided_at_iso: String,
    decided_by: Option<String>,
    reason: Option<String>,
  },
  ParserValidationError {
    kind: String,               // schema_mismatch | missing_fields | protocol_violation
    raw_preview: String,
    reason: String,
    occurred_at_iso: String,
  },
}

// Tauri event name
pub const LIVE_SESSION_EVENT: &str = "session:live:event";
```

Frontend TypeScript mirror:

```ts
type LiveSessionEventPayload =
  | { type: 'SessionDelta'; threadId: string; turnId: string; itemId: string; eventType: string; source: 'app_server_stream' | 'otel'; sequenceId: number; receivedAtIso: string; payload: unknown }
  | { type: 'ApprovalRequest'; requestId: string; threadId: string; turnId: string; command: string; options: string[]; timeoutMs: number }
  | { type: 'ApprovalResult'; requestId: string; threadId: string; approved: boolean; decidedAtIso: string; decidedBy?: string; reason?: string }
  | { type: 'ParserValidationError'; kind: 'schema_mismatch' | 'missing_fields' | 'protocol_violation'; rawPreview: string; reason: string; occurredAtIso: string };
```

### Async sidecar supervisor requirements

- Store process handle + monitor task handles in actor state.
- Start monitor task immediately after spawn and register cancellation token.
- On stop/shutdown:
  - set transition to stopping,
  - cancel monitor loops,
  - wait for graceful timeout,
  - hard-kill fallback,
  - clear process/handle state under lock in a `finally`-like path.
- Persist restart attempts in memory only and reset on successful steady-state transition.

### `live_sessions` migration checklist (must be completed before stream persistence work)

- Add migration file under `/Users/jamiecraik/dev/firefly-narrative/src-tauri/migrations/`:
  - `CREATE TABLE live_sessions (...)`
  - unique index on `(thread_id, turn_id, item_id, event_type)`,
  - index on `last_activity_at`,
  - index on `status`.
- Define retention policy:
  - `TTL_HOURS` default and `MAX_ROWS` hard cap,
  - cleanup query executed on completion/startup/reconnect.
- Include migration integration test and rollback expectation in `cargo test`.

### Parser and approval observability

- Add metric counters:
  - `codex_app_server_parse_error_total{kind}`,
  - `codex_app_server_approval_result_total{outcome}`,
  - `codex_app_server_restart_total{cause}`.
- Add reasoned log entries for dropped or rejected completions with correlation ids.

### Runbook delta (minimum required)

- Replace UI-driven stream health expectation with:
  - sidecar startup + initialized + authenticated + stream event handshake,
  - captured `session:live:event` and approval callback behavior,
  - restart budget state transitions.

### Updated acceptance mapping (new explicit checks)

- [ ] `session:live:event` listener receives all event types above for a synthetic frame sequence in integration test.
- [x] No direct renderer call can mutate stream health at runtime; attempt should return explicit command-not-exposed error.
- [x] `live_sessions` migration applied and cleanup policy is verifiable with deterministic row-count assertions.
- [x] At least one test asserts parser error event emission and one that asserts approval-result round-trip.
- [x] Crash-loop recovery follows defined async shutdown cleanup and restart backoff behavior.

## Overview
Ship the remaining Codex App Server runtime completion work as a scoped `feat` for this repository, excluding universal plan tracks. This plan converts the current status-only and UI-controlled behavior into a sidecar-owned runtime with supervised process lifecycle, real initialize/initialized handshake completion, internal stream event handling, and bounded persistence of completed live sessions.


### Research Insights

- Keep this plan’s boundary tight: runtime completion only, no adapter-framework expansion.
- Use backend actor ownership + explicit event contract (status transitions and session events).
- Target reliability over feature breadth: prioritize deterministic state transitions before UI polish.
## Problem Statement / Motivation
Current Codex App Server behavior is not yet complete for production use because the runtime is not owning stream process lifecycle or enforcing protocol-level stream integrity. Evidence of the gap includes:
- `start_codex_app_server` only updates in-memory status and sets a warning when the binary exists (no spawn/supervision path) in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs:361-377`.
- Handshake is currently a flag-only change (`codex_app_server_initialize` and `codex_app_server_initialized`) with no real completion path in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs:399-420`.
- Stream health and stream-event ingest are still renderer-callable commands (`codex_app_server_set_stream_health`, `ingest_codex_stream_event`) and not internal-only control paths.
- `useAutoIngest` currently sets stream health directly from UI flow, which bypasses server-side state truth and creates spoofable/degraded states: see `/Users/jamiecraik/dev/firefly-narrative/src/hooks/useAutoIngest.ts:413-420`.


### Research Insights

- `start_codex_app_server` and stream health mutability are currently weakly enforced; this is a process-owner and trust-boundary issue.
- Evidence from current files shows placeholder behavior and UI-mutable stream state are incompatible with crash-safe production behavior.
- Recommended acceptance: prove end-to-end that only sidecar callbacks can change stream health and session lifecycle status.
## Scope and Boundaries
- **In scope:** Codex App Server-only runtime completion (Tauri backend + TS command bridge + auto-ingest orchestration and tests).
- **Out of scope:** Universal adapter framework, OTLP adapter manager, MCP discover/reconnect architecture, Kimi integration, IDE/CLI extension tracks.
- **Source of truth:** `/Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-24-codex-app-server-completion-brainstorm.md` (must keep decisions intact; see section below).


### Research Insights

- Keep out-of-scope work explicit to avoid accidental creep (MCP, adapter manager, extension tracks).
- Maintain migration/backfill work inside `src-tauri` + TS hooks only.
- Include rollback path and feature-flag notes for any environment mismatch.
## What Was Carried From Brainstorm
(see brainstorm: `/Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-24-codex-app-server-completion-brainstorm.md`)

- Decision 1: Codex App Server-only scope; exclude broader universal work.
- Decision 2: Sidecar supervision (`spawn/monitor/shutdown/reconnect`) is mandatory.
- Decision 3: Stream activation requires real `initialize` + `initialized` flow.
- Decision 4: Emit `session:live:event` and approval-result events internally, not via raw renderer commands.
- Decision 5: Persist completed sessions through app-server path + bounded cleanup (`live_sessions` LRU).
- Decision 6: Minimal hardening only where relevant to Codex App Server runtime.


### Research Insights

- Preserve all listed decisions as non-negotiable constraints and reference their source file in implementation notes.
- Add traceability in plan phases: each decision maps to file(s) + tests.
## Stakeholder Impact
- **Users:** more reliable capture status (`HYBRID_ACTIVE`, fallback behavior), fewer silent drop scenarios, clearer degraded/failure states.
- **Engineers:** cleaner runtime ownership boundary and fewer renderer side-effects in state transitions.
- **Operations:** deterministic restart policy and auditability via events/logs and migration-safe runbook.


### Research Insights

- Users get explicit mode visibility (`HYBRID_ACTIVE`, `DEGRADED_STREAMING`, fallback paths).
- Engineers get reduced side-effects from UI writes to runtime state.
- Operations can run deterministic recovery paths from runbook checklists.
## Proposed Solution
Implement an actor-first runtime where the sidecar process is managed in Rust, emits lifecycle events to Tauri, and processes stream protocol frames internally. The frontend should only observe events and request top-level lifecycle operations.

- Replace in-process placeholders with a runtime actor capable of spawn + stderr/stdout supervision + reconnect behavior.
- Enforce handshake contract (`initialize`→`initialized`) as gate for stream activity requests and thread snapshots.
- Convert stream event ingestion from renderer-invokable mutators to internal runtime paths that:
  - perform dedupe,
  - emit `session:live:event`,
  - and persist completed sessions.
- Add `live_sessions` persistence + periodic LRU cleanup.
- Update hook/test contracts and runbook assertions to reflect the true runtime behavior.


### Research Insights

- Recommended architecture is “control via commands, state via internal actor + sidecar stream callbacks”.
- Avoid generic process-manager frameworks in this cycle; keep actor minimal and testable.
- Add event names in a shared constant for frontend listeners.
## Technical Approach

### Architecture
Create a dedicated Codex App Server runtime actor module extension in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs` and keep public Tauri commands strictly as safe control/read methods.

- **New runtime state additions:** child process handle, child monitor task handles, last handshake timestamps, reconnect policy state, approval waiter map, and in-memory completion buffers.
- **Command ownership model:**
  - Keep commands: start/stop/status/init/auth/kill-switch/thread snapshot/check reliability/logs.
  - Remove renderer invocation paths for `codex_app_server_set_stream_health` and `ingest_codex_stream_event`.
- **Event bus:** continue to emit `codex-app-server-status` and transition events; add stream/session/approval events with established names.

### State Machine and Lifecycle
Move from stringly ad-hoc state to explicit enums for:
- process state (`inactive`, `starting`, `running`, `degraded`, `crash_loop`, `error`),
- auth state (`needs_login`, `authenticating`, `authenticated`, `logged_out`),
- handshake state (`not_started`, `initialize_sent`, `initialized`),
- stream session state (`disabled`, `expected`, `alive`, `completed`, `failed`).

Update transitions in a single helper so every transition updates `last_transition_at_iso` and emits status.

### Sidecar Supervision
In `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs`:
- Detect and spawn executable path discovered by `detect_sidecar_path`.
- Track child PID and stderr/stdout readers.
- Implement `graceful_shutdown` with timeout and hard kill fallback.
- Enforce restart budget and cooldown windows:
  - preserve `RESTART_BUDGET`/window behavior, but make it actor-owned.
  - on budget exceed enter crash-loop state until manual recovery.
- Emit explicit status transitions on start/stop/restart/failure.

### Stream Event Handling
In `ingest_codex_stream_event` path:
- Make this function internal (non-`#[command]`) and callable only from actor/monitored sidecar callbacks.
- Add typed parser for sidecar protocol frames (complete + event types + ids).
- On completion events:
  - build/normalize `ParsedSession`,
  - pass through redaction + dedupe + existing canonical persistence helpers.
- On non-completion/delta events:
  - maintain bounded buffers and log decisions as before.
- Emit `session:live:event` from backend on user-facing deltas and approvals.

### Persistence and Cleanup
Add bounded persistence at `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src` and migrations:
- Add `live_sessions` table with:
  - `session_id`, `thread_id`, `repo_id`, `last_activity_at`, `payload`, `source`, `status`, `created_at`, `updated_at`, dedupe keys.
- Implement LRU retention on `last_activity_at` and max rows + TTL policy.
- Add repository-level cleanup task called:
  - on completion,
  - on startup,
  - and during reconnect recovery.
- Ensure stream completion persistence is audit logged in existing ingestion logs and/or dedicated status entries.

### Security and Recovery
- Reconnect policy validation:
  - only reconnect when auth/session validation passes,
  - preserve session schema/version checks.
- Harden input and status validation for protocol frames and runtime commands.
- Ensure token rotation/refresh and auth mode mismatch still fail closed.
- Keep `codex_app_server_set_stream_kill_switch` and auth gates as the only way to disable stream flow.

### Frontend/TS Contract Updates
In `/Users/jamiecraik/dev/firefly-narrative/src/core/tauri/ingestConfig.ts` and `/Users/jamiecraik/dev/firefly-narrative/src/hooks/useAutoIngest.ts`:
- Remove invocations of `codexAppServerSetStreamHealth`; keep UI/flow only requesting start/stop/init/initialized and auth operations.
- Add helper wrappers for new internal-safe events if required for UI status telemetry.
- Update listener behavior to consume server-emitted `session:live:event`/approval results.
- Update tests under `/Users/jamiecraik/dev/firefly-narrative/src/hooks/__tests__/useAutoIngest.test.ts` and mocks.


### Research Insights

- Split into five concerns: supervision, protocol, stream ingest, persistence, security.
- For each concern define invariant, failure mode, transition rule, and test coverage.
- Align with earlier hardening learnings where authenticated state must be authoritative.

### Event Contract and Async Supervision (Review addendum)

- Define the actor lifecycle transition graph before coding:
  - `inactive -> starting -> running -> healthy/degraded -> crash_loop -> inactive`.
- Keep event emission for both transition and protocol events as the only source of truth.
- Ensure monitor tasks are tied to actor-owned cancellation handles and cannot survive `stop_codex_app_server` return.
## SpecFlow Analysis

### Functional Gaps
1. Runtime ownership is incomplete: sidecar process is currently detected only, not managed.
2. Stream health can be spoofed from renderer (`codexAppServerSetStreamHealth`) instead of coming from protocol/actor callback.
3. Completion persistence path for stream sessions absent, so app-server stream can be non-authoritative for final ingestion.
4. Approval flow is not surfaced from sidecar events to user action/retry controls.

### Flow Gaps
- Missing guaranteed transition path from `initialize` -> `initialized` -> `authenticated` -> `stream_healthy` before allowing session requests.
- Recovery path does not include process state cleanup, event replay, and LRU cleanup for stale in-flight state.
- Runbook checklist still assumes status-only behavior, not real actor lifecycle.

### Risk Gaps
- Security posture around reconnect/auth verification remains soft.
- No bounded persistence for completed stream sessions leaves recovery and evidence gaps.
- Logging exists for dedupe decisions but lacks explicit completion/approval lifecycle audit.


### Research Insights

- Keep analysis as implementation contracts: each functional/flow/risk gap should map to a concrete test assertion.
- Add guardrail tests for forbidden UI commands.
## Implementation Plan

### Execution Owner Map
- **Runtime Owner** — Rust/Tauri runtime lifecycle and command surface (`/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs`, `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/lib.rs`).
- **Protocol Owner** — handshake/approval/event payload contracts and parser integrity.
- **Data Owner** — SQLite migrations and bounded retention (`/Users/jamiecraik/dev/firefly-narrative/src-tauri/migrations/`).
- **Frontend Owner** — Tauri wrappers/listeners and hook behavior (`/Users/jamiecraik/dev/firefly-narrative/src/core/tauri/ingestConfig.ts`, `/Users/jamiecraik/dev/firefly-narrative/src/hooks/useAutoIngest.ts`).
- **QA Owner** — test matrix and deterministic assertions (`cargo test`, `pnpm test`).
- **Ops Owner** — runbook validation and release readiness (`/Users/jamiecraik/dev/firefly-narrative/docs/agents/hybrid-capture-rollout-runbook.md`).

### Prioritized Execute-First Phase Order
1. **Phase 0 — Baseline Hardening (blocker):** must land first to lock safety rails and migration scaffold.
2. **Phase 1 — Sidecar actor + lifecycle:** establish process ownership and shutdown guarantees before protocol work.
3. **Phase 2 — Protocol handshake and approvals:** enforce authenticated/initialized gates before any persistence path.
4. **Phase 3 — Stream completion + persistence:** internal ingest + storage only after lifecycle and protocol are deterministic.
5. **Phase 4 — Security and operations hardening:** close reconnect/validation gaps on top of stable runtime behavior.
6. **Phase 5 — Verification and release gates:** final cross-layer validation and runbook sign-off before release.

### Phase 0 — Baseline Hardening
- [x] **P0-01** — Owner: **Runtime Owner**  
      Add state-machine unit tests in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs` for lifecycle states and restart budget (`>= 3 restarts in 60s`).
- [x] **P0-02** — Owner: **Runtime Owner**  
      Add command-surface hardening tests proving renderer cannot mutate stream health directly.
- [x] **P0-03** — Owner: **Data Owner**  
      Add `live_sessions` migration scaffold + migration tests in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/migrations/`.
- [x] **P0-04** — Owner: **QA Owner**  
      Ensure phase test commands pass locally: `cargo test` for runtime module and targeted `pnpm test` for ingest/hook mocks.
- [x] **Exit gate (required):** No phase-1 work starts until P0-01..P0-04 are green.

### Phase 1 — Sidecar actor + lifecycle
- [x] **P1-01** — Owner: **Runtime Owner**  
      Implement sidecar actor struct + supervisor loop (spawn/monitor/shutdown/reconnect) in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs`.
- [x] **P1-02** — Owner: **Runtime Owner**  
      Update `start_codex_app_server` to spawn process and transition `starting -> running` only after readiness signal.
- [x] **P1-03** — Owner: **Runtime Owner**  
      Update `stop_codex_app_server` to cancel monitor tasks, graceful-stop, timeout, hard-kill fallback, and final state cleanup.
- [x] **P1-04** — Owner: **Protocol Owner**  
      Emit transition/status events on every lifecycle change; ensure event payload shape is stable.
- [ ] **P1-05** — Owner: **QA Owner**  
      Add integration tests for start failure, crash-loop, and controlled shutdown behavior.
- [ ] **Exit gate (required):** Actor owns process lifecycle end-to-end with deterministic cleanup after stop.

### Phase 2 — Protocol handshake and approvals
- [x] **P2-01** — Owner: **Protocol Owner**  
      Replace boolean handshake state with explicit protocol state enum and transition helpers.
- [x] **P2-02** — Owner: **Protocol Owner**  
      Enforce `initialize -> initialized -> authenticated` before enabling stream healthy state or thread snapshot access.
- [x] **P2-03** — Owner: **Frontend Owner**  
      Wire `session:live:event` approval request/result handling in UI flow and remove any bypass paths.
- [x] **P2-04** — Owner: **Runtime Owner**  
      Restrict auth promotion to valid callback state (`account_updated(auth_mode=\"chatgpt\", authenticated=true)`).
- [ ] **P2-05** — Owner: **QA Owner**  
      Add tests for handshake gating, approval round-trip, and denied/timeout approval paths.
- [ ] **Exit gate (required):** Approval and handshake behavior proven by tests; no stream activation without full protocol gate.

### Phase 3 — Stream completion + persistence
- [x] **P3-01** — Owner: **Runtime Owner**  
      Internalize stream ingest path by removing public `#[command]` exposure for `codex_app_server_set_stream_health` and `ingest_codex_stream_event`.
- [x] **P3-02** — Owner: **Protocol Owner**  
      Parse sidecar callback payloads into typed `ParsedSession` and emit `session:live:event` deltas/errors.
- [ ] **P3-03** — Owner: **Data Owner**  
      Persist completed sessions through canonical store helpers and apply dedupe keys/indexes.
- [x] **P3-04** — Owner: **Data Owner**  
      Implement bounded `live_sessions` cleanup policy (TTL + row cap) on completion/startup/reconnect.
- [x] **P3-05** — Owner: **QA Owner**  
      Add deterministic tests for parser error emission, dedupe outcomes (`accepted|duplicate|replaced|dropped`), and retention cleanup.
- [ ] **Exit gate (required):** Completed stream sessions persist reliably and cleanup policy remains bounded under load tests.

### Phase 4 — Security and operations hardening
- [ ] **P4-01** — Owner: **Runtime Owner**  
      Tighten reconnect checks (schema/session/token validation) and normalize failure reasons.
- [x] **P4-02** — Owner: **Protocol Owner**  
      Add explicit observability metrics/logs for parse errors, approval outcomes, restart causes, and dropped completions.
- [x] **P4-03** — Owner: **Ops Owner**  
      Update `/Users/jamiecraik/dev/firefly-narrative/docs/agents/hybrid-capture-rollout-runbook.md` with new actor-owned verification steps and evidence capture.
- [ ] **P4-04** — Owner: **QA Owner**  
      Add security/regression tests for reconnect failure modes and command-surface guardrails.
- [ ] **Exit gate (required):** Runbook and telemetry prove operational recovery paths without UI-side mutation.

### Phase 5 — Verification and release gates
- [x] **P5-01** — Owner: **QA Owner**  
      Run full validation suite (`cargo test`, `pnpm test`, stream recovery smoke) and archive results.
- [x] **P5-02** — Owner: **Ops Owner**  
      Complete rollout checklist and mark each operational assertion verified in `/Users/jamiecraik/dev/firefly-narrative/docs/agents/hybrid-capture-rollout-runbook.md`.
- [ ] **P5-03** — Owner: **Runtime Owner**  
      Update plan status references in `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-19-feat-hybrid-codex-claude-capture-reliability-plan.md` if completion criteria are satisfied.
- [x] **P5-04** — Owner: **Frontend Owner**  
      Validate final TS command/event contract parity with Rust exports and test mocks.
- [ ] **Exit gate (release):** All phase gates passed, no open P0/P1 defects, runbook and tests signed off.


### Research Insights

- Validate phase order: ownership first, protocol second, persistence third, security fourth, gates last.
- Add phase-specific exit criteria (not just task completion).
- Ensure each phase updates at least one test file and one reference checklist item.
## System-wide Impact

### Interaction Graph
1. User enables auto-ingest in settings.
2. `useAutoIngest` calls `startCodexAppServer`.
3. Backend actor spawns sidecar and emits status transitions.
4. Sidecar emits protocol frames/approval requests.
5. Backend emits `session:live:event` and updates capture mode.
6. Completed session events persist through canonical session store and appear in UI activity.
7. Recovery actions call actor stop/start/auth commands and re-enter handshake.

### Error Propagation
- Startup error: process spawn/readiness errors set status with last error and move to degraded/crash_loop.
- Handshake error: remains degraded and cannot access thread snapshot until initialized/authenticated.
- Stream parse error: logs drop + optional audit entry, keeps stream healthy false only if policy demands.
- Persist errors: treated as dropped completion + explicit logs without masking overall process health.

### State Lifecycle Risks
- **Partial start failures:** actor should emit stop/cleanup and remove stale process handles before retry.
- **Duplicate completion events:** dedupe logic remains bounded and deterministic; repeated inserts become no-op via dedupe_key/index.
- **Orphaned sessions:** LRU cleanup should prevent unbounded retention for aborted sessions.
- **Crash-loop drift:** bounded backoff/retry counters must be persisted in memory only; no cross-boot state leak.

### API Surface Parity
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/lib.rs` command list must reflect removal of direct UI-mutable stream commands.
- `/Users/jamiecraik/dev/firefly-narrative/src/core/tauri/ingestConfig.ts` wrappers must stay aligned with Rust commands.
- Test mocks in `/Users/jamiecraik/dev/firefly-narrative/src/hooks/__tests__/useAutoIngest.test.ts` must match the updated wrapper set.


### Research Insights

- Document cross-layer callback chain (hook -> command -> sidecar -> event -> persistence).
- Track error classes so operations can route incidents correctly (process, protocol, persistence, auth).
## Acceptance Criteria
- [x] Codex App Server can spawn/supervise and shut down a real sidecar process.
- [x] `initialize` and `initialized` are enforced as a prerequisite for stream operations.
- [x] `session:live:event` is emitted by server internals and consumed by frontend listener.
- [x] Approval requests are surfaced in app flow and user can submit decision.
- [ ] Completed stream sessions are persisted to `live_sessions`/canonical sessions path with bounded cleanup.
- [x] `codex_app_server_set_stream_health` and `ingest_codex_stream_event` are no longer public renderer commands.
- [ ] Recovery/reconnect behavior is hardened (token/schema checks + reconnect and backoff policy).
- [x] Runbook checklist reflects completed checks and no false-positive placeholders remain.


### Research Insights

- Convert each acceptance item into a test-case mapping (path + assertion).
- Add negative assertions for renderer-attempted bypass of internal methods.
## Success Metrics
- Capture mode stability:
  - `HYBRID_ACTIVE` recovery to healthy after intentional sidecar restart within target MTTR.
- Session completeness:
  - ≥95% of stream `item/completed` events persist or are explicitly and audibly dropped.
- Reliability:
  - zero UI-spoofed stream health flips in integration tests.
- Safety:
  - bounded live_sessions growth under sustained streams.


### Research Insights

- Define explicit measurable thresholds: restart recovery p95, completion persistence ratio, no UI-only stream-health flips in tests, bounded growth.
- Keep these metrics in PR description and release notes.
## Dependencies and Risks
- **Dependencies:** `tokio` process APIs, SQLite migration tooling, existing session persistence helpers in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/import/commands.rs`.
- **Risks:** missing sidecar binary in dev/prod, protocol drift between sidecar and parser, long-running actor lifecycle complexity, migration backfill for existing sessions.
- **Mitigations:** feature-flaged rollout path, fallback OTEL-only behavior, explicit runbook-run checks.


### Research Insights

- Separate technical dependencies from operational dependencies.
- For each risk, define owner + mitigation test to prevent stale unresolved risk items.
- Keep migration dependency explicit with versioned schema migration path.
## Testing Strategy
- Rust tests:
  - Unit tests in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs` for state machine and lifecycle.
  - Existing integration-style tests under `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/import/commands.rs` helpers for persistence behavior.
- Frontend tests:
  - `vitest` tests in `/Users/jamiecraik/dev/firefly-narrative/src/hooks/__tests__/useAutoIngest.test.ts`.
  - Update mocks for removed wrappers and event-driven flow.
- Runbook and docs:
  - `pnpm test` (or relevant subsets) and update checks in `/Users/jamiecraik/dev/firefly-narrative/docs/agents/hybrid-capture-rollout-runbook.md`.


### Research Insights

- Rust: unit tests for state transitions and command hardening; integration tests for process lifecycle.
- TS: hook tests for event listener updates and wrapper contract.
- Docs: runbook smoke checks should be explicit acceptance steps.
## Open Questions
- None.


### Research Insights

- Current state is “None”; if this changes, convert each question into a follow-up issue to keep this plan executable.
## Resources and References
- **Origin:** [`/Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-24-codex-app-server-completion-brainstorm.md`](/Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-24-codex-app-server-completion-brainstorm.md)
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/codex_app_server.rs`
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/lib.rs`
- `/Users/jamiecraik/dev/firefly-narrative/src/core/tauri/ingestConfig.ts`
- `/Users/jamiecraik/dev/firefly-narrative/src/hooks/useAutoIngest.ts`
- `/Users/jamiecraik/dev/firefly-narrative/src/hooks/__tests__/useAutoIngest.test.ts`
- `/Users/jamiecraik/dev/firefly-narrative/docs/agents/hybrid-capture-rollout-runbook.md`
- `/Users/jamiecraik/dev/firefly-narrative/docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md`
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-19-feat-hybrid-codex-claude-capture-reliability-plan.md`

### Research Insights

- Add direct source links (docs + local files) and keep one line per artifact for auditability.
- Keep a short note that this plan is derived from the brainstorm file and includes only scoped completion work.
