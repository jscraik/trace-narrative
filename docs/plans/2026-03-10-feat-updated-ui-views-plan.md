---
title: Updated UI Views Implementation Plan
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-updated-ui-views-brainstorm.md
spec: docs/specs/2026-03-10-feat-updated-ui-views-spec.md
---

## Overview
This plan implements the "Updated UI Views" contract from the cited spec by wiring all non-anchor modes through the shared cockpit surface, with a single trust normalization path and explicit per-element data authority cues. The implementation should preserve current routing and existing anchor behaviors (`dashboard`, `repo`, `docs`) while making cockpit mode rendering deterministic and contract-driven.

## Enhancement Summary

**Deepened on:** 2026-03-10
**Key areas improved:** sequencing, execution gates, rollout control, and verification criteria

- Added explicit phase ordering with required prerequisites and exit criteria so each team can stop or proceed safely.
- Added implementation-level dependencies (internal, external, and review-gate) to prevent parallelization into uncoupled files.
- Strengthened rollout guidance with a concrete rollback criterion and evidence capture expectations before and after CI validation.
- Added acceptance checks mapped directly to risk categories (`trust`, `routing`, `authority`, and `async safety`) for faster risk-driven sign-off.

## Problem Statement / Motivation
Current UI mode coverage is partially implemented and includes gaps in trust/authority signaling consistency and mode coverage guarantees. The app risks contract drift when cockpit modes are rendered ad hoc, especially around:
- capture reliability normalization for `OTEL_ONLY` and degraded stream states,
- per-element authority tier framing (`Repo`, `Live`, `Derived`, `Preview`),
- and end-to-end checks at the Cockpit UI layer for source certainty signals.

## Scope and Non-Goals
- In scope:
  - Shared trust helper consolidation for `CaptureReliabilityStatus` → `CockpitTrustState` across dashboard and cockpit.
  - Cockpit rendering contract completion for all defined `cockpit` modes in `Mode`.
  - Explicit per-element authority cue visibility and tests, including OTEL-only derived-summary behavior at the UI layer.
  - Deterministic routing/state tests and telemetry/validation coverage required by the spec.
- Non-goals:
  - Replacing `BranchView`, `DashboardView`, or `DocsView` internals.
  - Full live data parity for every section on day one.
  - Destructive or auto-remediation workflows.
  - Backend persistence or ingestion schema redesign.

## Implementation Phases

### Phase 1 — Contract lock and safe baseline
- **Goal:** freeze execution scope and prevent accidental anchor-mode drift before content changes.
- **Prerequisites:** read and align on frontmatter-linked spec + brainstorm; confirm owner approval for test order in the work queue.
- **Actions:**
  - Reconfirm spec-to-code map and enumerate all `Mode` values with assigned view family and section.
  - Verify these files currently host the contract boundaries:
  - `src/core/types.ts`
  - `src/App.tsx`
  - `src/hooks/useAutoIngest.ts`
  - `src/ui/components/Sidebar.tsx`
  - `src/ui/views/dashboardState.ts`
  - `src/ui/views/CockpitView.tsx`
  - `src/ui/views/cockpitViewData.ts`
  - `src/ui/views/__tests__/CockpitView.test.tsx`
  - `src/ui/views/__tests__/cockpitViewData.test.tsx`
  - `src/ui/views/__tests__/dashboardState.test.ts`
- Add/adjust a short test checklist to ensure each mode can be routed and rendered by family before behavior details are touched.
- Capture/update an explicit `Mode` registry artifact in the plan or code comments so every phase reads from the same source of truth.
- **Exit criteria:**
  - No ambiguity on which modes are anchor vs cockpit.
  - No mode lacks a section assignment in the implementation plan.
  - Test checklist committed with pass/fail intent before Phase 2 changes begin.

