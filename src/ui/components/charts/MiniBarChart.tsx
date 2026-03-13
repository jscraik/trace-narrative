/**
 * MiniBarChart.tsx
 *
 * Horizontal bar chart for distribution data.
 * Use for: model usage breakdown, tool call frequency, language split, etc.
 *
 * Props:
 *   data   — [{label, value, tone?}] — sorted descending recommended
 *   height — canvas height in px (default 96)
 *   unit   — value suffix, e.g. '%', ' calls', ' ms' (default '')
 *   label  — aria-label for the wrapper (default 'Distribution chart')
 *   maxValue — denominator for percentage bars (defaults to max of data values)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { useTheme } from '@design-studio/tokens';

import { AccessibleChartWrapper } from './AccessibleChartWrapper';
import {
  type ChartTone,
  resolveChartPalette,
  toneToColor,
  usePrefersReducedMotion,
} from './chartUtils';

export interface MiniBarChartDatum {
  label: string;
  value: number;
  tone?: ChartTone;
}

interface MiniBarChartProps {
  data: MiniBarChartDatum[];
  height?: number;
  unit?: string;
  label?: string;
  maxValue?: number;
}

export function MiniBarChart({
  data,
  height = 96,
  unit = '',
  label = 'Distribution chart',
  maxValue,
}: MiniBarChartProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const reduced = usePrefersReducedMotion();

  const [palette, setPalette] = useState(() => resolveChartPalette(theme));
  useEffect(() => setPalette(resolveChartPalette(theme)), [theme]);

  const explicit_max = maxValue ?? Math.max(...data.map(d => d.value), 1);

  // ECharts mount & update
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: 'svg' });
    }

    const labels = [...data].reverse().map(d => d.label);
    const values = [...data].reverse().map(d => d.value);
    const colors = [...data].reverse().map(d =>
      toneToColor(palette, d.tone ?? 'violet')
    );

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: !reduced,
      animationDuration: 400,
      grid: { left: '2%', right: '4%', top: 4, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        max: explicit_max,
        show: false,
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: palette.textMuted,
          fontSize: 10,
          fontFamily: 'inherit',
        },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i], borderRadius: [0, 3, 3, 0] } })),
          barMaxWidth: 14,
          label: {
            show: true,
            position: 'right',
            color: palette.textMuted,
            fontSize: 10,
            formatter: (p) => `${p.value}${unit}`,
          },
        },
      ],
    };

    chartRef.current.setOption(option, { notMerge: true });
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [data, palette, reduced, unit, explicit_max]);

  // Cleanup on unmount
  useEffect(() => () => { chartRef.current?.dispose(); chartRef.current = null; }, []);

  const tableData = useMemo(
    () => data.map(d => ({ col1: d.label, col2: `${d.value}${unit}` })),
    [data, unit],
  );

  return (
    <AccessibleChartWrapper label={label} minHeight={height} tableData={tableData}>
      <div ref={containerRef} style={{ width: '100%', height }} />
    </AccessibleChartWrapper>
  );
}
