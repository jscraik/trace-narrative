# UI Polish Verification Checklist

## Table of Contents

- [Current State](#current-state)
- [Resolved Items](#resolved-items)
- [Remaining Release Checks](#remaining-release-checks)
- [Evidence Capture](#evidence-capture)
- [Validation](#validation)

## Current State

This document is now a release-polish checklist, not a feature implementation plan.

The earlier shell inconsistencies were mostly resolved during the Trace Narrative redesign pass. What remains is a short verification lane to confirm the visual and telemetry details that still matter before rollout closure.

## Resolved Items

- [x] `TopNav` stays visible across the primary narrative shell and keeps the Narrative anchor active for shared surfaces.
- [x] Drift state no longer defaults to an alarmist warning when the value is pending.
- [x] Shared-surface drift copy now includes a neutral `Calculating` state with a slate tone.
- [x] Sidebar navigation uses tab semantics and no longer relies on generic button-only behavior.

## Remaining Release Checks

### Visual Verification

- [x] Verify the red `Signal` authority badge in a mocked critical drift state on live shared surfaces.
- [x] Confirm the remaining `OK` pill alignment and padding in graph/timeline activity rows.
- [x] Reconfirm the Trust Center surface still reads cleanly after the signature provenance lane is introduced.

### Rollout Readiness

- [x] Complete a release-candidate telemetry spot check against the current `narrative:telemetry` contract.
- [x] Confirm the rollout evidence pack includes current screenshots, command logs, and owner fields.

## Evidence Capture

- [x] Capture one shared-surface screenshot with a critical `Signal` badge visible.
- [x] Capture one screenshot of the final Trust Center shared surface after provenance-lane integration.

## Validation

- [x] `pnpm docs:lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm check`
- [x] `pnpm test:deep`
