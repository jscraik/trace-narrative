schema_version: 1

# AGENTS.md — Narrative Repository Guide

Narrative is a Tauri desktop app that layers AI session narratives onto git history.

## Mandatory workflow snippet
1. Explore project first, then invoke skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Add a Table of Contents for docs.

## Instruction discovery order
1. Global: `/Users/jamiecraik/.codex/AGENTS.md`
2. Repo root: `AGENTS.md`
3. Nested AGENTS/README instructions in subdirectories
4. Precedence rule for this repo: repo-local instructions override global config-repo defaults when they differ.

## References (informational)
- Global protocol: `/Users/jamiecraik/.codex/instructions/rvcp-common.md`
- Security and standards baseline: `/Users/jamiecraik/.codex/instructions/standards.md`
- Codestyle: `/Users/jamiecraik/.codex/instructions/CODESTYLE.md`

## Tooling essentials
- Package manager: `pnpm` (Node via mise)
- Rust toolchain for Tauri features
- Run shell commands with `zsh -lc`
- Prefer `rg`, `fd`, and `jq`
- Execution mode: single-threaded by default

## Non-standard commands
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm tauri dev`
- `pnpm tauri build`
- `pnpm docs:lint`
- `pnpm agentation:autopilot`
- `pnpm agentation:critique`

## Agent session tools (Tauri commands)
- `agent_list_sessions` — list imported sessions (optional tool filter + limit)
- `agent_get_session` — fetch full session payload by repo/session id
- `agent_link_session_to_commit` — manually link a session to a commit
- `agent_link_session` — alias for manual session→commit linking

## Documentation map
### Table of Contents
- [Frontend website rules](docs/agents/frontend-website-rules.md)
- [Landing page separation](docs/agents/landing-page-separation.md)
- [Development](docs/agents/development.md)
- [Testing](docs/agents/testing.md)
- [Tauri](docs/agents/tauri.md)
- [Repo structure](docs/agents/repo-structure.md)
- [Repair agent](docs/agents/repair-agent.md)
- [Instruction governance](docs/agents/instruction-governance.md)
- [Agentation schema](docs/agents/agentation-schema.md)
- [Hybrid capture rollout runbook](docs/agents/hybrid-capture-rollout-runbook.md)

## Notes
- For standalone landing-page work, confirm boundary in `docs/agents/landing-page-separation.md` before using frontend screenshot workflows.
- Keep root guidance minimal; detailed procedures live under `docs/agents/`.
