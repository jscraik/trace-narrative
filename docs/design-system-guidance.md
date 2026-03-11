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
  - `src/ui/components/dashboard`
  - `src/ui/components/story-anchors`
  - `src/ui/components/right-panel-tabs`
  - `src/ui/components/session-excerpts`
  - `src/ui/components/auto-ingest-setup`
  - root support files:
    - `src/ui/components/TopNav.tsx`
    - `src/ui/components/NarrativeGovernancePanel.tsx`
    - `src/ui/components/NeedsAttentionList.tsx`
    - `src/ui/components/GitHubConnectorPanel.tsx`
    - `src/ui/components/AgentTraceSummary.tsx`
    - `src/ui/components/SourceLensStats.tsx`
    - `src/ui/components/CaptureActivityStrip.tsx`
    - `src/ui/components/SessionExcerpts.tsx`
    - `src/ui/components/TelemetrySettingsPanel.tsx`
    - `src/ui/components/Select.tsx`
    - `src/ui/components/SourceLensEmptyStates.tsx`
    - `src/ui/components/StepsSummaryCard.tsx`
    - `src/ui/components/Timeline.tsx`
    - `src/ui/components/AttributionSettingsPanel.tsx`
    - `src/ui/components/BranchHeader.tsx`
    - `src/ui/components/Breadcrumb.tsx`
    - `src/ui/components/DiffViewer.tsx`
    - `src/ui/components/IngestStatusStrip.tsx`
    - `src/ui/components/SourceLensLineTable.tsx`
    - `src/ui/components/BranchSummaryBar.tsx`
    - `src/ui/components/DecisionArchaeologyPanel.tsx`
    - `src/ui/components/Dialog.tsx`
    - `src/ui/components/FireflyHero.stories.tsx`
    - `src/ui/components/AskWhyAnswerCard.tsx`
    - `src/ui/components/BadgePill.tsx`
    - `src/ui/components/TimelineNode.tsx`
    - `src/ui/components/FilesChanged.tsx`
    - `src/ui/components/RepositoryPlaceholderCard.tsx`
    - `src/ui/components/Sidebar.tsx`
    - `src/ui/components/SourceLensView.tsx`
    - `src/ui/components/StoryAnchorsPanel.tsx`

This scope protects the narrative-facing shell copy, screen composition work, the dashboard-specific evidence widgets, the story anchor surface that explains how traces connect into a readable narrative, the right-panel control surface that holds session, attribution, atlas, tests, and settings workflows, the session excerpt support components that make commit-to-session links legible, the auto-ingest setup surface that configures Codex-first capture reliability, and a growing root-level shell support batch around navigation, governance, attention states, GitHub context, AI trace summary, source-lens stats, capture activity, session evidence, telemetry settings, selector affordances, empty states, step summaries, timeline scaffolding, attribution controls, repo evidence headers, breadcrumbs, diff reading, ingestion status, source-lens line evidence, branch summaries, decision archaeology, dialog primitives, storybook-facing brand surfaces, ask-why analysis, timeline badges, timeline nodes, file-evidence lists, repo placeholder states, sidebar navigation, source-lens framing, and the story-anchors panel wrapper. We can expand it further once the rest of the component surface is cleaned up enough to keep the CI signal meaningful.

## Expansion Rules

- Expand `include` only after the next directory or explicit file batch can pass `pnpm design-guidance:ci` cleanly.
- Prefer widening enforcement one directory at a time, or a tightly related root-file batch when the remaining debt sits outside scoped folders.
- When a directory or file batch is added to scope, clear the existing raw `px` and raw hex debt in the same change or an immediately preceding change.
