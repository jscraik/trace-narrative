# Documentation Index

This directory contains developer documentation and operational notes for the Narrative desktop application.

## Audience

- Contributors and maintainers running, testing, or releasing the app.
- Users looking for advanced configuration details.

## Contents

- [`AGENTS.md` (root)](../AGENTS.md) — Operator checklist and links to instruction categories.
- [`docs/agents/frontend-website-rules.md`](agents/frontend-website-rules.md) — Frontend website workflow for landing-page/web-only builds, screenshot rules, and visual matching guardrails.
- [`docs/agents/development.md`](agents/development.md) — Prerequisites, running locally, and build commands.
- [`docs/agents/testing.md`](agents/testing.md) — Testing, type-checking, and linting.
- [`docs/agents/tauri.md`](agents/tauri.md) — Tauri permissions and data locations.
- [`docs/agents/repo-structure.md`](agents/repo-structure.md) — Overview of the codebase layout.
- [`docs/agents/landing-page-separation.md`](agents/landing-page-separation.md) — Separation boundary notes for standalone landing-page work and in-app UI work.
- [`docs/agents/repair-agent.md`](agents/repair-agent.md) — Workflow for the autonomous CI repair agent.
- [`docs/agents/hybrid-capture-rollout-runbook.md`](agents/hybrid-capture-rollout-runbook.md) — Release and fallback operations for hybrid capture reliability.
- [`docs/agents/instruction-governance.md`](agents/instruction-governance.md) — Contradictions and cleanup candidates for instruction files.
- [`docs/agents/agentation-schema.md`](agents/agentation-schema.md) — Webhook payload schema reference for Agentation workflows.
- [`docs/solutions/`](solutions/) — Solved-problem writeups for recurring debugging and reliability incidents.
- [`docs/solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md`](solutions/integration-issues/codex-app-server-claude-otel-stream-reliability-auth-migration-hardening.md) — Codex App Server + Claude OTEL hybrid capture reliability remediation.
- `docs/assets/screenshots/` — Visual assets for documentation (landing, dashboard, repo views).
- `docs/reports/` — Audit and post-merge review reports.


## Agentation Quick Start

- Package setup (repo-local):
  - `agentation` is pinned in `devDependencies`.
  - `dialkit` is pinned in `dependencies`.

Quick local startup sequence:

```bash
# one-time env setup
cp .env.agentation.example .env.local

# start Agentation stack (MCP + webhook listener)
pnpm agentation:dev

# start Tauri app with dev tools
pnpm tauri:dev
```

If the Agentation panel shows an empty websocket URL on startup, open `/Users/jamiecraik/dev/agent-skills/frontend/agentation/SKILL.md` for the integration workflow and verify the `webhookUrl` defaults to `http://localhost:8787`.

## Documentation Checks

To verify documentation locally:

```bash
# Run the project docs lint wrapper (skips Vale when unavailable)
pnpm docs:lint

# Lint markdown files
npx -y markdownlint-cli2 README.md docs/**/*.md brand/README.md

# Check writing style (if configured)
vale --minAlertLevel=warning README.md docs/README.md docs/agents/*.md
```

## Maintenance

- Update this index when adding new documentation pages.
- Keep screenshots in `docs/assets/screenshots/` up-to-date as the UI evolves.

## Meta

- **Last updated**: 2026-02-20
