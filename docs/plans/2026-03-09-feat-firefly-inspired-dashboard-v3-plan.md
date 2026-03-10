---
title: "feat: firefly-inspired Dashboard v3 Implementation Plan"
type: feat
status: active
date: 2026-03-09
origin: /Users/jamiecraik/dev/trace-narrative/firefly-inspired-v3.html
spec: docs/specs/2026-03-09-feat-firefly-inspired-dashboard-v3-spec.md
---

## Table of Contents

- [Overview](#overview)
- [Enhancement Summary](#enhancement-summary)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Scope and Non-Goals](#scope-and-non-goals)
- [Planning Inputs to Honor](#planning-inputs-to-honor)
- [Implementation Phases](#implementation-phases)
- [Phase Dependencies](#phase-dependencies)
- [Dependencies and Risks](#dependencies-and-risks)
- [Test and Validation Strategy](#test-and-validation-strategy)
- [Rollout / Migration / Monitoring](#rollout--migration--monitoring)
- [Acceptance Checklist](#acceptance-checklist)
- [Sources & References](#sources--references)

## Overview

Implement the v3 dashboard as the new Trace Narrative app layout by following the spec exactly and reusing existing app-shell, telemetry, redaction, and Tauri capability patterns already present in the repo. The plan is sequenced to land contract-critical behavior first, then visual migration, then density/performance work, then rollout evidence and promotion gates.

## Enhancement Summary

**Deepened on:** 2026-03-09  
**Key areas improved:** spec alignment, sequencing, validation, rollout determinism, rollout evidence rigor

- Replaced stale plan assumptions with the current spec model: top-level `DashboardState`, separate `DashboardTrustState`, and `PanelStatusMap` for partial degradation.
- Added deterministic retry-budget, gate-math, artifact-schema, and rollback tasks so rollout decisions can be computed and audited.
- Anchored implementation to real repo files, real package scripts, and existing dashboard/telemetry/capability test surfaces.
- Added explicit phase prerequisites, multi-window isolation coverage, permission-context-change validation, and frozen-baseline rules so rollout math stays operator-stable.

## Problem Statement / Motivation

The HTML demo establishes the desired direction for the new app layout, but shipping it safely requires more than a visual port. The production build must preserve the existing `dashboard -> repo -> dashboard` loop, adopt the spec's fail-closed Tauri authority model, enforce reduced-motion and accessibility parity, and support high-density visualization with explicit fallback and rollout evidence. The prior plan draft no longer matches the hardened spec, so this updated plan focuses on execution order and proof rather than redefining behavior.

## Scope and Non-Goals

### Scope

1. Implement the v3 dashboard layout and interaction model inside the existing app shell.
2. Wire the spec's current state model:
   - top-level `DashboardState`: `default | loading | empty | error | offline | permission_denied`
   - trust overlay: `DashboardTrustState`
   - partial panel outcomes via `PanelStatusMap`
3. Add spec-required source-authority, stale-drop, retry-budget, redaction, and command-authority behavior.
4. Adopt the canonical dense-chart strategy from the spec (`echarts-canvas`) plus the accessible table fallback.
5. Add release-blocking tests, rollout artifacts, and promotion-gate computation required by the spec.
6. Add the spec-approved dense-chart dependency if it is still absent, with explicit lockfile, bundle-delta, and license review work.

### Non-Goals

1. Changing the spec contract.
2. Reworking ingest pipelines, OTEL collector internals, or branch narrative scoring.
3. Rebranding non-dashboard surfaces.
4. Adding extra visualization dependencies beyond the spec-approved chart dependency.
5. Broadening Tauri permissions beyond the minimum required for the dashboard path.

## Planning Inputs to Honor

1. Authoritative source: [2026-03-09-feat-firefly-inspired-dashboard-v3-spec.md](/Users/jamiecraik/dev/trace-narrative/docs/specs/2026-03-09-feat-firefly-inspired-dashboard-v3-spec.md)
2. Visual origin: [firefly-inspired-v3.html](/Users/jamiecraik/dev/trace-narrative/firefly-inspired-v3.html)
3. Architecture context:
   - [manifest.json](/Users/jamiecraik/dev/trace-narrative/.diagram/manifest.json)
   - [architecture.mmd](/Users/jamiecraik/dev/trace-narrative/.diagram/architecture.mmd)
4. Existing implementation anchors:
   - [App.tsx](/Users/jamiecraik/dev/trace-narrative/src/App.tsx)
   - [DashboardView.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/DashboardView.tsx)
   - [TopNav.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/TopNav.tsx)
   - [DashboardHeader.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/DashboardHeader.tsx)
   - [MetricsGrid.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/MetricsGrid.tsx)
   - [MetricCard.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/MetricCard.tsx)
   - [TopFilesTable.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/TopFilesTable.tsx)
   - [DashboardLoadingState.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/DashboardLoadingState.tsx)
   - [DashboardEmptyState.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/DashboardEmptyState.tsx)
   - [DashboardErrorState.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/DashboardErrorState.tsx)
   - [types.ts](/Users/jamiecraik/dev/trace-narrative/src/core/types.ts)
   - [attribution-api.ts](/Users/jamiecraik/dev/trace-narrative/src/core/attribution-api.ts)
   - [narrativeTelemetry.ts](/Users/jamiecraik/dev/trace-narrative/src/core/telemetry/narrativeTelemetry.ts)
   - [toolSanitizer.ts](/Users/jamiecraik/dev/trace-narrative/src/core/security/toolSanitizer.ts)
   - [redact.ts](/Users/jamiecraik/dev/trace-narrative/src/core/security/redact.ts)
   - [default.json](/Users/jamiecraik/dev/trace-narrative/src-tauri/capabilities/default.json)
   - [dashboard.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/attribution/dashboard.rs)
   - [lib.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/lib.rs)
5. Repo-local learnings to preserve:
   - strict authority ladders, not heuristic health promotion
   - artifact-backed promotion and rollback
   - hard denominator math for rates and burn conditions
   - forbidden-command/capability guardrail tests
6. External guidance to preserve in planning detail:
   - Tauri v2 capability files, permission sets, command scopes, and runtime authority remain the primary least-privilege boundary
   - React 19 transitions keep urgent input updates synchronous while heavy dashboard recompute can be deferred or transitioned
   - WCAG 2.2 reduced-motion, pause/stop/hide, and APG keyboard/focus checks remain release-gating validation, not optional polish

## Implementation Phases

### Phase 0: Preflight and Execution Contract

1. Reconcile the code touch list against the spec and current files.
2. Record one implementation note that maps spec sections to delivery checkpoints:
   - state machine and trust overlay
   - redaction and permission-safe residual content
   - release-blocking events and metrics
   - artifact pack and rollback runbook
3. Confirm that existing package scripts are the execution gates:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:deep`
   - `pnpm test:e2e`
   - `pnpm test:perf`
   - `pnpm test:artifacts`
   - `pnpm tauri:verify-rollout-artifacts`
   - `pnpm tauri:verify-release-artifacts`
   - `pnpm tauri:verify-trust-rollout-gates`
4. Define the rollout cohort table in one place:
   - Stage A: internal maintainers / explicit opt-in cohort
   - Stage B: 25 percent cohort
   - Stage C: 100 percent cohort
5. Confirm artifact roots exist or are created by existing scripts:
   - `artifacts/rollout/dashboard-v3/`
   - `artifacts/release/codex-app-server/`
   - `artifacts/test/`
6. Confirm dependency baseline before feature work starts:
   - if `echarts-canvas` is absent from `package.json`, land dependency plus lockfile plus bundle-review note before Phase 3 UI work
   - record the expected bundle-delta review output in implementation notes so perf regression checks have a baseline

Exit criteria:

1. File touch list is final.
2. Existing verification scripts are confirmed and referenced correctly.
3. No stale pre-spec assumptions remain in execution notes.
4. Cohort table and denominator policy are explicit.
5. Dependency and bundle-review prerequisites for `echarts-canvas` are explicit.

### Phase 1: Contract and State Wiring

1. Update shared dashboard types to match the spec exactly:
   - `DashboardState`
   - `DashboardTrustState`
   - `DashboardPanelStatus`
   - `PanelStatusMap`
   - retry budget profiles by environment
   - `CommandAuthorityOutcome`
2. Refactor [DashboardView.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/DashboardView.tsx) to use:
   - authoritative request identity
   - transition precedence
   - partial panel degradation
   - explicit `permission_denied` handling
3. Keep `degraded` as trust overlay only; do not add it as a competing top-level state.
4. Implement the normative timing defaults:
   - `g` chord timeout `750ms +-100ms`
   - focus restore `180ms +-40ms`
5. Implement hard-abort-first request cancellation and stale-drop reason codes:
   - `superseded`
   - `mode_exit`
   - `abort_unavailable`
6. Implement failure metadata lifecycle rules:
   - in-memory only
   - scoped to active `repo_id` + `request_key_hash`
   - cleared on repo change, mode exit, session restart, success, or explicit reset
7. Implement bounded dropped-request diagnostics:
   - ring buffer size `50`
   - TTL `24h`

Target files:

1. [DashboardView.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/DashboardView.tsx)
2. [types.ts](/Users/jamiecraik/dev/trace-narrative/src/core/types.ts)
3. [attribution-api.ts](/Users/jamiecraik/dev/trace-narrative/src/core/attribution-api.ts)
4. [App.tsx](/Users/jamiecraik/dev/trace-narrative/src/App.tsx)
5. [TopNav.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/TopNav.tsx)

Exit criteria:

1. Dashboard state model matches the spec exactly.
2. Trust overlay is separate from top-level state.
3. Abort/stale behavior is deterministic and observable.
4. Retry profiles are environment-mapped and testable.
5. Failure metadata cleanup is bounded and explicit.

### Phase 2: Layout Migration and Resolved UX Defaults

1. Port the v3 visual structure into the production dashboard components without breaking existing mode flow.
2. Apply the resolved UX defaults from the spec:
   - `offline` and `permission_denied` are visually distinct from `error`
   - degraded trust indicator appears in both top nav and dashboard header
3. Preserve the existing dashboard -> repo -> dashboard loop and focus restoration through [App.tsx](/Users/jamiecraik/dev/trace-narrative/src/App.tsx).
4. Keep navigation semantics APG-compliant in [TopNav.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/TopNav.tsx).
5. Enforce reduced-motion parity and pause/stop/hide behavior for long-running auto-updating indicators.
6. Keep input updates urgent and schedule heavier recompute work on transition/deferred lanes where appropriate.

Target files:

1. [DashboardView.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/DashboardView.tsx)
2. [DashboardHeader.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/DashboardHeader.tsx)
3. [MetricsGrid.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/MetricsGrid.tsx)
4. [MetricCard.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/MetricCard.tsx)
5. [TopFilesTable.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/TopFilesTable.tsx)
6. [DashboardLoadingState.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/DashboardLoadingState.tsx)
7. [DashboardEmptyState.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/DashboardEmptyState.tsx)
8. [DashboardErrorState.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/DashboardErrorState.tsx)
9. [App.tsx](/Users/jamiecraik/dev/trace-narrative/src/App.tsx)
10. [TopNav.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/TopNav.tsx)
11. `src/styles.css`

Exit criteria:

1. The v3 layout is live behind `dashboard_v3_layout`.
2. Distinct non-success states are visible in cards and detail panels.
3. Degraded trust indicators appear in both required surfaces.
4. Reduced-motion and focus parity pass local validation.

### Phase 3: Visualization Strategy and Performance Delivery

1. Add the spec-selected dense chart implementation using `echarts-canvas`, including dependency, lockfile, and bundle-review updates if the dependency is still absent.
2. Implement render strategy switching:
   - `svg_low_density` for `<=2k` points
   - `canvas_high_density` for `2k-100k` points or frame-cost breach
   - `table_accessible_fallback` for `>100k` points or accessibility override
3. Keep fallback reason and active mode visible to operators.
4. Add canonical performance fixtures and measurements:
   - `2k`, `20k`, `100k` points
   - `1`, `4`, `12` series variants
   - steady-state and `1Hz` update cadence
5. Measure and enforce the spec budgets:
   - interaction feedback latency with visible acknowledgement <=100ms
   - dashboard TTI
   - first data paint
   - filter-to-visual p95
   - render-frame-cost p95
   - renderer RSS and long-task guards
6. Make decimation and downsampling explicit for large time-series datasets before render and log the selected decimation path alongside fallback reason.

Target files:

1. [DashboardView.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/DashboardView.tsx)
2. [MetricsGrid.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/MetricsGrid.tsx)
3. [MetricCard.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/MetricCard.tsx)
4. [TopFilesTable.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/TopFilesTable.tsx)
5. `src/ui/components/dashboard/` chart module(s)
6. [firefly-visual-system-v1.spec.ts](/Users/jamiecraik/dev/trace-narrative/e2e/firefly-visual-system-v1.spec.ts)

Exit criteria:

1. Render strategy selection matches the spec thresholds.
2. Canonical fixtures exist and are used in perf validation.
3. Table fallback is accessible and auditable.
4. Performance gates are measurable on both hardware tiers defined in the spec.
5. High-density fixtures prove decimation or downsampling is applied before render when required by the spec.

### Phase 4: Telemetry, Audit, and Sanitization

1. Extend [narrativeTelemetry.ts](/Users/jamiecraik/dev/trace-narrative/src/core/telemetry/narrativeTelemetry.ts) with the canonical envelope:
   - `session_id`
   - `request_key_hash`
   - `attempt`
   - `mode`
   - `window_id`
   - `ts_iso8601`
2. Promote release-blocking event coverage to match the spec, including `dashboard_retry_budget_exhausted`.
3. Enforce hashing/enum requirements for `repo_id`, `request_key`, `scope`, `capability`, and `window`.
4. Add persistent audit entry plumbing for:
   - `open_repo`
   - `import_session`
   - command-boundary `permission_denied`
5. Keep `apply_filter`, `clear_filter`, and `view_activity` telemetry-only unless later policy expands audit scope.
6. Extend redaction/sanitization logic so `permission_denied` conceals privileged content immediately and only aggregate-safe residual cards may remain visible.
   - concealed categories must include repo names, branch names, file paths, commit messages, session titles, raw command text, error payload details, and row-level evidence content
7. Add telemetry schema validation for per-window isolation so `window_id` buckets interleaved multi-window activity without collision.

Target files:

1. [narrativeTelemetry.ts](/Users/jamiecraik/dev/trace-narrative/src/core/telemetry/narrativeTelemetry.ts)
2. [narrativeTelemetry.test.ts](/Users/jamiecraik/dev/trace-narrative/src/core/telemetry/__tests__/narrativeTelemetry.test.ts)
3. [toolSanitizer.ts](/Users/jamiecraik/dev/trace-narrative/src/core/security/toolSanitizer.ts)
4. [redact.ts](/Users/jamiecraik/dev/trace-narrative/src/core/security/redact.ts)
5. [dashboard.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/attribution/dashboard.rs)
6. [lib.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/lib.rs)

Exit criteria:

1. Event schemas match the spec exactly.
2. Release-blocking events are available before rollout.
3. Audit-vs-telemetry behavior matches the resolved defaults.
4. Post-denial content policy is enforced in code and tests.
5. Multi-window telemetry isolation is validated before rollout artifacts are generated.

### Phase 5: Tauri Authority Boundary Hardening

1. Review `src-tauri/capabilities/*` against the spec authorization matrix, not only [default.json](/Users/jamiecraik/dev/trace-narrative/src-tauri/capabilities/default.json).
2. Implement or refine dashboard command handling so:
   - unmapped action/command pairs default to deny
   - `authority_denied` is non-retryable
   - remediation points to approved re-authorization path
3. Keep the capability set minimal and auditable.
4. Verify runtime registration and scope semantics in Rust entrypoints.
5. Keep capability drift tests release-blocking.
6. If current command registration still exposes commands globally, add explicit per-window command allowlisting or equivalent Tauri authority configuration before rollout work proceeds.

Target files:

1. `src-tauri/capabilities/*`
2. [default.json](/Users/jamiecraik/dev/trace-narrative/src-tauri/capabilities/default.json)
3. [dashboard.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/attribution/dashboard.rs)
4. [lib.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/lib.rs)
5. [codex_capability_policy_gate.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/tests/codex_capability_policy_gate.rs)
6. [codex_command_surface_allowlist.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/tests/codex_command_surface_allowlist.rs)

Exit criteria:

1. Command boundary behavior matches the spec matrix.
2. Denials fail closed and do not leak sensitive detail.
3. Capability diff review can be completed from tests and manifest diffs.
4. Runtime authority path is explicit enough that denied commands never rely on UI-only suppression.

### Phase 6: Test Matrix Completion

1. Expand view and component tests to cover:
   - all top-level states
   - trust overlay
   - partial panel degradation
   - visual distinction of `offline` and `permission_denied`
2. Add negative tests for forbidden transitions:
   - `authority_denied` must not auto-retry
   - stale late responses must not commit after mode exit
   - retry affordance stays disabled until permission context changes
3. Add positive remediation-path tests:
   - `retry_load_if_permission_context_changed` succeeds only after an approved permission-context-change signal
   - post-remediation state resolves through `loading` before `default|empty`
4. Add stale-drop taxonomy tests for `superseded`, `mode_exit`, and `abort_unavailable`.
5. Add cleanup/durability tests:
   - ring buffer cap
   - 24h TTL
   - failure metadata clearing triggers
6. Extend telemetry tests for:
   - canonical envelope
   - forbidden-field rejection
   - release-blocking event coverage
   - explicit conceal-now denylist assertions for `permission_denied`
7. Extend Tauri boundary tests for denial classification and allowed capability surface across `src-tauri/capabilities/*`.
8. Extend e2e coverage for:
   - dashboard critical flow
   - reduced motion
   - density fallback behavior
   - top-nav and header trust indicators
   - reliability panel visibility for authority outcomes, retry exhaustion, and permission-denied rates
9. Add integration or e2e coverage for concurrent multi-window behavior:
   - interleaved dashboard actions preserve `window_id` isolation
   - stale-drop, denial telemetry, and request identity remain window-scoped

Target files:

1. [DashboardView.test.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/__tests__/DashboardView.test.tsx)
2. [narrativeTelemetry.test.ts](/Users/jamiecraik/dev/trace-narrative/src/core/telemetry/__tests__/narrativeTelemetry.test.ts)
3. [critical-flows.spec.ts](/Users/jamiecraik/dev/trace-narrative/e2e/critical-flows.spec.ts)
4. [app.spec.ts](/Users/jamiecraik/dev/trace-narrative/e2e/app.spec.ts)
5. [firefly-visual-system-v1.spec.ts](/Users/jamiecraik/dev/trace-narrative/e2e/firefly-visual-system-v1.spec.ts)
6. [codex_capability_policy_gate.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/tests/codex_capability_policy_gate.rs)
7. [codex_command_surface_allowlist.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/tests/codex_command_surface_allowlist.rs)

Exit criteria:

1. All spec-critical scenarios have automated proof.
2. Forbidden transitions and cleanup rules are covered, not just happy paths.
3. Perf fixtures and accessibility checks are included in CI-friendly lanes.
4. Permission-context-change remediation and multi-window isolation are covered before Stage A rollout.

### Phase 7: Rollout, Evidence, and Monitoring

1. Produce the canonical artifact pack under `artifacts/rollout/dashboard-v3/`:
   - `gate-eval-<iso8601>.json`
   - `recovery-drill-<iso8601>.json`
   - `rollback-<iso8601>.json` when triggered
2. Schema-validate each artifact before promotion and fail the stage if any normative field is missing.
3. Map the spec gate math into one rollout decision table:
   - numerators
   - denominators
   - minimum sample sizes
   - baseline source
   - `insufficient_data_hold`
4. Freeze the baseline artifact pointer at the start of each rollout stage and write it into every `gate-eval-<iso8601>.json` record with:
   - baseline artifact path
   - baseline artifact timestamp
   - cohort stage
   - hardware tier set
   - sample window start/end
5. Require the full normative artifact fields at creation time:
   - all artifacts: `cohort`, `window_start`, `window_end`, `operator`, `decision`, `timestamps`, `raw_metric_refs`
   - `gate-eval`: `gate_results`, `sample_sizes`, `hardware_tier`, `baseline_source`
   - `recovery-drill`: `scenario`, `result`, `steps_run`, `validation_refs`
   - `rollback`: `trigger`, `feature_flag_key`, `restored_artifact`, `verification_commands`
6. Run rollout in the normalized cohort order:
   - Stage A: internal opt-in cohort
   - Stage B: 25 percent cohort
   - Stage C: 100 percent cohort
7. Enforce the rollback trigger:
   - any promotion gate breach
   - `unexpected_permission_denied_rate > 0.1%` for 2 consecutive 60-minute windows
   - failed recovery drill
8. Require the following operator checks before every promotion decision:
   - stale-drop anomaly scan
   - reduced-motion parity confirmation
   - manual degraded/offline/permission-denied recovery drill evidence
   - reliability-panel verification artifact showing authority outcomes, retry exhaustion, and permission-denied rate
9. Run and archive verification commands for each promotion window: `pnpm test:artifacts`, `pnpm tauri:verify-rollout-artifacts`, `pnpm tauri:verify-release-artifacts`, and `pnpm tauri:verify-trust-rollout-gates`.
10. Treat the rollback verification command set as minimum-required evidence: every command must exit `0`, every command must record artifact paths, exit code, timestamp, and operator, and rollback artifacts must name the restored stable artifact plus the post-rollback verification result bundle.
11. Record stable-baseline verification commands in the rollout artifacts and reference the restored artifact on rollback.

Exit criteria:

1. Promotion decisions can be recomputed from artifacts alone.
2. Stage transitions use the same denominator and hardware-tier rules as the spec.
3. Rollback evidence contains trigger, action, timestamps, operator, feature flag key, restored artifact, and verification commands.
4. Baseline selection is frozen per stage and reproducible from the artifact pack alone.
5. Every promotion window includes mandatory operator checks and schema-valid artifacts before widening the cohort.

## Phase Dependencies

1. Phase 1 must pass before Phase 2 or Phase 3 merges proceed, because layout and chart work depend on the normalized state and retry contract.
2. Phase 4 and Phase 5 must pass before Phase 6 is considered complete, because automated proof depends on final telemetry schema and authority boundaries.
3. Phase 6 must be green before any Phase 7 rollout activity begins.
4. Phase 7 Stage A can start only after `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:deep`, `pnpm test:e2e`, `pnpm test:perf`, `pnpm test:artifacts`, `pnpm tauri:verify-rollout-artifacts`, `pnpm tauri:verify-release-artifacts`, and `pnpm tauri:verify-trust-rollout-gates` all exit `0`.
5. Stage B and Stage C promotion can proceed only after the stage baseline artifact is frozen, the current stage artifact pack is complete, no rollback trigger is active, and the current cohort has satisfied the spec-required `first 24h + day2-7 evidence + two consecutive passing windows` rule.

## Dependencies and Risks

### Dependencies

1. Existing dashboard data path in [DashboardView.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/DashboardView.tsx) remains the primary integration point.
2. Tauri command surfaces in [dashboard.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/attribution/dashboard.rs) and [lib.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/lib.rs) can express the required denial classes without broadening permissions.
3. Telemetry pipeline in [narrativeTelemetry.ts](/Users/jamiecraik/dev/trace-narrative/src/core/telemetry/narrativeTelemetry.ts) can carry the new envelope and event families.
4. Existing verification scripts continue to produce and validate artifact sets.
5. The `echarts-canvas` adoption can be landed without conflicting with existing bundle/runtime constraints.
6. Multi-window behavior can be exercised in test automation or equivalent harness coverage before rollout.
7. The reliability panel or equivalent operational view can be rendered and captured for promotion evidence.

### Risks

1. State-model regression if any code path still assumes top-level `degraded`.
2. Permission-state UX drift if residual-content rules are only partially enforced.
3. Performance regressions if dense fixtures are weaker than production-like loads.
4. Rollout ambiguity if artifact generation and gate computation drift from the spec schema.
5. Capability creep if command-boundary changes are made without manifest/test parity.
6. Bundle or runtime regressions if `echarts-canvas` is added without explicit bundle-delta review and fallback retention.
7. False rollout confidence if baseline artifact selection changes mid-stage.

### Mitigations

1. Make Phase 1 and Phase 5 merge-gated by tests before the visual rollout path proceeds.
2. Keep audit defaults and residual-content rules covered by explicit tests.
3. Use canonical perf fixtures and both hardware tiers from the spec.
4. Treat artifact schema and gate-math output as required deliverables, not follow-up docs.
5. Require capability diff review and `codex_capability_policy_gate` pass before rollout work starts.
6. Freeze and log baseline artifact selection at the start of each stage.
7. Keep accessible table fallback live even after dense-chart adoption so bundle/perf regressions have a safe operational fallback.
8. Treat rollback SLA compliance and post-rollback return-to-baseline confirmation as release-blocking evidence.

## Test and Validation Strategy

### Required Commands

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm test:deep`
5. `pnpm test:e2e`
6. `pnpm test:perf`
7. `pnpm test:artifacts`
8. `pnpm tauri:verify-rollout-artifacts`
9. `pnpm tauri:verify-release-artifacts`
10. `pnpm tauri:verify-trust-rollout-gates`

### Validation Focus

1. Contract alignment:
   - top-level states vs trust overlay
   - request precedence and denial handling
2. Cleanup and durability:
   - ring buffer cap
   - TTL
   - metadata clearing triggers
3. Telemetry correctness:
   - envelope fields
   - forbidden field rejection
   - release-blocking event availability
   - reliability-panel fields queryable for promotion evidence
4. Accessibility and UX:
   - APG keyboard flow
   - reduced-motion parity
   - distinct `offline` and `permission_denied` rendering
5. Performance:
   - canonical fixture matrix
   - interaction feedback latency, TTI, FDP, filter-to-visual p95
   - frame-cost, RSS, and long-task guardrails
6. Security boundary:
   - fail-closed denial
   - no in-session privilege escalation
   - no sensitive residual content leakage
7. Rollout evidence:
   - artifact schema completeness
   - gate recomputation
   - rollback trigger simulation
   - rollback SLA timing
   - post-rollback return-to-baseline proof
8. Multi-window correctness:
   - `window_id` isolation
   - interleaved stale-drop handling
   - per-window denial telemetry
9. React responsiveness:
   - urgent inputs stay synchronous
   - heavy recompute remains deferred or transitioned

## Rollout / Migration / Monitoring

### Rollout Strategy

1. Stage A: internal opt-in cohort behind `dashboard_v3_layout`.
2. Stage B: 25 percent cohort only after Stage A completes its first 24h observation window, satisfies day-2-to-day-7 evidence requirements, and records two consecutive passing gate windows.
3. Stage C: 100 percent cohort only after Stage B completes its first 24h observation window, satisfies day-2-to-day-7 evidence requirements, and records two consecutive passing gate windows.
4. If deterministic bucket routing is used for Stage A, cap the cohort at the runbook-equivalent canary lane (`<=5%`) while preserving the internal-opt-in requirement from the spec.

### Promotion Gate Computation

1. Use the spec's exact gate metric definitions and sample-size rules.
2. If a 60-minute window does not meet minimum sample size, promotion state is `insufficient_data_hold`.
3. Perf gates must pass on both normative hardware tiers or be held pending approved manual evidence.
4. Baseline artifact pointer and timestamp are frozen at stage start and cannot be changed mid-stage without restarting the stage.
5. Promotion gate computation must explicitly include interaction feedback latency, reduced-motion parity failures, retry success rate, recovery latency, degraded-vs-healthy ratio, and visualization fallback activation where required by the spec.

### Rollback Rules

1. Freeze promotion immediately on any gate breach.
2. Trigger rollback on:
   - any promotion gate breach
   - `unexpected_permission_denied_rate > 0.1%` for 2 consecutive 60-minute windows
   - failed recovery drill
3. Disable `dashboard_v3_layout`, restore the approved stable artifact, and record verification commands in the rollback artifact.
4. Minimum rollback verification command set:
   - `pnpm test:artifacts`
   - `pnpm tauri:verify-rollout-artifacts`
   - `pnpm tauri:verify-release-artifacts`
   - `pnpm tauri:verify-trust-rollout-gates`
5. Rollback SLA is release-blocking evidence:
   - begin rollback within 30 minutes of confirmed trigger
   - complete rollback within 60 minutes
6. Rollback is not complete until the restored stable artifact, the post-rollback command results, and the return-to-baseline metric window are attached to the rollback evidence file.

### Monitoring Signals

1. `dashboard_state_transition`
2. `dashboard_source_authority`
3. `dashboard_command_authority_denied`
4. `dashboard_retry_budget_exhausted`
5. retry success rate and median recovery latency
6. degraded-vs-healthy dashboard ratio
7. interaction feedback latency
8. `filter_to_visual_p95`
9. `render_frame_cost_p95`
10. renderer RSS and long-task guardrails
11. visualization fallback activation rate
12. stale-drop reason distribution
13. permission-denied rate by command/capability/window
14. reduced-motion parity failures
15. artifact verification status

## Acceptance Checklist

1. The plan reflects the current spec and no longer contains stale state-model, retry-budget, chart-strategy, or artifact-path assumptions.
2. Every spec-critical behavior has an implementation phase and a validation phase.
3. The plan names real repo files and real package scripts.
4. Dense-chart work uses the spec-selected `echarts-canvas` path and canonical fixture matrix.
5. Release-blocking telemetry includes `dashboard_retry_budget_exhausted`.
6. Audit-entry defaults and dual-surface degraded indicators are implemented and tested.
7. Rollout artifacts use `artifacts/rollout/dashboard-v3/` with the required schema.
8. Gate math includes denominators, sample-size rules, baseline source, hardware tiers, and `insufficient_data_hold`.
9. Rollback logic includes trigger thresholds, feature flag key, restored artifact, and verification commands.
10. `pnpm test`, `pnpm test:deep`, and rollout artifact verification remain required before promotion.
11. Phase prerequisites, multi-window isolation coverage, and permission-context-change remediation checks are explicit.
12. External planning guidance for Tauri authority, React transition/deferred work, and WCAG/APG validation is reflected without changing the spec contract.
13. Residual-content handling explicitly requires immediate concealment and denylist-based test coverage for `permission_denied`.
14. Capability review is release-blocking across `src-tauri/capabilities/*`, not only `default.json`.
15. Rollout and rollback evidence include schema-valid artifacts, operator checks, SLA timing, and return-to-baseline proof.

## Sources & References

1. [2026-03-09-feat-firefly-inspired-dashboard-v3-spec.md](/Users/jamiecraik/dev/trace-narrative/docs/specs/2026-03-09-feat-firefly-inspired-dashboard-v3-spec.md)
2. [firefly-inspired-v3.html](/Users/jamiecraik/dev/trace-narrative/firefly-inspired-v3.html)
3. [manifest.json](/Users/jamiecraik/dev/trace-narrative/.diagram/manifest.json)
4. [architecture.mmd](/Users/jamiecraik/dev/trace-narrative/.diagram/architecture.mmd)
5. [App.tsx](/Users/jamiecraik/dev/trace-narrative/src/App.tsx)
6. [DashboardView.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/DashboardView.tsx)
7. [TopNav.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/components/TopNav.tsx)
8. [DashboardView.test.tsx](/Users/jamiecraik/dev/trace-narrative/src/ui/views/__tests__/DashboardView.test.tsx)
9. [narrativeTelemetry.ts](/Users/jamiecraik/dev/trace-narrative/src/core/telemetry/narrativeTelemetry.ts)
10. [narrativeTelemetry.test.ts](/Users/jamiecraik/dev/trace-narrative/src/core/telemetry/__tests__/narrativeTelemetry.test.ts)
11. [toolSanitizer.ts](/Users/jamiecraik/dev/trace-narrative/src/core/security/toolSanitizer.ts)
12. [redact.ts](/Users/jamiecraik/dev/trace-narrative/src/core/security/redact.ts)
13. [default.json](/Users/jamiecraik/dev/trace-narrative/src-tauri/capabilities/default.json)
14. [dashboard.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/attribution/dashboard.rs)
15. [lib.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/src/lib.rs)
16. [codex_capability_policy_gate.rs](/Users/jamiecraik/dev/trace-narrative/src-tauri/tests/codex_capability_policy_gate.rs)
17. [critical-flows.spec.ts](/Users/jamiecraik/dev/trace-narrative/e2e/critical-flows.spec.ts)
18. [app.spec.ts](/Users/jamiecraik/dev/trace-narrative/e2e/app.spec.ts)
19. [firefly-visual-system-v1.spec.ts](/Users/jamiecraik/dev/trace-narrative/e2e/firefly-visual-system-v1.spec.ts)
20. [package.json](/Users/jamiecraik/dev/trace-narrative/package.json)
21. [hybrid-capture-rollout-runbook.md](/Users/jamiecraik/dev/trace-narrative/docs/agents/hybrid-capture-rollout-runbook.md)
22. [codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md](/Users/jamiecraik/dev/trace-narrative/docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md)
23. [Tauri Capabilities](https://v2.tauri.app/security/capabilities/)
24. [Tauri Runtime Authority](https://v2.tauri.app/security/runtime-authority/)
25. [Tauri Command Scopes](https://v2.tauri.app/security/scope/)
26. [React useTransition](https://react.dev/reference/react/useTransition)
27. [React useDeferredValue](https://react.dev/reference/react/useDeferredValue)
28. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
29. [Understanding SC 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions)
30. [WAI-ARIA APG Read Me First](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)
