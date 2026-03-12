# Trace Narrative UI Regression Audit

## Table of Contents

- [Purpose](#purpose)
- [Bottom Line](#bottom-line)
- [Structural Findings](#structural-findings)
- [Screen Audit](#screen-audit)
- [What We Keep](#what-we-keep)
- [What We Change First](#what-we-change-first)
- [Implementation Direction](#implementation-direction)

## Purpose

This audit records why the current Trace Narrative UI still feels weaker than the Readout reference bar, even after shell-copy and sidebar improvements.

The goal is not to copy Readout. The goal is to identify where Trace Narrative is currently too generic, too repetitive, or too weakly differentiated to feel like a serious evidence workstation.

## Bottom Line

The current implementation is a regression against the intended quality bar.

The main issue is not polish alone. The bigger issue is that too many destinations still render as variants of one shared surface, so the information architecture promises more product depth than the screens actually deliver.

## Structural Findings

- Only a small number of routes feel genuinely distinct today: `dashboard`, `repo`, and `docs`.
- Most remaining modes still inherit the same hero, metric, highlight, activity, and table scaffold through the shared narrative surface contract.
- The shell labels are now more Trace-native than before, but the bodies behind many labels are still too similar.
- This creates a product-shape mismatch: the sidebar suggests many specific tools, while the content still feels like one generalized operator template.
- The result is a perceived regression even when copy quality improves, because the UI now exposes the sameness more clearly.

## Screen Audit

### Narrative Brief

- Status: partially improved, still underpowered.
- Strength: now has a distinct dashboard route and real stats.
- Weakness: it still risks reading like a KPI summary instead of a narrative brief unless the first screen explicitly answers change, evidence, uncertainty, and next step.
- Direction: keep this as a dedicated anchor view and keep strengthening the narrative framing.

### Repo Evidence

- Status: strongest screen in the app.
- Strength: distinct layout, denser interaction model, real evidence-reading posture.
- Weakness: visual system could still be refined, but the product shape is correct.
- Direction: keep as the primary verification surface.

### Docs

- Status: acceptable utility surface, not a differentiator.
- Strength: dedicated route and clear runtime handling.
- Weakness: does not currently reinforce the main product identity strongly.
- Direction: keep functional and aligned, but do not treat as the signature experience.

### Story Map

- Status: materially improved, still worth refining.
- Strength: now has a dedicated topology-oriented layout with prioritization, movement, and provenance instead of living entirely inside the shared surface scaffold.
- Weakness: the topology model is still early and should become more spatial and interactive over time.
- Direction: keep strengthening it as the narrative-prioritization surface rather than collapsing it back into a generic summary page.

### Codex Copilot

- Status: folded into stronger surfaces.
- Strength: the useful Codex-first prompts now live closer to proof and trust posture.
- Weakness: a real guided workspace still does not exist, so this should not return as a standalone route by inertia.
- Direction: keep guided asks inside `Narrative Brief` and `Repo Evidence` until a genuinely distinct copilot workflow earns its own screen.

### Evidence Views

- Status: mixed, improving.
- Strength: the taxonomy is sensible.
- Weakness: `Tool Pulse` and `Cost Watch` still feel too structurally similar.
- Direction: keep `Tool Pulse` and `Cost Watch` demoted, while `Causal Timeline` now earns a dedicated screen by owning one clear job: sequence, session joins, evidence citations, and trust gating in one causal-analysis workflow.

### Transcript Lens

- Status: materially improved.
- Strength: now has a dedicated search-and-verification layout centered on query patterns, source coverage, and trust-aware follow-through.
- Weakness: the actual search interaction model is still implied rather than fully interactive.
- Direction: keep it as a dedicated evidence surface and deepen the real search mechanics later.

### Hygiene

- Status: keep.
- Strength: already reads like a real operator surface and fits the product well.
- Weakness: needs continued polish, not reinvention.
- Direction: preserve and use as a standard for seriousness.

### Trust Center

- Status: regression before this audit pass.
- Strength: the product idea is strong.
- Weakness: it was still trapped inside the shared template, which made a critical trust surface feel generic.
- Direction: make it a dedicated signature screen with a clear trust decision flow.

### Settings

- Status: keep.
- Strength: already feels like a serious control surface.
- Weakness: some copy and section emphasis can still be tightened.
- Direction: preserve structure and continue Codex-first enforcement.

## What We Keep

- The left sidepanel layout.
- The calm desktop shell posture.
- Hygiene as a first-class surface.
- Settings as a serious operator dashboard.
- Repo Evidence as the place where claims are verified.

## What We Change First

- Reduce the gap between navigation promise and screen distinctiveness.
- Treat `Narrative Brief`, `Repo Evidence`, and `Trust Center` as the first signature surfaces.
- Extend that dedicated-surface treatment into `Live Capture`, `Sessions`, and `Story Map` once their jobs are clear enough to justify distinct layouts.
- Stop letting critical product-defining views feel like variants of one generic content scaffold.
- Demote, fold, or defer lower-value surfaces until they earn distinct structure.

## Implementation Direction

- Strengthen `Narrative Brief` so it always answers: what changed, what supports that read, what is uncertain, and what to inspect next.
- Keep `Repo Evidence` as the dense verification lane rather than trying to flatten it to match other screens.
- Replace the generic `Trust Center` structure with a dedicated trust-decision layout.
- Keep `Hygiene` and `Settings` stable while the product-facing signature surfaces are repaired.
- Treat the remaining shared-surface views as secondary until the app has a stronger core shape.
