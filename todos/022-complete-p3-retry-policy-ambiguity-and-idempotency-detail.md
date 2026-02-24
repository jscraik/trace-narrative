---
status: complete
priority: p3
issue_id: CR-022
tags:
  - code-review
  - reliability
  - performance
  - quality
dependencies: []
---

## Problem Statement
The retry policy requirement is too rigid in one dimension and under-specified in others, which can produce unnecessary complexity or inconsistent behavior.

## Findings
- Plan hard-codes a specific retry shape (“max 2 retries with bounded exponential backoff”) without defining jitter/circuit-break behavior under lock contention.
- Idempotency linkage for retry attempts is not explicit in the acceptance criteria.
- Simplicity review suggests this may overfit v1 scope without proving necessity.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md` (line 275)
- Agent reviews: performance-oracle (P3), code-simplicity-reviewer (P3)

## Proposed Solutions
### Option 1 (Recommended): Specify retry contract in terms of outcomes, then pick minimal mechanism
- **Effort:** Small
- **Risk:** Low
- **Pros:** Maintains reliability without overengineering.
- **Approach:** Define required behavior (bounded retries, idempotent key reuse, jitter or equivalent contention spread, safe abort telemetry) and keep implementation minimal.

### Option 2: Reduce to single retry in v1
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Simpler and easier to test.
- **Approach:** Limit to one retry with strict idempotency and observe production behavior before expanding.

### Option 3: Defer retries and rely on user retry action
- **Effort:** Small
- **Risk:** Medium
- **Pros:** No background retry complexity.
- **Approach:** Fail fast with non-blocking UI notice and explicit re-submit action.

## Recommended Action

## Technical Details
- Affected components: persistence retry wrapper, telemetry for failures/retries.
- Risk category: reliability policy ambiguity.

## Acceptance Criteria
- [ ] Retry policy explicitly defines idempotency-key handling per attempt.
- [ ] Contention behavior (jitter/spread/abort) is documented.
- [ ] Tests prove no duplicate writes under retry paths.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Reliability/simplicity reviews converged on retry contract ambiguity.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md`
