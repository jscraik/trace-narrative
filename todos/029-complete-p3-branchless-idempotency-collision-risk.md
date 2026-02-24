---
status: complete
priority: p3
issue_id: CR-029
tags:
  - code-review
  - data-integrity
  - edge-case
  - sqlite
dependencies: []
---

## Problem Statement
When `branchName` is unavailable, idempotency falls back to `unknown-branch`, which can cause accidental collisions across contexts.

## Findings
- `branchName` is optional input to feedback submission.
- Fallback to `unknown-branch` can merge otherwise independent events if callers omit branch metadata.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts` (lines ~98, ~320)
- Agent review: data-migration-expert

## Proposed Solutions
### Option 1 (Recommended): Require branch identifier or deterministic fallback token
- **Effort:** Small
- **Risk:** Low
- **Pros:** Prevents hidden collisions.
- **Approach:** Reject missing branch context for git mode; otherwise use a stronger fallback key (e.g., repoId+HEAD SHA).

### Option 2: Keep fallback but log collisions
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Adds visibility with minimal change.
- **Approach:** Emit telemetry when branchless writes occur.

### Option 3: Split uniqueness by additional dimensions
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Reduces collision probability.
- **Approach:** Extend uniqueness key with commit or session identifiers.

## Recommended Action

## Technical Details
- Affected components: idempotency key construction and feedback input contract.
- Risk category: edge-case dedup inaccuracy.

## Acceptance Criteria
- [ ] Branchless feedback cannot collide across unrelated contexts.
- [ ] Missing-branch behavior is documented and tested.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Migration-focused review highlighted branchless dedup collisions.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/narrativeFeedback.ts`
