# firefly-inspired Dashboard v3 Implementation

**Origin Plan:** `/Users/jamiecraik/dev/trace-narrative/docs/plans/2026-03-09-feat-firefly-inspired-dashboard-v3-plan.md`
**Origin Spec:** `/Users/jamiecraik/dev/trace-narrative/docs/specs/2026-03-09-feat-firefly-inspired-dashboard-v3-spec.md`

## Phase 0: Preflight and Execution Contract

- [x] Write implementation notes mapping spec sections to delivery checkpoints
- [x] Confirm existing package scripts are execution gates
- [x] Define rollout cohort table in implementation notes
- [x] Confirm artifact roots exist or are created by scripts
- [x] Confirm dependency baseline (`echarts` dependency lockfile/bundle review if missing)

## Phase 1: Contract and State Wiring

- [x] Update shared dashboard types to match the spec exactly (`DashboardState`, `DashboardTrustState`, `DashboardPanelStatus`, `PanelStatusMap`, `CommandAuthorityOutcome`, retry budgets)
- [x] Refactor `DashboardView.tsx` (authoritative request identity, transitions, degradation, timeouts, stale-response, ring buffer)

## Phase 2: Layout Migration and Resolved UX Defaults

- [x] Port v3 visual structure (from `firefly-inspired-v3.html`) without breaking `App.tsx` navigation
- [x] Apply distinct styles for non-success states and trust indicators
- [x] Enforce reduced-motion parity and APG-compliant TopNav

## Phase 3: Visualization Strategy and Performance Delivery

- [x] Add `echarts-canvas` (if absent) and switch based on density (SVG vs Canvas vs Table)
- [x] Add canonical performance fixtures
- [x] Measure/enforce spec budgets (TTI, interaction latency)

## Phase 4: Telemetry, Audit, and Sanitization

- [x] Extend `narrativeTelemetry.ts` envelope
- [x] Promote release-blocking event coverage
- [x] Implement redaction/sanitization for `permission_denied`

## Phase 5: Tauri Authority Boundary Hardening

- [x] Review `/src-tauri/capabilities/*` against spec auth matrix
- [x] Verify `authority_denied` is non-retryable and defaults to deny

## Phase 6: Test Matrix Completion

- [x] Expand view and component tests
- [x] Add negative tests for forbidden transitions
- [x] Add remediation/stale-drop taxonomy tests
- [x] Extend telemetry tests

## Phase 7: Rollout, Evidence, and Monitoring

- [x] Produce canonical artifact pack
- [x] Setup schema validation
- [x] Map spec gate math into decision table
