---
status: complete
priority: p2
issue_id: CR-017
tags:
  - code-review
  - security
  - rust
  - import
dependencies: []
---

## Problem Statement
Canonicalizing all allowed root directories can unintentionally broaden path-validator trust boundaries when configured roots are symlinks.

## Findings
- `allowed_directories` now pushes both configured and canonicalized variants for `~/.claude`, `~/.cursor`, `~/.continue`, `~/.codex`, and `~/.config`.
- If any of those roots are symlinked to a broad location, the canonical target is added as an allowed prefix.
- `validate` checks `canonical.starts_with(prefix)`, so expanded canonical roots can permit reads outside intended app-scoped folders.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/import/path_validator.rs` (lines ~96-107, ~109-135)

## Proposed Solutions
### Option 1 (Recommended): Canonicalize only temp directories (not user-config roots)
- **Effort:** Small
- **Risk:** Low
- **Pros:** Solves macOS tmp symlink issue without expanding trusted config roots.
- **Approach:** Apply canonicalization for `TMPDIR`/`/tmp` paths only; keep home app roots as explicit literals.

### Option 2: Canonicalize but require canonical path remain under home-root + expected basename
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Preserves symlink compatibility with tighter boundaries.
- **Approach:** Validate canonical targets against home allowlist constraints before adding.

### Option 3: Keep current behavior and add warning telemetry
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Minimal change.
- **Approach:** Emit warning when canonical root differs substantially from configured root.

## Recommended Action

## Technical Details
- Affected components: import path security validation.
- Risk category: path authorization scope broadening.

## Acceptance Criteria
- [ ] Allowed roots cannot expand to arbitrary canonical locations.
- [ ] tmp symlink compatibility is preserved.
- [ ] Security tests cover symlinked config-directory edge cases.

## Work Log
- 2026-02-24: Implemented fix and validated via lint/typecheck/unit coverage.
- 2026-02-24: Diff review flagged potential trust-boundary broadening in path validator root canonicalization.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/import/path_validator.rs`
