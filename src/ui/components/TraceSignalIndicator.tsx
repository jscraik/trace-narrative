import { useEffect, useMemo, useState } from 'react';
import type { TraceEvent } from '../../hooks/useTraceSignal';

export interface TraceSignalIndicatorProps {
  /** X position relative to container */
  x: number;
  /** Y position relative to container */
  y: number;
  /** Current event state */
  event?: TraceEvent;
  /** Whether the trace is disabled (hidden) */
  disabled?: boolean;
  /** Custom burst animation (transient) */
  burstType?: 'success' | 'error' | null;
}

/**
 * Trace Signal Component
 *
 * An ambient UI instrument that provides persistent, non-intrusive feedback
 * about system state. Renders as a glowing orb with semantic state classes.
 *
 * @example
 * <TraceSignalIndicator x={100} y={20} event={{ type: 'idle', selectedNodeId: null }} />
 */
export function TraceSignalIndicator({
  x,
  y,
  event = { type: 'idle', selectedNodeId: null },
  disabled = false,
  burstType = null,
}: TraceSignalIndicatorProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);

    update();
    query.addEventListener('change', update);

    return () => {
      query.removeEventListener('change', update);
    };
  }, []);

  const motionClass = useMemo(() => {
    if (prefersReducedMotion) {
      return `trace-${event.type}-static`;
    }
    return `animate-trace-${event.type}`;
  }, [event.type, prefersReducedMotion]);

  if (disabled) return null;

  return (
    <div
      className="trace"
      style={{
        transform: `translate(${x}px, ${y}px)`,
      }}
      aria-hidden="true"
      data-testid="trace-signal"
      data-state={event.type}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
    >
      <div className="trace-wings">
        <div className="trace-wing left" />
        <div className="trace-wing right" />
      </div>
      <div
        className={[
          'trace-orb',
          `trace-${event.type}`,
          motionClass,
          burstType ? `trace-burst-${burstType}` : '',
        ].filter(Boolean).join(' ')}
      />
    </div>
  );
}