### Phase 2 — Shared trust mapping and authority cue foundation
- **Goal:** guarantee the only trust normalization source is shared, then make it visible at element level.
- **Prerequisites:** completion and sign-off of Phase 1 mode registry.
- **Actions:**
  - Add or confirm a single shared helper path that maps `CaptureReliabilityStatus` to `CockpitTrustState` and is reused by dashboard and cockpit code paths.
  - Ensure mapping includes explicit handling for `OTEL_ONLY` as a baseline/live-only source that maps to `CockpitTrustState.healthy` while rendering `derived_summary` authority cues.
  - Extend `CockpitView` and `cockpitViewData` data generation so each rendered field includes deterministic `DataAuthorityTier` metadata.
  - Add assertion coverage for per-element authority cue rendering across representative cockpit modes.
- **Exit criteria:**
  - A single helper is the only mapping function referenced by new/modified routing paths.
  - At least one `OTEL_ONLY` UI assertion and one unknown-state regression assertion are written.
  - Snapshot updates are limited to intentional content changes tied to cue labeling.

### Phase 3 — Cockpit mode content hardening
- **Goal:** complete the spec’s mode surface with consistent structure and safe framing before deeper data wiring.
- **Prerequisites:** completion and code review of Phase 2 trust/cue foundation.
- **Actions:**
  - Implement/update mode data in `cockpitViewData.ts` for all cockpit modes in spec matrix (`work-graph`, `assistant`, `live`, `sessions`, `transcripts`, `tools`, `costs`, `timeline`, `repo-pulse`, `diffs`, `snapshots`, `worktrees`, `attribution`, `skills`, `agents`, `memory`, `hooks`, `setup`, `ports`, `hygiene`, `deps`, `env`, `status`, `settings`).
  - Keep all modes in a shared contract shape and ensure unknown/missing source states degrade safely to non-authoritative framing.
  - For `repo`, `dashboard`, `docs`, preserve anchor-mode pathways and avoid adding cockpit-specific logic that bypasses anchor behavior.
  - Add/adjust action availability logic where CTA availability depends on repo/trust/runtime state.
  - Add `DataAuthorityTier` coverage for representative high-risk modes (`status`, `work-graph`, `live`) first, then fill remaining modes in batches.
- **Exit criteria:**
  - No `Mode` remains unmapped or uses legacy placeholders lacking section and authority metadata.
  - No action path in cockpit bypasses shared action gating contract.
  - Unknown source states consistently show safe framing across at least two sample pages and one shared fixture.

### Phase 4 — Verification and hardening layer
- **Goal:** hard-stop risky regressions before rollout and establish release evidence.
- **Prerequisites:** all mode data paths changed or intentionally deferred by scope.
- **Actions:**
  - Add dedicated helper-level and Cockpit-level tests for OTEL-only mapping and authority visibility:
    - Shared helper unit test: `OTEL_ONLY` resolves via shared mapping to healthy trust state and explicit authority cue metadata (`derived_summary`).
  - Add one dedicated integration-style UI test for OTEL-only and authority visibility in CockpitView:
    - Render CockpitView in OTEL-only derived-summary mode.
    - Assert `derived_summary` cue is present and displayed at element scope.
  - Add regression tests for unknown capture modes and authority cue presence before implementation kickoff:
    - unknown mode mapped to degraded trust,
    - each representative tier (`live_repo`, `live_capture`, `derived_summary`, `static_scaffold`) has expected cue rendering.
  - Add a contract-level matrix test that renders/serializes every non-anchor `Mode` through `cockpitViewData` and asserts each rendered element (`hero`, `metrics`, `highlights`, `activity`, `table`, `footerNote`) includes non-null `DataAuthorityTier` and cue metadata, preventing untested fallback drift.
  - Run routing matrix tests for sidebar grouping and top-nav anchor-only behavior.
  - Validate retry class reuse for capture-related diagnostics remains shared (no duplicate budget constants or forks).
  - Add async discard test that proves late results do not overwrite route-specific state for docs autoload, drilldown, and trust refresh surfaces.
