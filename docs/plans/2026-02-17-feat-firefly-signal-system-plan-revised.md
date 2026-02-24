---
title: "feat: Firefly Signal System — ambient commit graph indicator"
type: feat
date: 2026-02-17
enhanced: 2026-02-17
revised: 2026-02-17
status: superseded
superseded_by: /Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-visual-system-v1-plan.md
---

# Firefly Signal System (Revised)

> **Status:** Superseded. Use `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-firefly-visual-system-v1-plan.md` as the canonical Firefly plan.

## Revision Summary

**Revised on:** 2026-02-17  
**Changes from review:**
1. **Removed EventEmitter** — Using React props/context instead of global event bus
2. **Simplified positioning** — Firefly rendered as Timeline child, not portal
3. **Reduced timing complexity** — 3 durations instead of 5
4. **Fixed memory safety** — `Map` for node refs (not WeakMap), cleanup on unmount
5. **Collapsed CSS tokens** — Semantic names, fewer variations
6. **Fixed Tauri Store init** — Lazy singleton pattern (not top-level await)
7. **Added ref population** — Complete example with cleanup
8. **Added CSS import note** — Where to import the firefly.css file

---

## Overview

An **ambient UI instrument** that provides persistent, non-intrusive feedback about system state in the commit graph. Functions like a status LED on professional equipment: always visible but only demands attention when something meaningful happens.

The firefly lives **inside the Timeline component** (not a portal), anchoring to the selected commit and responding to analysis events via props.

## Problem Statement / Motivation

Narrative processes complex data — commit attribution, trace correlation, dashboard analytics — but lacks ambient feedback about what's happening "under the hood." Users don't know when:
- Analysis is running
- New insights are available
- Anomalies are detected in commit patterns

Current UI uses explicit banners and toasts which are interruptive. An ambient signal provides status awareness without cognitive overhead.

## Proposed Solution

A **FireflySignal** component rendered **inside Timeline**, positioned relative to the selected commit node via CSS custom properties. It receives events via props from parent components.

### Core Primitives

1. **Core Node** — 8px glowing orb, anchored to active commit
2. **Pulse Ring** — Event-driven ring animation on state changes
3. **Thread Highlight** — Edge illumination (simplified for Phase 1)

### State Machine

| State | Visual | Trigger |
|-------|--------|---------|
| **Idle** | Faint breathe (8s cycle, 0.4 opacity) | Default |
| **Tracking** | Glides to selected commit (350ms) | `selectedNodeId` changes |
| **Active** | Bright pulse (400ms) | `signalEvent` prop received |

### Scope Reduction: Phase 1 Only

Ship only the **passive indicator** first:
- Idle breathing on selected commit
- Settings toggle to disable
- 60fps during scroll

**Defer to Phase 2 (if Phase 1 proves valuable):**
- Insight/Anomaly states
- Thread illumination
- Event queue system

---

## Technical Considerations

### Positioning Strategy (Simplified)

**Approach:** Firefly is a child of Timeline, positioned with CSS variables.

```typescript
// Timeline.tsx
export function Timeline({ nodes, selectedId, fireflyEvent }: TimelineProps) {
  const [fireflyPos, setFireflyPos] = useState({ x: 0, y: 0 });
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = nodeRefs.current.get(selectedId);
    const container = containerRef.current;
    if (node && container) {
      const nodeRect = node.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setFireflyPos({
        x: nodeRect.left - containerRect.left + container.scrollLeft,
        y: nodeRect.top - containerRect.top,
      });
    }
  }, [selectedId]);

  return (
    <div ref={containerRef} className="relative">
      {nodes.map((node) => (
        <div
          key={node.id}
          ref={(el) => {
            if (el) nodeRefs.current.set(node.id, el);
            else nodeRefs.current.delete(node.id);
          }}
        >
          {/* Node content */}
        </div>
      ))}
      <FireflySignal x={fireflyPos.x} y={fireflyPos.y} event={fireflyEvent} />
    </div>
  );
}
```

**Why not portal + ref forwarding?**
- Simpler — no imperative handle, no ref forwarding
- React-idiomatic — props down, events up
- Easier to test — component accepts props, doesn't query DOM

### Animation Discipline

**Three timing values only:**

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-slow` | 8s | Idle breathe |
| `--duration-medium` | 350ms | Tracking glide |
| `--duration-fast` | 400ms | Active pulse |

**Two easing values:**

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-smooth` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Tracking |
| `--ease-bounce` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | Pulse |

