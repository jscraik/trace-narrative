---
status: complete
priority: p2
issue_id: CR-012
tags:
  - code-review
  - security
  - quality
  - narrative
dependencies: []
---

## Problem Statement
Prompt/eval governance requirements in the plan are only partially implemented: rubric checks exist, but prompt versioning and adversarial prompt-injection checks are not present.

## Findings
- The plan calls for prompt template versioning and adversarial prompt-injection checks.
- Current implementation includes rollout rubric logic and tests.
- No implementation was found for adversarial prompt-injection checks or prompt-version tracking metadata.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-18-feat-vision-parity-track-plan.md` (line ~255)
- Existing governance code: `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/rolloutGovernance.ts`
- Existing tests: `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/__tests__/rolloutGovernance.test.ts`

## Proposed Solutions
### Option 1 (Recommended): Add prompt metadata + adversarial test suite
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Aligns implementation with planned security governance.
- **Approach:** Introduce prompt template IDs/versions and add adversarial payload tests that must pass before rollout.

### Option 2: Add lightweight static policy checks
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Quick baseline protection.
- **Approach:** Add lint/policy checks for dangerous prompt constructs and required template metadata.

### Option 3: De-scope governance requirements in plan
- **Effort:** Small
- **Risk:** High
- **Pros:** Clarifies current state.
- **Approach:** Explicitly mark adversarial checks/versioning as deferred and track in backlog.

## Recommended Action
Implemented prompt governance primitives with explicit template version metadata and adversarial prompt-injection detection in rollout rules + tests.

## Technical Details
- Affected area: narrative prompt/eval safety governance.
- Impact: reduced assurance against injection-like prompt failures.

## Acceptance Criteria
- [x] Prompt templates have explicit version metadata.
- [x] Adversarial prompt-injection tests exist and run in CI.
- [x] Governance docs map 1:1 to implemented checks.

## Work Log
- 2026-02-24: Logged missing prompt-versioning and adversarial-test controls relative to plan.
- 2026-02-24: Added `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/promptGovernance.ts` with template constants and adversarial pattern checks.
- 2026-02-24: Added `promptTemplate` metadata to `BranchNarrative` and composer output in `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/composeBranchNarrative.ts`.
- 2026-02-24: Extended rollout governance rules (`prompt_template_unversioned`, `prompt_injection_signal`) in `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/rolloutGovernance.ts`.
- 2026-02-24: Added/updated tests in:
  - `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/__tests__/rolloutGovernance.test.ts`
  - `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/__tests__/composeBranchNarrative.test.ts`
- 2026-02-24: Updated mapping notes in `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-18-feat-vision-parity-track-plan.md`.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-18-feat-vision-parity-track-plan.md`
