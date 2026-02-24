---
status: complete
priority: p3
issue_id: CR-014
tags:
  - code-review
  - docs
  - process
  - quality
dependencies: []
---

## Problem Statement
Plan lifecycle metadata and checklist completion markers are stale/inconsistent across docs/plans, which weakens review reliability and execution tracking.

## Findings
- Hybrid reliability plan is still marked `status: planned` while a corresponding solution document is `status: solved`.
- Several plan files have many unchecked items despite implemented code/tests in adjacent areas.
- Status/checklist drift makes it hard to tell what is complete vs. deferred.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-19-feat-hybrid-codex-claude-capture-reliability-plan.md` (`status: planned`)
- `/Users/jamiecraik/dev/firefly-narrative/docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md` (`status: solved`)
- Checklist counts sampled on 2026-02-24:
  - `...firefly-signal-system-plan-deepened.md`: 21 unchecked
  - `...universal-agent-tracking-plan.md`: 48 unchecked
  - `...hybrid-codex-claude-capture-reliability-plan.md`: 9 unchecked

## Proposed Solutions
### Option 1 (Recommended): Add doc lifecycle policy and sync pass
- **Effort:** Small
- **Risk:** Low
- **Pros:** Quick clarity improvement.
- **Approach:** Enforce “planned/in-progress/solved/superseded” semantics and run a one-time checklist/status reconciliation.

### Option 2: Generate status from code evidence automatically
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Reduces manual drift long-term.
- **Approach:** Add script that compares plan IDs to test artifacts and solution docs.

### Option 3: Freeze checklists in archived plans
- **Effort:** Small
- **Risk:** Low
- **Pros:** Avoids misleading unfinished boxes in superseded docs.
- **Approach:** Convert legacy plan checklists into historical notes and move active tasks to one canonical plan.

## Recommended Action
Performed lifecycle sync pass across plans/solutions and added explicit checklist semantics for the active universal tracking plan.

## Technical Details
- Affected area: docs process governance for plans/solutions.
- Impact: lower confidence in review and rollout status.

## Acceptance Criteria
- [x] Plan/solution statuses are reconciled and current.
- [x] Superseded plans are labeled as such.
- [x] Active plan checklists reflect real implementation state.

## Work Log
- 2026-02-24: Logged lifecycle/status drift across plans and solutions.
- 2026-02-24: Reconciled hybrid reliability lifecycle by setting `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-19-feat-hybrid-codex-claude-capture-reliability-plan.md` to `status: solved` and linking `resolved_by` solution evidence.
- 2026-02-24: Added lifecycle/checklist semantics note and normalized status fields in `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-universal-agent-tracking-plan.md`.
- 2026-02-24: Applied superseded labels to legacy firefly-signal plans and canonical pointer to visual-system-v1 plan.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/`
- `/Users/jamiecraik/dev/firefly-narrative/docs/solutions/`
