---
title: "feat: First-win commit story loop"
type: feat
status: active
date: 2026-03-04
origin: docs/brainstorms/2026-03-04-first-win-commit-story-loop-brainstorm.md
---

# ✨ feat: First-win commit story loop

## Table of Contents
- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Proposed Solution](#proposed-solution)
- [Technical Approach](#technical-approach)
  - [Architecture](#architecture)
  - [UX Funnel KPI Design](#ux-funnel-kpi-design)
  - [Deterministic Async Handling Contract](#deterministic-async-handling-contract)
  - [Official Pattern Alignment (React)](#official-pattern-alignment-react)
  - [Telemetry Contract Testing Pattern](#telemetry-contract-testing-pattern)
  - [Implementation Phases](#implementation-phases)
- [Alternative Approaches Considered](#alternative-approaches-considered)
- [System-Wide Impact](#system-wide-impact)
  - [Interaction Graph](#interaction-graph)
  - [Error \& Failure Propagation](#error--failure-propagation)
  - [State Lifecycle Risks](#state-lifecycle-risks)
  - [Security \& Privacy Controls](#security--privacy-controls)
  - [API Surface Parity](#api-surface-parity)
  - [Integration Test Scenarios](#integration-test-scenarios)
- [Acceptance Criteria](#acceptance-criteria)
  - [Functional Requirements](#functional-requirements)
  - [Non-Functional Requirements](#non-functional-requirements)
  - [Quality Gates](#quality-gates)
- [Success Metrics](#success-metrics)
- [Dependencies \& Prerequisites](#dependencies--prerequisites)
- [Risk Analysis \& Mitigation](#risk-analysis--mitigation)
- [Premortem (2026-09)](#premortem-2026-09)
- [Plan Revisions from Premortem](#plan-revisions-from-premortem)
- [Resource Requirements](#resource-requirements)
- [Open Questions / Decision Gates](#open-questions--decision-gates)
- [AI-Era Considerations](#ai-era-considerations)
- [Future Considerations](#future-considerations)
- [Documentation Plan](#documentation-plan)
- [Sources \& References](#sources--references)

## Overview

Deliver a tighter “first-win” repo experience that helps a solo AI-heavy developer understand a commit in under 30 seconds using a guided **What → Why → Evidence** path, while staying on existing surfaces (see brainstorm: `docs/brainstorms/2026-03-04-first-win-commit-story-loop-brainstorm.md`).

This plan intentionally prioritizes immediate clarity over product breadth and pairs UX tightening with targeted orchestration cleanup to keep future iteration maintainable (see brainstorm: same origin file, Key Decisions + Resolved Questions).

## Problem Statement

Current Narrative flow is powerful but cognitively heavy for first-time/returning users. The intended What/Why/Evidence journey exists, but orchestration complexity and async edge cases can reduce trust, consistency, and speed.

Evidence from repo research:
- Existing path is distributed across `src/App.tsx`, `src/ui/views/BranchViewLayout.tsx`, `src/ui/components/BranchNarrativePanel.tsx`, and `src/ui/views/branch-view/useBranchViewController.ts`.
- Stale-guard and telemetry patterns exist, but need consistent enforcement and measurement for the first-win funnel.
- Maintainability hotspots remain in orchestration-heavy files, slowing safe UX changes.

## Proposed Solution

Implement a no-new-surface first-win loop by refining behavior inside existing Branch/Narrative surfaces:
1. Make the first narrative item deterministic and quickly visible.
2. Standardize What → Why → Evidence interaction outcomes and fallback behavior.
3. Enforce stale-guard + confidence sanitization + telemetry contract for all first-win actions.
4. Reduce orchestration risk through focused extraction/boundary tightening in the existing branch controller stack.

Research decision: this pass now aligns implementation requirements to official React/Vitest guidance on async race handling and event-contract testing (see `External References`).

## Technical Approach

### Architecture

Use existing app architecture and improve boundaries:
- Keep route/surface structure in `src/App.tsx` and `src/ui/views/BranchViewLayout.tsx`.
- Refine interaction logic in `src/ui/components/BranchNarrativePanel.tsx` and branch-view hooks.
- Strengthen deterministic ordering and fallback contract in narrative composition and evidence routing.
- Preserve existing trust boundaries; do not introduce net-new major surfaces.

No new DB model is planned. **ERD update is not applicable** for this feature unless implementation introduces new persistence tables.

### UX Funnel KPI Design

Keep all tracking on existing telemetry channels (`narrative:telemetry`) and add deterministic funnel metadata to payloads only:

- `funnel_session_id`: stable per render cycle (e.g., `narrativeViewInstanceId` + request epoch).
- `funnel_step`: `what_ready` | `why_requested` | `why_ready` | `evidence_requested` | `evidence_ready`.
- `event_outcome`: `attempt` | `success` | `fallback` | `failed` | `stale_ignored`.
- `flow_latency_ms`: step latency deltas from an origin timestamp.

KPI targets (post-implementation, for single-step funnel path):

- **p95 completion** from selected-commit narrative render (`what_ready`) to first completed evidence view (`evidence_ready`): **≤ 30s**.
- **p95 per-step latency**: `what_ready→why_ready` **≤ 10s**, `why_ready→evidence_ready` **≤ 8s**.
- **Stale drop rate** (`stale_ignored` outcomes): **< 1%** after warm interactions.
- **Explicit fallback ratio**: track and alert if fallback > 60% on healthy local repos (indicates narrative/evidence quality drift).

### Deterministic Async Handling Contract

Adopt a strict async contract in existing hooks only (no new surfaces):

1. **Identity before execution** — every async action is tagged with a request identity derived from existing scope inputs (`branchScopeKey`, selected commit/file, step type).
2. **Monotonic versions** — each request increments a local version/epoch; commit results only when both `activeVersion === requestVersion` **and** identity still matches.
3. **Deterministic cancellation semantics** — return cleanup handlers from effects and clear stale branches before starting next request.
4. **Outcome completeness** — every path emits one of `event_outcome` states, including stale-cancel and explicit fallback.
5. **Latency boundary instrumentation** — capture `performance.now()` at action origin and emit step latency on any terminal outcome.

#### Official Pattern Alignment (React)

- Use effect-level request guards (`ignore` / cleanup-driven cancellation) so stale responses cannot update state, matching React's official race-condition guidance (`useEffect` cleanup).
- Preserve scope tokens across async boundaries and validate both token + scope before mutating state; if branch/file/request context changed, classify as `stale_ignored`.
- In any async path with cancellable API support, pass `AbortSignal` and abort on cleanup to avoid unnecessary work and reduce resource leak risk.
- Keep dependency arrays complete and test behavior under development `StrictMode` remount cycles; React docs indicate extra mount/cleanup cycles in development are expected and should be treated as contract stress tests.

Implementation notes for existing paths:

- `useBranchSelectionData`: keep request key/version guards, add canonical `stale_ignored` telemetry when a request drops.
- `useBranchAskWhyState`: preserve and extend the existing monotonic request token guard with terminal outcome telemetry for aborted/stale responses.
- `useBranchViewController` ask-why/evidence/open-raw-diff: normalize event ordering so `evidence_opened` is emitted after fallback decisions are resolved for the same request.
- `useBranchNarrativeState` + `useCommitData` paths: snapshot request identities on load start to prevent ABA (`A→B→A`) response ordering regressions.

### Telemetry Contract Testing Pattern

Use Vitest-native contract checks in addition to behavior assertions:

1. **Event matrix** — define a canonical list (`NarrativeTelemetryEventNameAll`) with per-event required field assertions in test fixtures.
2. **Strict telemetry builder tests** — call each `track*` helper with boundary payloads and verify:
   - `schemaVersion === 'v1'`
   - `event` name matches
   - required keys are present (`expect.toMatchObject` / `expect.objectContaining`)
   - `dispatchEvent` call count and argument shape.
3. **Compile-time guards** — keep event payload builders typed and add `expectTypeOf(...).toMatchObjectType<...>()` checks where practical.
4. **Race-state invariants** — add tests that branch switches mid-flight:
   - stale branch/path responses are ignored,
   - only the latest request emits terminal contract-validated telemetry.

### Implementation Phases

#### Phase 0: Sequencing preflight (delta scan)
- **Tasks and deliverables**
  - [x] Verify current behavior vs plan assumptions using `rg` + focused tests (deterministic ordering, confidence clamp, stale guards) before changing logic.
  - [x] Capture a short delta table in this plan (already implemented / gap / planned change) for each targeted file.
  - [x] Lock canonical funnel anchor definition: start at commit-scoped `what_ready`, end at `evidence_ready`.
  - [ ] Capture baseline metrics before code changes: current p95 path latency, current fallback rate, current stale-ignore rate.
  - [ ] Define rollout kill criteria (when to disable first-win guidance) and rollback owner.
- **Success criteria**
  - Implementation work only targets verified gaps (no duplicate rework).
  - KPI boundary is unambiguous and commit-scoped.
  - Baseline and rollback thresholds are written and testable.
- **Estimated effort**: 0.5 day

**Execution delta (2026-03-05):**

| File | Already implemented | Gap identified | Change delivered |
| --- | --- | --- | --- |
| `src/ui/views/branch-view/useBranchTelemetry.ts` | `narrative_viewed` baseline events | No commit-scoped funnel anchor | Added `what_ready` emission keyed by `selectedNodeId` + branch scope/session metadata |
| `src/ui/views/branch-view/useBranchAskWhyState.ts` | Monotonic request token stale guards | Missing terminal outcome coverage + latency/session metadata | Added `stale_ignored`/`failed` terminal telemetry, branch scope/session context, flow latency emission |
| `src/ui/views/branch-view/useBranchViewController.ts` | Evidence/open-raw-diff orchestration | Incomplete funnel metadata + consent/branch-scope wiring | Added branch-scope runtime consent wiring, enriched event payloads, deterministic outcome mapping |
| `src/core/telemetry/narrativeTelemetry.ts` | Event dispatch plumbing | No runtime validator, no consent gate, no duplicate terminal suppression | Added consent-aware runtime config, payload validator, pseudonymized scope helper, terminal dedupe guard |
| `src/ui/views/__tests__/BranchView.test.tsx` + `src/core/telemetry/__tests__/narrativeTelemetry.test.ts` | Existing stale guard coverage | Missing consent/scope validator/duplicate-terminal regression tests | Added stale callback assertions, consent suppressor tests, malformed scope rejection, dedupe tests |

#### Phase 1: First-win flow contract hardening (gap-only)
- **Tasks and deliverables**
  - [ ] Validate and harden (not re-implement) deterministic ordering contract in `src/core/narrative/recallLane.ts`.
  - [ ] Validate and harden confidence sanitization in `src/core/narrative/composeBranchNarrative.ts`.
  - [x] Standardize evidence fallback sequence in `src/ui/views/branchViewEvidence.ts` and `src/ui/views/branch-view/useBranchViewController.ts`.
  - [x] Add explicit first-win interaction outcomes in `src/core/telemetry/narrativeTelemetry.ts`.
  - [x] Add commit-scoped funnel anchor emission (`what_ready`) keyed by `selectedNodeId` while keeping existing `narrative_viewed` behavior backward-compatible.
  - [x] Add funnel step IDs and `event_outcome` mapping to existing `trackNarrativeEvent` / Ask-Why events.
  - [x] Add consent-aware telemetry gate in narrative/ask-why telemetry wrappers (deny/revoked paths must emit no telemetry).
  - [x] Canonicalize and pseudonymize `branch_scope` (no raw repo path leakage).
  - [ ] Add explicit expert bypass behavior so advanced users can skip guided flow without extra clicks.
  - **Success criteria**
    - Stable ordering on rerender/branch switches.
    - No invalid confidence display states.
    - Deterministic fallback to raw diff when evidence cannot open.
    - New telemetry fields are additive-compatible first, then enforced via tests after producer migration.
    - Expert path does not regress compared with current click/latency baseline.
- **Estimated effort**: 1.5–2.5 days

#### Phase 2: Orchestration risk reduction (supporting track)
- **Tasks and deliverables**
  - [ ] Reduce controller coupling in `src/ui/views/branch-view/useBranchViewController.ts` via focused extraction aligned with `docs/plans/refactor-useBranchViewController-extraction.md`.
  - [ ] Preserve existing stale-guard semantics in `src/ui/views/branch-view/useBranchAskWhyState.ts` and selection hooks.
  - [ ] Keep behavior parity and telemetry parity during extraction.
- **Success criteria**
  - Smaller orchestration surface, clearer ownership per hook.
  - No behavior regressions in narrative flow.
- **Estimated effort**: 1–2 days

#### Phase 3: Measurement and polish
- **Tasks and deliverables**
  - [x] Add funnel metrics and latency instrumentation for What/Why/Evidence in `src/core/telemetry/*`.
  - [x] Add/extend tests for stale ignores and fallback outcomes in `src/ui/views/__tests__/BranchView.test.tsx` and related hook tests.
  - [ ] Add a dedicated telemetry contract test file (for example `src/core/telemetry/__tests__/narrativeTelemetry.contract.test.ts`) using:
    - shared fixtures for each `NarrativeTelemetryEventNameAll` and expected required fields,
    - `expect.toHaveBeenCalledWith` + `expect.toMatchObject` for payload contract assertions,
    - `expectTypeOf` assertions for payload-type conformance.
  - [ ] Document operator/reviewer expectations in `docs/agents/testing.md` and this plan’s follow-up notes.
  - [x] Add funnel-path test matrix for ABA transitions (`A→B→A`) and `stale_ignored` outcomes.
  - [x] Add runtime telemetry payload validator (producer boundary) and negative tests for malformed payload/event_outcome/schemaVersion.
  - [x] Add event burst suppression/duplicate-terminal-outcome tests for rapid re-entrancy flows.
  - [ ] Add retention/deletion verification checks for new first-win telemetry fields.
  - [ ] Add release gate checklist: canary metrics, rollback switch verification, and post-release watch window.
- **Success criteria**
  - <30s funnel measured in p95 target path.
  - Contract-tested telemetry fields: `source`, `item_id`, `branch_scope`, `event_outcome`.
  - Each first-win request path emits exactly one terminal outcome (`success|failed|fallback|stale_ignored`).
  - Canary gates and rollback path are proven before broad rollout.
- **Estimated effort**: 1–1.5 days

## Alternative Approaches Considered

1. **Guided commit story loop (selected)**  
   Chosen for strongest immediate user value without new surfaces (see brainstorm: Why This Approach).
2. **Progressive disclosure cleanup only (rejected for now)**  
   Helpful, but insufficient alone for measurable What/Why/Evidence completion.
3. **Agent-facing contract-first (deferred)**  
   Valuable strategic track, but deferred to keep first-win scope tight and user-visible outcomes immediate.

## System-Wide Impact

### Interaction Graph

Primary chain:
1. User selects commit in timeline (`src/ui/views/branch-view/useBranchViewController.ts`)  
2. Controller updates selected node and triggers selection data hooks (`useBranchSelectionData`)  
3. Narrative panel renders What, then user requests Why (`useBranchAskWhyState`)  
4. Citation/evidence action routes through `handleOpenEvidence` / raw diff fallback path  
5. Telemetry emits narrative interaction events for funnel tracking.

Secondary chain:
1. Branch switch or file mutation occurs mid-request  
2. Stale guard checks active scope/request version  
3. Stale response is ignored  
4. Telemetry emits stale-ignored outcome instead of mutating visible state.

### Error & Failure Propagation

- Narrative/why async errors bubble to action error state in branch controller and render non-blocking UI errors.
- Evidence-open failures degrade to raw diff; if raw diff unavailable, show explanatory fallback.
- Failure outcomes must propagate telemetry with explicit event outcome (`failed` or `fallback`) to prevent silent drops.

### State Lifecycle Risks

- Risks: stale selected commit/file, stale async updates, non-deterministic item ordering.
- Mitigations:
  - scope/version stale guards on async completion,
  - deterministic sort/tiebreak rules,
  - file existence checks before selection/open,
  - no partial persistence changes in this feature scope.

### Security & Privacy Controls

- Telemetry emission must be consent-aware; no first-win telemetry when consent is false/revoked.
- `branch_scope` must be pseudonymized/canonicalized; raw absolute repo paths are prohibited in emitted payloads.
- Runtime payload validation must reject malformed event contracts and unknown `event_outcome` values.
- Terminal outcome completeness is required for auditability (`success|failed|fallback|stale_ignored` exactly once per request identity).
- Add bounded duplicate suppression for high-frequency interaction bursts to reduce telemetry amplification risk.

### API Surface Parity

Surfaces requiring parity updates:
- Narrative action handlers in branch view hooks.
- Evidence routing helper(s).
- Narrative telemetry payload shape across What/Why/Evidence events.

No new external API endpoints are required.

### Integration Test Scenarios

1. **Branch-switch stale guard**  
   Start Why request on branch A, switch to branch B, verify stale result is ignored and logged as stale.
2. **Evidence fallback chain**  
   Broken evidence target must auto-route to raw diff or explicit fallback state without blocking flow.
3. **Deterministic ordering stability**  
   Same input data yields identical narrative item order across rerenders.
4. **Confidence sanitization**  
   Out-of-range confidence input is normalized and does not break display logic.
5. **Telemetry contract completeness**  
   Every What/Why/Evidence action emits required fields (`branch`, `event`, event-specific payload fields, `event_outcome`), with no missing required outcomes.
6. **Telemetry contract test matrix**  
   Per-event minimum payload contract is verified for `trackNarrativeEvent` and Ask-Why helpers with table-driven tests.
7. **No duplicate emissions under race pressure**  
   Rapid ask-why submit + branch-switch interleavings produce at most one terminal `*_submitted` and one terminal outcome event each.
8. **ABA async determinism**  
   Force `A→B→A` commit scope transitions during in-flight Why/evidence requests; only latest logical request may emit terminal outcomes.

## Acceptance Criteria

### Functional Requirements

- [x] Existing repo/branch UI presents a clear What → Why → Evidence path without introducing new major surfaces (see brainstorm: scope guardrail).
- [ ] First narrative item ordering is deterministic and stable for equivalent input.
- [x] Why request results are stale-safe under branch/commit/file transitions.
- [x] Evidence action follows deterministic fallback contract (primary evidence → raw diff → explanatory fallback).
- [x] No regressions in existing BranchView narrative interactions.
- [ ] Advanced users can bypass guided flow without additional mandatory steps.

### Non-Functional Requirements

- [ ] End-to-end first-win comprehension path achieves **≤30s p95** for the target flow (see brainstorm: success metric).
- [ ] Confidence values are sanitized and never render invalid visual states.
- [x] Telemetry events include `source`, `item_id`, `branch_scope`, and `event_outcome`.
- [x] Flow remains local-first and does not require cloud-only dependencies.
- [x] No first-win telemetry is emitted when consent is false or revoked.
- [x] No raw repo paths or absolute filesystem paths appear in first-win telemetry payloads.
- [x] 100% of first-win request paths emit exactly one terminal outcome event.
- [ ] Guided flow does not increase expert-path interaction cost vs baseline (click count and median time non-regressing).

### Quality Gates

- [x] `pnpm typecheck` passes.
- [x] `pnpm lint` passes.
- [x] `pnpm test` passes.
- [x] `pnpm test:deep` passes (runtime behavior changed).
- [x] Updated/added tests cover stale guard, fallback, deterministic ordering, and telemetry contract scenarios.
- [ ] Security regression matrix passes: consent enforcement, data minimization, runtime schema validation, terminal outcome completeness.

## Success Metrics

- Primary KPI: p95 time from selected commit narrative render to completed What/Why/Evidence path is ≤30s.
- Reliability KPI: stale-result UI contamination rate is 0 in test coverage and near-zero in telemetry.
- Trust KPI: fallback outcomes are explicit (no silent failure path) and measurable.
- Guardrail KPI: expert-path median interaction time does not regress from baseline.
- Risk KPI: fallback ratio and stale-ignored ratio remain within pre-defined canary thresholds; threshold breach triggers rollback.
- User sentiment KPI: qualitative feedback on “forced flow/friction” remains neutral-or-better in early rollout checks.

## Dependencies & Prerequisites

- Existing narrative and branch-view hook architecture.
- Existing telemetry/event infrastructure.
- Existing tests in branch-view and hook suites.
- Alignment with ongoing controller extraction guidance in `docs/plans/refactor-useBranchViewController-extraction.md`.

## Risk Analysis & Mitigation

- **Risk: controller refactor introduces regressions**  
  Mitigation: phased extraction, behavior-parity checks, test-first for hot paths.
- **Risk: performance target misses on cold state**  
  Mitigation: measure per-step latencies, optimize sequencing, avoid unnecessary blocking transitions.
- **Risk: telemetry drift between flows**  
  Mitigation: single event contract and contract tests.
- **Risk: ambiguous funnel definition**  
  Mitigation: lock metric start/end points before implementation.

## Premortem (2026-09)

### Failure scenario (6 months later)

The first-win project shipped, but users disabled or ignored it. Power users reported extra friction, telemetry looked “successful” but was misleading, and maintainers lost trust due to noisy events and unclear failures. The team spent months fixing regressions in async flows and cleanup logic, while the core KPI (<30s understanding) did not improve in real usage.

### Assumptions that proved false

- “Guided flow helps everyone” was false; advanced users wanted speed and direct evidence access.
- “Telemetry fields can be tightened later” was false; additive/compat constraints caused analysis drift.
- “Existing stale guards are enough” was false; commit-level identity gaps still let wrong-context outcomes through.
- “Fallback frequency is healthy noise” was false; high fallback signaled poor evidence quality and user distrust.

### Missed edge cases and integration issues

- Commit/context churn during rebases, branch renames, and rapid A→B→A switching.
- Evidence targets missing for binary/renamed files or rewritten history.
- Consent changes mid-flight leading to stale or undesired telemetry emission.
- Event schema mismatch between producer updates and downstream consumers.
- Duplicate terminal events under bursty interaction patterns.

### What users hated

- Feeling forced through a prescribed path when they already knew what they wanted.
- Inconsistent explanations (“why” low quality) followed by frequent raw-diff fallback.
- UI state jumps during fast navigation, reducing trust in displayed evidence.
- Perceived monitoring overhead without clear personal value.

## Plan Revisions from Premortem

This plan is revised to reduce likely failure modes:

1. **Delta-first delivery**: added Phase 0 baseline + delta verification before coding.
2. **User-friction guardrails**: added explicit expert bypass and non-regression acceptance criteria.
3. **Commit-scoped KPI anchor**: clarified start/end events and commit identity requirements.
4. **Telemetry hardening**: added additive-compat rollout, schema validation, consent gating, and pseudonymized scope.
5. **Outcome completeness**: every request path must emit exactly one terminal outcome.
6. **Rollout discipline**: added canary/rollback checks and threshold-triggered rollback criteria.

## Resource Requirements

- 1 engineer familiar with BranchView + narrative hooks.
- Optional review by maintainer on telemetry schema consistency.
- Estimated total: ~4–6 engineering days across phases.

## Open Questions / Decision Gates

From SpecFlow analysis, resolve these before implementation freeze:

1. **30s KPI boundary definition**  
   Start at selected commit narrative render, end at evidence content visible (recommended).
2. **Gating strictness**  
   Keep guided What → Why → Evidence path strict by default, or allow direct evidence open for high-confidence items.
3. **Evidence fallback behavior**  
   Auto-attempt raw diff immediately on evidence failure (recommended) vs requiring explicit user re-click.
4. **`branch_scope` canonical schema**  
   Use pseudonymized stable namespaced key (for example hash-based `repo_scope:branch_scope`) with no raw path leakage.
5. **Retry/copy policy**  
   Define retry limits and user-facing copy tone for Why/evidence failures.

These are now explicitly flagged so they are not lost from planning to implementation.

## AI-Era Considerations

- This feature directly supports AI-assisted coding review loops; prioritize deterministic output and explicit confidence/fallback cues.
- Require human review on any AI-generated changes touching telemetry contract, stale-guard logic, and fallback policy.
- Preserve prompt/result traceability in tests and plan notes so future agents can reason about regressions quickly.

## Future Considerations

- Promote this flow into an explicit agent-facing contract in a follow-up plan.
- Revisit broader progressive-disclosure IA improvements after KPI validation.
- Consider extending funnel analytics to team-review personas once solo flow is stable.

## Documentation Plan

- Update this plan with implementation deltas after work begins.
- Add concise notes in `docs/agents/testing.md` if new mandatory validation scenarios are introduced.
- If telemetry contract changes materially, add/update docs under `docs/agents/` or `docs/plans/` for consistency.

## Sources & References

### Origin

- **Brainstorm document:** [`docs/brainstorms/2026-03-04-first-win-commit-story-loop-brainstorm.md`](../brainstorms/2026-03-04-first-win-commit-story-loop-brainstorm.md)  
  Key decisions carried forward (see brainstorm): first-win UX priority, solo AI-heavy target persona, <30s success metric, no net-new surfaces, orchestration cleanup as supporting track.

### Internal References

- App orchestration: `src/App.tsx:157-163`, `src/App.tsx:267-364`
- Branch entry/layout: `src/ui/views/BranchView.tsx:15-18`, `src/ui/views/BranchViewLayout.tsx:71-187`
- Narrative interactions: `src/ui/components/BranchNarrativePanel.tsx:111-136`, `src/ui/components/BranchNarrativePanel.tsx:173-217`, `src/ui/components/BranchNarrativePanel.tsx:335-370`
- Branch controller/hotspots: `src/ui/views/branch-view/useBranchViewController.ts:33-230`, `src/ui/views/branch-view/useBranchViewController.ts:318-459`, `src/ui/views/branch-view/useBranchViewController.ts:560-629`
- Ask-Why hook: `src/ui/views/branch-view/useBranchAskWhyState.ts:59-125`
- Evidence routing: `src/ui/views/branchViewEvidence.ts:3-5`
- Refactor guidance: `docs/plans/refactor-useBranchViewController-extraction.md:13-31`, `docs/plans/refactor-useBranchViewController-extraction.md:205-243`

### Institutional Learnings

- `docs/plans/2026-02-27-feat-add-recall-lane-comprehension-plan.md`
- `docs/brainstorms/2026-02-27-recall-lane-comprehension-brainstorm.md`
- `docs/plans/2026-03-01-feat-causal-recall-copilot-answer-card-plan.md`
- `docs/plans/2026-02-18-feat-vision-parity-track-plan.md`
- `docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md`
- `docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md` (transferable reliability/fallback principles)

### External References

- **React official docs (race-safe async/state effects):**
  - https://react.dev/reference/react/useEffect
  - https://react.dev/learn/synchronizing-with-effects
  - https://react.dev/learn/you-might-not-need-an-effect
  - https://react.dev/reference/react/StrictMode
- **Vitest official docs (TypeScript + contract-style assertions):**
  - https://vitest.dev/api/expect
  - https://vitest.dev/api/mock
  - https://vitest.dev/api/expect-typeof
- **TypeScript `satisfies` docs (strict contract typing):**
  - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0
