schema_version: 1

# AGENTS.md — Narrative Repository Guide

Narrative is a Tauri + React desktop app for AI session narratives on git history.

## Table of Contents
- [Mandatory workflow snippet](#mandatory-workflow-snippet)
- [Required essentials](#required-essentials)
- [Instruction routing](#instruction-routing)
- [Architecture-first bootstrap](#architecture-first-bootstrap)
- [Command preflight](#command-preflight)
- [Task route map](#task-route-map)
- [Contradictions](#contradictions)
- [Validation](#validation)

## Mandatory workflow snippet
1. Explore the project first, then invoke the right skill.
2. Prefer retrieval-led reasoning for React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook, and Chat Widget tasks.

## Required essentials
- Package manager: `pnpm`.
- Command environment defaults:
  - shell: `zsh -lc`
  - Node + pnpm + Rust + git for standard desktop workflow.
- Discovery defaults: `rg`, `fd`, `jq`.
- Single-threaded execution by default.

## Instruction routing
- Global path: `/Users/jamiecraik/.codex/AGENTS.md`.
- Repo root: this `AGENTS.md` (closest scope takes precedence).
- Domain details: `docs/agents/*`.
- Resolve any conflicting rules in favor of this repo-local file.

## Architecture-first bootstrap
- Read `.diagram/manifest.json` and `.diagram/architecture.mmd` before planning work.
- If `.diagram/manifest.json` is missing or stale, run:
  - `diagram analyze`, or
  - `npx --yes @brainwav/diagram analyze`.

## Command preflight
- Confirm binaries before edits:
  - `rg`, `fd`, `jq`.
- Confirm required paths before editing:
  - `AGENTS.md`, `package.json`, `docs`, `scripts`.
- Confirm destructive operation scope with `fd` first.
- Use `scripts/codex-preflight.sh` for multi-step/path-sensitive or config-impacting workflows:
  - `bash -lc 'source scripts/codex-preflight.sh && preflight_repo'`
  - `bash -lc 'source scripts/codex-preflight.sh && preflight_js'`
  - `bash -lc 'source scripts/codex-preflight.sh && preflight_py'`
  - `bash -lc 'source scripts/codex-preflight.sh && preflight_rust'`
- For external integrations, run a 1Password+env preflight before API calls:
  - `op account list`
  - `op item list --categories=API_CREDENTIAL --format json | jq -r '.[] | .title + \"\\t\" + .id'`
  - `ENV_FILES=("$HOME/.codex.env" "$HOME/dev/config/.env" "$HOME/dev/config/codex/.env" "$HOME/.env" "$HOME/.codex/.env"); for k in CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN; do echo "$k"; for f in "${ENV_FILES[@]}"; do [ -f "$f" ] || continue; awk -F'=' -v key=\"$k\" 'BEGIN{OFS=\"\\t\"} $0 !~ /^[[:space:]]*#/ {sub(/^[[:space:]]*export[[:space:]]+/, \"\"); if ($1==key) {print FILENAME, \"found\"; exit}}' \"$f\"; done; done`
- If a key is missing from files and environment, stop and refresh the 1Password-backed export path before retrying.

## Task route map
- development and local execution commands: `docs/agents/development.md`
- testing and validation: `docs/agents/testing.md`
- tauri runtime and capabilities: `docs/agents/tauri.md`
- project structure and ownership checks: `docs/agents/repo-structure.md`
- landing-page workflows: `docs/agents/landing-page-separation.md`, `docs/agents/frontend-website-rules.md`
- agentation payload and webhook workflows: `docs/agents/agentation-schema.md`
- repair and operations playbooks: `docs/agents/repair-agent.md`
- rollout and hybrid-capture runbooks: `docs/agents/hybrid-capture-rollout-runbook.md`
- instruction cleanup and contradictions: `docs/agents/instruction-governance.md`

## Contradictions
- Global config instructions under `/Users/jamiecraik/.codex/AGENTS.md` include config-repo specifics (for example workspace path and package-manager assumptions) that do not map to this app repository.
- Keep both files in scope; this repo's local `AGENTS.md` rules for workflow and stack expectations apply here.
- Confirm and route new guidance through `docs/agents/instruction-governance.md` before adding duplicate constraints.

## Validation
- Confirm command guidance against real repo files before publishing instructions.
- Keep this root file minimal and route deep policies to linked docs.
- Treat unresolved contradictions as blocking until resolved.
