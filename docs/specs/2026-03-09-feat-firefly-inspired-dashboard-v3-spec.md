---
title: firefly-inspired Dashboard v3 Contract
type: feat
status: draft
date: 2026-03-09
origin: /Users/jamiecraik/dev/trace-narrative/firefly-inspired-v3.html
risk: high
spec_depth: full
---

## Problem Statement

`firefly-inspired-v3.html` is a strong visual demo, but it is not yet a behavioral contract for the live Narrative app. The current demo does not define ownership boundaries, source authority, failure transitions, recovery rules, or observability expectations. Without this contract, implementation work can diverge from existing app conventions in `App.tsx`, `TopNav.tsx`, and `DashboardView.tsx`, especially around drill-down behavior, degraded capture modes, and accessibility/reduced-motion parity.

## Table of Contents

- [Problem Statement](#problem-statement)
- [Enhancement Summary](#enhancement-summary)
- [Goals](#goals)
- [Gold Standards Baseline (March 2026)](#gold-standards-baseline-march-2026)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Core Domain Model](#core-domain-model)
- [Main Flow / Lifecycle](#main-flow--lifecycle)
- [Interfaces and Dependencies](#interfaces-and-dependencies)
- [Trust Boundary and Data Handling](#trust-boundary-and-data-handling)
- [Invariants / Safety Requirements](#invariants--safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability](#observability)
- [Gate Metric Definitions (Normative)](#gate-metric-definitions-normative)
- [Evidence Artifact Schema (Normative)](#evidence-artifact-schema-normative)
- [Rollback Runbook (Normative)](#rollback-runbook-normative)
- [Acceptance and Test Matrix](#acceptance-and-test-matrix)
- [Resolved UX and Audit Defaults](#resolved-ux-and-audit-defaults)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)
- [Reference Baseline (Validated 2026-03-09)](#reference-baseline-validated-2026-03-09)

## Enhancement Summary

**Deepened on:** 2026-03-09  
**Key areas improved:** boundary clarity, lifecycle timing, failure recovery, permissions, observability, rollout determinism

- Added explicit ownership boundaries between app shell, dashboard view layer, and Tauri capability/command surfaces.
- Added retry/timeout and stale-response handling rules with deterministic failure classification and cleanup expectations.
- Added operational observability and readiness gates (including rollback drill evidence and post-deploy checks).
- Added deterministic metric definitions, artifact schema requirements, and explicit defaults for previously unresolved UI/operator questions.

## Goals

1. Define a production-ready dashboard contract for the v3 direction that fits the existing Narrative architecture.
2. Preserve established navigation and drill-down behavior (`dashboard -> repo filtered -> dashboard`) with deterministic focus restoration.
3. Specify explicit UI/data states (`default | loading | empty | error | offline | permission_denied`) with trust-surface overlays and recovery expectations.
4. Define source authority and precedence rules so dashboard status never presents optimistic or conflicting state.
5. Define observability and validation requirements so operators can verify correctness and diagnose regressions quickly.
6. Enforce a March 2026 gold-standard implementation baseline for Tauri desktop UX, accessibility, security boundaries, and visualization performance.
7. Provide a spec-level contract that `/prompts:workflow-plan` can execute without inventing missing timing, retry, permission, or recovery behavior.

## Gold Standards Baseline (March 2026)

1. Accessibility baseline is WCAG 2.2 AA with APG-compliant keyboard behavior for every custom interactive pattern.
2. Tauri runtime baseline is v2 capability/permission model with least-privilege command exposure per window/webview.
3. Frontend baseline remains modern repo-native stack:
   - React 19.x
   - Vite 6.x
   - Tailwind 4.x
   - Radix primitives for interaction semantics
4. Visualization baseline for dense dashboard views:
   - canonical dense-chart engine: `echarts-canvas` (approved dependency allowance for this spec)
   - strategy gates by density/profile (`svg_low_density`, `canvas_high_density`, `table_accessible_fallback`)
   - interactive table fallback for accessibility and precise auditing
   - decimation/downsampling before render for large time-series datasets
5. Motion baseline:
   - reduced-motion parity for all transitions and status indicators
   - non-essential animation must be suppressible without information loss
   - any auto-updating motion longer than 5 seconds must offer pause/stop/hide controls
6. Performance baseline:
   - dashboard time-to-interactive <=1500ms cold start, <=700ms warm start
   - first data paint <=1200ms for default dashboard payload
   - interaction acknowledgement <=100ms and filter-to-visual-update p95 <=250ms
   - webview Core Web Vitals-style metrics may be tracked as secondary diagnostics (non-gating)
7. Responsiveness baseline:
   - text/filter input updates remain urgent
   - heavy chart/table recompute is scheduled on transition/deferred lanes to preserve input responsiveness

## Non-Goals

1. Rewriting backend ingestion architecture, trace pipelines, or database schema.
2. Replacing existing mode taxonomy (`demo`, `repo`, `dashboard`, `docs`).
3. Introducing unreviewed dependency sprawl (one chart dependency is allowed here: `echarts-canvas`; any additional dependency requires architecture review).
4. Full visual rebrand work unrelated to operational dashboard behavior.
5. Regressing current app security posture by broadening Tauri command/capability scope without explicit approval.

## System Boundary

## In Scope (Owned by this spec)

1. Dashboard information architecture and interaction contract for the v3 layout.
2. Mapping between dashboard UI states and existing application/domain states.
3. Accessibility behavior: landmark semantics, keyboard flow, focus management, reduced-motion parity.
4. Recovery behavior for dashboard-level failures and degraded capture confidence.
5. Dashboard observability events/metrics for state transitions and user actions.

## Out of Scope (Not owned by this spec)

1. OTEL collector internals and auth migration mechanics.
2. Branch narrative scoring/calibration logic.
3. Non-dashboard views and non-dashboard design language decisions.

## Ownership Map

1. App shell module ownership (current examples: `src/App.tsx`): mode transitions, drill-down return path, and focus restoration contract.
2. Dashboard view module ownership (current examples: `src/ui/views/DashboardView.tsx` + dashboard components): data-state rendering, retry initiation, visualization strategy selection, and reduced-motion parity.
3. Command boundary module ownership (current examples: `src-tauri/capabilities/*`, `src-tauri/src/lib.rs`, `src-tauri/src/attribution/dashboard.rs`): invoke authorization, scope constraints, and fail-closed denial behavior.
4. Contract module ownership (current examples: `src/core/types.ts`, `src/core/attribution-api.ts`): request identity, payload schema validation, and state/reliability normalization.
5. This spec owns behavior and invariants; implementation plan owns sequencing; tests and rollout artifacts own proof.

## Core Domain Model

## Entities

1. `ViewMode`: existing top-level mode enum (`demo | repo | dashboard | docs`).
2. `DashboardFilter`: drill-down selector that scopes repo view from dashboard aggregates.
3. `DashboardState`: `default | loading | empty | error | offline | permission_denied`.
4. `DashboardTrustState`: `healthy | degraded`.
5. `DashboardPanelStatus`: `ready | loading | empty | error | degraded`.
6. `PanelStatusMap`: panel-keyed status map used when dashboard remains usable with partial degradation.
7. `CaptureReliabilityMode`: source reliability from ingest/capture systems (`HYBRID_ACTIVE | DEGRADED_STREAMING | OTEL_ONLY | FAILURE`).
8. `SourceAuthority`: one authority per state transition:
   - dashboard aggregate API for aggregate cards/lists
   - ingest reliability status for trust/degraded/offline indicators
   - client navigation state for selected mode/filter transitions
9. `DashboardAction`: operator action (`open_repo`, `import_session`, `view_activity`, `apply_filter`, `clear_filter`, `retry_load`).
10. `VisualizationProfile`: `summary_cards | trend_chart | evidence_table`.
11. `RenderStrategy`: `svg_low_density | canvas_high_density | table_accessible_fallback`.
12. `RetryBudgetProfile`: retry policy by failure class (`ipc_timeout`, `io_transient`, `offline_source`, `authority_denied`).
13. `CommandAuthorityOutcome`: `allowed | denied_capability | denied_scope | denied_window`.

## Normalization Rules

1. UI state may only promote from `loading` to `default` after authoritative data is present for the active request key.
2. Stale responses must be ignored when request identity changes (repo/time-range/filter drift).
3. Reliability naming must remain canonical and normalized before metrics aggregation (`codex_app_server` and `codex-app-server` treated as one service identity).
4. `degraded` is a trust overlay (`DashboardTrustState=degraded`) and must not be represented as a competing top-level `DashboardState`.
5. Render strategy is selected by data volume and must degrade safely to accessible table views.
6. Permission/authority denials must map to `permission_denied` state class and never degrade silently into generic transport errors.
7. Existing empty-reason categories (`no-repo`, `no-commits`, `no-ai`, `no-attribution`) are retained as explanatory metadata, not replacements for the top-level `DashboardState`.
8. Dashboard state transitions require one authoritative source per transition and must record authority outcome (`accepted|duplicate|replaced|dropped`).
9. Transition precedence is strict and deterministic: `permission_denied > offline > error > empty > default`.
10. Unmapped action/command authorization requests default to deny.

## Main Flow / Lifecycle

## 1) Entry

1. User enters `dashboard` mode.
2. Dashboard state initializes to `loading`.
3. Dashboard aggregate request starts with request identity key (`repoId + range + filter`).
4. If keyboard chord navigation is used (`g` + destination), the second key window uses a normative default of `750ms` with allowable variance of `+-100ms` across supported platforms.

## 2) Resolve and Render

1. If request succeeds with non-empty payload, state becomes `default`.
2. If request succeeds with no meaningful results, state becomes `empty`.
3. If request fails due to transport/runtime/API error, state becomes `error`.
4. If capture reliability indicates degraded/failure but dashboard data exists, state remains `default` with `DashboardTrustState=degraded`.
5. If no valid ingest path or telemetry source is available, state becomes `offline`.
6. If some panels fail while core aggregates remain valid, state remains `default` and `PanelStatusMap` marks affected panels as `error|degraded` with local recovery affordances.
7. Visualization strategy is chosen by dataset size/frame-cost gates:
   - low density (`<=2k points`) -> `svg_low_density`
   - high density (`2k-100k points` or frame-cost p95 >16ms) -> `canvas_high_density`
   - audit/readability (`>100k points` or reduced-motion/accessibility override) -> `table_accessible_fallback`
8. If capability authorization fails for a required dashboard command, state resolves to `permission_denied` with remediation guidance.
9. Transition precedence applies before commit: `permission_denied > offline > error > empty > default`.

## 3) Drill-down

1. User applies a `DashboardFilter`.
2. App transitions to `repo` mode with filter context.
3. On clear-filter action, app returns to dashboard with exit animation and restores pre-drilldown focus target.
4. Focus restore must remain aligned with exit animation timing (default contract: `180ms +-40ms`, or the mapped motion token with equivalent duration).
5. On mode exit/unmount/superseding request, any in-flight dashboard request attempts hard abort first; if the runtime cannot abort, it must mark the request stale, emit a stale-drop reason code, and ignore the late result.

## 4) Recovery

1. `error` and `offline` states expose `retry_load` action.
2. `permission_denied` exposes remediation actions (`re-open repo`, `follow approved re-authorization path`, `retry_load_if_permission_context_changed`) without silent auto-retry or in-session self-escalation.
3. Recovery attempt resets to `loading` and re-evaluates authority from current request identity.
4. On successful retry, transition to `default` or `empty` only (never directly to trust-degraded state without explicit reliability signal).

## 5) Retry, Timeout, and Cancellation Contract

1. Retry behavior is failure-class specific:
   - `authority_denied` (`denied_capability|denied_scope|denied_window`) -> non-retryable until permission context changes.
   - `offline_source` -> manual retry only; no automatic retry loop.
   - `ipc_timeout` and `io_transient` -> retryable with bounded jittered backoff.
2. Retry budget defaults for retryable classes:
   - `max_attempts = 3`
   - `max_total_retry_ms = 6000`
   - `backoff_schedule_ms = [250, 500, 1000]`
   - `jitter_percent = 20`
3. Environment profile mapping is normative:
   - `dev`: `max_total_retry_ms = 4000`
   - `ci`: `max_total_retry_ms = 6000`
   - `prod`: `max_total_retry_ms = 12000`
4. Each retry attempt must re-evaluate request identity and authority before committing state.
5. If retry budget is exhausted, surface durable failure metadata and remain in recoverable non-success state until operator action.
6. If a request is superseded by a new request identity, stale work is cancelled or ignored and cannot mutate current state.

## 6) Authorization Matrix (Normative)

| DashboardAction | Command / Boundary | Required Capability/Scope/Window | On Denial |
| --- | --- | --- | --- |
| `open_repo` | repo open/load invoke path | repo-read scope for active repo + active dashboard window | `permission_denied`, remediation path, no retry |
| `import_session` | session ingest/import invoke path | ingest/import capability + repo/session scope + active window | `permission_denied`, remediation path, no retry |
| `view_activity` | activity read path | activity-read scope for selected range + active window | `permission_denied`, remediation path, no retry |
| `apply_filter` | dashboard aggregate query path | dashboard-read scope for filter context + active window | `permission_denied`, remediation path, no retry |
| `clear_filter` | dashboard aggregate query reset | dashboard-read scope + active window | `permission_denied`, remediation path, no retry |
| `retry_load` | retryable data read path | same capability/scope as originating request | non-retryable for `authority_denied`; bounded retry for retryable classes |

Any unmapped action/command pair is denied by default.

## Interfaces and Dependencies

## Internal Interfaces

1. `src/App.tsx`: top-level mode switch, dashboard drill-down and focus restoration behavior.
2. `src/ui/views/DashboardView.tsx`: dashboard data retrieval, state rendering, drill-down initiation.
3. `src/ui/components/TopNav.tsx`: primary navigation and keyboard tablist semantics.
4. `src/core/types.ts`: `DashboardFilter` and related UI/domain contracts.
5. `src/hooks/useTraceCollector.ts` and ingest status surfaces: reliability/degraded signaling.
6. `src/styles.css` and motion classes: reduced-motion and focus ring behavior.
7. `src/core/telemetry/narrativeTelemetry.ts`: sanitized telemetry contract, consent gate, and dedupe behavior used by dashboard events.
8. `src/core/security/toolSanitizer.ts` and `src/core/security/redact.ts`: untrusted content sanitization and redaction for UI-safe rendering and telemetry payloads.

## External/Runtime Dependencies

1. Tauri runtime for desktop shell behavior.
2. Local repo and ingest artifacts through existing app services.
3. Capability definitions in `src-tauri/capabilities/*` govern command boundary authorization.
4. `echarts-canvas` is allowed as the canonical dense-chart dependency for this spec; no additional visualization dependency is in scope without architecture approval.
5. No new remote services are introduced by this spec.
6. Local plan dependency: `docs/plans/2026-03-09-feat-firefly-inspired-dashboard-v3-plan.md` is the execution source downstream from this contract.

## Trust Boundary and Data Handling

1. All repo/session/ingest-derived strings are treated as untrusted input.
2. Dashboard rendering paths must not render repo/session text as HTML; only text-safe rendering is allowed.
3. Error and remediation surfaces must pass through sanitizer/redaction helpers before render.
4. Telemetry payloads must not include raw paths, tokens, command arguments, or file contents.
5. `request_key` and `repo_id` in telemetry are hashed/normalized identifiers (no raw local absolute paths).
6. `scope`, `capability`, and `window` telemetry fields must come from fixed enums or hashed identifiers; schema validation must reject path-like or user-derived freeform values.
7. Allowed post-denial residual content is limited to non-sensitive aggregate cards that contain counts, ratios, or trend buckets only. Concealed after `permission_denied`: repo names, branch names, file paths, commit messages, session titles, raw command text, error payload details, and any row-level evidence table content.

## Invariants / Safety Requirements

1. Dashboard must always have exactly one active `DashboardState`.
2. Dashboard must never show success-only trust messaging when reliability mode is degraded/failure.
3. Focus must remain keyboard reachable across dashboard -> repo drill-down -> dashboard return.
4. Reduced-motion users must receive equivalent information and completion cues without continuous animation.
5. Stale async results must not overwrite newer dashboard state.
6. Sensitive details (paths, tokens, raw secrets) must not be leaked in dashboard error surfaces.
7. Dashboard visualization must always provide an accessible, keyboard-readable fallback representation.
8. No privileged Rust command may be callable by dashboard surfaces without explicit capability grant.
9. Capability/scope resolution failures must fail closed (no partial side effects, no implicit privilege escalation).
10. Observability emission must be non-blocking and bounded; telemetry failures cannot block user-visible recovery actions.
11. On `permission_denied`, sensitive views are concealed immediately; only aggregate-safe residual cards defined in this spec may remain visible.
12. Every observability event must carry a common correlation envelope (`session_id`, `request_key_hash`, `attempt`, `mode`, `window_id`, `ts_iso8601`).

## Failure Model and Recovery

## Failure Classes

1. Data fetch failure (API/IPC/network/read errors).
2. Reliability signal conflict (dashboard payload available but ingest source degraded/failing).
3. Stale response race (late response for an obsolete request key).
4. Permission/access failure (repo unreadable, denied, or detached).
5. Visualization overload (dataset density exceeds DOM-safe rendering budget).
6. Command boundary rejection (capability denies invoke request).
7. Retry budget exhaustion (recoverable operation has exceeded allowed attempts/time budget).

## Recovery Rules

1. Fetch failure -> show `error` with retry and short diagnostics; no silent fallback to stale success.
2. Reliability conflict -> keep usable data visible, mark trust as degraded, and expose operator affordance to inspect ingest status.
3. Stale response race -> drop stale payload, keep current state, log stale-drop event with explicit reason code (`superseded`, `mode_exit`, `abort_unavailable`).
4. Permission failure -> show `permission_denied` with clear action path (re-open repo/re-authorize).
5. Visualization overload -> switch to decimated canvas profile or evidence-table fallback, persist an operator-visible rendering mode notice.
6. Command boundary rejection -> fail closed, emit structured error class, and surface a non-sensitive remediation hint.
7. Retry budget exhaustion -> emit `dashboard_retry_budget_exhausted`, preserve durable failure metadata, and require explicit operator retry/reset.
8. Mode-exit cancellation -> abort in-flight request on dashboard exit; ignore any late payload and emit stale-drop outcome.

## Cleanup and Durability Rules

1. On stale request drop, retain current state and record bounded dropped-request diagnostics in an in-memory ring buffer of the most recent 50 entries with 24h TTL.
2. On recovery failure, persist last failure class and timestamp in memory for the active `repo_id` + `request_key_hash` only; clear on repo change, mode exit, session restart, successful authoritative transition, or explicit operator reset.
3. On permission denial, immediately conceal privileged content and replace with a permission-safe placeholder state.
4. On visualization fallback activation, keep selected fallback mode visible and user-auditable.
5. On rollback activation, persist rollback marker and reason in rollout evidence artifacts before cohort changes.

## Observability

## Event Envelope and Data Classification (Normative)

1. Every dashboard event must include: `{session_id, request_key_hash, attempt, mode, window_id, ts_iso8601}`.
2. `repo_id` and `request_key` are hashed/normalized before emit.
3. Forbidden fields in telemetry payloads: raw paths, raw command arguments, tokens/secrets, file contents.
4. Event schemas are validated at build/test time with sensitive-field checks and cardinality guards.

## Required Events (Release-Blocking)

1. `dashboard_state_transition` with `{from, to, request_key_hash, repo_id_hash, trust_state}`.
2. `dashboard_action` with `{action, mode, filter_key_hash, result}`.
3. `dashboard_source_authority` with `{authority, outcome}` where `outcome in {accepted, duplicate, replaced, dropped}`.
4. `dashboard_command_authority_denied` with `{command, capability, scope, window, denial_type}`.
5. `dashboard_retry_budget_exhausted` with `{request_key_hash, attempts, elapsed_ms, last_failure_class}`.

## Required Events (Post-Rollout Week 1)

1. `dashboard_recovery_attempt` with `{failure_class, attempt, result}`.
2. `dashboard_visualization_mode_selected` with `{strategy, data_points_bucket, reason}`.
3. `dashboard_reliability_surface` with `{capture_mode, trust_state, degraded_reason_code}`.

## Required Metrics

1. State transition counts by `DashboardState`.
2. Retry success rate and median recovery latency.
3. Stale response drop count.
4. Degraded vs healthy session ratio in dashboard windows.
5. Interaction feedback latency for primary actions (target <=100ms visible acknowledgement).
6. Filter-to-visual-update latency p95 (target <=250ms).
7. Dashboard time-to-interactive (targets: <=1500ms cold, <=700ms warm).
8. First data paint (target <=1200ms).
9. Chart render frame cost p95 and dropped-frame rate under high-density datasets.
10. Renderer resource guardrails: renderer RSS p95 <=600MB, long tasks >50ms <=5/minute during steady-state high-density sessions.
11. Visualization fallback activation rate (`canvas` -> `table`).
12. Permission-denied rate by command/capability/window.

## Gate Metric Definitions (Normative)

1. `retry_budget_exhaustion_rate`
   - numerator: count of `dashboard_retry_budget_exhausted`
   - denominator: count of dashboard load attempts for the same cohort window
   - minimum sample size: `>=500` dashboard load attempts per 60m window; otherwise status is `insufficient_data_hold`
2. `unexpected_permission_denied_rate`
   - numerator: `dashboard_command_authority_denied` where denial was not preceded by an approved operator-initiated permission change workflow
   - denominator: count of dashboard-triggered command attempts in the same 60m window
   - minimum sample size: `>=100` command attempts per 60m window
3. `stale_drop_rate_delta`
   - numerator: stale-drop events with reason code
   - denominator: dashboard load attempts in the same cohort
   - baseline source: previous stable-release 7-day rolling median for the same metric on the same hardware tier
4. `filter_to_visual_p95`
   - start event: operator commits filter change or keyboard shortcut confirmation
   - end event: first non-skeleton filtered visualization paint is committed
5. `dashboard_time_to_interactive`
   - start event: dashboard route activation
   - end event: first primary control is enabled and keyboard-focusable
6. `first_data_paint`
   - start event: dashboard route activation
   - end event: first non-skeleton aggregate card or table row paints
7. `render_frame_cost_p95`
   - measured over canonical high-density fixtures on declared hardware tiers
8. Hardware tiers are normative:
   - `tier_a_reference`: Apple Silicon class with 16GB RAM, 60Hz display
   - `tier_b_lower_bound`: Apple Silicon or Intel-equivalent class with 8GB RAM, 60Hz display
   - release gates must pass on both tiers or enter `insufficient_data_hold` when the lower tier is unavailable in CI and no approved manual evidence exists

## Required Operational Views and Checks

1. Dashboard reliability panel must expose:
   - authority outcomes (`accepted|duplicate|replaced|dropped`)
   - retry success rate and budget exhaustion count
   - permission-denied rate by capability
2. Rollout checks before cohort promotion must include:
   - stale-drop anomaly scan
   - reduced-motion parity confirmation
   - manual degraded/offline/permission-denied recovery drill evidence
3. Promotion gate matrix (must pass all):
   - `retry_budget_exhaustion_rate < 1.0%` over rolling 60m
   - `unexpected_permission_denied_rate < 0.1%` over rolling 60m
   - `stale_drop_rate_delta <= +0.5%` vs baseline over rolling 60m
   - `reduced_motion_parity_failures = 0` in latest audit batch
   - `filter_to_visual_p95 <= 250ms` and `render_frame_cost_p95 <= 16ms` on supported hardware tiers
4. Post-deploy verification window:
   - first 24 hours: heightened monitoring; any gate breach triggers automatic promotion hold and rollback decision within 30 minutes
   - day 2-7: sustained threshold tracking; two consecutive gate windows must pass before next cohort promotion

## Evidence Artifact Schema (Normative)

1. Canonical artifact pack root: `artifacts/rollout/dashboard-v3/`
2. Required artifact files per promotion window:
   - `gate-eval-<iso8601>.json`
   - `recovery-drill-<iso8601>.json`
   - `rollback-<iso8601>.json` when rollback occurs
3. Required fields for all artifacts:
   - `cohort`
   - `window_start`
   - `window_end`
   - `operator`
   - `decision`
   - `timestamps`
   - `raw_metric_refs`
4. `gate-eval` must also include:
   - `gate_results`
   - `sample_sizes`
   - `hardware_tier`
   - `baseline_source`
5. `recovery-drill` must also include:
   - `scenario`
   - `result`
   - `steps_run`
   - `validation_refs`
6. `rollback` must also include:
   - `trigger`
   - `feature_flag_key`
   - `restored_artifact`
   - `verification_commands`

## Rollback Runbook (Normative)

1. Rollback owner: on-call dashboard operator or release owner for the active cohort window.
2. Trigger conditions: any promotion gate breach, `unexpected_permission_denied_rate > 0.1%` for 2 consecutive 60m windows, or recoverability drill failure.
3. Rollback steps:
   - freeze cohort promotion immediately
   - disable `dashboard_v3_layout` feature flag for affected cohort
   - restore last known stable dashboard package/config baseline from the approved release artifact referenced by the active promotion record
   - run the stable-baseline verification commands for permission-denied, offline, and retry flows
4. Rollback SLA: begin rollback within 30 minutes of confirmed trigger; complete within 60 minutes.
5. Post-rollback verification:
   - confirm all promotion gate metrics return to baseline window
   - attach evidence artifact with trigger, action, timestamps, and operator
6. Required evidence artifact path: `artifacts/rollout/dashboard-v3/rollback-<iso8601>.json`.
7. Stable-baseline verification commands must be recorded in the linked rollout plan and referenced by `verification_commands` in the rollback artifact.

## Acceptance and Test Matrix

| Scenario | Expected Behavior | Validation Path |
| --- | --- | --- |
| Initial dashboard load | `loading -> default/empty/error` with correct authority | Dashboard view tests + integration assertion on state transitions |
| Drill-down and back | Filter applied in repo mode, focus restored on return | App-level behavior tests for mode/filter/focus restoration |
| Dashboard mode exit during in-flight request | In-flight request is aborted/invalidated; late payload cannot overwrite active state | Integration test for mode exit with delayed response fixture |
| Reduced-motion enabled | No continuous pulse/large transforms; equivalent feedback preserved | UI tests under reduced-motion media query + manual keyboard run |
| Reliability degraded | Dashboard remains usable with degraded trust indicator | Reliability-mode contract tests using ingest status fixtures |
| Stale response arrives late | Late response dropped and does not overwrite active state | Request-key race tests in dashboard data layer |
| Permission failure | Permission state rendered with operator-safe next action | Error-state tests + manual repo permission simulation |
| Partial panel failure | Dashboard remains in `default` with panel-level degraded/error statuses and local retry affordances | Component + integration tests with mixed success fixture |
| High-density dataset | Render switches to performant strategy without blocking interactions | Visualization performance tests with canonical fixtures: `2k`, `20k`, and `100k` points; 1, 4, and 12 series variants; steady-state and 1Hz update cadence |
| Capability denied invoke | Operation fails closed with safe user message and telemetry event | Tauri capability tests + invoke boundary integration tests |
| Retry budget exhausted | Retry stops at budget, durable failure metadata retained, operator can re-initiate | Integration test with forced repeated failure and telemetry assertion |
| Reduced-motion with auto-updating indicators | Equivalent information retained without non-essential motion and with pause/stop/hide where applicable | Accessibility checks under reduced-motion media query + manual audit |
| Telemetry schema safety | Required envelope present and forbidden fields absent | Schema validation tests + redaction fixture tests |
| Rollout gate evaluation | Promotion/hold/rollback decisions are deterministic from metric windows | Operational simulation with canned metric windows and expected gate outcomes |
| Forbidden transition enforcement | `authority_denied` cannot auto-retry and stale late responses cannot commit after mode exit | Negative state-machine tests with precedence conflict fixtures |
| Visual distinction for critical non-success states | `offline` and `permission_denied` are visually distinct from `error` in cards and detail panels | UI snapshot/accessibility tests for top-level cards and detail surfaces |

## Resolved UX and Audit Defaults

1. `offline` and `permission_denied` must be visually distinct from `error` in both top-level metrics cards and detail panels.
2. Persistent audit entries are required for `open_repo`, `import_session`, and every `permission_denied` command-boundary rejection; `apply_filter`, `clear_filter`, and `view_activity` remain telemetry-only unless explicitly escalated by policy.
3. Degraded trust indicators must appear in both top nav and dashboard header.

## Open Questions

1. None. This spec now chooses defaults wherever the earlier review identified decision gaps.

## Definition of Done

1. Dashboard contract is implemented with explicit state machine coverage for all states in this spec.
2. Drill-down/focus restoration and stale-response protection are verified by tests.
3. Reduced-motion parity is verified for all motion-bearing interactions.
4. Required release-blocking observability events and metrics are emitted with normalized authority/reliability fields and schema safety checks.
5. Tauri capability boundaries are validated for dashboard-triggered commands.
6. Visualization strategy selection and fallback behavior are verified under high-density fixtures.
7. `/prompts:workflow-plan` can derive implementation phases without inventing missing behavior.
8. Recovery drill evidence exists for degraded, offline, permission-denied, and retry-budget-exhausted flows.
9. Permission denial and authority conflict telemetry are visible in operational dashboards.
10. Promotion gate matrix and rollback runbook are validated via dry-run operational simulation.
11. Capability boundary drift check (diff against approved `src-tauri/capabilities/*` allowlist) passes for rollout candidate.

## Reference Baseline (Validated 2026-03-09)

1. Tauri frontend architecture and Vite integration (accessed 2026-03-09):
   - [Tauri Frontend Integration](https://v2.tauri.app/start/frontend/)
   - [Tauri + Vite Integration](https://v2.tauri.app/start/frontend/vite/)
2. Tauri v2 security model and migration (accessed 2026-03-09):
   - [Tauri Capabilities](https://v2.tauri.app/security/capabilities/)
   - [Tauri Runtime Authority](https://v2.tauri.app/security/runtime-authority/) (last updated 2025-02-22)
   - [Tauri Command Scope](https://v2.tauri.app/security/scope/) (last updated 2025-02-28)
   - [Tauri Permissions](https://v2.tauri.app/security/permissions/) (last updated 2025-04-08)
   - [Migrate from Tauri 1](https://v2.tauri.app/start/migrate/from-tauri-1/)
3. React 19 and modern rendering guidance (accessed 2026-03-09):
   - [React 19 Announcement (2024-12-05)](https://react.dev/blog/2024/12/05/react-19)
   - [React useTransition](https://react.dev/reference/react/useTransition)
   - [React startTransition](https://react.dev/reference/react/startTransition)
   - [React useDeferredValue](https://react.dev/reference/react/useDeferredValue)
4. Vite baseline (accessed 2026-03-09):
   - [Vite 6 Announcement](https://vite.dev/blog/announcing-vite6)
5. Tailwind v4 baseline (accessed 2026-03-09):
   - [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)
   - [Tailwind v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
6. Accessibility and interaction standards (accessed 2026-03-09):
   - [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
   - [WAI-ARIA APG Read Me First](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)
   - [W3C Accessible Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)
   - [Understanding WCAG 2.2 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
7. Visualization performance guidance (accessed 2026-03-09):
   - [ECharts Canvas vs SVG Guidance](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
   - [Chart.js Performance Guidance](https://www.chartjs.org/docs/latest/general/performance.html)
8. Reliability and rollout policy references (accessed 2026-03-09):
   - [AWS Builders Library: Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
   - [Google SRE Workbook: Error Budget Policy](https://sre.google/workbook/error-budget-policy/)
   - [OpenTelemetry Performance Guidance](https://opentelemetry.io/docs/specs/otel/performance/)