- **Exit criteria:**
  - All targeted tests are automated and keyed to the acceptance checklist entries.
  - No test in this phase depends on external live data from non-test fixtures.
  - Test-only flake handling documented if failures are non-deterministic.

### Phase 5 — Pre-launch validation and handoff
- **Goal:** convert implementation evidence into a minimal safe rollout gate.
- **Prerequisites:** all verification tests from Phase 4 pass in the target branch.
- **Actions:**
  - Ensure rollout evidence artifact scaffold exists before running release gates:
    - create or refresh `artifacts/ui-views-rollout-plan-evidence.md` with required section headers.
    - fail Phase 5 if required sections are missing.
  - Compile final rollout evidence pack from commands, output logs, and risk register.
  - Validate telemetry event contract for release-blocking classes manually against a local or test harness sample.
  - Conduct a focused visual/accessibility sweep for one representative mode per section (`Monitor`, `Workspace`, `Ecosystem`, `Health`, `Config`).
  - Confirm rollback instructions and owner contact path are in place before merge.
- **Exit criteria:**
  - Artifacts include test results, command log, and unresolved risk callouts.
  - No critical roll-forward blockers remain untriaged.

## Dependencies and Risks
- Dependencies:
  - Existing shared trust primitives in `src/ui/views/dashboardState.ts`.
  - Capture-reliability and status flow in `src/hooks/useAutoIngest.ts`.
  - Existing Cockpit render scaffolding in `CockpitView.tsx`.
  - Type updates in `src/core/types.ts` (`CockpitTrustState`, `DataAuthorityTier`, `Mode`).
- Risks:
  - Scope creep if per-mode deep data adapters are added without shared gating.
  - Regression risk in tests if existing snapshots were authored before authority cues.
  - Hidden runtime coupling from docs autoload or authority decision paths if not key-bound and deduplicated.
- Mitigations:
  - Keep implementation constrained to shared contracts before mode-specific enrichment.
  - Gate each batch with tests that assert both render shape and cue/trust classes.
- **Internal dependencies:**
  - Frontend owner for view/component changes (`CockpitView`, `CockpitView` test suite).
  - Frontend owner for shell and routing changes (`App.tsx`, `Sidebar.tsx`).
  - Tauri/runtime owner for docs autoload/runtime gate behavior.
- **External dependencies:**
  - CI resources and deterministic test environment for `pnpm test`.
  - Any upstream capture-reliability contract changes in ingest/daemon components must be reviewed before changing mapping logic.
- **Human dependencies:**
  - Product owner to approve whether the assistant stays scaffolded (`assistant` mode scope) during initial rollout.
  - Platform owner to confirm telemetry event names/envelope fields stay stable.
- **Risk response table:**
  - Risk: helper drift or duplicate mapping → Mitigation: grep-based CI guard (single-source mapping search) and reviewer checklist item before merging.
  - Risk: unstable benchmark for OTEL-only UI assertion → Mitigation: use deterministic fixture + explicit `data-*` selectors.
  - Risk: hidden regressions in docs runtime/autoload behavior → Mitigation: one-shot guard and explicit route identity checks in tests.

## Test and Validation Strategy
- Unit and component test matrix:
  - `src/ui/views/__tests__/dashboardState.test.ts`
  - `src/ui/views/__tests__/CockpitView.test.tsx`
  - `src/ui/views/__tests__/cockpitViewData.test.ts`
  - `src/ui/components/__tests__/TrustStateIndicator.test.tsx`
  - `src/ui/views/__tests__/docsAutoLoad.test.ts`
  - `src/ui/components/__tests__/Sidebar.test.tsx`
- **Cue assertion contract:** authority rendering checks should use fixed selectors:
  - `data-authority-tier="live_repo|live_capture|derived_summary|static_scaffold"`
  - `data-authority-label="Repo|Live|Derived|Preview"`
  - `data-authority-source="trust|authority|fixture|runtime"` (when available)
- **Canonical naming checks:**
  - Add a naming regression assertion that forbids legacy aliasing in primary shell-facing copy.
  - Include primary headings, sidebar labels, top-nav tabs, and section names in the canonical naming scan.
