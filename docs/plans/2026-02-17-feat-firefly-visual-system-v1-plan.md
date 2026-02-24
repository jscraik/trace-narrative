---
title: "feat: Firefly Visual System v1 (commit-graph semantic signal)"
type: feat
date: 2026-02-17
status: canonical
brainstorm: "/Users/jamiecraik/dev/narrative/docs/brainstorms/2026-02-17-firefly-visual-system-brainstorm.md"
deepened: 2026-02-17
supersedes:
  - /Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan.md
  - /Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan-deepened.md
  - /Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan-revised.md
---

# Firefly Visual System v1 Plan

> Canonical plan for Firefly architecture and state model. Prior `firefly-signal-system` variants are superseded and retained for historical context only.

## Enhancement Summary

**Deepened on:** 2026-02-17  
**Sections enhanced:** 11  
**Research agents used:** skill-runners (react-ui-patterns, vercel-react-best-practices, frontend-ui-design, context7), repo/review analyzers (architecture, flow tracing, test coverage, silent-failure, type-design, validation-gate).

### Key Improvements

1. Added an explicit **current implementation check** so plan claims match today’s code reality.
2. Upgraded the event model from abstract prose to a **source-and-guarded state contract**.
3. Locked `Insight` to a concrete source + dedupe key, and added a **formal transition matrix** with precedence.
4. Added **stale async protection** details for selection-driven loaders and insight signaling.
5. Added **error visibility requirements** (no silent failure during loader/persistence errors) and measurable perf gates.

### New Considerations Discovered

- `Insight` trigger semantics were initially underspecified and are now locked to selected-commit trace summary availability.
- Existing implementation is still `idle|active`; semantic states are planned but not yet wired.
- Current hook timer reset (`setTimeout`) risks race conditions once semantic states expand.
- Non-functional goals (60fps/no layout shift/reduced motion) need explicit verification steps.

## Table of Contents

