---
status: complete
priority: p3
issue_id: CR-030
tags:
  - code-review
  - maintainability
  - react
  - quality
dependencies: []
---

## Problem Statement
BranchView repeats near-identical async request guard logic across multiple effects, increasing maintenance overhead.

## Findings
- Multiple effects duplicate `cancelled` flags and request identity checks.
- Shared guard pattern is error-prone to update consistently across all async branches.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx`
- Agent review: code-simplicity-reviewer

## Proposed Solutions
### Option 1 (Recommended): Extract shared guarded-async helper/hook
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Centralizes cancellation/version logic.
- **Approach:** Create reusable helper for guarded async state updates.

### Option 2: Keep inline guards but standardize utility comments/tests
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Minimal refactor cost.
- **Approach:** Add clear conventions + lint/test checks for guard pattern drift.

### Option 3: Use request library abstraction
- **Effort:** Large
- **Risk:** Medium
- **Pros:** Stronger async lifecycle controls.
- **Approach:** Adopt query/state library for request orchestration.

## Recommended Action
Extracted a shared `createRequestGuard` helper in `BranchView` and reused it for files/diff/trace async effects.

## Technical Details
- Affected components: BranchView async effects and request lifecycle handling.
- Risk category: maintainability.

## Acceptance Criteria
- [x] Shared guard behavior is implemented once and reused.
- [x] Existing async effects remain behaviorally equivalent after refactor.
- [x] Tests cover cancellation and stale-response prevention.

## Work Log
- 2026-02-24: Simplicity review flagged duplicated guard boilerplate.
- 2026-02-24: Added `createRequestGuard` in `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx` and replaced duplicated cancellation/version checks across three effects.
- 2026-02-24: Verified with `pnpm exec vitest run src/ui/views/__tests__/BranchView.test.tsx` (pass).

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx`
