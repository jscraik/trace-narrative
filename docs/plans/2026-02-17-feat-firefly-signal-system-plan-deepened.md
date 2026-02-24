---
title: "feat: Firefly Signal System — ambient commit graph indicator"
type: feat
date: 2026-02-17
enhanced: 2026-02-17
status: superseded
superseded_by: /Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-visual-system-v1-plan.md
---

# Firefly Signal System

> **Status:** Superseded. Use `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-visual-system-v1-plan.md` as the canonical Firefly plan.

## Enhancement Summary

**Deepened on:** 2026-02-17  
**Sections enhanced:** 6  
**Research agents used:** ui-ux-creative-coding skill, web search (animation performance, EventEmitter patterns, Tauri Store, React portals)

### Key Improvements
1. **Animation Performance** — Added `will-change`, `contain: layout paint`, and GPU layer promotion guidance
2. **Event System** — Recommended `eventemitter3` for zero-re-render event flow, with explicit cleanup patterns
3. **Tauri Settings** — Switched from custom Rust struct to `tauri-plugin-store` for simpler persistence
4. **Portal Implementation** — Added positioning strategy for `transform` stacking context handling
5. **CSS Architecture** — Added Tailwind v4 `@theme` integration for firefly tokens
6. **Timing Refinement** — Specific cubic-bezier curves based on motion research

### New Considerations Discovered
- `eventemitter3` provides ~2x faster event emission than Node's EventEmitter
- Tauri Store auto-saves on app close; manual `.save()` for immediate persistence
- CSS `contain: layout paint` isolates firefly animations from document layout
- React 19 Compiler may affect memoization needs (monitor after upgrade)

---

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

### Research Insights

**Motion is Communication (@emilkowalski):**
Each state change teaches the user something about system state. The idle breathe says "I'm here, watching." The pulse says "Something happened." The thread illumination says "Here's the pattern." If the motion doesn't teach, cut it.

**CSS-First Animation (@jh3yy):**
All animations should be achievable with CSS transforms and opacity. Avoid JavaScript-driven animation loops where possible — they're harder to optimize and break more easily.

---

## Technical Considerations

### Positioning Strategy

**Challenge:** Timeline uses horizontal scroll (`overflow-x-auto`). Firefly must track node positions across scroll boundaries without causing layout thrashing.

**Approach:**
1. `Timeline` exposes `getNodePosition(nodeId: string): { x: number; y: number } | null` via ref
2. `FireflySignal` receives `selectedNodeId` and `timelineRef`
3. On scroll/resize, compute relative position: `nodeRect.left - containerRect.left + container.scrollLeft`
4. Apply as CSS `transform: translate3d(x, y, 0)` for GPU acceleration

**Implementation Pattern:**
```typescript
// src/ui/components/Timeline.tsx
export interface TimelineRef {
  getNodePosition: (nodeId: string) => { x: number; y: number } | null;
}

export const Timeline = forwardRef<TimelineRef, TimelineProps>(
  ({ nodes, selectedId, onSelect }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useImperativeHandle(ref, () => ({
      getNodePosition: (nodeId: string) => {
        const node = nodeRefs.current.get(nodeId);
        const container = containerRef.current;
        if (!node || !container) return null;
        
        const nodeRect = node.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        return {
          x: nodeRect.left - containerRect.left + container.scrollLeft,
          y: nodeRect.top - containerRect.top,
        };
      },
    }));

    // ... render with ref callback for each node
  }
);
```

**Fallback:** If node off-screen, firefly parks at nearest visible edge with "off-screen" chevron indicator.

### Research Insights

**GPU Acceleration Best Practices:**
- Use `transform: translate3d(x, y, 0)` not `translate(x, y)` — forces GPU layer creation
- Add `will-change: transform` only during active animation, remove after to free GPU memory
- Apply `contain: layout paint` to firefly container to isolate from document layout
- Read layout metrics (`getBoundingClientRect`) only in measurement phase, never during animation

**Stacking Context Warning:**
Portals with `position: fixed` can be affected by ancestor `transform` properties. Firefly must use `position: absolute` relative to a stable container, or ensure no ancestor creates a containing block.

### Animation Discipline

Following existing patterns (`pulseCommitId` in BranchView) and CSS-first motion principles:

**Animate only:**
- `transform` (translate, scale)
- `opacity`
- `filter` (sparingly — box-shadow/glow only)

**Never animate:**
- `width`, `height`, `top`, `left` — causes layout thrashing
- `margin`, `padding`, `border-width`
- `box-shadow` spread directly (use pseudo-element with opacity instead)

**Timing Constants:**

| Animation | Duration | Easing | Notes |
|-----------|----------|--------|-------|
| Idle breathe | 8s | `ease-in-out` | CSS keyframe loop |
| Tracking glide | 350ms | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Ease-out-quad |
| Pulse ring | 350ms | `cubic-bezier(0.165, 0.84, 0.44, 1)` | Ease-out-quart |
| Thread highlight | 1200ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Material standard |
| Anomaly flash | 400ms | `cubic-bezier(0.4, 0, 1, 1)` | Ease-in |

