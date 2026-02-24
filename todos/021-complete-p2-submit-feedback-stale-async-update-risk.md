---
status: complete
priority: p2
issue_id: CR-021
tags:
  - code-review
  - correctness
  - react
  - async
dependencies: []
---

## Problem Statement
`handleSubmitFeedback` updates state after async completion without guarding against component unmount or context change.

## Findings
- Submission callback awaits `submitNarrativeFeedback` then sets calibration state.
- No cancellation/ref identity guard is used in this callback, unlike other guarded async effects in `BranchView`.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx` (lines ~767-790)
- Agent reviews: architecture-strategist, kieran-typescript-reviewer

## Proposed Solutions
### Option 1 (Recommended): Add mounted/context guard before state update
- **Effort:** Small
- **Risk:** Low
- **Pros:** Prevents stale state updates and React warnings.
- **Approach:** Track mounted status and current repo/branch key; only apply result when still current.

### Option 2: Route through a guarded async helper
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Reuses existing request-guard patterns.
- **Approach:** Standardize callback async guards used elsewhere in `BranchView`.

### Option 3: Use abortable command wrapper
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Central cancellation semantics.
- **Approach:** Add abort token support to feedback persistence call path.

## Recommended Action

## Technical Details
- Affected components: feedback submit callback state lifecycle.
- Risk category: stale async update.

## Acceptance Criteria
- [ ] No state updates occur after unmount or context switch.
- [ ] Tests cover submit-in-flight + navigation/repo change scenarios.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Deep review flagged missing async guard in feedback submit callback.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx`
