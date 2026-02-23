# CLAUDE.md — Agent Task Notes

## Agent Startup Checklist
- Confirm scope first in `docs/agents/landing-page-separation.md`.
- If this is standalone landing-page work, follow `docs/agents/frontend-website-rules.md` before UI edits.
- For visual verification, run screenshot commands from localhost:
  - `node screenshot.mjs http://localhost:2000`
  - `node screenshot.mjs http://localhost:2000 card`
  - `node screenshot.mjs http://localhost:2000 button`
- Use output names like `temporary screenshots/screenshot-<N>.png` and `screenshot-<N>-card.png` / `...-button.png`.

This repo uses separate instruction paths for app UI work vs standalone frontend work.

## When to follow landing-page workflow
- Use `docs/agents/landing-page-separation.md` first to confirm scope.
- Use `docs/agents/frontend-website-rules.md` for standalone landing-page work (not the embedded Tauri dashboard flows).
- For in-app Tauri UI changes, follow normal app docs (`docs/agents/development.md`, `docs/agents/tauri.md`).

## Required visual verification flow
1. Build first:

```bash
pnpm build
```

2. Start local server (once):

```bash
node serve.mjs
```

3. Capture required screenshots from localhost:

```bash
node screenshot.mjs http://localhost:2000
node screenshot.mjs http://localhost:2000 card
node screenshot.mjs http://localhost:2000 button
```

## Server/process guardrails
- If `serve.mjs` is already running, do **not** start a second instance (it uses port `2000`).
- If screenshots fail with `ERR_CONNECTION_REFUSED`, wait/retry for server startup timing or verify no port conflict.

## Naming convention
- Screenshot outputs are auto-incremented: `temporary screenshots/screenshot-<N>.png`
- Use labeled component shots like `screenshot-<N>-card.png`, `screenshot-<N>-button.png`, etc.

## Capture tooling
- Screenshot capture is handled by `screenshot.mjs`; keep all captures on localhost and route output review from `temporary screenshots/`.