**Implementation:**
```css
/* Tailwind v4 with @theme */
@theme {
  --ease-firefly-glide: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-firefly-pulse: cubic-bezier(0.165, 0.84, 0.44, 1);
  --duration-firefly-glide: 350ms;
  --duration-firefly-pulse: 350ms;
}

@keyframes firefly-breathe {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.05); }
}

.firefly-idle {
  animation: firefly-breathe 8s ease-in-out infinite;
}
```

### Accessibility

**`prefers-reduced-motion`:**
```css
@media (prefers-reduced-motion: reduce) {
  .firefly-idle {
    animation: none;
    opacity: 0.45; /* Static medium opacity */
  }
  
  .firefly-tracking {
    transition: none; /* Instant position change */
  }
}
```

**Screen Reader Considerations:**
- Firefly is decorative — add `aria-hidden="true"` to the container
- State changes should have complementary ARIA live regions for important events (insights, anomalies)
- Keyboard navigation unchanged — firefly does not receive focus

### Event Sources

| Firefly State | Event Source | Data Flow |
|---------------|--------------|-----------|
| Tracking | `BranchView` → `selectedNodeId` | Passed as prop |
| Analyzing | `useCommitData` loading states | New: `isLoadingAnalysis` |
| Insight | Dashboard completion, trace correlation | New: `insightEvent` emitter |
| Anomaly | Rules engine violations | New: `anomalyDetected` event |

### Research Insights

**EventEmitter vs Context:**
For firefly events that don't require re-rendering consuming components, use `eventemitter3` (lighter, faster than Node's EventEmitter):

```typescript
// src/core/events/fireflyEvents.ts
import { EventEmitter } from 'eventemitter3';

export interface FireflyEvents {
  insight: (data: { commitIds: string[]; type: string }) => void;
  anomaly: (data: { commitId: string; rule: string }) => void;
  analyzing: (isAnalyzing: boolean) => void;
}

export const fireflyEmitter = new EventEmitter<FireflyEvents>();

// Usage — no re-renders, just event emission
fireflyEmitter.emit('insight', { commitIds: ['abc123'], type: 'pattern-match' });

// Cleanup is critical
useEffect(() => {
  const handler = (data) => setInsight(data);
  fireflyEmitter.on('insight', handler);
  return () => { fireflyEmitter.off('insight', handler); };
}, []);
```

**Why not Context?**
Context causes re-renders of all consumers. Firefly events are transient (insights, anomalies) — they don't represent shared state that components need to react to. EventEmitter is the right primitive for "something happened" notifications.

**Event Queuing:**
For rapid successive events, implement a simple queue with visual debounce:

```typescript
const eventQueue = useRef<FireflyEvent[]>([]);
const isAnimating = useRef(false);

const processQueue = useCallback(() => {
  if (eventQueue.current.length === 0 || isAnimating.current) return;
  
  const next = eventQueue.current.shift();
  isAnimating.current = true;
  setState(next);
  
  setTimeout(() => {
    isAnimating.current = false;
    processQueue();
  }, 1200); // Wait for animation to complete
}, []);
```

### Settings Persistence

Use Tauri Store plugin (not custom Rust commands) for simple key-value persistence:

```typescript
// src/core/tauri/settings.ts
import { Store } from '@tauri-apps/plugin-store';

const store = await Store.load('settings.json');

export interface FireflySettings {
  showFirefly: boolean;
  intensity: 'low' | 'medium' | 'high';
}

export const getFireflySettings = async (): Promise<FireflySettings> => {
  const defaults: FireflySettings = { showFirefly: true, intensity: 'medium' };
  const stored = await store.get<FireflySettings>('firefly');
  return stored ?? defaults;
};

export const setFireflySettings = async (settings: FireflySettings): Promise<void> => {
  await store.set('firefly', settings);
  await store.save(); // Immediate persistence
};
```

**Why Tauri Store over localStorage?**
- Cross-platform consistency (Windows, macOS, Linux)
- Encrypted on some platforms
- Survives browser storage clearing
- Proper TypeScript support with schema validation

---

## Acceptance Criteria

### Phase 1: Passive Indicator
- [ ] Firefly renders as 8px glowing dot anchored to selected commit
- [ ] Idle state: subtle breathe animation (CSS keyframes)
- [ ] Tracking state: smoothly glides when selection changes
- [ ] Respects `prefers-reduced-motion` (disables breathe, instant tracking)
- [ ] User can disable via settings toggle
- [ ] 60fps maintained during scroll + tracking

### Phase 2: Insight Pulse
- [ ] Pulse ring animation on insight events
- [ ] Thread highlight illuminates relevant commit edges
- [ ] Queue/debounce rapid successive events
- [ ] Analyzing state shows during dashboard loading
- [ ] EventEmitter cleanup on unmount (no memory leaks)