- Test additions:
  - OTEL-only UI-layer test for CockpitView + `derived_summary` cue.
  - Unknown capture mode trust mapping tests at model and UI view boundary.
  - Per-element authority cue assertions (`data-authority-tier` and/or visible badge/label assertions).
  - Route/family coverage test ensuring every non-anchor mode uses cockpit rendering and every anchor mode bypasses.
  - Docs runtime-gate and one-shot autoload regression checks.
  - Replay stale async result discard assertions for route/request identity changes.
- Required commands post-change:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
- `required=('command log' 'pass/fail outcomes' 'risk matrix' 'residual risk notes' 'rollback decision' 'monitor window handoff' 'owner sign-off'); for h in "${required[@]}"; do rg -q -i "^##[[:space:]]+${h// /[[:space:]]*}" artifacts/ui-views-rollout-plan-evidence.md || { echo "Missing required evidence heading: $h"; exit 1; }; done`

## Rollout / Migration / Monitoring
- Rollout is phased:
  - Phase A: trust/helper and data contract hardening.
  - Phase B: mode matrix + cockpit content + cue assertions.
  - Phase C: full test and telemetry sanity checks, then release candidate.
- Observability checks:
  - Validate release-blocking events for `ui_mode_changed`, `cockpit_view_rendered`, `cockpit_action_blocked`, and `async_result_discarded`.
  - Confirm telemetry excludes raw paths/secrets and includes envelope fields (`session_id`, `request_key_hash`, `mode`, `attempt`, `ts_iso8601`, etc.).
- **Rollout evidence pack (required for go/no-go):**
  - Required file: `artifacts/ui-views-rollout-plan-evidence.md`
  - Required sections: command log, pass/fail outcomes, risk matrix with owners, residual risk notes, rollback decision, and monitor window handoff.
  - Required owners: implementation owner, platform owner, release owner.
  - Completion condition: plan cannot proceed to merge without this artifact.
  - Evidence bootstrap check (before merge):
    - Required command: `required=('command log' 'pass/fail outcomes' 'risk matrix' 'residual risk notes' 'rollback decision' 'monitor window handoff' 'owner sign-off'); for h in "${required[@]}"; do rg -q -i "^##[[:space:]]+${h// /[[:space:]]*}" artifacts/ui-views-rollout-plan-evidence.md || { echo "Missing required evidence heading: $h"; exit 1; }; done`.
    - Required headings present: `command log`, `pass/fail outcomes`, `risk matrix`, `residual risk notes`, `rollback decision`, `monitor window handoff`, `owner sign-off`.
- Rollback rule:
  - If trust or routing checks fail in CI, revert to previous behavior in shared trust helper and gate Cockpit mode rendering to bounded fallback scaffolds.
- **Rollout window and sequencing:**
  - Recommended sequencing: Weekday off-peak window for first full rollout with a 30-minute monitor window after merge.
  - First merge target should include only Phases 1–4 if telemetry confidence is insufficient to add production rollouts in the same pass.
  - If metrics are clean, merge Phase 5 artifacts and enable broader mode visibility.
- **Monitoring and alerting expectations:**
  - Track routing mismatches, `cockpit_view_rendered` counts by `trust_state`/`DataAuthorityTier`, and `async_result_discarded` volume over the first 24 hours.
  - Alert threshold suggestion: any sustained increase in discard or routing-mismatch events compared to previous release baselines should pause rollout and require remediation before proceeding.
- **Backfill / migration notes:**
  - No schema migration required.
  - If authority cue metadata is added to existing fixtures, update only fixture expectations in tests and no user data migration is needed.

## Resolved Open Questions

- Q: Should `OTEL_ONLY` be validated at both helper and Cockpit UI levels?
  - A: Yes. Phase 4 requires both a shared helper unit test and a CockpitView integration-style assertion.
