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
  - `src/styles.css`
  - `src/styles/trace-signal.css`
  - `src/assets/icons` except:
    - `src/assets/icons/claude-color.svg`
    - `src/assets/icons/gemini-color.svg`
    - `src/assets/icons/kimi-color.svg`

This scope protects the narrative-facing shell copy, screen composition work, the full `src/ui/components` surface, the app-shell entrypoints that mount and route the live experience, the shared stylesheet layer that supports the shell identity, and the token-friendly SVG icon lane under `src/assets/icons`. That includes the dashboard evidence widgets, story anchors, right-panel workflows, session excerpt support components, auto-ingest setup, repo evidence panels, docs overview rendering, Atlas search inspection, attribution badges, transcript rendering, trust-state recovery affordances, the live motion, pill, glass, and trace-signal treatments, plus monochrome icons that already follow `currentColor`-based theming without needing a brittle file-by-file allowlist.

The remaining provider brand marks in `src/assets/icons` are intentionally out of scope for now. `claude-color.svg`, `gemini-color.svg`, and `kimi-color.svg` carry vendor-owned fills, gradients, and brand-color decisions, so we treat them as a brand-governance lane rather than forcing them through the generic raw-literal checker. By contrast, `ollama.svg` and `openai.svg` inherit `currentColor`, which matches current CSS theming guidance and makes them safe to enforce as part of the shared UI surface.

## Expansion Rules

- Expand `include` only after the next directory or explicit file batch can pass `pnpm design-guidance:ci` cleanly.
- Prefer widening enforcement one directory at a time, or a tightly related root-file batch when the remaining debt sits outside scoped folders.
- When a directory or file batch is added to scope, clear the existing raw `px` and raw hex debt in the same change or an immediately preceding change.
