# Trace Shell Redesign Brief

## Table of Contents

- [Goal](#goal)
- [Constraints](#constraints)
- [New Information Architecture](#new-information-architecture)
- [Screen Direction](#screen-direction)
- [Phase 1 Deliverables](#phase-1-deliverables)
- [Deferred Work](#deferred-work)

## Goal

Redesign the Trace Narrative shell so it keeps the strong desktop layout and calm operator tone, while becoming clearly about narrative evidence rather than generic AI monitoring.

## Constraints

- Keep the sidepanel layout.
- Keep the Hygiene view.
- Keep the Settings dashboard.
- Avoid blatant visual or structural plagiarism of Readout.
- Make the current phase Codex-first.
- Use real signals where possible; do not invent certainty.

## New Information Architecture

The shell keeps its six grouped columns of meaning, but the labels become product-specific.

- `Narrative`: story framing and explanation surfaces
- `Evidence`: sessions, live capture, transcripts, tools, costs, causal timeline
- `Workspace`: repo evidence, diffs, snapshots, worktrees, attribution
- `Integrations`: skills, agents, memory, hooks, setup, ports
- `Health`: hygiene, dependency watch, env hygiene, trust center
- `Configure`: docs and settings

## Screen Direction

### Narrative Brief

The landing screen should feel like a branch brief, not a KPI wall.

Required content:

- a narrative headline grounded in the selected repo and time window
- a short evidence summary using real stats
- an explicit next move
- metrics that describe commits, attribution, evidence volume, and primary tool
- quick actions that privilege repo evidence, Codex session import, and hygiene review

### Repo Evidence

Repo stays the primary deep-reading surface.

Direction:

- emphasize commit-linked files and evidence trails
- make cockpit actions drop into repo evidence cleanly
- treat repo mode as the place where claims are verified

### Story Map

This remains a high-level workspace navigator.

Direction:

- show which repos deserve attention
- avoid turning into a generic org chart
- keep the language about story pressure, drift, and next move

### Codex Copilot

Assistant should be framed as a guided narrative copilot, not a provider switchboard.

Direction:

- Codex-first copy
- suggested asks tied to evidence
- safe action framing
- provider expansion positioned as later, explicit work

### Evidence Views

`Live Capture`, `Sessions`, `Transcript Lens`, `Tool Pulse`, `Cost Watch`, and `Causal Timeline` should collectively answer how evidence enters and supports the narrative.

Direction:

- distinguish observed capture from inferred summaries
- use trust cues consistently
- keep costs and tooling secondary to evidence usefulness

### Hygiene

Keep this as a signature operational view.

Direction:

- cautious language
- explicit blast-radius framing
- cleanup suggestions that feel safe and reversible

### Settings

Keep this as a serious dashboard, but clarify that it controls the operator contract.

Direction:

- Codex-first source posture
- scan scope clarity
- budget and trust settings visible
- no vague provider sprawl in the primary copy

### Docs

Docs should reinforce the current product identity and remove stale naming drift.

Direction:

- no Firefly naming
- frame docs as operational guidance for Trace Narrative
- support the Codex-first rollout story

## Phase 1 Deliverables

- rename the shell taxonomy
- replace dashboard greeting with a narrative brief
- remove fake dashboard metrics
- make quick actions Codex-first
- align assistant/settings copy with Codex-first rollout
- add a vision document to prevent future shell drift

## Deferred Work

- bespoke signature visualization for provenance and causality
- provider-expansion UX beyond Codex
- deeper repo/docs onboarding states
- broader shell and landing-page visual system cleanup
EOF

cat > docs/reports/2026-03-11-shell-audit.md <<'"'"'EOF'"'"'
# Shell Audit 2026-03-11

## Table of Contents

- [Summary](#summary)
- [File Audit](#file-audit)
- [Priority Order](#priority-order)

## Summary

The current shell has solid structure, but its labels and dashboard framing drift toward a generic reference dashboard. The immediate correction is to preserve layout while changing taxonomy, copy, and first-impression screens to emphasize narrative evidence.

## File Audit

### /Users/jamiecraik/dev/trace-narrative/src/ui/components/Sidebar.tsx

Change first:

- rename section headers from `Overview/Monitor/Ecosystem/Config` to `Narrative/Evidence/Integrations/Configure`
- rename primary entries to `Narrative Brief`, `Story Map`, `Codex Copilot`, `Live Capture`, `Causal Timeline`, `Repo Evidence`, `Hygiene`
- keep the physical layout unchanged

### /Users/jamiecraik/dev/trace-narrative/src/ui/components/TopNav.tsx

Change first:

- keep the three-tab anchor model
- rename `Cockpit` to `Narrative`
- replace duplicate product branding with lightweight surface context copy

### /Users/jamiecraik/dev/trace-narrative/src/ui/views/DashboardView.tsx

Change first:

- replace the generic greeting with a narrative brief
- add a real evidence summary using repo stats
- point the user toward repo evidence, Codex session import, and hygiene review

### /Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/MetricsGrid.tsx

Change first:

- remove fake `Linked Sessions` and `System Health`
- use real metrics only
- replace reference-app comments with Trace-specific language

### /Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/QuickActions.tsx

Change first:

- remove generic AI-dashboard actions
- use `Open Repo Evidence`, `Import Codex Session`, and `Review Hygiene`

### /Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/RecentActivity.tsx

Change first:

- rename to `Evidence Trail`
- make the CTA open repo trail rather than generic activity

### /Users/jamiecraik/dev/trace-narrative/src/ui/components/dashboard/TopFilesTable.tsx

Change first:

- reposition as evidence-ranked files rather than generic AI leaderboard

### /Users/jamiecraik/dev/trace-narrative/src/ui/views/DocsView.tsx

Change first:

- remove stale `Firefly Narrative` copy
- keep docs aligned with Trace Narrative naming

### /Users/jamiecraik/dev/trace-narrative/src/ui/views/cockpitViewData.ts

Change first:

- align section labels with the new IA
- make assistant copy explicitly Codex-first
- update settings copy to avoid provider sprawl
- keep Hygiene and Settings behaviorally intact

### /Users/jamiecraik/dev/trace-narrative/src/core/types.ts

Change first:

- update `ViewSection` to the new taxonomy so UI and tests share one contract

### /Users/jamiecraik/dev/trace-narrative/src/ui/components/__tests__/Sidebar.test.tsx
### /Users/jamiecraik/dev/trace-narrative/src/ui/components/__tests__/TopNav.test.tsx

Change first:

- update expected labels and section headers to match the shell redesign
- preserve the anchor-mode navigation contract

## Priority Order

1. Shell taxonomy and dashboard framing
2. Codex-first copy in assistant/settings/dashboard empty states
3. Test updates for the new contract
4. Deeper provider-expansion and signature visualization work
EOF

cat > docs/agents/mode-registry.md <<'"'"'EOF'"'"'
# Mode Registry

## Table of Contents

- [Mode Map](#mode-map)
- [Contract Status](#contract-status)
- [Current Product Posture](#current-product-posture)

## Mode Map

This registry tracks the mapping between `Mode` values and their view family and section in the redesigned Trace Narrative shell.

| Mode | Family | Section | Current label |
| :--- | :--- | :--- | :--- |
| `dashboard` | Anchor | Narrative | Narrative Brief |
| `work-graph` | Cockpit | Narrative | Story Map |
| `assistant` | Cockpit | Narrative | Codex Copilot |
| `live` | Cockpit | Evidence | Live Capture |
| `sessions` | Cockpit | Evidence | Sessions |
| `transcripts` | Cockpit | Evidence | Transcript Lens |
| `tools` | Cockpit | Evidence | Tool Pulse |
| `costs` | Cockpit | Evidence | Cost Watch |
| `timeline` | Cockpit | Evidence | Causal Timeline |
| `repo` | Anchor | Workspace | Repo Evidence |
| `repo-pulse` | Cockpit | Workspace | Workspace Pulse |
| `diffs` | Cockpit | Workspace | Diff Review |
| `snapshots` | Cockpit | Workspace | Checkpoints |
| `worktrees` | Cockpit | Workspace | Worktrees |
| `attribution` | Cockpit | Workspace | Attribution Lens |
| `skills` | Cockpit | Integrations | Codex Skills |
| `agents` | Cockpit | Integrations | Agent Roles |
| `memory` | Cockpit | Integrations | Memory Graph |
| `hooks` | Cockpit | Integrations | Hooks |
| `setup` | Cockpit | Integrations | Setup |
| `ports` | Cockpit | Integrations | Ports |
| `hygiene` | Cockpit | Health | Hygiene |
| `deps` | Cockpit | Health | Dependency Watch |
| `env` | Cockpit | Health | Env Hygiene |
| `status` | Cockpit | Health | Trust Center |
| `docs` | Anchor | Configure | Docs |
| `settings` | Cockpit | Configure | Settings |

## Contract Status

- [x] Anchor-mode shell preserved
- [x] Section taxonomy updated to narrative-first labels
- [x] Hygiene and Settings retained as first-class views
- [ ] Signature provenance visualization added
- [ ] Multi-provider shell expansion after Codex-first stabilization

## Current Product Posture

The shell is currently Codex-first.

That means:

- the dashboard and assistant copy should privilege Codex workflows
- other providers may still exist in the system, but they are not the primary shell story yet
- future provider expansion should happen after the Codex narrative flow is clearly trustworthy
EOF'