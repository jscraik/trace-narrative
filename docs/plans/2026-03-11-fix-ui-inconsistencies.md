# UI Design & Implementation Inconsistency Fixes

## Overview
This plan addresses inconsistencies found during the UI audit, focusing on navigation visibility, drift status accuracy, and visual signal rendering.

## Identified Inconsistencies
1.  **TopNav Visibility**: The anchor navigation tabs (Repo, Cockpit, Docs) disappear when entering Cockpit modes, making it hard to switch back to Repo/Docs without the sidebar.
2.  **Drift Status False Positive**: The Drift metric defaults to "Drifting" (amber) if the repo is not ready or if drift is undefined, which is alarmist.
3.  **Red Signal Rendering**: The `system_signal` badge for critical drift alerts needs verification in a live (mocked) critical state to ensure premium aesthetics and visibility.
4.  **Sidebar A11y**: Sidebar navigation buttons lack semantic tab roles.

## Implementation Plan

### Phase 1: Navigation & Visibility
- [ ] Update `App.tsx` to render `TopNav` consistently across all primary modes.
- [ ] Ensure `TopNav` correctly highlights "Cockpit" when any cockpit sub-mode (e.g., `assistant`, `work-graph`) is active.

### Phase 2: Drift Metric Accuracy
- [ ] Update `cockpitViewData.ts` to show "Healthy" or "N/A" instead of "Drifting" when drift is 0 or undefined.
- [ ] Add a "Calculating..." state and blue/slate tone for pending drift assessments.

### Phase 3: Visual Signal Hardening
- [ ] Temporarily mock a `critical` drift state in `automation.ts` or `cockpitViewData.ts`.
- [ ] Verify the red `Signal` badge renders in the Assistant activity feed and Snapshot metrics.
- [ ] Check alignment and padding of the red badge relative to other cues.

### Phase 4: A11y & Polish
- [ ] Add `role="tab"` and associated ARIA attributes to Sidebar navigation if appropriate, or ensure `TopNav` is the clear primary.
- [ ] Fix the "OK" pill alignment in graph movements.

## Verification
- [ ] Use `browser_subagent` to capture screenshots of the fixed `TopNav` and the red `Signal` badge.
- [ ] Run unit tests to ensure no regressions in navigation logic.
