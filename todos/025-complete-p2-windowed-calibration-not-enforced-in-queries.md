---
status: complete
priority: p2
issue_id: CR-025
tags:
  - code-review
  - architecture
  - sqlite
  - calibration
dependencies: []
---

## Problem Statement
Calibration profile stores a rolling window (`window_start`/`window_end`) but recomputation queries do not apply that window.

## Findings
- `recomputeCalibrationProfile` computes a 30-day window and persists it.
- Aggregate queries (`COUNT/SUM` totals and highlight adjustments) filter only by `repo_id`, so all historical rows influence calibration indefinitely.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts` (lines ~194-213, ~229-238, ~261-263)
- Related plan expectation: `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md`

## Proposed Solutions
### Option 1 (Recommended): Enforce window bounds in both aggregate queries
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Aligns implementation with retained-window semantics.
- **Approach:** Add `created_at` filters with `windowStartISO/windowEndISO` to totals and per-highlight aggregation queries.

### Option 2: Remove window fields until retention is implemented
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Avoids misleading metadata.
- **Approach:** Keep full-history model explicitly and defer windowed behavior.

### Option 3: Maintain periodic snapshot tables for windowed aggregates
- **Effort:** Large
- **Risk:** Medium
- **Pros:** Better query performance at scale.
- **Approach:** Precompute rolling aggregates and query snapshots rather than raw events.

## Recommended Action

## Technical Details
- Affected components: calibration recompute SQL and profile metadata semantics.
- Risk category: logic drift / trust calibration fidelity.

## Acceptance Criteria
- [ ] Window fields reflect actual SQL filtering behavior.
- [ ] Old feedback outside retention window no longer affects calibration.
- [ ] Tests verify window-bound aggregation behavior.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Architecture review found mismatch between stored window metadata and query logic.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts`
