---
status: complete
priority: p2
issue_id: CR-019
tags:
  - code-review
  - performance
  - sqlite
  - telemetry
  - narrative
dependencies: []
---

## Problem Statement
The plan lacks explicit throughput controls and full query/index coverage for calibration workloads, increasing risk of UI degradation under feedback bursts.

## Findings
- Plan does not define write burst controls (debounce/rate limits) for repeated feedback interactions.
- Index guidance is partial; expected aggregation dimensions (actor role, branch, time windows) are not fully mapped to explicit query plans and index validation.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md` (lines 143, 216-224, 309)
- Agent review: performance-oracle (P2)

## Proposed Solutions
### Option 1 (Recommended): Add explicit load-control + query-plan matrix requirements
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Reduces contention risk and clarifies index decisions.
- **Approach:** Define per-target feedback write throttling, enumerate calibration SQL queries, require `EXPLAIN QUERY PLAN` evidence for each, and validate during phase-1 gate.

### Option 2: Introduce buffered write queue with adaptive flush
- **Effort:** Large
- **Risk:** Medium
- **Pros:** Better burst handling.
- **Approach:** Buffer transient bursts and flush at bounded intervals with idempotency keys.

### Option 3: Keep current plan and monitor post-rollout
- **Effort:** Small
- **Risk:** High
- **Pros:** Minimal upfront work.
- **Approach:** Rely on telemetry to catch issues after deployment.

## Recommended Action

## Technical Details
- Affected components: UI feedback handlers, Tauri persistence path, SQLite indexing/migrations.
- Risk category: latency regressions / lock contention.

## Acceptance Criteria
- [ ] Write-rate controls are defined and tested for rapid repeated feedback.
- [ ] Calibration query set is documented with corresponding index strategy.
- [ ] `EXPLAIN QUERY PLAN` evidence exists for all calibration-critical queries.
- [ ] Phase-1 gate includes contention/load verification.

## Work Log
- 2026-02-24: Implemented fix and validated via updated docs/contracts plus automated checks.
- 2026-02-24: Performance review identified write contention and index coverage gaps.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md`
