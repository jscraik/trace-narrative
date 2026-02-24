---
status: complete
priority: p2
issue_id: CR-016
tags:
  - code-review
  - quality
  - ux
  - telemetry
  - narrative
dependencies: []
---

## Problem Statement
The feedback actor-role selector in the UI currently behaves as a no-op because persisted role is always normalized to `developer`.

## Findings
- `BranchNarrativePanel` presents `developer` and `reviewer` role toggles and submits the selected value.
- `submitNarrativeFeedback` force-normalizes all roles to `developer` via `resolveVerifiedActorRole`.
- Telemetry records `feedbackActorRole` using `result.verifiedActorRole`, which is always `developer`, so reviewer selection is never represented.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/components/BranchNarrativePanel.tsx`
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts` (lines ~35-39, ~362-366)
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx` (lines ~778-785)

## Proposed Solutions
### Option 1 (Recommended): Gate reviewer role UI until authenticated role binding exists
- **Effort:** Small
- **Risk:** Low
- **Pros:** Removes misleading affordance and keeps analytics honest.
- **Approach:** Hide/disable reviewer selection behind a capability flag; show explanatory tooltip.

### Option 2: Keep selector visible but surface normalization in UI
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Preserves workflow preview.
- **Approach:** Show inline note that reviewer weighting is disabled until trust binding lands.

### Option 3: Re-enable reviewer persistence with trusted binding now
- **Effort:** Large
- **Risk:** Medium
- **Pros:** Delivers intended weighting behavior immediately.
- **Approach:** Implement authenticated role derivation before writing role-specific weights.

## Recommended Action

## Technical Details
- Affected components: feedback controls, persistence normalization, telemetry semantics.
- Risk category: product correctness / observability fidelity.

## Acceptance Criteria
- [ ] UI role options reflect actual persisted behavior.
- [ ] Telemetry role values are truthful and explainable.
- [ ] Reviewer weighting remains disabled until trust boundary is implemented.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Review observed selected reviewer role is normalized to developer before persistence.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts`
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/components/BranchNarrativePanel.tsx`
