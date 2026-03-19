/**
 * ActivityBarChart.tsx
 *
 * Vertical bar chart for time-series activity data.
 * Use for: daily commit count, sessions per day, tool calls per hour, etc.
 *
 * Props:
 *   data   — [{date: ISO string | label, value: number}]
 *   height — canvas height in px (default 80)
 *   tone   — accent tone key (default 'violet')
 *   label  — aria-label
 *   unit   — value unit suffix for tooltip
 *   showXLabels — whether to show date labels on x axis (default true if ≤14 points)
 */

import { useTheme } from "@design-studio/tokens";
import * as echarts from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";

import { AccessibleChartWrapper } from "./AccessibleChartWrapper";
import {
	type ChartTone,
	resolveChartPalette,
	toneToColor,
	usePrefersReducedMotion,
} from "./chartUtils";

export interface ActivityBarChartDatum {
	date: string; // ISO date string or short label like 'Mon', 'Mar 10'
	value: number;
}

interface ActivityBarChartProps {
	data: ActivityBarChartDatum[];
	height?: number;
	tone?: ChartTone;
	label?: string;
	unit?: string;
	showXLabels?: boolean;
}

function formatDateLabel(raw: string): string {
	// Try to parse as ISO date; fall back to raw string
	const d = new Date(raw);
	if (!Number.isNaN(d.getTime())) {
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}
	return raw;
}

// Helper function to create ECharts options
function createActivityBarChartOptions({
	data,
	reduced,
	unit,
	autoShowLabels,
	barColor,
	palette,
}: {
	data: ActivityBarChartDatum[];
	reduced: boolean;
	unit: string;
	autoShowLabels: boolean;
	barColor: string;
	palette: ReturnType<typeof resolveChartPalette>;
}) {
	const labels = data.map((d) => formatDateLabel(d.date));
	const values = data.map((d) => d.value);

	const options: echarts.EChartsOption = {
		backgroundColor: "transparent",
		animation: !reduced,
		animationDuration: 300,
		grid: {
			left: 0,
			right: 0,
			top: 4,
			bottom: autoShowLabels ? 20 : 4,
			containLabel: autoShowLabels,
		},
		tooltip: {
			trigger: "axis",
			backgroundColor: palette.tooltipBackground,
			borderColor: palette.grid,
			textStyle: {
				color: palette.textPrimary,
				fontSize: 11,
				fontFamily: "inherit",
			},
			padding: [6, 10],
			borderRadius: 6,
			formatter: (params: unknown) => {
				const list = Array.isArray(params) ? params : [params];
				const p = list[0] as { name: string; value: string | number };
				return `${p.name}<br/><b>${p.value}${unit}</b>`;
			},
		},
		xAxis: {
			type: "category",
			data: labels,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: autoShowLabels
				? { color: palette.textMuted, fontSize: 9, fontFamily: "inherit" }
				: { show: false },
			boundaryGap: true,
		},
		yAxis: {
			type: "value",
			show: false,
		},
		series: [
			{
				type: "bar",
				data: values,
				barMaxWidth: 20,
				itemStyle: {
					color: barColor,
					borderRadius: [3, 3, 0, 0],
					opacity: 0.85,
				},
				emphasis: {
					itemStyle: { opacity: 1 },
				},
			},
		],
	};
	return { options };
}

export function ActivityBarChart({
	data,
	height = 80,
	tone = "violet",
	label = "Activity chart",
	unit = "",
	showXLabels,
}: ActivityBarChartProps) {
	const { theme } = useTheme();
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<echarts.EChartsType | null>(null);
	const reduced = usePrefersReducedMotion();

	const [palette, setPalette] = useState(() => resolveChartPalette(theme));
	useEffect(() => setPalette(resolveChartPalette(theme)), [theme]);

	const autoShowLabels = showXLabels ?? data.length <= 14;
	const barColor = toneToColor(palette, tone);

	useEffect(() => {
		if (!containerRef.current || data.length === 0) return;

		let chartInstance = chartRef.current;
		if (!chartInstance) {
			chartInstance = echarts.init(containerRef.current, null, {
				renderer: "svg",
			});
			chartRef.current = chartInstance;
		}

		const { options } = createActivityBarChartOptions({
			data,
			reduced,
			unit,
			autoShowLabels,
			barColor,
			palette, // Pass palette to the options creator
		});

		chartInstance.setOption(options);

		const onResize = () => chartInstance?.resize();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [data, reduced, unit, autoShowLabels, barColor, palette]); // Add palette to dependencies

	useEffect(
		() => () => {
			chartRef.current?.dispose();
			chartRef.current = null;
		},
		[],
	);

	const tableData = useMemo(
		() =>
			data.map((d) => ({
				col1: formatDateLabel(d.date),
				col2: `${d.value}${unit}`,
			})),
		[data, unit],
	);

	return (
		<AccessibleChartWrapper
			label={label}
			minHeight={height}
			tableData={tableData}
		>
			<div ref={containerRef} style={{ width: "100%", height }} />
		</AccessibleChartWrapper>
	);
}
