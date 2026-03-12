# Design System Guidance

## Table of Contents

- [Purpose](#purpose)
- [Package Policy](#package-policy)
- [Local Commands](#local-commands)
- [Current Enforcement Scope](#current-enforcement-scope)
- [Expansion Rules](#expansion-rules)

## Purpose

Trace Narrative uses `@brainwav/design-system-guidance` as the canonical design-system policy checker for this repository.

The package gives us one repeatable place to enforce:

- required design-system docs
- Table of Contents hygiene for key docs
- deprecation pressure on old icon imports
- a fail-fast check for raw hex colors and raw pixel literals inside the scoped UI surface

## Package Policy

- Jamie's enforced package is `@brainwav/design-system-guidance`.
- The CLI may be installed globally for workstation use, but this repo also keeps it in `devDependencies` so local setup, CI, and Codex runs stay reproducible.
- `pnpm check` includes the CI-mode design guidance gate.

## Local Commands

```bash
pnpm design-guidance
pnpm design-guidance:ci
pnpm design-guidance:init
```

- `pnpm design-guidance` reports violations without failing the shell.
- `pnpm design-guidance:ci` fails on warnings and errors and is the enforcement path used by this repo.
- `pnpm design-guidance:init` is kept for recovery if the config file is ever removed and needs to be regenerated before tailoring.

## Current Enforcement Scope

Phase 1 is intentionally narrow so the package is useful immediately instead of becoming a noisy legacy audit.

- Docs:
  - [VISION.md](/Users/jamiecraik/dev/trace-narrative/VISION.md)
  - [docs/design-system-guidance.md](/Users/jamiecraik/dev/trace-narrative/docs/design-system-guidance.md)
  - [docs/design-system-local-tarball-workflow.md](/Users/jamiecraik/dev/trace-narrative/docs/design-system-local-tarball-workflow.md)
- Source scan:
  - `src/ui/views`
  - `src/ui/components`
  - `src/App.tsx`
  - `src/AppContent.tsx`
  - `src/main.tsx`

This scope protects the narrative-facing shell copy, screen composition work, the full `src/ui/components` surface, and the app-shell entrypoints that mount and route the live experience. That includes the dashboard evidence widgets, story anchors, right-panel workflows, session excerpt support components, auto-ingest setup, repo evidence panels, docs overview rendering, Atlas search inspection, attribution badges, transcript rendering, trust-state recovery affordances, and the rest of the live shell components without needing a brittle file-by-file allowlist.

The next nearest presentation-oriented surfaces outside this scope are `src/styles` and `src/assets`. We audited them before this expansion and intentionally deferred them because they are a separate, noisier design-system debt lane than the app shell entrypoints.

## Expansion Rules

- Expand `include` only after the next directory or explicit file batch can pass `pnpm design-guidance:ci` cleanly.
- Prefer widening enforcement one directory at a time, or a tightly related root-file batch when the remaining debt sits outside scoped folders.
- When a directory or file batch is added to scope, clear the existing raw `px` and raw hex debt in the same change or an immediately preceding change.
