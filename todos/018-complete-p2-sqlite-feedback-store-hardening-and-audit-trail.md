---
status: complete
priority: p2
issue_id: CR-018
tags:
  - code-review
  - security
  - tauri
  - sqlite
  - compliance
dependencies: []
---

## Problem Statement
The plan introduces sensitive feedback/calibration persistence but lacks explicit hardening and tamper-evidence controls for the SQLite store.

## Findings
- Security guidance mentions least privilege generally, but does not require concrete DB file access controls, command-level permission boundaries, or integrity/audit logging for profile updates.
- Local DB tampering risk remains under-specified for rollback and forensic analysis.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md` (lines 152-154)
- Agent review: security-sentinel (P2)

## Proposed Solutions
### Option 1 (Recommended): Add explicit security controls as phase-1 acceptance criteria
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Improves security posture with minimal architecture change.
- **Approach:** Require owner-only DB permissions, capability-restricted Tauri commands, immutable audit events for calibration updates, and validation tests.

### Option 2: Add signed checksum snapshots for calibration profiles
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Enables tamper detection even for offline file edits.
- **Approach:** Persist periodic profile hashes and compare on startup/update.

### Option 3: Delay calibration writes until hardened storage abstraction exists
- **Effort:** Large
- **Risk:** Low
- **Pros:** Avoids deploying partially protected persistence.
- **Approach:** Feature-flag write path off until hardening milestone is complete.

## Recommended Action

## Technical Details
- Affected components: Tauri persistence commands, SQLite file policy, telemetry/audit streams.
- Risk category: integrity and auditability.

## Acceptance Criteria
- [ ] DB file permissions and command capabilities are explicitly documented and tested.
- [ ] Calibration profile updates produce immutable audit records.
- [ ] Tamper scenarios are covered in failure/recovery tests.
- [ ] Security hardening requirements are visible in phase gates.

## Work Log
- 2026-02-24: Implemented fix and validated via updated docs/contracts plus automated checks.
- 2026-02-24: Security review flagged missing persistence hardening/tamper-evidence requirements.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-24-feat-narrative-truth-loop-feedback-calibration-plan.md`
