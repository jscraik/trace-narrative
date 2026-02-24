---
title: "feat: Firefly Signal System — ambient commit graph indicator"
type: feat
date: 2026-02-17
status: superseded
superseded_by: /Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-visual-system-v1-plan.md
---

# Firefly Signal System

> **Status:** Superseded. Use `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-visual-system-v1-plan.md` as the canonical Firefly plan.

## Overview

An **ambient UI instrument** that provides persistent, non-intrusive feedback about system state in the commit graph. Functions like a status LED on professional equipment: always visible but only demands attention when something meaningful happens.

The firefly lives as an overlay on the Timeline component, anchoring to the selected commit and responding to analysis events (insights, anomalies, loading states) with subtle motion and glow changes.

## Problem Statement / Motivation

Narrative processes complex data — commit attribution, trace correlation, dashboard analytics — but lacks ambient feedback about what's happening "under the hood." Users don't know when:
- Analysis is running
- New insights are available
- Anomalies are detected in commit patterns
- Sessions are auto-linked to commits

Current UI uses explicit banners and toasts (e.g., `IngestToast`, `ImportErrorBanner`) which are interruptive. An ambient signal provides status awareness without cognitive overhead.

## Proposed Solution

A **FireflySignal** component rendered as a portal overlay in `App.tsx`, positioned absolutely over the Timeline. It tracks the selected commit's DOM position and animates between states based on application events.

### Core Primitives

1. **Core Node** — 8–12px glowing orb, always anchored to active commit
2. **Pulse Ring** — Event-driven ring animation on state changes
3. **Trail** — Temporary connection line for thread highlighting
4. **Thread Highlight** — Sequential edge illumination (BFS-style propagation)

### State Machine

| State | Visual | Trigger |
|-------|--------|---------|
| **Idle** | Faint breathe (6–10s cycle, 0.35–0.55 opacity) | Default, no activity |
| **Tracking** | Glides to selected commit | `selectedNodeId` changes |
| **Analyzing** | Glow tightens, micro-pulse | Dashboard loading, trace ingestion |
| **Insight** | Pulse ring → thread illumination | Analysis complete, pattern found |
| **Anomaly** | Sharp pulse, graph dims 300–600ms | Rule violation, discontinuity detected |
| **Offline** | Dim neutral dot, no motion | Analysis engine unavailable |

## Technical Considerations

### Positioning Strategy

**Challenge:** Timeline uses horizontal scroll (`overflow-x-auto`). Firefly must track node positions across scroll boundaries.

**Approach:**
1. `Timeline` exposes `getNodePosition(nodeId: string): DOMRect | null` via ref
2. `FireflySignal` receives `selectedNodeId` and `timelineRef`
3. On animation frame, compute relative position: `nodeRect.left - containerRect.left`
4. Apply as CSS `transform: translate(x, y)` for GPU acceleration

**Fallback:** If node off-screen, firefly parks at nearest visible edge with "off-screen" indicator (small arrow).

### Animation Discipline

Following existing patterns (`pulseCommitId` in BranchView):
- Animate only: `transform`, `opacity`, `filter` (sparingly)
- Use CSS variables for theme-aware colors (glow effects)
- `pointer-events: none` — never blocks interactions
- Respect `prefers-reduced-motion` (skip breathe, instant state changes)

**Timing constants:**
- Idle breathe: 6–10s cycle
- Pulse ring: 250–450ms
- Thread highlight: 900–1600ms
- Tracking glide: 300–400ms ease-out

### Event Sources

| Firefly State | Event Source | Data Flow |
|---------------|--------------|-----------|
| Tracking | `BranchView` → `selectedNodeId` | Passed as prop |
| Analyzing | `useCommitData` loading states | New: `isLoadingAnalysis` |
| Insight | Dashboard completion, trace correlation | New: `insightEvent` emitter |
| Anomaly | Rules engine violations | New: `anomalyDetected` event |

### Settings Persistence

