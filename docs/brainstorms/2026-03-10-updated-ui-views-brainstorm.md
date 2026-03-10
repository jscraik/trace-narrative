---
date: 2026-03-10
topic: updated-ui-views
---

# Updated UI Views

## Table of Contents
- [What We Are Building](#what-we-are-building)
- [Why This Approach](#why-this-approach)
- [Approaches Considered](#approaches-considered)
- [Key Decisions](#key-decisions)
- [Non-Goals (v1)](#non-goals-v1)
- [Open Questions](#open-questions)
- [Next Steps](#next-steps)

## What We Are Building
An evidence-driven cockpit layer for Trace Narrative that turns the existing mode taxonomy into first-class UI views for:
`dashboard`, `work-graph`, `assistant`, `live`, `sessions`, `costs`, `timeline`, `attribution`, `settings`, and `status`.

The updated shell should feel broader and more operational, while still preserving Trace Narrative's differentiators:
1. explainable provenance
2. replay trust
3. safer remediation framing
4. narrative-first repo understanding

## Why This Approach
The current app already has the raw ingredients for a much richer operator experience: multiple latent modes, a narrative-first repo workspace, and an upgraded dashboard language. The missing piece is turning those pieces into a coherent control plane with distinct sections for monitoring, workspace state, costs, hygiene, and configuration.

Trace Narrative already has the beginnings of that architecture:
- a wide `Mode` union,
- a sidebar shell,
- an upgraded dashboard,
- and a strong repo narrative view.

The most leverage comes from promoting those latent modes into real views instead of overloading the dashboard with every job-to-be-done. This gives us a clearer information architecture while keeping implementation bounded and compatible with the current app shell.

## Approaches Considered
### A) Single Super-Dashboard
Keep everything inside `DashboardView` and add more cards, tables, and sections.

### B) Sectioned Cockpit Views (**selected**)
Use the existing mode taxonomy to create distinct operational views for monitor, workspace, config, and health while preserving the existing repo narrative experience.

### C) Full Feature-Complete Parity Push
Attempt to wire every cockpit view to real backend data and action flows in one pass.

## Key Decisions
- Primary recommendation: **Sectioned Cockpit Views**.
- Shell strategy: **reuse the existing sidebar + mode system rather than inventing a new router**.
- Differentiation strategy: **match breadth, but frame each view around trust, evidence, and safer actions**.
- Repo mode posture: **keep `repo` as the deep narrative/provenance workspace, not just another ops screen**.
- Delivery constraint: **ship reusable presentational views first; deeper data plumbing can follow per section**.

## Non-Goals (v1)
- No parity-driven replica work.
- No rewrite of repo mode or branch narrative internals.
- No backend ingestion or schema overhaul just to support the new shell.
- No expansion of destructive or auto-remediation behaviors.

## Open Questions
- Which cockpit sections should receive real live data next after the new views land?
- Should the assistant become a standalone conversation surface or remain a guided command center in this phase?

## Next Steps
1. Add a reusable cockpit view system for the expanded operator modes.
2. Wire the existing sidebar entries to those views.
3. Preserve `dashboard`, `repo`, and `docs` as anchor experiences.
4. Validate the shell with focused rendering tests plus full repo checks.