- Q: Where should rollout evidence be stored and what must it contain?
  - A: `artifacts/ui-views-rollout-plan-evidence.md` with commands, outcomes, risk matrix, residual risks, owner decisions, and rollback status.
- Q: How should reduced-motion be validated?
  - A: Run a manual accessibility sweep for motion parity and add a targeted automated check only if motion tokens/classes are added during implementation.

## Spec Open Questions — Resolved for this plan

- Q: Which cockpit sections should receive real live data first after the shared shell lands?
  - A: `status`, `live`, and `sessions` first (high operational value), then `repo-pulse`, then `workspace` and `health` sections; `assistant` and `tools` remain scaffolded until shared adapters are in place.
  - Owner: Product + Frontend leads; due date: Phase 3 completion.
- Q: Should sidebar badge counts remain static placeholders initially or become live-derived before broader rollout?
  - A: Static placeholders in phase one to keep implementation bounded; migrate to live-derived counts after shared adapter parity is proven on initial high-value sections.
  - Owner: Frontend lead; due date: after Phase 3 acceptance.
- Q: Should top-nav continue to show only anchor experiences, or should it eventually expose section context for cockpit modes?
  - A: Keep anchor-only in phase one to match current contract; evaluate expansion as a follow-up phase only.
  - Owner: Product lead; due date: post-Phase 5 review.
- Q: Should the assistant remain a guided operator surface in phase one, or evolve into a richer conversation workspace later?
  - A: Keep as guided operator surface (`static_scaffold`) in phase one; do not expand to rich conversation workflow in this plan.
  - Owner: Product lead.
- Q: Should `OTEL_ONLY` eventually receive distinct badge copy from generic degraded trust, or remain a detailed explanation inside supporting text only?
  - A: Keep generic `derived_summary` badge semantics in this phase, with explanatory copy in supporting text and no separate badge variant.
  - Owner: Frontend + Product leads.

## Acceptance Checklist
- [ ] Routing safety: every `Mode` maps deterministically to anchor or cockpit rendering, including explicit test fixtures for unknown `Mode` values.
- [ ] Trust safety: shared helper is the only `CaptureReliabilityStatus` → `CockpitTrustState` path for both dashboard and cockpit paths.
- [ ] OTEL-only safety: UI-layer Cockpit integration test verifies `OTEL_ONLY` maps to allowed behavior and renders `derived_summary` cue.
- [ ] Degradation safety: unknown capture states map to documented degraded-safe behavior with non-authoritative framing and no action escalations.
- [ ] Authority transparency: all cockpit elements with rendered content include visible authority cueing and tier metadata.
- [ ] Authority coverage completeness: a phase-4 contract test verifies every non-anchor `Mode` path includes authority metadata for all rendered sections.
- [ ] Canonical naming safety: primary shell-facing copy excludes legacy aliases and follows spec contract naming.
- [ ] Accessibility and anchor safety: all anchor modes keep current shell semantics and remain keyboard-accessible with explicit anchor/tab behavior.
- [ ] Async safety: stale async results are ignored after request/route transitions; tests prove one-shot docs autoload, discard behavior, and request invalidation.
- [ ] Operational readiness: rollout artifacts include command outputs, residual risks, and rollback decision by owner for a go/no-go.
- [ ] Rollout evidence completeness: `artifacts/ui-views-rollout-plan-evidence.md` contains required sections and owner sign-off.
- [ ] Evidence bootstrap: evidence artifact command guard and required section checks pass before merge.
- [ ] Static quality gate: `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass.

## Sources & References
- [docs/specs/2026-03-10-feat-updated-ui-views-spec.md](/Users/jamiecraik/dev/trace-narrative/docs/specs/2026-03-10-feat-updated-ui-views-spec.md)
- [docs/brainstorms/2026-03-10-updated-ui-views-brainstorm.md](/Users/jamiecraik/dev/trace-narrative/docs/brainstorms/2026-03-10-updated-ui-views-brainstorm.md)
- [docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md](/Users/jamiecraik/dev/trace-narrative/docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md)
