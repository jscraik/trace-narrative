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
- [Contradictions and cleanup](#contradictions-and-cleanup)
- [Validation notes](#validation-notes)

## Mandatory workflow snippet
1. Explore project first, then invoke skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Add a Table of Contents for docs.

## Required essentials
- Package manager: `pnpm`.
- Repo is configuration-aware and no separate package-manager shim layer is required.
- Command environment defaults:
  - shell: `zsh -lc`
  - Node + pnpm + Rust + git for standard desktop workflow.
- Use `rg`, `fd`, `jq` for discovery and evidence extraction.
- Single-threaded execution by default.

## Instruction routing
- Global path: `/Users/jamiecraik/.codex/AGENTS.md`.
- Repo root: `AGENTS.md`.
- Deeper docs override only for domain-specific behavior.
- If guidance conflicts between files, pause and resolve before editing.

## Architecture-first bootstrap
- Read `.diagram/manifest.json` and `.diagram/architecture.mmd` before planning work.
- If `.diagram/manifest.json` is missing or stale, regenerate with `diagram analyze` or `npx --yes @brainwav/diagram analyze`.

## Command preflight
- Confirm binaries and paths before edits:
  - binary checks: `rg`, `fd`, `jq`.
  - required paths: `AGENTS.md`, `package.json`, `docs`, `scripts`.
- Use `scripts/codex-preflight.sh` for multi-step or path-sensitive workflows:
  - `bash -lc 'source scripts/codex-preflight.sh && preflight_repo'`
  - `bash -lc 'source scripts/codex-preflight.sh && preflight_js'`
  - `bash -lc 'source scripts/codex-preflight.sh && preflight_py'`
  - `bash -lc 'source scripts/codex-preflight.sh && preflight_rust'`

## Task route map
- development and local execution commands: `docs/agents/development.md`
- testing and validation: `docs/agents/testing.md`
- tauri runtime and capability surfaces: `docs/agents/tauri.md`
- project structure and ownership checks: `docs/agents/repo-structure.md`
- frontend landing-page-only workflows: `docs/agents/landing-page-separation.md`, `docs/agents/frontend-website-rules.md`
- agentation payload and webhook workflows: `docs/agents/agentation-schema.md`
- repair and operations playbooks: `docs/agents/repair-agent.md`
- rollout and hybrid-capture runbooks: `docs/agents/hybrid-capture-rollout-runbook.md`
- instruction cleanup and contradictions: `docs/agents/instruction-governance.md`

## Contradictions and cleanup
- Open: none.
- Resolved and tracked items are maintained in `docs/agents/instruction-governance.md` and must be revisited before adding duplicate guidance.

## Validation notes
- Before documenting command guidance, confirm the command exists in `package.json` scripts, script files, or docs.
- Keep root file minimal; push long-running and domain-specific policy to linked docs.
- Treat unresolved contradictions as blocking until resolved.
