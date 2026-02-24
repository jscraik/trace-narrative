---
status: complete
priority: p3
issue_id: CR-023
tags:
  - code-review
  - telemetry
  - observability
  - quality
dependencies: []
---

## Problem Statement
`narrative_viewed` telemetry currently emits `detailLevel: summary` regardless of actual viewed mode.

## Findings
- Event emission hard-codes summary detail level.
- This prevents slicing denominator metrics by effective mode and reduces observability precision.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx` (lines ~483-486)
- Agent review: pattern-recognition-specialist

## Proposed Solutions
### Option 1 (Recommended): Emit effective detail level
- **Effort:** Small
- **Risk:** Low
- **Pros:** Improves metric fidelity with minimal change.
- **Approach:** Send `effectiveDetailLevel` (or actual rendered mode) in `narrative_viewed` payload.

### Option 2: Remove detail level from denominator event
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Simplifies event contract.
- **Approach:** Keep denominator purely count-based and derive mode from companion events.

### Option 3: Add secondary dimension field
- **Effort:** Small
- **Risk:** Low
- **Pros:** Backward compatible.
- **Approach:** Keep current field but add `renderedDetailLevel` and migrate dashboards.

## Recommended Action

## Technical Details
- Affected components: telemetry payload quality for KPI analysis.
- Risk category: observability precision.

## Acceptance Criteria
- [ ] Denominator telemetry reflects actual viewed mode or intentionally omits mode.
- [ ] Dashboards can reliably segment fallback-rate by mode if required.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Review flagged hard-coded detail-level value in `narrative_viewed` event.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx`
