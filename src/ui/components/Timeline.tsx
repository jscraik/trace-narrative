import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { TimelineNode as TimelineNodeType } from '../../core/types';
import type { FireflyEvent } from '../../hooks/useFirefly';
import { useTimelineNavigation } from '../../hooks/useTimelineNavigation';
import { BadgePill } from './BadgePill';
import { FireflySignal } from './FireflySignal';
import { TimelineNavButtons } from './TimelineNavButtons';
import { TimelineNodeComponent } from './TimelineNode';

export interface FireflyTrackingSettlePayload {
  selectedNodeId: string;
  x: number;
  y: number;
}

export interface TimelineProps {
  nodes: TimelineNodeType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pulseCommitId?: string | null;
  fireflyEvent?: FireflyEvent;
  fireflyDisabled?: boolean;
  fireflyBurstType?: 'success' | 'error' | null;
  onFireflyTrackingSettled?: (payload: FireflyTrackingSettlePayload) => void;
}

export function Timeline({
  nodes,
  selectedId,
  onSelect,
  pulseCommitId,
  fireflyEvent = { type: 'idle', selectedNodeId: null },
  fireflyDisabled = false,
  fireflyBurstType = null,
  onFireflyTrackingSettled,
}: TimelineProps) {
  const layout = {
    padding: 7,
    maskWidth: 22,
  };
  const {
    containerRef,
    sorted,
    hasPrev,
    hasNext,
    scrollToNode,
  } = useTimelineNavigation({ nodes, selectedId, onSelect });

  // Firefly position tracking
  const [fireflyPos, setFireflyPos] = useState({ x: 0, y: 0 });
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const settleRafRef = useRef<number | null>(null);
  const keyboardPulseTimerRef = useRef<number | null>(null);
  const [keyboardPulseId, setKeyboardPulseId] = useState<string | null>(null);

  const scheduleKeyboardPulseClear = useCallback(() => {
    if (keyboardPulseTimerRef.current !== null) {
      window.clearTimeout(keyboardPulseTimerRef.current);
      keyboardPulseTimerRef.current = null;
    }

    keyboardPulseTimerRef.current = window.setTimeout(() => {
      setKeyboardPulseId(null);
      keyboardPulseTimerRef.current = null;
    }, 300);
  }, []);

  const measureFireflyPosition = useCallback(() => {
    if (!selectedId) return null;
    const node = nodeRefs.current.get(selectedId);
    const container = containerRef.current;
    if (!node || !container) return null;

    const nodeRect = node.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const nextPos = {
      x: nodeRect.left - containerRect.left + container.scrollLeft,
      y: nodeRect.top - containerRect.top,
    };

    setFireflyPos(nextPos);
    return nextPos;
  }, [selectedId, containerRef]);

  useEffect(() => {
    if (!selectedId) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let settleRafA = 0;
    let settleRafB = 0;

    const runSettleCheck = () => {
      const first = measureFireflyPosition();
      if (!first) return;

      settleRafA = window.requestAnimationFrame(() => {
        const second = measureFireflyPosition();
        if (!second || cancelled) return;

        const stableX = Math.abs(first.x - second.x) <= 1;
        const stableY = Math.abs(first.y - second.y) <= 1;

        if (stableX && stableY) {
          onFireflyTrackingSettled?.({
            selectedNodeId: selectedId,
            x: second.x,
            y: second.y,
          });
        } else {
          settleRafB = window.requestAnimationFrame(runSettleCheck);
          settleRafRef.current = settleRafB;
        }
      });
      settleRafRef.current = settleRafA;
    };

    runSettleCheck();

    const handleScroll = () => {
      measureFireflyPosition();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', runSettleCheck);

    return () => {
      cancelled = true;
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', runSettleCheck);
      window.cancelAnimationFrame(settleRafA);
      window.cancelAnimationFrame(settleRafB);
      if (settleRafRef.current !== null) {
        window.cancelAnimationFrame(settleRafRef.current);
      }
    };
  }, [measureFireflyPosition, onFireflyTrackingSettled, selectedId, containerRef]);

  useEffect(() => {
    return () => {
      if (keyboardPulseTimerRef.current !== null) {
        window.clearTimeout(keyboardPulseTimerRef.current);
      }
    };
  }, []);

  const maskStyle = {
    maskImage: `linear-gradient(to right, transparent, black ${layout.maskWidth}px, black calc(100% - ${layout.maskWidth}px), transparent)`,
    WebkitMaskImage: `linear-gradient(to right, transparent, black ${layout.maskWidth}px, black calc(100% - ${layout.maskWidth}px), transparent)`,
  };

  return (
    <div
      className="bg-bg-secondary/80 backdrop-blur-lg border-t border-border-subtle"
      style={{ padding: `${layout.padding}px` }}
    >
      <div className="flex items-center gap-3">
        <TimelineNavButtons
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={() => scrollToNode('prev')}
          onNext={() => scrollToNode('next')}
        />

        <div
          ref={containerRef}
          className="relative flex-1 overflow-x-auto no-scrollbar scroll-smooth"
          tabIndex={0}
          role="listbox"
          aria-label="Commit timeline"
          style={maskStyle}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              scrollToNode('prev');
              const idx = sorted.findIndex(n => n.id === selectedId);
              if (idx > 0) {
                const prevId = sorted[idx - 1].id;
                setKeyboardPulseId(prevId);
                scheduleKeyboardPulseClear();
              }
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              scrollToNode('next');
              const idx = sorted.findIndex(n => n.id === selectedId);
              if (idx >= 0 && idx < sorted.length - 1) {
                const nextId = sorted[idx + 1].id;
                setKeyboardPulseId(nextId);
                scheduleKeyboardPulseClear();
              }
            }
          }}
        >
          {/* Connection line - visible path */}
          <div className="pointer-events-none absolute left-0 right-0 top-[38px] h-[1px] bg-border-subtle" />

          <motion.div
            className="relative flex min-w-max items-start gap-2 px-4 py-2"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: { staggerChildren: 0.05 }
              }
            }}
          >
            {sorted.map((n) => (
              <motion.div
                key={n.id}
                variants={{
                  hidden: { opacity: 0, y: 15 },
                  visible: { opacity: 1, y: 0 }
                }}
              >
                <TimelineNodeComponent
                  ref={(el) => {
                    if (el) nodeRefs.current.set(n.id, el);
                    else nodeRefs.current.delete(n.id);
                  }}
                  node={n}
                  selected={selectedId === n.id}
                  pulsing={pulseCommitId === n.id || keyboardPulseId === n.id}
                  onSelect={() => onSelect(n.id)}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Firefly Signal */}
          <FireflySignal
            x={fireflyPos.x}
            y={fireflyPos.y}
            event={fireflyEvent}
            disabled={fireflyDisabled}
            burstType={fireflyBurstType}
          />
        </div>

        <TimelineNavButtons
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={() => scrollToNode('prev')}
          onNext={() => scrollToNode('next')}
        />
      </div>
    </div>
  );
}

// Re-export for convenience
export { BadgePill };
