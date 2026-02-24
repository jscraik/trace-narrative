---
status: complete
priority: p2
issue_id: CR-020
tags:
  - code-review
  - telemetry
  - metrics
  - quality
  - rollout
dependencies: []
---

## Problem Statement
The fallback-rate KPI contract is directionally strong but operationally incomplete for opt-in rollout cohorts.

## Findings
- Baseline requirement (“14-day pre-enable rolling window for opted-in repos”) is not actionable for newly onboarded repos without pre-enable collection rules.
- Denominator event (`narrative_viewed`) lacks explicit uniqueness/session semantics, risking metric distortion.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md` (lines 283-285)
- Agent reviews: architecture-strategist (P2), performance-oracle (P3)

## Proposed Solutions
### Option 1 (Recommended): Define KPI measurement contract with cohort and event identity semantics
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Makes rollout decisions statistically valid and reproducible.
- **Approach:** Specify baseline eligibility rules, cohort handling for new repos, and one-to-one narrative view instance identifiers linking numerator/denominator events.

### Option 2: Use global baseline only in v1
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Simplifies rollout analytics.
- **Approach:** Compare opt-in repos to a fixed global pre-enable baseline; defer per-repo baseline requirement.

### Option 3: Remove relative-reduction target until instrumentation matures
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Avoids false confidence.
- **Approach:** Keep directional telemetry only for v1 and set target in v1.1.

## Recommended Action

## Technical Details
- Affected components: telemetry schema, rollout dashboard logic, success criteria evaluation.
- Risk category: invalid KPI-driven decisions.

## Acceptance Criteria
- [ ] Baseline collection policy is explicitly defined for newly opted-in repos.
- [ ] `narrative_viewed` event uniqueness semantics are documented and testable.
- [ ] KPI calculation and guardrail comparison windows are reproducible from telemetry.
- [ ] Rollout gate references the final KPI contract.

## Work Log
- 2026-02-24: Implemented fix and validated via updated docs/contracts plus automated checks.
- 2026-02-24: Multi-agent review found baseline/denominator ambiguities in KPI contract.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md`
