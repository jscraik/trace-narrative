---
status: complete
priority: p2
issue_id: CR-013
tags:
  - code-review
  - architecture
  - ui
  - docs
  - firefly
dependencies: []
---

## Problem Statement
Firefly planning documents conflict with each other and with implementation details, making it unclear which architecture/state model is canonical.

## Findings
- Legacy/deepened Firefly plans describe portal + EventEmitter architecture with additional states (`Anomaly`, `Offline`) and off-screen indicators.
- Revised Firefly plan explicitly removes EventEmitter and portal, and implementation matches this simplified approach.
- Multiple active plans with the same feature title remain, with unchecked checklists and no superseded/archive marker.

### Evidence
- Legacy/deepened docs:
  - `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan.md` (portal, anomaly/offline, off-screen)
  - `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan-deepened.md`
- Revised doc:
  - `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan-revised.md` (removed EventEmitter, in-Timeline rendering)
- Implementation:
  - `/Users/jamiecraik/dev/firefly-narrative/src/ui/components/Timeline.tsx`
  - `/Users/jamiecraik/dev/firefly-narrative/src/hooks/useFirefly.ts`
  - `/Users/jamiecraik/dev/firefly-narrative/src/ui/components/FireflySignal.tsx`

## Proposed Solutions
### Option 1 (Recommended): Canonicalize to one Firefly plan and archive superseded variants
- **Effort:** Small
- **Risk:** Low
- **Pros:** Removes ambiguity and prevents drift.
- **Approach:** Keep one canonical plan (likely revised or visual-v1), mark others as superseded with explicit links.

### Option 2: Keep all docs but add a compatibility matrix
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Preserves full decision history.
- **Approach:** Add a top-level matrix mapping each plan section to implementation status.

### Option 3: Split into “implemented” vs “future roadmap” docs
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Clear boundary between shipped and exploratory items.
- **Approach:** Move unfinished ideas (anomaly/offline/off-screen) into a separate roadmap file.

## Recommended Action
Canonicalized Firefly planning to one source of truth (`firefly-visual-system-v1-plan`) and explicitly marked legacy signal-system variants as superseded.

## Technical Details
- Affected area: Firefly architecture docs and state-model governance.
- Impact: onboarding confusion and potential reintroduction of abandoned patterns.

## Acceptance Criteria
- [x] Exactly one Firefly architecture plan is marked canonical.
- [x] Superseded plans are explicitly marked and linked.
- [x] Canonical plan state model matches `useFirefly` contract.

## Work Log
- 2026-02-24: Consolidated multi-agent finding on Firefly plan/implementation drift.
- 2026-02-24: Marked `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-visual-system-v1-plan.md` as canonical and added explicit `supersedes` references.
- 2026-02-24: Marked these plans as `status: superseded` with canonical pointer notes:
  - `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan.md`
  - `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan-deepened.md`
  - `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan-revised.md`

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-signal-system-plan*.md`
- `/Users/jamiecraik/dev/firefly-narrative/docs/brainstorms/2026-02-17-firefly-signal-brainstorm.md`
