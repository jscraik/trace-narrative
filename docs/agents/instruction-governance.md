---
schema_version: 1
---

# Instruction Governance

## Contradictions (open)

- `README.md` (`137-146`) and `docs/agents/frontend-website-rules.md` (`50-60`) define overlapping snapshot workflows with mismatched naming/source-of-truth details:
  - `README.md`: `node screenshot.mjs http://localhost:2000`, optional labels, output `screenshot-<N>-<label>.png`, and `ERR_CONNECTION_REFUSED` recovery text.
  - `frontend-website-rules.md`: `node screenshot.mjs` plus `agent-browser` guidance, output `screenshot-N(-label).png`.
- Question: keep both snippets as-is (README as troubleshooting shortcut) or move all snapshot guidance to `docs/agents/frontend-website-rules.md` and collapse README to one link?

## Contradictions (resolved)

- [RESOLVED] Frontend website rules are scoped to standalone landing-page work only, not default in-app Tauri UI edits.
- [RESOLVED] This repository is repo-specific; repo-local instructions override config-repo essentials from `/Users/jamiecraik/.codex/AGENTS.md` when they differ (for example package manager and command set).
- [RESOLVED] Frontend rules are scoped for landing-page/web-only work only, especially for the planned separation of the landing page from the Tauri app.

## Flag for deletion candidates

- `README.md`: remove duplicated screenshot command list `137-146` if `docs/agents/frontend-website-rules.md` remains canonical.
- `docs/agents/landing-page-separation.md`: verify whether its screenshot expectations (`52-57`) should be moved under `frontend-website-rules.md` and reduced to boundary text only.
- Keep one canonical source for screenshot naming examples to avoid drift.
- Remove generic wording in `README.md` where a concrete command exists in a linked doc.
