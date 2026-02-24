---
status: complete
priority: p2
issue_id: CR-028
tags:
  - code-review
  - telemetry
  - metrics
  - rollout
dependencies: []
---

## Problem Statement
`narrative_viewed` denominator semantics are under-defined in implementation, risking KPI drift for fallback-rate measurement.

## Findings
- `narrative_viewed` emits once per `repoId:branchName` key per component lifetime.
- Payload hard-codes `detailLevel: summary`, which may not represent actual viewed mode and limits slicing quality.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx` (lines ~477-488)
- Agent review: pattern-recognition-specialist

## Proposed Solutions
### Option 1 (Recommended): Define explicit view-instance contract and emit semantics
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Makes fallback KPI reproducible and auditable.
- **Approach:** Introduce stable view-instance IDs, emit at defined moments, and include actual effective detail level.

### Option 2: Keep branch-level denominator and update KPI definition
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Minimal code change.
- **Approach:** Document denominator as branch-session-level and adjust targets accordingly.

### Option 3: Aggregate denominator server-side from navigation events
- **Effort:** Large
- **Risk:** Medium
- **Pros:** Potentially cleaner analytics semantics.
- **Approach:** Build derived metric pipeline from broader session telemetry.

## Recommended Action

## Technical Details
- Affected components: BranchView telemetry emission and KPI dashboards.
- Risk category: measurement integrity.

## Acceptance Criteria
- [ ] Denominator event semantics are explicitly documented.
- [ ] Emitted payload reflects actual viewed context.
- [ ] Fallback-rate calculations are stable across repeat views.

## Work Log
- 2026-02-24: Implemented fix and validated via updated docs/contracts plus automated checks.
- 2026-02-24: Pattern review found denominator instrumentation ambiguity.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx`
