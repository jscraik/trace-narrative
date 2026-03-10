---
title: Updated UI Views Contract
type: feat
status: draft
date: 2026-03-10
origin: /Users/jamiecraik/dev/trace-narrative/docs/brainstorms/2026-03-10-updated-ui-views-brainstorm.md
risk: high
spec_depth: full
---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Enhancement Summary](#enhancement-summary)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Core Domain Model](#core-domain-model)
- [Main Flow / Lifecycle](#main-flow--lifecycle)
- [Interfaces and Dependencies](#interfaces-and-dependencies)
- [Invariants / Safety Requirements](#invariants--safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability](#observability)
- [Acceptance and Test Matrix](#acceptance-and-test-matrix)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)

## Problem Statement

Trace Narrative already exposes a broad operator-oriented mode taxonomy in `src/core/types.ts`, but the shell contract has lagged behind the taxonomy. The app currently has strong anchor experiences for `dashboard`, `repo`, and `docs`, yet the broader monitor, workspace, ecosystem, health, and config lanes need a shared behavioral contract so implementation does not drift into ad hoc placeholders, inconsistent trust messaging, or clone-like information architecture.

Without a spec, the app can regress on the things Trace Narrative uniquely owns:

1. repo understanding rooted in narrative evidence
2. trust-aware operator guidance
3. safer remediation framing
4. canonical Trace Narrative naming and provenance-first UX

Evidence:

- Brainstorm source defines the sectioned cockpit direction and non-goals.
- `src/App.tsx` already routes between anchor views and non-anchor modes.
- `src/core/types.ts` defines the expanded `Mode` union.
- `src/ui/views/dashboardState.ts` and `src/hooks/useAutoIngest.ts` already establish trust and retry semantics that the updated views must preserve.

## Enhancement Summary

**Deepened on:** 2026-03-10
**Key areas improved:** lifecycle timing, source authority, failure handling, observability, and validation gates

- Added explicit data-authority and action-availability contracts so cockpit content cannot overstate source certainty.
- Added async coordination rules for focus restore, one-shot docs autoload, deduplicated trust refresh, and stale-result discard.
- Expanded recovery, diagnostics, and acceptance coverage around permission boundaries, runtime gating, and rollout evidence.

## Goals

1. Define a first-class shell contract for the updated Trace Narrative UI views across the full current `Mode` union.
2. Preserve anchor experiences:
   `dashboard` remains the aggregate cockpit entry, `repo` remains the deep narrative evidence workspace, and `docs` remains the documentation and repo-doc inspection lane.
3. Define how non-anchor modes render as cockpit views without inventing a second routing system.
4. Ensure trust and reliability state remain consistent with existing capture-reliability semantics instead of introducing a competing status model.
5. Make every mode explicit about ownership, allowed actions, degraded states, and recovery affordances.
6. Require canonical Trace Narrative naming in user-visible copy, even where historical aliases still exist in legacy docs or artifacts.
7. Produce a contract detailed enough that `/prompts:workflow-plan` can sequence implementation without inventing lifecycle, safety, or validation behavior.

## Non-Goals

1. Rewriting repo indexing, session linking, telemetry ingestion, or Tauri-side data persistence.
2. Replacing `BranchView`, `DashboardView`, or `DocsView` with a single universal surface.
3. Wiring every cockpit mode to fully live backend data in the first implementation pass.
4. Rebranding the app away from its current visual token system.
5. Adding destructive cleanup or auto-remediation actions beyond existing explicit operator-triggered flows.
6. Preserving historical product names in user-facing copy.

## System Boundary

### Owned by this spec

1. Top-level shell behavior for all current modes in `src/core/types.ts`.
2. Navigation grouping and mode discoverability in the left sidebar.
3. Which modes use anchor views versus cockpit views.
4. Trust-surface behavior for cockpit pages that depend on capture reliability or repo state.
5. Canonical copy rules for operator-facing labels, section names, and affordances.
6. Acceptance criteria for view routing, recovery behavior, and operator validation.

### Not owned by this spec

1. Internal logic of repo indexing, attribution, session import, or trace ingestion.
2. Detailed branch narrative composition rules inside `BranchView`.
3. Docs generation internals beyond runtime gating and shell integration.
4. Telemetry schema redesign outside the new UI-view events described here.

### Ownership map

1. `src/App.tsx` owns top-level mode routing, anchor-view selection, drill-down return path, and shell-level action wiring.
2. `src/ui/components/Sidebar.tsx` owns mode grouping, canonical labels, and sidebar action entry points.
3. `src/ui/components/TopNav.tsx` owns anchor-mode tab semantics and anchor-level actions only.
4. `src/ui/views/DashboardView.tsx` owns aggregate dashboard behavior and drill-down initiation.
5. `src/ui/views/BranchView.tsx` owns repo evidence, branch narrative, and filtered drill-down resolution.
6. `src/ui/views/DocsView.tsx` owns docs-specific runtime gating and docs overview rendering.
7. `src/ui/views/CockpitView.tsx` owns the shared presentation contract for non-anchor modes.
8. `src/ui/views/cockpitViewData.ts` owns per-mode information architecture, copy contract, and section-level summary content until richer data adapters exist.

## Core Domain Model

### Primary entities

1. `Mode`
   Canonical top-level route selector. Current values include anchor modes (`dashboard`, `repo`, `docs`) and cockpit modes such as `live`, `sessions`, `tools`, `work-graph`, and `status`.
2. `AnchorMode`
   `dashboard | repo | docs`. Uses dedicated views with distinct behavior and deeper interaction models.
3. `CockpitMode`
   Every `Mode` except `dashboard | repo | docs`. Renders via the shared cockpit contract.
4. `ViewSection`
   One of `Overview`, `Monitor`, `Workspace`, `Ecosystem`, `Health`, or `Config`. Determines sidebar grouping and page-level framing.
5. `RepoState`
   Top-level repo availability state: `idle`, `loading`, `error`, or `ready`. Shared across dashboard, repo, docs, and cockpit views.
6. `DashboardFilter`
   Drill-down selector created in dashboard and consumed by repo mode.
7. `CaptureReliabilityStatus`
   Existing source of truth for reliability and stream health.
8. `CockpitTrustState`
   Normalized UI-facing trust overlay for cockpit pages. Values: `healthy` or `degraded`. Derived from `CaptureReliabilityStatus`, not independently authored by cockpit pages.
9. `CockpitViewModel`
   Presentation contract for a cockpit page: `section`, `title`, `subtitle`, `hero`, `metrics`, `highlights`, `activity`, `table`, `footerNote`, and `trustState`.
10. `OperatorAction`
    User-triggered shell affordance such as `open_repo`, `import_session`, `switch_mode`, `apply_dashboard_filter`, `clear_dashboard_filter`, or `close_docs`.
11. `DataAuthorityTier`
    Declares how trustworthy a rendered fact is:
    - `live_repo`: derived from the currently indexed repo model
    - `live_capture`: derived from capture or ingest runtime state
    - `derived_summary`: computed summary from durable data already in memory
    - `static_scaffold`: intentionally non-live presentation content used to frame an unfinished page
12. `OperatorActionAvailability`
    Declares whether an action is `enabled`, `disabled_explained`, or `hidden`, plus the blocking reason when not enabled.
13. `BlockedActionReason`
    Closed enum for blocked-action reporting and UI copy:
    - `repo_not_ready`
    - `runtime_unsupported`
    - `authority_denied`
    - `trust_degraded_policy`
    - `offline_source`
    - `action_in_flight`
    - `view_scaffold_only`
14. `TopLevelPageState`
    Shared shell state resolution model:
    - `loading`
    - `permission_denied`
    - `offline`
    - `error`
    - `empty`
    - `default`
15. `AuthorityDecision`
    Typed execution-time authorization result returned by the backend or Tauri authority boundary:
    - `allowed`
    - `denied_capability`
    - `denied_scope`
    - `denied_window`

### Normalization rules

1. Every `Mode` must deterministically resolve to exactly one view family: anchor view or cockpit view.
2. Every cockpit page must have exactly one `ViewSection`.
3. Trust overlays must derive from existing capture reliability rules:
   - `HYBRID_ACTIVE` maps to `healthy`
   - `OTEL_ONLY` maps to `healthy`, but must carry visible baseline-only authority cues and must never be presented as hybrid or stream-backed
   - `DEGRADED_STREAMING` and `FAILURE`, or an unhealthy expected stream, map to `degraded`
4. User-visible naming must use `Trace Narrative` and `trace-narrative`; historical aliases are not allowed in primary UI copy.
5. A cockpit page may be partially populated, but it may not present invented live certainty when its data is static, missing, or degraded.
6. Missing per-mode live data is represented as bounded placeholder or summary content, not as hidden routing.
7. Top-level page-state precedence remains deterministic:
   - `permission_denied > offline > error > empty > default`
   - trust remains a separate overlay and must not replace the top-level page state
8. Every hero, metric, highlight, activity item, and summary row must map to a `DataAuthorityTier`, even if the first implementation keeps that metadata internal.
9. `static_scaffold` and `derived_summary` content must use framing that signals guidance, preview, or orientation rather than live operational fact.
10. Actions shown in cockpit pages must declare availability from current `repoState`, runtime support, and trust context; a disabled action must explain why it is blocked.
11. Phase one requires a visible authority cue for every rendered cockpit element:
   - `live_repo` => visible `Repo` cue
   - `live_capture` => visible `Live` cue
   - `derived_summary` => visible `Derived` cue
   - `static_scaffold` => visible `Preview` cue
12. One shared trust-normalization helper must own `CaptureReliabilityStatus -> CockpitTrustState` conversion for both dashboard and cockpit surfaces; dashboard and cockpit pages must not fork trust conversion logic.
13. UI-side action gating is advisory only; every privileged action must be re-authorized at execution time by the backend or Tauri authority boundary with deny-by-default semantics.
14. Telemetry identifiers derived from repo, branch, session, or filter values must use keyed HMAC or coarse bucketing; plain unsalted hashing is out of contract.

### Canonical mode matrix

| Mode | View family | Section | Sidebar label | Initial authority posture |
| --- | --- | --- | --- | --- |
| `dashboard` | anchor | Overview | Overview | `derived_summary` |
| `work-graph` | cockpit | Overview | Workspace Graph | `derived_summary` |
| `assistant` | cockpit | Overview | Story Copilot | `static_scaffold` |
| `live` | cockpit | Monitor | Live Trace | `live_capture` |
| `sessions` | cockpit | Monitor | Sessions | `derived_summary` |
| `transcripts` | cockpit | Monitor | Transcript Lens | `static_scaffold` |
| `tools` | cockpit | Monitor | Tool Pulse | `static_scaffold` |
| `costs` | cockpit | Monitor | Costs | `static_scaffold` |
| `timeline` | cockpit | Monitor | Decision Timeline | `derived_summary` |
| `repo` | anchor | Workspace | Repos | `live_repo` |
| `repo-pulse` | cockpit | Workspace | Workspace Pulse | `derived_summary` |
| `diffs` | cockpit | Workspace | Diff Review | `derived_summary` |
| `snapshots` | cockpit | Workspace | Checkpoints | `derived_summary` |
| `worktrees` | cockpit | Workspace | Worktrees | `static_scaffold` |
| `attribution` | cockpit | Workspace | Trace Lens | `derived_summary` |
| `skills` | cockpit | Ecosystem | Skills | `static_scaffold` |
| `agents` | cockpit | Ecosystem | Agent Roles | `static_scaffold` |
| `memory` | cockpit | Ecosystem | Memory Graph | `static_scaffold` |
| `hooks` | cockpit | Ecosystem | Hooks | `static_scaffold` |
| `setup` | cockpit | Ecosystem | Setup | `static_scaffold` |
| `ports` | cockpit | Ecosystem | Ports | `static_scaffold` |
| `hygiene` | cockpit | Health | Cleanup Queue | `static_scaffold` |
| `deps` | cockpit | Health | Dependency Watch | `static_scaffold` |
| `env` | cockpit | Health | Env Hygiene | `static_scaffold` |
| `status` | cockpit | Health | Trust Center | `live_capture` |
| `docs` | anchor | Config | Docs | `live_repo` |
| `settings` | cockpit | Config | Settings | `static_scaffold` |

### Page-state resolution

`TopLevelPageState` is derived separately from `RepoState` and resolves in this order after any in-flight `loading` state:

| Inputs | Result |
| --- | --- |
| authority decision is denied for the current surface or action | `permission_denied` |
| current surface depends on unavailable network, stream, or capture source and cannot produce the required result | `offline` |
| repo or runtime operation failed for a non-authority reason | `error` |
| operation completed safely but no relevant data exists for the current surface | `empty` |
| none of the above | `default` |

Additional rules:

1. `RepoState` remains the source of truth for repo loading and readiness only.
2. Docs runtime gating is evaluated before page-state resolution and fails closed with a dedicated runtime gate instead of masquerading as a generic page state.
3. When multiple failure signals are present, precedence remains `permission_denied > offline > error > empty > default`.

## Main Flow / Lifecycle

### 1. Application entry

1. App loads into the shell with sidebar visible.
2. Default mode is `dashboard`.
3. Repo-related data and capture-reliability state initialize through existing hooks.
4. Shell determines which view family to render based on `mode`.

### 2. Mode selection

1. Operator selects a sidebar item.
2. `App.tsx` updates `mode`.
3. Rendering contract resolves:
   - `dashboard` renders `DashboardView`
   - `repo` renders `BranchView` or a repo empty, loading, or error state
   - `docs` renders `DocsView`
   - every other mode renders `CockpitView`
4. Sidebar active state updates immediately.
5. Top navigation remains visible only for anchor modes.

### 3. Anchor view behavior

1. `dashboard` remains the aggregate operator overview and may initiate drill-down into `repo` via `DashboardFilter`.
2. `repo` remains the evidence-rich narrative workspace. If entered via dashboard drill-down, it must preserve the filter context until explicitly cleared.
3. `docs` remains the documentation lane. If desktop-only requirements are not met, it must render a runtime gate rather than fail silently.

### 4. Cockpit view behavior

1. Non-anchor modes render through a shared layout contract with section badge, trust badge, repo context, hero area, metrics, highlights, activity or status feed, and operator summary table.
2. Cockpit pages may reuse stable summary data initially, but they must frame it as operator guidance rather than canonical source-of-truth history.
3. Cockpit pages must provide at least one clear bridge back to the repo evidence lane where deeper inspection is required.

### 5. Drill-down lifecycle

1. Dashboard interaction creates a `DashboardFilter`.
2. Shell transitions from `dashboard` to `repo`.
3. Current focused element is stored before transition.
4. Clearing the filter returns to `dashboard`.
5. Focus is restored after the exit-animation timing budget already established in the dashboard contract.

### 6. Trust propagation lifecycle

1. Capture reliability is derived by existing ingest and session infrastructure.
2. `dashboard` and cockpit pages consume normalized trust state.
3. Trust degradation is an overlay, not a route replacement.
4. A page with usable content and degraded trust remains usable, but degraded status must stay visible in header-level context.

### 7. Repo-state lifecycle

1. `idle`
   Dashboard and cockpit may still render shell-level framing, but repo-dependent actions must remain cautious.
2. `loading`
   Repo mode renders indexing or progress UI, while cockpit pages continue to show shell context without claiming repo-ready facts.
3. `error`
   Repo mode renders repo-load failure state, while cockpit pages may continue to render bounded shell content but must soften or omit repo-path-derived detail.
4. `ready`
   All shell views may render repo-specific context and actions normally.

### 8. Async coordination lifecycle

1. Dashboard drill-down and return remain the only shell flow with a timed focus-restoration contract.
2. Focus restoration must respect the existing dashboard budget of `DASHBOARD_FOCUS_RESTORE_MS = 180`.
3. Dashboard chord interactions remain bounded by `DASHBOARD_CHORD_TIMEOUT_MS = 750`; cockpit views must not introduce longer hidden chord windows that make navigation feel inconsistent.
4. Dashboard dropped-request diagnostics remain bounded by the existing cap and TTL (`50` retained items over `24h`); cockpit views may add diagnostics, but they must follow bounded retention rather than unbounded in-memory growth.
5. Docs autoload is a one-shot attempt per mount under supported desktop runtime and current dev fallback rules; repeated silent retries are out of contract.
6. Capture-reliability refresh remains deduplicated when a request is already in flight; cockpit pages consume the shared result instead of launching parallel refresh storms.
7. Recovery-checkpoint loads and other async responses must be keyed so stale results are ignored after mode, request, or thread identity changes.
8. Leaving a cockpit page must not leave behind page-owned polling loops, retry timers, or focus traps.

## Interfaces and Dependencies

### Internal modules

1. `src/core/types.ts`
   Owns `Mode`, `DashboardFilter`, and shared branch, session, and domain types.
2. `src/App.tsx`
   Owns shell routing, anchor or cockpit resolution, and action wiring.
3. `src/hooks/useRepoLoader.ts`
   Owns repo open and load lifecycle plus repo state.
4. `src/hooks/useAutoIngest.ts`
   Owns capture reliability and trust-adjacent ingest state.
5. `src/ui/views/dashboardState.ts`
   Owns dashboard trust derivation and retry or failure classification.
6. `src/ui/components/Sidebar.tsx`
   Owns grouped navigation and shell action entry points.
7. `src/ui/components/TopNav.tsx`
   Owns anchor navigation semantics.
8. `src/ui/views/DashboardView.tsx`
   Owns aggregate dashboard behavior.
9. `src/ui/views/BranchView.tsx`
   Owns deep repo narrative behavior.
10. `src/ui/views/DocsView.tsx`
    Owns docs runtime-gate behavior.
11. `src/ui/views/CockpitView.tsx`
    Owns shared cockpit presentation.
12. `src/ui/views/cockpitViewData.ts`
    Owns per-mode cockpit content contract.
13. `src/ui/components/dashboard/DashboardTrustBadge.tsx`
    Owns the current degraded-trust badge primitive reused by dashboard and cockpit surfaces.
14. `src/ui/views/__tests__/CockpitView.test.tsx`
    Owns baseline render and degraded-trust regression coverage for cockpit pages.

### External and runtime dependencies

1. Tauri runtime presence for desktop-only docs behavior.
2. Existing update mechanism (`useUpdater`) for shell-level notifications.
3. Existing capture-reliability state from ingest and session infrastructure.
4. Existing hybrid-capture reliability contract from `src/core/tauri/ingestConfig.ts` and related trust-state helpers.

### Relevant repo guidance

1. `.diagram/architecture.mmd` confirms the shell depends on `useRepoLoader`, `useAutoIngest`, and dedicated view modules rather than a second router.
2. `docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md`
   documents the authoritative capture modes and the deterministic relationship between `HYBRID_ACTIVE`, `DEGRADED_STREAMING`, `OTEL_ONLY`, and `FAILURE`.

### Evidence gaps

1. Per-mode live data adapters are not yet defined for every cockpit section.
2. Final operator telemetry schema for cockpit-mode interactions is not yet standardized.
3. The current cockpit implementation does not yet expose per-element authority metadata, so this spec defines the contract before implementation catches up.

## Invariants / Safety Requirements

1. The UI must not describe itself using historical product names in primary operator-facing copy.
2. `repo` remains the only deep evidence workspace for branch narrative and linked drill-down context.
3. `dashboard` remains the only source of dashboard-created repo drill-down filters.
4. `docs` runtime gating must fail closed with user-readable explanation when desktop-only requirements are not met.
5. Trust degradation must never masquerade as health.
6. Anchor-mode behavior must remain keyboard-accessible and stable under rapid mode changes.
7. Sidebar and shell actions must use explicit button semantics and must not rely on implicit submit behavior.
8. Every defined `Mode` must be covered by routing and test coverage; adding a new mode without view-family mapping is invalid.
9. Imported, session-derived, and repo-derived strings remain untrusted input and must continue to respect existing sanitization and redaction boundaries.
10. Cockpit actions must stay recommendation-first: no cockpit page may introduce a destructive auto-remediation path without a separate explicit spec.
11. Desktop-only behavior must fail closed outside supported runtime; unsupported contexts may explain the limitation, but may not claim success or fabricate docs output.
12. Secret-bearing surfaces such as env hygiene must not become credential browsers; they may validate presence, status, or policy, but not expose secret values.

## Failure Model and Recovery

### Failure classes

1. `repo_unavailable`
   No repo is selected or the repo is not ready. Recovery: operator opens a repo or waits for indexing.
2. `repo_load_error`
   Git, indexing, or open failure. Recovery: show current repo error state and allow explicit retry or reopen.
3. `capture_degraded`
   Reliability is degraded while content remains usable. Recovery: keep page usable, show degraded trust, and point the operator toward status or repo evidence.
4. `docs_runtime_unavailable`
   Docs view is entered outside the supported desktop runtime. Recovery: render a runtime-gate message with no silent fallback.
5. `stale_async_result`
   A late response arrives after route or request identity changed. Recovery: ignore the late result and preserve current state.
6. `unmapped_mode`
   A new mode exists without view mapping. Recovery: fail in test or build validation rather than at runtime.
7. `docs_autoload_failed`
   Desktop runtime is available, but the one-shot docs autoload fails. Recovery: preserve explicit repo state error and require an operator-visible next step rather than looping.
8. `action_blocked_by_state`
   A cockpit CTA cannot run because repo state, trust, or runtime preconditions are not met. Recovery: render the action as disabled with the blocking reason and the nearest safe alternative.

### Recovery rules

1. Shell-level navigation remains available even when repo-specific content is unavailable.
2. Trust recovery follows existing capture and ingest recovery mechanisms; cockpit views do not invent their own retry state machine.
3. Any operator action that cannot complete safely must fail with explicit copy, not hidden no-op behavior.
4. Historical naming drift is corrected in current UI copy; imported historical artifacts may retain original names only inside evidence or history views where accuracy requires it.
5. Permission-denied states must fail closed and keep only aggregate-safe residuals; privileged or sensitive row-level detail must not leak through fallback rendering.
6. Retry behavior for cockpit-adjacent data access follows the existing class-based contract:
   - `authority_denied` is non-retryable until permission context changes
   - transient or runtime failures may use bounded retries only where an existing surface already owns that policy
   - cockpit pages must not introduce their own unbounded polling or silent retry loops
7. Stale async responses must be discarded without overwriting newer route or trust state, and the discard should be diagnosable in development or test assertions.
8. Route exit, repo change, or runtime loss must clean up page-owned timers, listeners, and transient action state before the next view becomes authoritative.
9. A blocked action must degrade into one of three outcomes only: explained disablement, safe alternative CTA, or removal from the current context.

### Retry budget profile

1. Failure classification for shell-owned retries remains limited to:
   - `ipc_timeout`
   - `io_transient`
   - `offline_source`
   - `authority_denied`
2. Budget profiles are environment-specific and inherited from the established dashboard contract:
   - `dev`
     - `ipc_timeout`: `maxAttempts=3`, `maxTotalRetryMs=4000`, `backoff=[250, 500, 1000]`, `jitterPercent=20`
     - `io_transient`: `maxAttempts=3`, `maxTotalRetryMs=4000`, `backoff=[250, 500, 1000]`, `jitterPercent=20`
     - `offline_source`: `maxAttempts=1`, `maxTotalRetryMs=0`
     - `authority_denied`: `maxAttempts=1`, `maxTotalRetryMs=0`
   - `ci`
     - `ipc_timeout`: `maxAttempts=3`, `maxTotalRetryMs=6000`, `backoff=[250, 500, 1000]`, `jitterPercent=20`
     - `io_transient`: `maxAttempts=3`, `maxTotalRetryMs=6000`, `backoff=[250, 500, 1000]`, `jitterPercent=20`
     - `offline_source`: `maxAttempts=1`, `maxTotalRetryMs=0`
     - `authority_denied`: `maxAttempts=1`, `maxTotalRetryMs=0`
   - `prod`
     - `ipc_timeout`: `maxAttempts=3`, `maxTotalRetryMs=12000`, `backoff=[250, 500, 1000]`, `jitterPercent=20`
     - `io_transient`: `maxAttempts=3`, `maxTotalRetryMs=12000`, `backoff=[250, 500, 1000]`, `jitterPercent=20`
     - `offline_source`: `maxAttempts=1`, `maxTotalRetryMs=0`
     - `authority_denied`: `maxAttempts=1`, `maxTotalRetryMs=0`
3. Cockpit pages may reuse these budgets only through shared shell or hook helpers; they must not fork the numbers locally.

### Operator recovery drill

1. If capture becomes unstable, the operator path is:
   - verify current capture mode and trust banner
   - fall back to `OTEL_ONLY` or `DEGRADED_STREAMING` safely if stream enrichment is unhealthy
   - keep the shell usable with explicit degraded messaging
   - recover hybrid behavior only after the ordered runtime and auth handshake succeeds
2. Recovery UX must point to the next safe action in order, not just restate failure.
3. Shell surfaces must never imply `HYBRID_ACTIVE` until the shared capture-reliability source confirms it.

## Observability

### Required UI events

1. `ui_mode_changed`
   Payload includes `from_mode`, `to_mode`, `view_family`, and `repo_state`.
2. `cockpit_view_rendered`
   Payload includes `mode`, `section`, `trust_state`, and `repo_state`.
3. `dashboard_repo_drilldown_started`
   Payload includes `filter_type` and `filter_value_hash`.
4. `dashboard_repo_drilldown_cleared`
   Payload includes `restored_focus` and `elapsed_ms`.
5. `docs_runtime_gate_rendered`
   Payload includes `runtime_supported: false` and `repo_state`.
6. `cockpit_action_invoked`
   Payload includes `mode`, `action`, and `repo_state`.
7. `cockpit_action_blocked`
   Payload includes `mode`, `action`, `block_reason`, `repo_state`, and `trust_state`.
8. `docs_autoload_attempted`
   Payload includes `runtime_supported`, `is_dev`, and `repo_state_before_attempt`.
9. `docs_autoload_completed`
   Payload includes `outcome`, `repo_state_after_attempt`, and `error_class` when applicable.
10. `async_result_discarded`
    Payload includes `surface`, `request_kind`, and `discard_reason`.

### Required diagnostics

1. Count of rendered cockpit modes versus defined cockpit modes.
2. Count of degraded-trust renders by mode.
3. Count of docs runtime-gate renders.
4. Count of routing mismatches caught in tests or assertions.
5. Count of cockpit renders by `DataAuthorityTier` mix so scaffold-heavy pages are visible during rollout.
6. Count of blocked cockpit actions by reason.
7. Count of stale async results discarded instead of applied.
8. Count of docs autoload attempts by outcome.

### Telemetry envelope

1. Shell and cockpit telemetry events must carry a stable envelope when the data is available:
   - `session_id`
   - `request_key_hash`
   - `attempt`
   - `mode`
   - `window_id`
   - `ts_iso8601`
2. Events must not emit raw filesystem paths, tokens, secrets, command arguments, or unsanitized imported content.
3. Path-like values that need correlation must be hashed, bucketed, or reduced to safe labels before emission.

### Release-blocking events

1. The following event classes are release-blocking for shell rollout instrumentation:
   - mode-to-view state transition events
   - source-authority classification events
   - command or action authority denied events
   - retry-budget exhausted events
   - async discard events where stale results were prevented from applying
2. Missing or malformed release-blocking events are a no-go for rollout promotion because they remove operator visibility into trust and routing behavior.

### Rollout evidence expectations

1. Shell rollout validation must produce an artifact pack that includes:
   - commands run
   - pass or fail outcomes
   - sample size or mode coverage
   - operator and timestamp
   - residual risks and any rollback recommendation
2. If a degraded-trust or runtime-gate recovery drill is exercised, the artifact pack must capture the exact before and after mode plus the verification result.

### Operator validation surfaces

1. Screenshot or visual-regression coverage for representative modes from each section.
2. Focus and keyboard coverage for shell navigation and dashboard drill-down return.
3. Explicit verification that user-visible naming is canonical Trace Narrative naming.
4. Artifact-first rollout evidence for shell changes, including commands run, outcomes, and residual risks.
5. A spec-to-code spot check that every shipped mode is mapped in routing, grouped in the sidebar, and covered by at least one render assertion.

## Acceptance and Test Matrix

| Area | Contract | Validation |
| --- | --- | --- |
| Mode routing | Every `Mode` resolves to anchor or cockpit view deterministically | Unit test over mode mapping plus render smoke tests |
| Sidebar IA | Sidebar groups modes into stable section buckets with canonical labels | Component test for labels and active state |
| Anchor shell | Top nav appears for `dashboard`, `repo`, and `docs` only | App-shell render test |
| Dashboard drill-down | `dashboard -> repo filtered -> dashboard` return path still works with focus restoration | Existing dashboard and branch integration tests plus targeted shell test |
| Trust overlay | Degraded capture remains a visible overlay on dashboard and cockpit pages | DashboardView and CockpitView trust-state tests |
| Source authority | Scaffold or derived cockpit content is labeled and framed so it cannot be mistaken for live state | Snapshot or content assertion over representative cockpit views |
| Action availability | Cockpit CTAs explain blocked states instead of silently no-oping | Component tests for disabled or alternative CTA states |
| Repo-state handling | `idle`, `loading`, `error`, and `ready` behave predictably across view families | App-shell render matrix |
| Docs runtime gate | Unsupported runtime shows explicit docs gating state | DocsView tests |
| Docs autoload | Desktop dev autoload attempts at most once per mount and surfaces success or failure explicitly | DocsView unit test with guarded retry assertions |
| Async discard | Late async results do not overwrite newer route or trust state | Hook or integration tests around keyed request invalidation |
| Retry budgets | Shared retry classes and per-environment budgets remain contractually intact | Unit test over retry profiles and failure classification |
| Telemetry envelope | Release-blocking shell events include required envelope fields and exclude forbidden raw fields | Telemetry payload tests or assertion helpers |
| Rollout evidence | UI shell rollout yields an artifact pack with commands, outcomes, coverage, and residual risk | Manual or scripted release-readiness check captured in artifacts |
| Canonical naming | Primary operator-facing copy uses Trace Narrative naming only | Snapshot or search-based test over shell labels and primary headings |
| Accessibility | Sidebar buttons, top-nav tabs, and action affordances remain keyboard reachable and semantically correct | Testing Library keyboard tests and accessibility assertions |
| Reduced motion | Any shell-level animation retains information with reduced-motion parity | Visual or behavioral QA, or targeted tests if motion tokens are added |

### Validation commands

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- targeted shell and view tests for mode routing and trust overlays when new mode behavior is added

## Open Questions

1. Which cockpit sections should receive real live data first after the shared shell lands?
2. Should sidebar badge counts remain static placeholders initially or become live-derived before broader rollout?
3. Should top-nav continue to show only anchor experiences, or should it eventually expose section context for cockpit modes?
4. Should the assistant remain a guided operator surface in phase one, or evolve into a richer conversation workspace later?
5. Should `OTEL_ONLY` eventually receive distinct badge copy from generic degraded trust, or remain a detailed explanation inside supporting text only?

## Definition of Done

1. A new implementation plan can reference this document without inventing shell ownership or recovery behavior.
2. The contract clearly distinguishes anchor views from cockpit views.
3. Trust, repo-state, and docs-runtime behavior are explicit enough to test.
4. Canonical naming and non-goals are explicit enough to prevent clone-like drift.
5. Lifecycle timing, async discard, and action-blocking behavior are explicit enough that the shell can be implemented without hidden state-machine guesses.