### Phase 3: Thread Illumination
- [ ] BFS-style edge propagation animation
- [ ] Graph dimming during anomaly state
- [ ] Off-screen indicator when target node not visible
- [ ] Settings persist across app restarts (Tauri Store)

### Quality Gates
- [ ] No layout shift during animations
- [ ] 60fps on scroll + tracking (Chrome DevTools Performance)
- [ ] Settings persist across app restarts
- [ ] Keyboard navigation unchanged (firefly is decorative)
- [ ] Memory profile shows no leaks after 100 state changes
- [ ] Lighthouse "Avoid non-composited animations" passes

## Success Metrics

- **Adoption:** Settings default remains enabled (opt-out rate < 10%)
- **Performance:** No dropped frames during scroll + animation (target: 60fps)
- **Clarity:** Users can identify firefly state without explanation (informal test)
- **Memory:** < 5MB additional heap usage

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Position tracking performance | Use `transform: translate3d`, read layout only on commit change, apply `contain: layout paint` |
| Z-index conflicts with modals | Render in separate portal at root level, use `position: absolute` not `fixed` |
| Visual clutter complaints | Keep defaults subtle, provide disable toggle, respect `prefers-reduced-motion` |
| Timeline refactors break positioning | Expose stable API (`getNodePosition`), test in CI with visual regression |
| Memory leaks from EventEmitter | Strict cleanup pattern: always `off()` in useEffect cleanup |
| GPU memory pressure | Remove `will-change` after animation completes |

## Implementation Plan

### Phase 1: Foundation

**Files to create/modify:**
1. `src/ui/components/FireflySignal.tsx` — Core component with Idle + Tracking
2. `src/ui/components/Timeline.tsx` — Add `getNodePosition` ref method
3. `src/core/events/fireflyEvents.ts` — EventEmitter setup
4. `src/styles/firefly.css` — CSS keyframes and tokens
5. `src/App.tsx` — Mount FireflySignal portal

**CSS Token Setup (Tailwind v4):**
```css
/* src/styles/firefly.css */
@theme {
  --color-firefly-core: oklch(0.85 0.15 85); /* Warm amber glow */
  --color-firefly-pulse: oklch(0.75 0.2 85);
  --color-firefly-dim: oklch(0.6 0.05 85);
  
  --ease-firefly-glide: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-firefly-pulse: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ease-firefly-thread: cubic-bezier(0.4, 0, 0.2, 1);
  
  --duration-firefly-glide: 350ms;
  --duration-firefly-pulse: 350ms;
  --duration-firefly-thread: 1200ms;
  --duration-firefly-breathe: 8s;
}
```

### Phase 2: Event Integration

**Files:**
1. `src/core/tauri/settings.ts` — Tauri Store integration
2. `src/ui/components/FireflySignal.tsx` — Add Analyzing, Insight, Anomaly states
3. `src/ui/views/DashboardView.tsx` — Emit insight events on analysis complete
4. `src/ui/components/RightPanelTabs.tsx` — Add settings toggle

### Phase 3: Polish

**Files:**
1. `src/ui/components/FireflySignal.tsx` — Thread illumination, off-screen indicator
2. `src/ui/components/Timeline.tsx` — Edge/path data for BFS highlighting
3. `e2e/firefly.spec.ts` — Playwright tests for animation states

## References & Research

### Internal Patterns
- `src/ui/views/BranchView.tsx:43-56` — `pulseCommitId` animation pattern
- `src/ui/components/Timeline.tsx` — Timeline scroll container structure
- `src/ui/components/TimelineNode.tsx` — Node positioning reference target
- `src/core/types.ts:85-101` — `TimelineNode` type definitions

### Brainstorm Document
- `docs/brainstorms/2026-02-17-firefly-signal-brainstorm.md` — Full state machine, visual spec, and design rationale

### External Resources
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [MDN CSS Containment](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)
- [eventemitter3 GitHub](https://github.com/primus/eventemitter3) — Fast EventEmitter implementation
- [Tauri Store Plugin](https://v2.tauri.app/plugin/store/) — Persistent key-value storage
- [Steve Kinney — Animation Performance](https://stevekinney.com/courses/react-performance/animation-performance) — GPU acceleration patterns

### Design References
- @emilkowalski — Motion as communication, timing/easing precision
- @jh3yy — CSS-first creativity, performant micro-interactions
- @jenny_wen — Clarity over process, high-fidelity prototyping

## Open Questions

1. **Thread highlighting data:** Does the current Timeline component expose edge/path data for BFS-style illumination, or do we need to compute from node positions?
2. **Off-screen behavior:** When insight fires for off-screen commit, should we auto-scroll to it or show an indicator that lets users decide?
3. **Edge/node highlight coordination:** Should thread illumination highlight Timeline edges, nodes, or both? What's the visual hierarchy?

---

*Original plan: docs/plans/2026-02-17-feat-firefly-signal-system-plan.md*  
*Brainstorm: docs/brainstorms/2026-02-17-firefly-signal-brainstorm.md*
