---
schema_version: 1
---

# Instruction Governance

## Contradictions (open)

- None currently observed.

## Contradictions (resolved)

- [RESOLVED] Frontend website rules are scoped to standalone landing-page work only, not default in-app Tauri UI edits.
- [RESOLVED] This repository is repo-specific; repo-local instructions override config-repo essentials from `/Users/jamiecraik/.codex/AGENTS.md` when they differ (for example package manager and command set).

## Flag for deletion candidates

- Remove repeated screenshot command lists from non-canonical files when they duplicate `docs/agents/frontend-website-rules.md`.
- Keep one canonical place for screenshot naming examples to avoid drift.
- Remove generic wording if a concrete command already exists in a linked doc.
