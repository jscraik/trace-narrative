---
status: complete
priority: p2
issue_id: CR-024
tags:
  - code-review
  - correctness
  - react
  - narrative
dependencies: []
---

## Problem Statement
When repo context changes, the previous repo calibration can remain active until the new profile fetch resolves.

## Findings
- `narrativeCalibration` is not cleared before starting a new `getNarrativeCalibrationProfile(repoId)` request.
- During the async gap, `composeBranchNarrative` may apply stale calibration from a different repo/branch.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx` (lines ~318-320, ~393-404)
- Agent reviews: kieran-typescript-reviewer, architecture-strategist

## Proposed Solutions
### Option 1 (Recommended): Clear calibration state immediately on repo change
- **Effort:** Small
- **Risk:** Low
- **Pros:** Eliminates cross-repo bleed instantly.
- **Approach:** Call `setNarrativeCalibration(null)` before issuing profile load; keep cancellation guard for late responses.

### Option 2: Key calibration state by repo id
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Prevents stale cross-repo reuse while preserving cache.
- **Approach:** Store profiles in a map keyed by repoId; read only current key.

### Option 3: Attach request token and compare on resolve
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Strong stale-response protection.
- **Approach:** Include repoId token in closure and ignore mismatched completions.

## Recommended Action

## Technical Details
- Affected components: BranchView profile-loading effect and narrative composition memo.
- Risk category: correctness regression.

## Acceptance Criteria
- [ ] Changing repo/branch never applies previous repo calibration.
- [ ] Tests cover rapid repo switching while profile requests are in flight.
- [ ] Narrative confidence/highlight ordering stays stable during load transitions.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Multi-agent review identified transient cross-repo calibration leakage.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src/ui/views/BranchView.tsx`
