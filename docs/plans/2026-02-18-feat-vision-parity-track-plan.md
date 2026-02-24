---
title: Vision Parity Track — Narrative-First Progressive Disclosure
type: feat
date: 2026-02-18
status: draft
brainstorm: "/Users/jamiecraik/dev/narrative/docs/brainstorms/2026-02-18-vision-alignment-brainstorm.md"
---

# Vision Parity Track Plan

## Table of Contents

- [Enhancement Summary](#enhancement-summary)
- [Goal](#goal)
- [Scope](#scope)
- [Phasing (Written Now, Implemented in Phases)](#phasing-written-now-implemented-in-phases)
- [Parity Map](#parity-map)
- [Out of Scope (Phase 1)](#out-of-scope-phase-1)
- [Success Criteria](#success-criteria)
- [Dependency Graph](#dependency-graph)
- [Task Breakdown](#task-breakdown)
- [React Architecture / State / Routing Optimizations](#react-architecture--state--routing-optimizations)
- [Execution-Loop Contracts](#execution-loop-contracts)
- [UX Flow Critique](#ux-flow-critique)
- [Security and Safety Guardrails](#security-and-safety-guardrails)
- [Validation Plan](#validation-plan)
- [Risks and Mitigations](#risks-and-mitigations)
- [References](#references)

## Enhancement Summary

**Deepened on:** 2026-02-18  
**Sections enhanced:** 13  
**Skill/research agents used:** agent-native-architecture, frontend-ui-design, react-ui-patterns, security-best-practices, product-design-review, llm-design-review, Context7 (React docs)  
**Learnings scan:** no `docs/solutions/**/*.md` learnings found to apply

### Key Improvements
1. Added parity mapping and explicit execution-loop contracts so agent and UI paths stay aligned.
2. Elevated security/privacy from general mitigation to enforceable task and rollout gates.
3. Expanded UX and accessibility criteria for stakeholder-specific progressive disclosure.

### New Considerations Discovered
- Narrative claims must be evidence-linked and confidence-calibrated to avoid overconfident summaries.
- Rollout needs explicit rollback/kill-switch criteria and auto-disable thresholds.

## Goal

Deliver the missing narrative abstraction layer so Narrative matches the original thesis: intent-first understanding, progressive disclosure by stakeholder level, and decision archaeology beyond raw diffs.

### Research Insights

- Treat parity as a product contract: each high-level narrative action must have a deterministic drill-down path to raw evidence.
- Keep the final UX trust model explicit: summary first, evidence second, raw diff always available.

## Scope (Phase 1 — Implement Now)

1. Branch-level narrative summary generated from sessions + diffs.
2. Deterministic highlight selection with explicit “why this mattered” text.
3. Single adaptive disclosure surface with a strict ladder: **Narrative summary → evidence snippets → session artifacts → raw diff**.
4. UI state completeness for v1: default/loading/empty/error/offline/permission.
5. Baseline safety controls: evidence links, confidence labels, global fallback path, and basic telemetry.

### Research Insights

- Disclosure must preserve context between levels (selected milestone/highlight should not reset on view switch).
- Motion and interaction should provide reduced-motion parity and keyboard-complete traversal.

## Phasing (Written Now, Implemented in Phases)

### Phase 1 (now)
- Core narrative composer + evidence ladder + raw diff fallback.
- Single adaptable UI surface (not three full stakeholder panel systems).
- Minimal quality/safety gates to validate usefulness quickly.

### Phase 2 (written now, implemented next)
- Stakeholder-specific projections (Executive/Manager/Engineer) as explicit view-model contracts.
- Decision archaeology panel with progressive chunking.
- GitHub metadata connector (opt-in, sanitized, redacted, keychain-backed auth boundary).

### Phase 3 (written now, hardening/scale)
- Expanded rollout governance (advanced rubric, kill-switch matrix, richer observability).
- Broader connector expansion and stricter confidence calibration loops.

## Parity Map

| User action | Current UI path | Agent/tool path | Gap severity | Owner task |
|---|---|---|---|---|
| Generate branch narrative | Branch View + timeline context | Narrative composer pipeline | High | T2 |
| Drill into evidence | Commit/session/file drilldowns | Evidence link resolver | High | T3 |
| Pin/unpin highlight | Limited manual controls | Highlight override loop | Medium | T2/T3 |
| Mark summary incorrect | Not explicit | Feedback + retry workflow | High | T4 (v1), T8 (advanced) |
| Re-run synthesis | Not explicit UX affordance | Recompute branch narrative | Medium | T2/T4 |
| Open raw diff fallback | Existing diff panel | Explicit fallback CTA in all views | Medium | T3 |

## Out of Scope (Phase 1)

- Slack/Email/Meeting ingestion.
- Shared backend or org-wide RBAC rollout.
- Full decision archaeology and connector expansion (documented in Phase 2+).
- Full semantic search redesign.

## Success Criteria

- Non-technical user can explain “what changed and why” on a branch within 2 minutes.
- At least 80% of branch summaries judged “useful” in internal review.
- Highlight ranking precision >70% for “meaningful session moments.”
- Phase 1 adaptive narrative view is readable without opening raw diffs.
- Phase 1 flow still supports full diff + trace depth.
- WCAG 2.2 AA compliance for all progressive disclosure states.
- Keyboard-only completion for top Phase 1 branch tasks; Phase 2 extends this to Executive/Manager/Engineer projections.
- Narrative interaction responsiveness: INP ≤ 200ms, CLS ≤ 0.1 on disclosure interactions.

### Research Insights

- Add trust calibration metrics: low-confidence narrative usage and fallback-to-evidence completion rate.
- Define “medium repo” benchmark fixture explicitly for the 1.5s generation target.

## Dependency Graph

### Phase 1 (implement now)
- T0: Narrative contract baseline (`depends_on: []`)
- T1: Narrative schema + evidence contracts (`depends_on: [T0]`)
- T1b: Schema versioning + migration strategy (`depends_on: [T1]`)
- T2: Narrative composer v1 (summary + deterministic highlights) (`depends_on: [T1b]`)
- T3: Progressive disclosure UI v1 (single adaptive panel + raw diff fallback) (`depends_on: [T2]`)
- T4: Minimal safety/quality gates (global flag + confidence fallback + baseline telemetry) (`depends_on: [T3]`)

### Phase 2 (written now, implemented next)
- T5: Stakeholder projection API (Executive/Manager/Engineer) (`depends_on: [T3, T4]`)
- T6: Decision archaeology panel (`depends_on: [T5]`)
- T7: GitHub metadata connector v1 (`depends_on: [T1b, T4]`)

### Phase 3 (written now, hardening)
- T8: Advanced rollout framework (rubric, kill-switch matrix, expanded observability) (`depends_on: [T5, T6, T7]`)

## Task Breakdown

### Phase 1 — Implement now

- [x] T0 — Narrative contract baseline
- [x] T1 — Narrative schema + evidence contracts
- [x] T1b — Schema versioning + migration strategy
- [x] T2 — Narrative composer v1
- [x] T3 — Progressive disclosure UI v1
- [x] T4 — Minimal safety/quality gates

#### T0 — Narrative contract baseline
Create parity matrix for narrative entities (summary, highlights, evidence links) and idempotency expectations.

#### T1 — Narrative schema + evidence contracts
Define canonical narrative entities and persistence strategy across local DB + `.narrative/` metadata.

**Research Insights**
- Require claim-level evidence references (`session_ids`, `commit_ids`, optional PR refs).
- Include confidence and abstain semantics in schema, not only UI.

#### T1b — Schema versioning + migration strategy
Define schema version fields, migration rules, and downgrade-safe behavior for local metadata and DB records.

#### T2 — Narrative composer v1
Build synthesis pipeline combining linked sessions, trace summaries, and commit stats into a concise branch story with deterministic highlight selection.

**Research Insights**
- Keep ranking simple in v1 (deterministic top-N + pin/unpin feedback).
- Prefer clear heuristic signals over opaque scoring early.

#### T3 — Progressive disclosure UI v1
Implement one adaptive branch narrative surface with explicit transitions from summary to evidence to raw diff.

**Research Insights**
- Preserve focus context between disclosure changes.
- Include reduced-motion parity and explicit low-confidence fallback CTA (“Show raw evidence”).

#### T4 — Minimal safety/quality gates
Add baseline feature flag, confidence fallback behavior, and essential telemetry (`layer_switched`, `evidence_opened`, `fallback_used`).

### Phase 2 — Written now, implemented next

- [x] T5 — Stakeholder projection API
- [x] T6 — Decision archaeology panel
- [x] T7 — GitHub metadata connector v1

#### T5 — Stakeholder projection API
Introduce explicit Executive/Manager/Engineer view-model projections over canonical narrative entities.

#### T6 — Decision archaeology panel
Expose “why built this way”: summarized intent, alternatives, tradeoffs, and linked evidence.

#### T7 — GitHub metadata connector v1
Ingest PR title/body/review summary metadata as optional context with strict sanitization and opt-in consent.

### Phase 3 — Written now, hardening

- [x] T8 — Advanced rollout framework

#### T8 — Advanced rollout framework
Add expanded quality rubric scoring, kill-switch matrix, and deeper observability/reporting loops.

## React Architecture / State / Routing Optimizations

### 1) Component architecture (phased disclosure rollout)

- **Phase 1:** ship one adaptive panel:
  - `BranchNarrativeShell` (orchestration + URL sync)
  - `BranchNarrativePanel` (summary/evidence/diff ladder)
- Keep `BranchView` focused on timeline + evidence plumbing; compose the narrative region as a child.
- **Phase 2:** split into stakeholder-specific panels only after v1 signal quality is proven:
  - `ExecutiveNarrativePanel`, `ManagerNarrativePanel`, `EngineerEvidencePanel`
  - Backed by projection selectors (`selectExecutiveNarrative`, etc.).

### 2) State ownership model (optimize for predictable updates)

- Add a single reducer-driven UI state for disclosure concerns:
  - `type DetailLevel = 'summary' | 'evidence' | 'diff'`
  - `type NarrativeFocus = { kind: 'summary' | 'highlight' | 'file'; id?: string }`
  - `useReducer` in `BranchNarrativeShell` for `detailLevel`, `focus`, `pinnedHighlightIds`, `showEvidence`.
- Keep ephemeral panel state local; persist only deep-linkable shared state.
- Use memoized selectors and `startTransition` for non-urgent disclosure switches.

### 3) Routing optimization

- Short-term URL state adapter for repo mode:
  - `?mode=repo&detail=evidence&focus=highlight:<id>&node=<sha>&file=<path>`
- Parse on load, serialize on interactions, preserve browser back/forward.

### 4) Anti-patterns to avoid

- Growing `BranchView` into a state-heavy god component.
- Duplicating narrative transformations per stakeholder panel.
- Deriving display state via effects where selectors are enough.
- Resetting focus/file context on every layer change.

## Execution-Loop Contracts

- **States (v1):** `running | ready | needs_attention | failed`
- **Stop condition:** `ready` only when summary + evidence links + confidence are present.
- **Retry behavior:** manual “Regenerate” for v1 (automatic retry policy deferred to later phase).
- **Fallback contract:** `needs_attention` must provide `reason` + direct path to raw evidence/diff.
- **Phase 2+ expansion:** resume tokens, richer blocked payloads, and automatic retry budgets.

## UX Flow Critique

- Add a default “Start here” narrative card: **What changed / Why / Risk**.
- Require confidence + evidence chips on summary/highlight cards.
- Preserve selected highlight/file context across disclosure changes (and across Executive/Manager/Engineer switches in Phase 2).
- Add low-cognitive-load decision snapshot before full archaeology expansion.
- Add first-run microcopy explaining progressive disclosure in one sentence.

## Security and Safety Guardrails

- Token boundary: GitHub auth tokens stored only in keychain; never in `.narrative/` or logs.
- Untrusted text boundary: sanitize and isolate external PR/review text before synthesis/render.
- Redaction gate: redact before write/index/summarize across TS + Rust paths.
- Retention model: classify raw metadata vs derived narrative artifacts and define purge semantics for both.
- Prompt/eval governance: version prompt templates, maintain golden rubric set, add adversarial prompt-injection checks.
  - Implemented in:
    - `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/promptGovernance.ts`
    - `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/composeBranchNarrative.ts` (`promptTemplate.id/version`)
    - `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/rolloutGovernance.ts` (`prompt_template_unversioned`, `prompt_injection_signal` rules)

## Validation Plan

- Unit tests for synthesis/highlight determinism.
- Integration tests for branch narrative generation on fixture repos.
- UX acceptance checks for the Phase 1 adaptive panel.
- Regression checks: existing timeline/diff/session flows remain intact.
- Performance budget: narrative generation under 1.5s for medium repos.
- Contract tests for v1 execution-loop state transitions (`running|ready|needs_attention|failed`).
- Accessibility checks: keyboard traversal, focus order, reduced-motion parity, contrast in all disclosure states.
- Security checks: malicious PR payload tests, redaction regression corpus, connector consent/revoke tests (Phase 2 gate before T7 release).
- Adversarial prompt checks: `/Users/jamiecraik/dev/firefly-narrative/src/core/narrative/__tests__/rolloutGovernance.test.ts` includes prompt-injection and missing-template governance tests.
- Rollback drills: verify global kill switch and fallback behavior.

## Risks and Mitigations

- **Risk:** Hallucinated summaries.
  - **Mitigation:** Evidence-linked outputs + confidence labels + fallback to raw data + abstain mode when evidence is weak.
- **Risk:** Over-complex UI.
  - **Mitigation:** Strict mode presets, chunked disclosure, stable context rails, first-run guidance.
- **Risk:** Signal noise in highlight ranking.
  - **Mitigation:** Weighted heuristics + manual pin/unpin + correction telemetry.
- **Risk:** Privacy concerns for external context.
  - **Mitigation:** Opt-in connector + redaction-before-write + retention/purge policy.
- **Risk:** Silent quality regression during rollout.
  - **Mitigation:** T4 baseline gates in Phase 1, then T8 advanced rubric + rollback criteria + expanded confidence monitoring in later phases.

## References

- [React `startTransition` and `useTransition` guidance](https://react.dev/reference/react/useTransition)
- [Tauri v2 security model and capabilities](https://v2.tauri.app/security/)
- [GitHub webhook security best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