Use Tauri config (not localStorage) for cross-session consistency:

```rust
// src-tauri/src/config.rs
pub struct UiSettings {
    pub show_firefly_signal: bool,      // default: true
    pub firefly_intensity: String,      // "low" | "medium" | "high", default: "medium"
}
```

Expose via Tauri command:
```typescript
// src/core/tauri/settings.ts
invoke('get_ui_settings'): Promise<UiSettings>
invoke('update_ui_settings', { settings: UiSettings }): Promise<void>
```

## Acceptance Criteria

### Phase 1: Passive Indicator
- [ ] Firefly renders as 8px glowing dot anchored to selected commit
- [ ] Idle state: subtle breathe animation (CSS keyframes)
- [ ] Tracking state: smoothly glides when selection changes
- [ ] Respects `prefers-reduced-motion` (disables breathe, instant tracking)
- [ ] User can disable via settings toggle

### Phase 2: Insight Pulse
- [ ] Pulse ring animation on insight events
- [ ] Thread highlight illuminates relevant commit edges
- [ ] Queue/debounce rapid successive events
- [ ] Analyzing state shows during dashboard loading

### Phase 3: Thread Illumination
- [ ] BFS-style edge propagation animation
- [ ] Graph dimming during anomaly state
- [ ] Off-screen indicator when target node not visible

### Quality Gates
- [ ] No layout shift during animations
- [ ] 60fps on scroll + tracking
- [ ] Settings persist across app restarts
- [ ] Keyboard navigation unchanged (firefly is decorative)

## Success Metrics

- **Adoption:** Settings default remains enabled (opt-out rate < 10%)
- **Performance:** No dropped frames during scroll + animation
- **Clarity:** Users can identify firefly state without explanation (informal test)

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Position tracking performance | Use `transform`, read layout only on commit change, not every frame |
| Z-index conflicts with modals | Render in separate portal at root level |
| Visual clutter complaints | Keep defaults subtle, provide disable toggle |
| Timeline refactors break positioning | Expose stable API (`getNodePosition`), test in CI |

## Implementation Plan

### Phase 1: Foundation
1. Create `FireflySignal.tsx` component with Idle + Tracking states
2. Add `timelineRef` to `Timeline` component exposing `getNodePosition`
3. Wire up in `App.tsx` with `selectedNodeId` from `BranchView` context
4. Add CSS keyframes for breathe and glide animations

### Phase 2: Event Integration
1. Add `insightEvent` emitter to dashboard data fetch completion
2. Add `anomalyDetected` emitter to rules engine
3. Extend `FireflySignal` with Analyzing, Insight, Anomaly states
4. Implement pulse ring and thread highlight animations

### Phase 3: Polish
1. Add Tauri config for settings persistence
2. Create settings UI toggle in `RightPanelTabs`
3. Add off-screen indicator for scrolled-out nodes
4. Performance audit and optimization

## References & Research

### Internal Patterns
- `src/ui/views/BranchView.tsx:43-56` — `pulseCommitId` animation pattern
- `src/ui/components/Timeline.tsx` — Timeline scroll container structure
- `src/ui/components/TimelineNode.tsx` — Node positioning reference target
- `src/core/types.ts:85-101` — `TimelineNode` type definitions

### Brainstorm Document
- `docs/brainstorms/2026-02-17-firefly-signal-brainstorm.md` — Full state machine, visual spec, and design rationale

### External Resources
- [ prefers-reduced-motion MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [CSS Containment for Performance](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)

## Open Questions

1. **Event emission:** Should we use a simple EventEmitter pattern, or integrate with existing React context/state?
2. **Thread highlighting:** Does the current Timeline component expose edge/path data for BFS-style illumination, or do we need to compute from node positions?
3. **Off-screen behavior:** When insight fires for off-screen commit, should we auto-scroll to it or show an indicator that lets users decide?

---

*Plan generated from brainstorm: docs/brainstorms/2026-02-17-firefly-signal-brainstorm.md*