- [Enhancement Summary](#enhancement-summary)
- [Section Manifest](#section-manifest)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Scope](#scope)
- [Found Brainstorm Context](#found-brainstorm-context)
- [Research Summary](#research-summary)
- [Research Decision (External Docs)](#research-decision-external-docs)
- [Proposed Solution](#proposed-solution)
- [Event-to-State Contract (v1)](#event-to-state-contract-v1)
- [Deterministic Signal Definitions (P0 closeout)](#deterministic-signal-definitions-p0-closeout)
- [Formal Transition Matrix (P0)](#formal-transition-matrix-p0)
- [Technical Considerations](#technical-considerations)
- [Performance verification protocol (P1)](#6-performance-verification-protocol-p1)
- [Acceptance Criteria](#acceptance-criteria)
- [Implementation Plan](#implementation-plan)
- [SpecFlow Analysis (Gaps Closed)](#specflow-analysis-gaps-closed)
- [Dependencies & Risks](#dependencies--risks)
- [Success Metrics](#success-metrics)
- [References & Research](#references--research)

## Section Manifest

- **Overview / Motivation** — validate clarity of v1 outcome and problem framing.
- **Scope** — enforce commit-graph-only boundary and deferred mascot work.
- **Research Summary** — align plan claims with current implementation state.
- **Proposed Solution + Event Contract** — define explicit trigger/guard semantics.
- **Technical Considerations** — add performance, accessibility, and failure-visibility guardrails.
- **Acceptance Criteria** — convert objectives into measurable functional/non-functional gates.
- **Implementation Plan** — dependency-ordered tasks with explicit file ownership.
- **SpecFlow + Risks** — close ambiguity/race/silent-failure gaps and capture mitigations.

## Overview

Ship **Firefly Visual System v1** as a **product-first, commit-graph-only ambient signal**.  
This is not mascot illustration work. In v1, Firefly remains an **abstract orb** that communicates system state with semantic clarity and restrained motion.

## Problem Statement / Motivation

The current Firefly implementation already supports:
- positional anchoring to timeline commits
- idle pulse and active pulse visuals
- user toggle persistence

But it does not yet implement the agreed semantic model:
- `Idle`
- `Tracking`
- `Analyzing`
- `Insight`

Without this semantic layer, Firefly remains mostly decorative instead of trustworthy ambient telemetry.

## Scope

### In scope (v1)

- Commit graph surface only.
- Semantic state machine: `Idle`, `Tracking`, `Analyzing`, `Insight`.
- Deterministic, user-visible triggers and exits for each state.
- Existing settings toggle preserved and respected.
- `prefers-reduced-motion` behavior for all state transitions.

### Out of scope (deferred)

- Onboarding guide variant.
- Empty-state mascot variant.
- Character-style mascot rendering in runtime UI.
- Expanded anomaly/offline taxonomy.

## Found Brainstorm Context

Found relevant brainstorm from **2026-02-17** and used as source context:
- `/Users/jamiecraik/dev/narrative/docs/brainstorms/2026-02-17-firefly-visual-system-brainstorm.md`

Locked decisions imported:
1. Product-first source of truth.
2. Commit-graph-only v1 surface.
3. Primary message: “system is actively analyzing.”
4. Abstract orb visual form.
5. Onboarding + empty-state variants deferred.

## Research Summary

### Current implementation check (as of 2026-02-17)

- Firefly state model is currently only `idle|active`:
  - `/Users/jamiecraik/dev/narrative/src/ui/components/FireflySignal.tsx:8-10`
- Hook pulse is timer-based (`500ms` reset), which can race future semantic states:
  - `/Users/jamiecraik/dev/narrative/src/hooks/useFirefly.ts:73-80`
- Timeline anchoring is implemented and stable (node-ref + container-relative position):
  - `/Users/jamiecraik/dev/narrative/src/ui/components/Timeline.tsx:34-53`
- BranchView currently passes Firefly props through but does not yet emit semantic transitions from loader/finding lifecycle:
  - `/Users/jamiecraik/dev/narrative/src/ui/views/BranchView.tsx:449-456`
- Toggle persistence via Tauri Store is already implemented:
  - `/Users/jamiecraik/dev/narrative/src/core/tauri/settings.ts:28-54`

### Local patterns and review synthesis

- Recommended architecture: `useFirefly` should be single semantic-state owner; `Timeline` should remain presentation/positioning-only.
- Highest-risk gap: `Insight` trigger definition was too vague (“new finding visible”) and must be concretely bound to data/visibility source.
- Critical testing gap: no explicit stale-selection race tests yet tied to `Analyzing`/`Insight`.
- Silent-failure gap: BranchView loader catches can clear UI state without user-visible error messaging if not explicitly surfaced.

### Institutional learnings

- No `docs/solutions/` directory exists in this repo (no direct compound learnings to import).
- Nearest applicable internal docs:
  - `/Users/jamiecraik/dev/narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan-deepened.md`
  - `/Users/jamiecraik/dev/narrative/docs/notes/plans/PLANS.txt:52-101`
  - `/Users/jamiecraik/dev/narrative/docs/agents/tauri.md:1-37`

## Research Decision (External Docs)

**Decision:** targeted external verification was performed for standards-critical behaviors.

Verified areas:
- React effect cleanup and stale async guard patterns.
- `prefers-reduced-motion` behavior.
- animation performance guidance (`transform`/`opacity`).
- Tauri Store plugin usage and save behavior.

## Proposed Solution

Extend Firefly from `idle|active` pulse behavior to a deterministic semantic state contract with explicit trigger sources and stale-event guards.

Approach:

1. Keep current Timeline anchoring and settings persistence architecture.
2. Make `/Users/jamiecraik/dev/narrative/src/hooks/useFirefly.ts` the **single owner** of semantic state; `BranchView` provides inputs and `Timeline` renders only.
3. Replace timer-dominant flow with a derived priority selector: `Insight > Analyzing > Tracking > Idle`.
4. Lock `Insight` to a concrete source: `model.traceSummaries?.byCommit[selectedCommitSha]` transitioning from `undefined` to a summary where `(aiLines + humanLines + mixedLines + unknownLines) > 0`.
5. Dedupe `Insight` emissions with `insightKey = ${selectedCommitSha}:${commitSha}:${aiLines}:${humanLines}:${mixedLines}:${unknownLines}:${sortedModelIds}:${sortedToolNames}`.
6. Gate all async transition commits by current selection identity + sequence token to prevent stale leakage.

## Event-to-State Contract (v1)

| State | Trigger Source | Guard Key | Exit Condition | Notes |
|---|---|---|---|---|
| `Idle` | default resting | current selected node | selection change or selected-node analysis starts | ambient baseline |
| `Tracking` | selected node changes | `selectedNodeId` at event emission | position settle or `Analyzing` begins | commit-following orientation |
| `Analyzing` | selected-node visible loaders active (`files`, `diff`, `trace`) | applicable loader set + loader token + `selectedNodeId` | all tracked applicable loaders settle for same selected node | stale completions ignored |
| `Insight` | `traceSummaries.byCommit[selectedCommitSha]` becomes newly available with non-zero summary payload | `insightKey` + `selectedCommitSha` | selection changes, summary key changes, or `Analyzing` restarts for same node | never emit for off-selection commits |

### Deterministic Signal Definitions (P0 closeout)

- **Position settled (`Tracking` exit):** first render tick where `fireflyPos` has been computed for the current `selectedNodeId` and remains within ±1px on the next frame.
- **Analyzing active predicate:** `true` when **any** tracked loader for the current `selectedNodeId` is pending.
  - Tracked loaders: `files`, `diff`, `trace`.
  - Loader applicability truth table:

    | Loader | Applicable when |
    |---|---|
    | `files` | selected node is a commit node |
    | `diff` | selected node is commit node **and** a file is selected |
    | `trace` | selected node is commit node **and** a file is selected **and** trace-range load was requested |

  - If a loader is not applicable for the current node/context, exclude it from the pending set.
  - `Analyzing` exits only when the pending set is empty for the same `selectedNodeId`.
- **Insight eligible predicate:** summary exists for current selected commit, `summary.commitSha === selectedCommitSha`, and total lines `(ai+human+mixed+unknown) > 0`.
- **ID normalization contract:** treat semantic-selection identity as `selectedCommitSha`; if UI state is `selectedNodeId`, normalize once at adapter boundary before semantic evaluation.
- **Self-transition semantics:**  
  - `Analyzing → Analyzing`: allowed only when pending-loader set changes for same selection; do not restart animation state.  
  - `Insight → Insight`: allowed only when `insightKey` changes; unchanged key must not re-emit.
- **Tracking-settle plumbing contract:** `Timeline` emits settled position updates to `BranchView`; `BranchView` passes tracking-settled input into `useFirefly` (no transition calculation outside hook).
- **Trace applicability source-of-truth:** use a single adapter flag (`traceRequestedForSelection`) in `BranchView` as the only condition for whether `trace` enters the applicable loader set.
- **Ownership guard:** semantic transitions are computed only in `useFirefly`; `BranchView` supplies inputs only.

### Formal Transition Matrix (P0)

Allowed transitions only:

- `Idle → Tracking | Analyzing`
- `Tracking → Analyzing | Idle`
- `Analyzing → Insight | Tracking | Idle | Analyzing` (`Analyzing→Analyzing` only on pending-set change)
- `Insight → Analyzing | Tracking | Idle | Insight` (`Insight→Insight` only on `insightKey` change)

Precedence when multiple signals are true in the same frame:
Apply precedence only after filtering to transitions allowed from the **current state** by the matrix above (precedence never bypasses matrix rules).
1. `Insight`
2. `Analyzing`
3. `Tracking`
4. `Idle`

Anti-flap rules:
- `Analyzing` minimum dwell: `150ms`
- `Insight` minimum dwell: `300ms`
- Preemption precedence over dwell:
  1. selection change (always immediate)
  2. `Analyzing` restart for same selection (immediate preemption of `Insight`)
  3. otherwise, dwell constraints apply

## Technical Considerations

### 1) State orchestration and race prevention

- Keep semantic transition logic in `/Users/jamiecraik/dev/narrative/src/hooks/useFirefly.ts` as the only state owner.
- Keep `/Users/jamiecraik/dev/narrative/src/ui/components/Timeline.tsx` focused on position/paint only.
- Keep `/Users/jamiecraik/dev/narrative/src/ui/views/BranchView.tsx` as input adapter (selection, loader, trace summary inputs).
- Keep `/Users/jamiecraik/dev/narrative/src/App.tsx` pass-through only (no transition logic).
- Guard asynchronous lifecycle transitions by selection identity + sequence token.
- Apply one deterministic priority selector (`Insight > Analyzing > Tracking > Idle`) to reduce branching complexity.
- Callback/data path contract:
  - `Timeline` exposes settled-position signal for current selected node.
  - `BranchView` forwards that signal and loader/summary inputs to `useFirefly`.
  - `useFirefly` alone decides state transitions.

Plan-level pseudocode pattern:

```ts
let seq = 0;

function beginSelection(newId: string) {
  seq += 1;
  const localSeq = seq;
  setState({ type: 'tracking', selectedNodeId: newId });
  return localSeq;
}

function commitIfCurrent(localSeq: number, next: FireflyState) {
  if (localSeq !== seq) return; // stale completion, ignore
  setState(next);
}
```

Insight dedupe key contract:

```ts
const insightKey = `${selectedCommitSha}:${summary.commitSha}:${summary.aiLines}:${summary.humanLines}:${summary.mixedLines}:${summary.unknownLines}:${[...summary.modelIds].sort().join(',')}:${[...summary.toolNames].sort().join(',')}`;
if (insightKey !== lastInsightKey) setState({ type: 'insight', insightKey });
```

### 2) Animation and rendering performance

- Keep animation on composited properties (`transform`, `opacity`) and avoid layout-triggering properties.
- Use `will-change` sparingly and only while active transitions are expected.
- Avoid layout thrash by separating measurement and mutation phases.
- Keep anti-flap dwell times short and fixed to avoid visual chatter (`Analyzing: 150ms`, `Insight: 300ms`).

### 3) Reduced motion and accessibility

- Maintain decorative semantics on orb (`aria-hidden`) unless semantic content depends solely on it.
- Under `prefers-reduced-motion`, keep state visibility but remove/shorten motion.
- Keep keyboard behavior unchanged in timeline container flow.

### 4) Error visibility (no silent failures)

- Loader failures tied to semantic transitions must route to existing user-visible surface:
  - `/Users/jamiecraik/dev/narrative/src/ui/views/BranchView.tsx` `actionError` + `ImportErrorBanner`
- Firefly toggle persistence failures must route through the same `setActionError` path and appear in `ImportErrorBanner` (single canonical surface), plus structured console log (`[firefly.toggle.persist_failed]`).
- Ownership path for toggle failure:
  - `useFirefly.toggle()` reports persistence errors to App-level error handler.
  - App-level handler calls `setActionError`.
  - `BranchView` renders `ImportErrorBanner`.
- “Console-only” failure handling is out of contract for v1.

### 5) Persistence contract

- Continue using Tauri Store lazy singleton pattern:
  - `/Users/jamiecraik/dev/narrative/src/core/tauri/settings.ts:7-14`
- Keep explicit `save()` after setting toggle to ensure durable preference updates.
- Toggle-off behavior contract:
  - disabling Firefly immediately suppresses rendering and new state emissions
  - pending transition commits for the current sequence are ignored while disabled

### 6) Performance verification protocol (P1)

- Run a scripted 10s timeline-scroll scenario on fixture:
  - `/Users/jamiecraik/dev/narrative/e2e/fixtures/firefly-large-timeline.json`
- Required verification commands:
  - `pnpm test`
  - `pnpm test:e2e -- e2e/firefly-visual-system-v1.spec.ts`
- Perf capture command (reproducible):
  - `pnpm test:e2e -- e2e/firefly-visual-system-v1.spec.ts --grep "@firefly-perf"`
- Persist perf evidence to:
  - `/Users/jamiecraik/dev/narrative/docs/assets/verification/firefly-perf-YYYY-MM-DD.json`
- Perf artifact metadata (required):
  - OS + version
  - browser/runtime mode (headed/headless)
  - machine profile label
  - run timestamp + attempt count
- Acceptance thresholds:
  - average FPS ≥ 55
  - p95 frame time ≤ 20ms
  - layout shift observer reports zero shifts caused by Firefly transitions

## Acceptance Criteria

### Functional

- [x] Firefly supports `Idle`, `Tracking`, `Analyzing`, `Insight` states with typed event/state contract.
- [x] `useFirefly` is the single semantic-state owner; `BranchView` and `App` do not contain competing transition logic.
- [x] Selection identity is normalized at adapter boundary (`selectedNodeId -> selectedCommitSha`) before semantic evaluation.
- [x] `Tracking` emits only for active selection changes and exits only after deterministic “position settled” criteria.
- [x] `Analyzing` reflects selected-node loader truth table (`any pending in tracked applicable loaders`) and ignores stale async results.
- [x] `Insight` emits only when `traceSummaries.byCommit[selectedCommitSha]` transitions to newly available summary where total lines > 0.
- [x] `Insight` dedupe key prevents repeated re-emit from rerender/tab churn without underlying summary change.
- [x] Transition precedence is enforced: `Insight > Analyzing > Tracking > Idle`.
- [x] Self-transition rules are enforced (`Analyzing→Analyzing` only on pending-set change, `Insight→Insight` only on `insightKey` change).
- [x] Firefly toggle reliably enables/disables signal and persists across app restarts.
- [x] Toggle OFF immediately suppresses Firefly rendering/state emissions and prevents pending transitions from reappearing while disabled.

### Non-functional

- [x] In the scripted 10s timeline-scroll scenario, average FPS is ≥ 55 and p95 frame time is ≤ 20ms.
- [x] No layout shift introduced by firefly transitions.
- [x] Reduced-motion preference suppresses motion while preserving state visibility.
- [x] Keyboard timeline behavior remains unchanged.
- [x] Loader/settings errors involved in Firefly flow are surfaced (no silent fail path).
- [x] Anti-flap dwell constraints are respected (`Analyzing: 150ms`, `Insight: 300ms`, selection change may preempt).

### Validation Gate (must-pass)

- [x] `/Users/jamiecraik/dev/narrative/src/ui/components/__tests__/FireflySignal.test.tsx`
  - verifies state-specific classes/data attributes and reduced-motion behavior.
- [x] `/Users/jamiecraik/dev/narrative/src/hooks/__tests__/useFirefly.test.ts`
  - verifies formal transition matrix, precedence ordering, stale-event guards, insight dedupe key, and persistence failure handling.
- [x] `/Users/jamiecraik/dev/narrative/e2e/firefly-visual-system-v1.spec.ts`
  - verifies selection flow, loader-driven analyzing, selected-node-only insight trigger source, and toggle persistence.
  - includes UI assertion that toggle persistence failures are surfaced via `ImportErrorBanner`.
- [x] Deferred-promise race harness in hook tests
  - verifies out-of-order loader completion does not produce off-selection `Analyzing`/`Insight`.
- [x] Command gate executed:
  - `pnpm test`
  - `pnpm test:e2e -- e2e/firefly-visual-system-v1.spec.ts`
- [x] Perf capture command executed:
  - `pnpm test:e2e -- e2e/firefly-visual-system-v1.spec.ts --grep "@firefly-perf"`
- [x] Performance verification artifact (scripted scroll run)
  - records average FPS, p95 frame time, layout-shift check results, and required run metadata at `/Users/jamiecraik/dev/narrative/docs/assets/verification/firefly-perf-YYYY-MM-DD.json`.

## Implementation Plan

### Dependency Graph

- `T1` → `T2` → `T3` → `T4` → `T5`

### Tasks

#### T1 — Expand state/type contract in hook and signal boundary
`depends_on: []`

Files:
- `/Users/jamiecraik/dev/narrative/src/hooks/useFirefly.ts`
- `/Users/jamiecraik/dev/narrative/src/ui/components/FireflySignal.tsx`

Deliverables:
- semantic state union for v1 states
- state payload fields needed for guards (`selectedNodeId`, finding id/context)
- formal transition matrix + precedence constants
- anti-flap dwell constants
- removal/replacement of fragile timer-only reset semantics

#### T2 — Wire selected-node and loader lifecycle to transitions
`depends_on: [T1]`

Files:
- `/Users/jamiecraik/dev/narrative/src/ui/views/BranchView.tsx`
- `/Users/jamiecraik/dev/narrative/src/ui/components/Timeline.tsx`
- `/Users/jamiecraik/dev/narrative/src/App.tsx` (pass-through only, if prop shape updates are required)

Deliverables:
- selected-node and loader inputs wired into `useFirefly` (input adapter only)
- normalized semantic selection identity (`selectedCommitSha`) provided by adapter
- explicit `traceRequestedForSelection` adapter flag provided as trace applicability source
- deterministic `Tracking` settle signal input and `Analyzing` loader truth-table inputs
- explicit callback plumbing for settled position (`Timeline -> BranchView -> useFirefly`)
- stale async guard keyed by current selected node + sequence token
- no duplicated transition logic outside `useFirefly`

#### T3 — Wire concrete Insight source and dedupe key
`depends_on: [T2]`

Files:
- `/Users/jamiecraik/dev/narrative/src/ui/views/BranchView.tsx`
- `/Users/jamiecraik/dev/narrative/src/core/types.ts` (if additional typed summary payload is needed)

Deliverables:
- explicit source lock: `traceSummaries.byCommit[selectedCommitSha]`
- `Insight` emission only on `undefined -> eligible summary` transition for selected commit
- dedupe by strengthened `insightKey` (includes sorted model/tool dimensions)
- self-transition behavior defined (`Insight→Insight` only on key change)
- guard against off-selection insight triggers

#### T4 — Hardening: reduced-motion, error visibility, and toggle robustness
`depends_on: [T2, T3]`

Files:
- `/Users/jamiecraik/dev/narrative/src/styles/firefly.css`
- `/Users/jamiecraik/dev/narrative/src/ui/components/Timeline.tsx`
- `/Users/jamiecraik/dev/narrative/src/ui/views/BranchView.tsx`
- `/Users/jamiecraik/dev/narrative/src/core/tauri/settings.ts`

Deliverables:
- reduced-motion transition behavior validated
- user-visible + logged error path for loader/settings failures (canonical `actionError` / `ImportErrorBanner` surface contract)
- toggle-off immediate suppression + no-reappear behavior validated
- mid-transition toggle cleanup behavior

#### T5 — Tests, race harness, and perf verification gates
`depends_on: [T4]`

Files:
- `/Users/jamiecraik/dev/narrative/src/ui/components/__tests__/FireflySignal.test.tsx`
- `/Users/jamiecraik/dev/narrative/src/hooks/__tests__/useFirefly.test.ts`
- `/Users/jamiecraik/dev/narrative/e2e/firefly-visual-system-v1.spec.ts`
- `/Users/jamiecraik/dev/narrative/e2e/fixtures/firefly-large-timeline.json`
- `/Users/jamiecraik/dev/narrative/docs/assets/verification/` (artifact location for perf gate output)

Deliverables:
- full state transition coverage
- stale-event and out-of-order completion regression coverage
- reduced-motion and persistence regression coverage
- command gate execution evidence (`pnpm test`, `pnpm test:e2e -- e2e/firefly-visual-system-v1.spec.ts`)
- scripted perf gate output (avg FPS, p95 frame time, layout-shift outcome) at `/Users/jamiecraik/dev/narrative/docs/assets/verification/firefly-perf-YYYY-MM-DD.json`
- perf artifact includes required run metadata fields

## SpecFlow Analysis (Gaps Closed)

1. **Gap:** semantic states existed in plan prose but not in typed/event wiring detail.  
   **Resolution:** explicit source-and-guard state contract + dependency-ordered tasks.

2. **Gap:** `Insight` trigger semantics were ambiguous.  
   **Resolution:** locked concrete source (`traceSummaries.byCommit[selectedCommitSha]`) + `insightKey` dedupe semantics in `T3`.

3. **Gap:** stale async race mitigation was mentioned but not operationalized.  
   **Resolution:** explicit sequence-token + selected-node guard approach + deferred-promise out-of-order test harness.

4. **Gap:** non-functional goals lacked enforcement linkage.  
   **Resolution:** must-pass validation gate with named tests plus perf thresholds (avg FPS/p95 frame time/layout shift).

5. **Gap:** silent-failure risk not represented in acceptance criteria.  
   **Resolution:** explicit user-visible error surface contract + hardening task.

6. **Gap:** risk of transition logic scattering across layers.  
   **Resolution:** single-owner rule (`useFirefly`) + pass-through-only guard for `App`.

7. **Gap:** predicate ambiguity (`position settled`, loader applicability, summary non-empty) could cause divergent implementations.  
   **Resolution:** deterministic signal definitions and self-transition rules added to the contract.

8. **Gap:** reproducibility and ownership details were still partially implicit.  
   **Resolution:** explicit callback/data plumbing, toggle-error propagation ownership, fixture path, and perf capture command added.

9. **Gap:** identity and loader-applicability semantics could drift across implementations.  
   **Resolution:** added adapter-level ID normalization and single trace-applicability source flag.

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Insight trigger regresses into vague behavior | enforce locked source + `insightKey` contract in `T3` tests |
| Stale async results cause wrong-state flashes | selection + sequence guard on all async transition commits |
| Timer-based resets override valid semantic states | migrate to deterministic transition handling in `T1` |
| Silent loader/persistence failures mislead users | enforce surfaced error path + logging in `T4` |
| State logic duplicated across files | enforce `useFirefly` single-owner rule in implementation + review checklist |
| ID mismatch between selection and commit summary | adapter normalization to `selectedCommitSha` + dedicated assertions |
| Predicate drift across implementers | deterministic signal definitions + explicit truth-table tests |
| Visual flapping from fast loader churn | precedence + dwell constraints + race harness assertions |
| Perf artifacts not comparable across environments | required run metadata in perf artifact + fixed perf capture command |
| Visual noise/distraction from ambient signal | reduced-motion and restrained animation defaults, plus toggle |

## Success Metrics

- Users can correctly describe Firefly as analysis telemetry (not decorative glow) in usability checks.
- No regression in timeline keyboard operation or reduced-motion behavior.
- No stale-state transitions reproduced in deferred-promise out-of-order race tests.
- Toggle persistence remains reliable across restart cycles.
- Perf gate passes scripted threshold (`avg FPS ≥ 55`, `p95 frame time ≤ 20ms`, no Firefly-induced layout shift).

## References & Research

### Brainstorm + internal references

- `/Users/jamiecraik/dev/narrative/docs/brainstorms/2026-02-17-firefly-visual-system-brainstorm.md`
- `/Users/jamiecraik/dev/narrative/src/hooks/useFirefly.ts`
- `/Users/jamiecraik/dev/narrative/src/ui/views/BranchView.tsx`
- `/Users/jamiecraik/dev/narrative/src/ui/components/Timeline.tsx`
- `/Users/jamiecraik/dev/narrative/src/ui/components/FireflySignal.tsx`
- `/Users/jamiecraik/dev/narrative/src/styles/firefly.css`
- `/Users/jamiecraik/dev/narrative/src/core/tauri/settings.ts`
- `/Users/jamiecraik/dev/narrative/src/ui/components/RightPanelTabs.tsx`

### External standards/docs used for deepening

- React `useEffect` reference: https://react.dev/reference/react/useEffect
- React race-condition cleanup pattern: https://react.dev/learn/synchronizing-with-effects
- MDN reduced motion media query: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- web.dev animation performance guide: https://web.dev/articles/animations-guide
- Tauri Store plugin docs:
  - https://v2.tauri.app/plugin/store/
  - https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/store
