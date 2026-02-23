schema_version: 1

# AGENTS.md — Frontend Website Rules

## Agent Startup Checklist
- Confirm task scope: check `docs/agents/landing-page-separation.md` before deciding in-app vs standalone-page workflow.
- If standalone landing-page work: read `docs/agents/frontend-website-rules.md` before making code changes.
- For visual work, capture required screenshots in order:
  - `node screenshot.mjs http://localhost:2000`
  - `node screenshot.mjs http://localhost:2000 card`
  - `node screenshot.mjs http://localhost:2000 button`
- Verify screenshot naming: `temporary screenshots/screenshot-<N>-<label>.png`.

## Table of Contents
- [Project Description](#project-description)
- [Instruction Discovery Order](#instruction-discovery-order)
- [References](#references)
- [Tooling Essentials](#tooling-essentials)
- [Non-Standard Commands](#non-standard-commands)
- [Instruction Index](#instruction-index)
- [Notes](#notes)

## Project Description
Narrative is a Tauri desktop app that layers AI session narratives onto git history.

## Instruction Discovery Order
1. Global: `/Users/jamiecraik/.codex/AGENTS.md`
2. Repo root: `AGENTS.md`
3. Nested AGENTS/README instructions in subdirectories

## References (informational)
- Protocol: `/Users/jamiecraik/.codex/instructions/rvcp-common.md`
- Security and standards baseline: `/Users/jamiecraik/.codex/instructions/standards.md`
- Codestyle: `/Users/jamiecraik/.codex/instructions/CODESTYLE.md`

## Tooling Essentials
- Package manager: `pnpm` (Node via mise)
- Rust toolchain for Tauri features
- Git must be available in PATH

## Non-Standard Commands
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm tauri dev`
- `pnpm tauri build`
- `pnpm agentation:autopilot`
- `pnpm agentation:critique`
- `pnpm docs:lint`

## Instruction Index
- [`docs/agents/frontend-website-rules.md`](docs/agents/frontend-website-rules.md) — Session-specific frontend website workflow and hard constraints
- [`docs/agents/development.md`](docs/agents/development.md) — App setup and local development
- [`docs/agents/testing.md`](docs/agents/testing.md) — Test and verification commands
- [`docs/agents/tauri.md`](docs/agents/tauri.md) — Tauri integration and security
- [`docs/agents/repo-structure.md`](docs/agents/repo-structure.md) — Codebase structure
- [`docs/agents/repair-agent.md`](docs/agents/repair-agent.md) — Agent repair and troubleshooting workflow
- [`docs/agents/instruction-governance.md`](docs/agents/instruction-governance.md) — Instruction conflicts and cleanup candidates
- [`docs/agents/landing-page-separation.md`](docs/agents/landing-page-separation.md) — Landing page vs in-app UI boundary and separation workflow.

## Landing Page / Frontend Verification Ops
- For standalone landing-page work (and only then), follow `docs/agents/frontend-website-rules.md`.
- Confirm boundary first in `docs/agents/landing-page-separation.md` before entering frontend verification mode.
- Mandatory verification flow:
  1. `pnpm build` (ensures `dist` is current),
  2. Ensure no stale `node serve.mjs` process is already running, then
  3. `node serve.mjs`,
  4. capture at least these shots:
     - `node screenshot.mjs http://localhost:2000`
     - `node screenshot.mjs http://localhost:2000 card`
     - `node screenshot.mjs http://localhost:2000 button`
- Never start a second `serve.mjs` if port 2000 is already in use.
- If `screenshot.mjs` fails with `ERR_CONNECTION_REFUSED`, wait/retry after server startup.
- Use `temporary screenshots/screenshot-<N>-<label>.png` naming; avoid overwriting and keep labels descriptive (`card`, `button`, `modal`, etc.).

## Notes
- Frontend-specific rules are in `docs/agents/frontend-website-rules.md` and are the primary reference when the website/landing page is being built or maintained separately from the Tauri shell.
- For in-app Tauri UI changes, prefer the app-specific docs unless the task explicitly requests standalone-page workflow.
