---
status: complete
priority: p2
issue_id: CR-026
tags:
  - code-review
  - performance
  - sqlite
  - calibration
dependencies: []
---

## Problem Statement
Even idempotent duplicate submissions trigger full profile recomputation, causing avoidable DB load.

## Findings
- Insert uses `INSERT OR IGNORE` with idempotency key and returns `rowsAffected`.
- Regardless of `inserted` value, code recomputes calibration profile and highlight adjustments.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts` (lines ~379-407)
- Agent review: performance-oracle

## Proposed Solutions
### Option 1 (Recommended): Skip recompute when `rowsAffected === 0`
- **Effort:** Small
- **Risk:** Low
- **Pros:** Immediate reduction in unnecessary DB reads.
- **Approach:** If duplicate, return existing profile (cached or loaded) without recomputation.

### Option 2: Incremental counters with conditional updates
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Scales better for high event volumes.
- **Approach:** Update aggregates only on successful inserts.

### Option 3: Background recompute queue
- **Effort:** Large
- **Risk:** Medium
- **Pros:** Decouples write latency from read aggregation cost.
- **Approach:** Queue profile recomputation asynchronously.

## Recommended Action

## Technical Details
- Affected components: feedback write path and profile recompute path.
- Risk category: throughput and responsiveness.

## Acceptance Criteria
- [ ] Duplicate feedback does not trigger expensive recompute work.
- [ ] Feedback latency remains stable under repeated clicks.
- [ ] Tests verify no recompute for ignored inserts.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Performance review identified redundant recomputation on idempotent duplicates.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts`
