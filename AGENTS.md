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
3. Nested AGENTS/README instructions
4. Repo-local instructions override global defaults when they differ.

## References (informational)
- Global protocol: `/Users/jamiecraik/.codex/instructions/rvcp-common.md`
- Security and standards baseline: `/Users/jamiecraik/.codex/instructions/standards.md`
- Codestyle: `/Users/jamiecraik/.codex/instructions/CODESTYLE.md`

## Tooling essentials
- Package-manager map (repo-native):
  - install: `pnpm install`
  - run script: `pnpm <script>`
  - run binary: `pnpm exec <command>`
- Rust toolchain for Tauri features
- Shell: `zsh -lc`
- Use `rg`, `fd`, `jq`
- Single-threaded execution mode by default

## Non-standard commands
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:artifacts*`
- `pnpm tauri dev`
- `pnpm tauri build`
- `pnpm docs:lint`
- `pnpm agentation:autopilot`
- `pnpm agentation:critique`

## Code Quality Standards
- Run full test suite before completing work: `pnpm test`.
- Fix TypeScript/lint/test failures; keep tests order-independent.

## Flaky Test Artifact Capture
- Run `bash scripts/test-with-artifacts.sh all` (or `pnpm test:artifacts`) to emit flaky evidence under `artifacts/test`.
- Optional targeted modes: `unit`, `integration`, `e2e`.
- Preserve stable outputs:
  - `artifacts/test/summary-*.json`
  - `artifacts/test/test-output-*.log`
  - `artifacts/test/junit-*.xml`
  - `artifacts/test/*-results.json`
  - `artifacts/test/artifact-manifest.json`
- Keep artifact filenames stable (no timestamps).

## Shell Script Conventions
- Validate wrapper scripts with shellcheck before considering complete.
- Use `bash -n script.sh` and check env/function edge cases.

## Agent session tools
- `agent_list_sessions`
- `agent_get_session`
- `agent_link_session_to_commit`
- `agent_link_session`

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

## Contradictions and cleanup
- `README.md` (`137-146`) and `docs/agents/frontend-website-rules.md` (`50-60`) appear to de-duplicate the exact same troubleshooting surface for standalone frontend snapshots:
  - `README.md`: hardcoded commands + naming form `node screenshot.mjs ...`, `screenshot-<N>-<label>.png`, and `ERR_CONNECTION_REFUSED` recovery.
  - `frontend-website-rules.md`: same command family, but framed as workflow control (`agent-browser`) and naming form `screenshot-N(-label).png`.
  - Question: should this workflow be kept only in `docs/agents/frontend-website-rules.md` and linked from README?
- `README.md` also includes port-2000 duplicate-process guidance (`If already running, do not start another process on port 2000`) that is not present in `frontend-website-rules.md`.

## Flag for deletion (review in cleanup)
- Keep one canonical screenshot workflow source.
- If canonicalizing `docs/agents/frontend-website-rules.md`:
  - remove `README.md:137-146` entire block,
  - add a 1-line pointer from README to `docs/agents/frontend-website-rules.md`.

## Notes
- For standalone landing-page work, confirm scope in `docs/agents/landing-page-separation.md` before screenshots.
