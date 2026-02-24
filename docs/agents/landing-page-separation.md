---
schema_version: 1
---

# Landing Page Separation Notes

## Table of Contents

- [Scope](#scope)
- [Hard Boundary](#hard-boundary)
- [When to apply Frontend Website Rules](#when-to-apply-frontend-website-rules)
- [Directory ownership during separation](#directory-ownership-during-separation)
- [Screenshot expectations](#screenshot-expectations)

## Scope

This document governs **landing-page work after the UI split** from the Tauri app shell.

- In-scope:
  - Marketing pages, public product landing pages, and standalone marketing web entry points.
  - Visual matching tasks that target screenshot parity for the new web page.
- Out-of-scope:
  - In-app Tauri UI views, dialogs, and shell workflows.

## Hard Boundary

- If the change is inside `src-tauri/`, `src/` app shell, or other in-app UI code, use the app docs (`docs/agents/tauri.md`, `docs/agents/development.md`) unless the task explicitly says "standalone page."
- If the change is for a standalone page (outside app shell) or if the screenshot requirement is a page-level visual match, use:
  - `docs/agents/frontend-website-rules.md`
  - `node serve.mjs`
  - `node screenshot.mjs`

## When to apply Frontend Website Rules

- Use frontend website rules for:
  - a separate web landing page experience,
  - reference-based design matching,
  - or one-off component/page screenshot verification of standalone UI.

- Do not use frontend website rules for:
  - normal app window layout changes,
  - feature behavior changes,
  - or backend/agentation wiring changes unless no visual page constraints exist.

## Directory ownership during separation

- Prefer keeping landed separation files in the project root for the page build (`index.html`, assets, `screenshot.mjs`, `serve.mjs`) unless project standards dictate a dedicated web package.
- Keep app-specific and app-shell docs aligned with `docs/agents/development.md` and `docs/agents/tauri.md`.

## Screenshot expectations

- For standalone page snapshots:
  - `node screenshot.mjs http://localhost:2000`
- For component checks:
  - `node screenshot.mjs http://localhost:2000 card`
  - expected file: `screenshot-N-card.png`
  - examples: `node screenshot.mjs http://localhost:2000 button`, `node screenshot.mjs http://localhost:2000 card`
- Keep screenshot names exact and stable for iterative comparison.
