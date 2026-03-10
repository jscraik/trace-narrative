---
schema_version: 1
---

# Instruction Governance

## Contradictions (open)

- None currently open.

## Contradictions (resolved)

- Canonicalized standalone screenshot workflow source of truth for landing-page work:
  - `README.md` and `docs/README.md` now route users to `docs/agents/frontend-website-rules.md`.
  - `screenshot.mjs` output is canonical as `screenshot-<N>.png` and `screenshot-<N>-<label>.png`.
  - `ERR_CONNECTION_REFUSED` retry behavior is documented in the canonical rule.
- [RESOLVED] Frontend website rules are scoped to standalone landing-page work only, not default in-app tauri UI edits.
- [RESOLVED] This repository is repo-specific; repo-local instructions override config-repo essentials from `/Users/jamiecraik/.codex/AGENTS.md` when they differ (for example package manager and command set).
- [RESOLVED] Frontend rules are scoped for the standalone landing-page separation from the tauri app.

## Flag for deletion candidates

- None currently.
