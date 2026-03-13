/**
 * SparklineChart.tsx
 *
 * Tiny inline sparkline for table rows and repo chips.
 * Renders as a pure SVG path — no ECharts overhead.
 * No axes, no tooltip — just the trend shape.
 *
 * Props:
 *   data   — array of numbers (values over time, oldest first)
 *   height — px (default 28)
 *   width  — px (default 80), set to 0 to fill container via CSS
 *   tone   — accent tone (default 'violet')
 *   label  — aria-label (default 'Sparkline')
 *   filled — whether to draw area fill under the line (default true)
 */

import { useMemo } from 'react';
import { usePrefersReducedMotion } from './chartUtils';

// tone → stroke + fill colours (hardcoded for SVG — no CSS var access in SVG attributes)
const TONE_COLORS: Record<string, { stroke: string; fill: string }> = {
  violet: { stroke: 'rgba(139,92,246,0.9)',  fill: 'rgba(139,92,246,0.15)' },
  green:  { stroke: 'rgba(16,185,129,0.9)',  fill: 'rgba(16,185,129,0.12)' },
  blue:   { stroke: 'rgba(59,130,246,0.9)',  fill: 'rgba(59,130,246,0.12)' },
  amber:  { stroke: 'rgba(245,158,11,0.9)',  fill: 'rgba(245,158,11,0.12)' },
  red:    { stroke: 'rgba(239,68,68,0.9)',   fill: 'rgba(239,68,68,0.12)' },
  slate:  { stroke: 'rgba(160,160,176,0.6)', fill: 'rgba(160,160,176,0.08)' },
};

export type SparklineTone = keyof typeof TONE_COLORS;

interface SparklineChartProps {
  data: number[];
  height?: number;
  width?: number;
  tone?: SparklineTone;
  label?: string;
  filled?: boolean;
}

function buildPath(data: number[], w: number, h: number): { line: string; area: string } {
  if (data.length < 2) return { line: '', area: '' };

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pad = 2; // vertical padding px
  const innerH = h - pad * 2;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: pad + innerH - ((v - min) / range) * innerH,
  }));

  // Smooth cubic bezier
  const lineParts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    lineParts.push(`C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`);
  }

  const last = points[points.length - 1];
  const first = points[0];
  const area = [
    ...lineParts,
    `L ${last.x} ${h}`,
    `L ${first.x} ${h}`,
    'Z',
  ].join(' ');

  return { line: lineParts.join(' '), area };
}

export function SparklineChart({
  data,
  height = 28,
  width = 80,
  tone = 'violet',
  label = 'Trend sparkline',
  filled = true,
}: SparklineChartProps) {
  const reduced = usePrefersReducedMotion();
  const colors = TONE_COLORS[tone] ?? TONE_COLORS.violet;

  const { line, area } = useMemo(
    () => (data.length >= 2 ? buildPath(data, width, height) : { line: '', area: '' }),
    [data, width, height],
  );

  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        aria-label={label}
        role="img"
        style={{ display: 'block' }}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={colors.stroke}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.4}
        />
        <title>{label} — no data</title>
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      aria-label={label}
      role="img"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <title>{label}</title>
      {filled && area && (
        <path
          d={area}
          fill={colors.fill}
          strokeWidth={0}
          style={reduced ? undefined : { transition: 'opacity 200ms ease' }}
        />
      )}
      {line && (
        <path
          d={line}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={reduced ? undefined : { transition: 'stroke 200ms ease' }}
        />
      )}
    </svg>
  );
}
