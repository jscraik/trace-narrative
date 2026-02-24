---
status: complete
priority: p2
issue_id: CR-027
tags:
  - code-review
  - data-integrity
  - sqlite
  - telemetry
dependencies: []
---

## Problem Statement
Idempotency key generation excludes `detailLevel`, so distinct feedback events can be collapsed within the same minute.

## Findings
- Key includes repo/branch/role/type/target/minute bucket but omits `detailLevel`.
- A user can submit the same highlight feedback with different detail contexts and the latter can be silently ignored.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts` (lines ~86-104, ~381)
- Agent review: data-migration-expert

## Proposed Solutions
### Option 1 (Recommended): Include `detailLevel` in idempotency key
- **Effort:** Small
- **Risk:** Low
- **Pros:** Preserves intended distinct events.
- **Approach:** Append detail level to key components and update tests.

### Option 2: Remove minute bucket and use strict structural uniqueness
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Avoids time-based collision ambiguity.
- **Approach:** Use deterministic uniqueness over semantic fields only.

### Option 3: Keep current key and drop detail-level as tracked dimension
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Simplifies dedup policy.
- **Approach:** Explicitly document detail-level non-distinction in product/analytics contracts.

## Recommended Action

## Technical Details
- Affected components: idempotency policy and feedback event fidelity.
- Risk category: silent data loss.

## Acceptance Criteria
- [ ] Distinct detail-level submissions are retained when intended.
- [ ] Idempotency behavior is documented and test-covered.
- [ ] Dedup policy matches analytics expectations.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Data migration review flagged detail-level collision in dedup key.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts`