**CSS Implementation:**
```css
@theme {
  --color-firefly-glow: oklch(0.85 0.15 85);
  --color-firefly-dim: oklch(0.6 0.05 85);
  
  --duration-slow: 8s;
  --duration-medium: 350ms;
  --duration-fast: 400ms;
  
  --ease-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-bounce: cubic-bezier(0.165, 0.84, 0.44, 1);
}

@keyframes breathe {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}

.animate-breathe {
  animation: breathe var(--duration-slow) ease-in-out infinite;
}

.animate-pulse {
  animation: pulse var(--duration-fast) var(--ease-bounce);
}
```

**Import in `src/main.tsx`:**
```typescript
import './styles/firefly.css';
```

### Event System (Props-Based)

**No EventEmitter.** Firefly receives events via props:

```typescript
// Simplified discriminated union
type FireflyEvent =
  | { type: 'idle' }
  | { type: 'active'; message?: string };

interface FireflySignalProps {
  x: number;
  y: number;
  event: FireflyEvent;
}
```

**Animation completion uses events, not setTimeout:**
```typescript
function FireflySignal({ x, y, event }: FireflySignalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (event.type === 'active') {
      setIsAnimating(true);
    }
  }, [event]);

  return (
    <div
      className={cn(
        "absolute w-2 h-2 rounded-full",
        event.type === 'idle' && "animate-breathe",
        event.type === 'active' && "animate-pulse"
      )}
      style={{
        transform: `translate(${x}px, ${y}px)`,
      }}
      onAnimationEnd={() => setIsAnimating(false)}
    />
  );
}
```

### Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  .firefly {
    animation: none;
    opacity: 0.5;
  }
  .firefly-tracking {
    transition: none;
  }
}
```

- `aria-hidden="true"` on firefly container
- Keyboard navigation unchanged

### Settings Persistence

```typescript
// src/core/tauri/settings.ts
import { Store } from '@tauri-apps/plugin-store';

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('settings.json');
  }
  return store;
}

export interface FireflySettings {
  enabled: boolean;
}

export const getFireflySettings = async (): Promise<FireflySettings> => {
  const s = await getStore();
  return {
    enabled: (await s.get<boolean>('firefly.enabled')) ?? true,
  };
};

export const setFireflyEnabled = async (enabled: boolean): Promise<void> => {
  const s = await getStore();
  await s.set('firefly.enabled', enabled);
  await s.save();
};
```

---

## Acceptance Criteria (Phase 1 Only)

- [ ] Firefly renders as 8px glowing dot anchored to selected commit
- [ ] Idle state: subtle breathe animation (8s cycle)
- [ ] Tracking state: smoothly glides when selection changes (350ms)
- [ ] Respects `prefers-reduced-motion`
- [ ] User can disable via settings toggle
- [ ] 60fps maintained during scroll + tracking
- [ ] Settings persist across app restarts

## Success Metrics

- **Adoption:** Settings default remains enabled (opt-out rate < 10%)
- **Performance:** No dropped frames during scroll (Chrome DevTools)
- **Clarity:** Users notice and understand the firefly (informal feedback)

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| WeakMap browser support | Target modern browsers (WeakMap is baseline) |
| Visual clutter | Ship Phase 1, gather feedback before Phase 2 |
| Timeline refactors | Firefly is child component — changes are localized |

## Implementation Plan (Phase 1 Only)

### Files to Create/Modify

1. `src/ui/components/FireflySignal.tsx` — Core component
2. `src/ui/components/Timeline.tsx` — Add firefly as child
3. `src/core/tauri/settings.ts` — Add firefly settings
4. `src/ui/components/RightPanelTabs.tsx` — Add toggle
5. `src/styles/firefly.css` — CSS keyframes (import in `src/main.tsx`)

### FireflySignal.tsx

```typescript
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export type FireflyEvent = { type: 'idle' } | { type: 'active' };

interface FireflySignalProps {
  x: number;
  y: number;
  event?: FireflyEvent;
  disabled?: boolean;
}

export function FireflySignal({ x, y, event = { type: 'idle' }, disabled }: FireflySignalProps) {
  const [isVisible, setIsVisible] = useState(!disabled);

  useEffect(() => {
    setIsVisible(!disabled);
  }, [disabled]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute pointer-events-none",
        "w-2 h-2 rounded-full",
        "bg-amber-400 shadow-lg",
        event.type === 'idle' && "animate-breathe",
        event.type === 'active' && "animate-pulse"
      )}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        boxShadow: '0 0 8px 2px rgba(251, 191, 36, 0.5)',
      }}
      aria-hidden="true"
    />
  );
}
```

---

## References

- Original plan: `docs/plans/2026-02-17-feat-firefly-signal-system-plan-deepened.md`
- Brainstorm: `docs/brainstorms/2026-02-17-firefly-signal-brainstorm.md`

---

*Revised based on technical review feedback: simplified positioning, removed EventEmitter, reduced timing complexity, fixed memory safety patterns.*
