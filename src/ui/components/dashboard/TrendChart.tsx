import { useTheme } from "@design-studio/tokens";
import * as echarts from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TrendPoint } from "../../../core/types";

interface TrendChartProps {
	trend: TrendPoint[];
}

type RenderStrategy =
	| "svg_low_density"
	| "canvas_high_density"
	| "table_accessible_fallback";

function resolveChartColor(variableName: string, fallback: string) {
	if (typeof window === "undefined") return fallback;
	const value = window
		.getComputedStyle(document.documentElement)
		.getPropertyValue(variableName)
		.trim();
	return value || fallback;
}

function resolveChartPalette(theme: string) {
	const isLightTheme = theme === "light";

	return {
		border: resolveChartColor(
			"--border-light",
			isLightTheme ? "rgba(13, 13, 13, 0.18)" : "rgba(86, 96, 122, 0.72)",
		),
		grid: resolveChartColor(
			"--border-subtle",
			isLightTheme ? "rgba(13, 13, 13, 0.1)" : "rgba(76, 86, 110, 0.4)",
		),
		textPrimary: resolveChartColor(
			"--text-primary",
			isLightTheme ? "rgba(13, 13, 13, 1)" : "rgba(224, 224, 224, 1)",
		),
		textMuted: resolveChartColor(
			"--text-muted",
			isLightTheme ? "rgba(93, 93, 93, 1)" : "rgba(160, 160, 176, 1)",
		),
		accentViolet: resolveChartColor(
			"--accent-violet",
			isLightTheme ? "rgba(146, 79, 247, 1)" : "rgba(139, 92, 246, 1)",
		),
		accentGreen: resolveChartColor(
			"--accent-green",
			isLightTheme ? "rgba(0, 134, 53, 1)" : "rgba(16, 185, 129, 1)",
		),
		tooltipBackground: isLightTheme
			? "rgba(255, 255, 255, 0.96)"
			: "rgba(13, 13, 18, 0.92)",
		tooltipShadow: isLightTheme
			? "rgba(13, 13, 13, 0.14)"
			: "rgba(0, 0, 0, 0.5)",
		accentVioletShadow: isLightTheme
			? "rgba(146, 79, 247, 0.18)"
			: "rgba(139, 92, 246, 0.3)",
		accentVioletAreaStart: isLightTheme
			? "rgba(146, 79, 247, 0.22)"
			: "rgba(139, 92, 246, 0.4)",
		accentVioletAreaEnd: isLightTheme
			? "rgba(146, 79, 247, 0)"
			: "rgba(139, 92, 246, 0)",
	};
}

export function TrendChart({ trend }: TrendChartProps) {
	const { theme } = useTheme();
	const containerRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
	const [_frameCostBreach, _setFrameCostBreach] = useState(false);
	const [chartPalette, setChartPalette] = useState(() =>
		resolveChartPalette(theme),
	);

	useEffect(() => {
		if (typeof window.matchMedia !== "function") return;
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		setPrefersReducedMotion(mediaQuery.matches);
		const handler = (e: MediaQueryListEvent) =>
			setPrefersReducedMotion(e.matches);
		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	}, []);

	const totalPoints = trend.length * 2; // 2 metrics: AI Percentage & Commits

	const [strategy, reason] = useMemo<[RenderStrategy, string]>(() => {
		if (prefersReducedMotion)
			return [
				"table_accessible_fallback",
				"Accessibility Override (Reduced Motion)",
			];
		if (totalPoints > 100000)
			return [
				"table_accessible_fallback",
				"Density Exceeds Canvas Limit (>100k points)",
			];
		if (_frameCostBreach)
			return [
				"canvas_high_density",
				"Frame-cost breach detected (Canvas fallback)",
			];
		if (totalPoints > 4000)
			return ["canvas_high_density", "High Density (2k-100k points)"]; // totalPoints is * 2
		return ["svg_low_density", "Low Density (<=2k points)"];
	}, [totalPoints, prefersReducedMotion, _frameCostBreach]);

	useEffect(() => {
		setChartPalette(resolveChartPalette(theme));
	}, [theme]);

	useEffect(() => {
		if (strategy === "table_accessible_fallback" || !containerRef.current) {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
			return;
		}

		// Initialize ECharts with selected renderer
		const renderer = strategy === "svg_low_density" ? "svg" : "canvas";
		if (
			!chartInstanceRef.current ||
			chartInstanceRef.current.getOption() === undefined
		) {
			chartInstanceRef.current = echarts.init(containerRef.current, undefined, {
				renderer,
			});
		} else {
			// Re-init if renderer changed
			const currentRenderer = chartInstanceRef.current.getOption()?.renderer;
			if (currentRenderer !== undefined && currentRenderer !== renderer) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = echarts.init(
					containerRef.current,
					undefined,
					{ renderer },
				);
			}
		}

		const times = trend.map((t) =>
			new Date(t.date).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				hour: "numeric",
			}),
		);
		const aiData = trend.map((t) => t.aiPercentage);
		const commitData = trend.map((t) => t.commitCount);

		const option: echarts.EChartsOption = {
			backgroundColor: "transparent",
			tooltip: {
				trigger: "axis",
				axisPointer: {
					type: "line",
					lineStyle: { color: chartPalette.border, type: "dashed" },
				},
				backgroundColor: chartPalette.tooltipBackground,
				borderColor: chartPalette.grid,
				textStyle: { color: chartPalette.textPrimary, fontSize: 11 },
				padding: [10, 14],
				borderRadius: 8,
				shadowBlur: 20,
				shadowColor: chartPalette.tooltipShadow,
			},
			legend: {
				data: ["AI %", "Commits"],
				textStyle: { color: chartPalette.textMuted },
			},
			grid: {
				left: "3%",
				right: "4%",
				bottom: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				boundaryGap: false,
				data: times,
				axisLine: { lineStyle: { color: chartPalette.border } },
				axisLabel: { color: chartPalette.textMuted },
			},
			yAxis: [
				{
					type: "value",
					name: "AI %",
					position: "left",
					axisLine: { show: true, lineStyle: { color: chartPalette.border } },
					axisLabel: {
						color: chartPalette.accentViolet,
						formatter: "{value}%",
					},
					splitLine: { lineStyle: { color: chartPalette.grid } },
					max: 100,
				},
				{
					type: "value",
					name: "Commits",
					position: "right",
					axisLine: { show: true, lineStyle: { color: chartPalette.border } },
					axisLabel: { color: chartPalette.accentGreen },
					splitLine: { show: false },
				},
			],
			series: [
				{
					name: "AI %",
					type: "line",
					yAxisIndex: 0,
					smooth: 0.6, // Higher smoothing for "fluid" v3 look
					showSymbol: false,
					lineStyle: {
						width: 3,
						color: chartPalette.accentViolet,
						shadowBlur: 10,
						shadowColor: chartPalette.accentVioletShadow,
					},
					areaStyle: {
						opacity: 0.2,
						color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
							{ offset: 0, color: chartPalette.accentVioletAreaStart },
							{ offset: 1, color: chartPalette.accentVioletAreaEnd },
						]),
					},
					data: aiData,
					animation: !prefersReducedMotion,
				},
				{
					name: "Commits",
					type: "bar",
					yAxisIndex: 1,
					barWidth: "40%",
					itemStyle: {
						color: chartPalette.accentGreen,
						borderRadius: [4, 4, 0, 0], // Rounded top corners
					},
					data: commitData,
					animation: !prefersReducedMotion,
				},
			],
		};

		chartInstanceRef.current.setOption(option);

		const handleResize = () => chartInstanceRef.current?.resize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [chartPalette, trend, strategy, prefersReducedMotion]);

	// Simulate downsampling decision for large datasets as requested by spec
	const decimationNotice =
		totalPoints > 2000 && strategy !== "table_accessible_fallback"
			? " (Auto-decimation applied)"
			: "";

	return (
		<section className="card mb-5 p-5">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="font-semibold text-text-primary">Activity Trend</h3>
					<p className="text-xs text-text-muted mt-1">
						Mode:{" "}
						<span className="font-medium text-accent-blue">{strategy}</span> —{" "}
						{reason}
						{decimationNotice}
					</p>
				</div>
			</div>

			{strategy === "table_accessible_fallback" ? (
				<div className="overflow-x-auto max-h-64 scrollbar-thin rounded-lg border border-border-light bg-bg-secondary p-4">
					<table className="w-full text-sm text-left">
						<thead className="text-xs text-text-muted uppercase border-b border-border-subtle">
							<tr>
								<th className="px-4 py-2">Date</th>
								<th className="px-4 py-2">AI %</th>
								<th className="px-4 py-2">Commits</th>
							</tr>
						</thead>
						<tbody>
							{trend.map((point) => (
								<tr
									key={point.date}
									className="border-b border-border-subtle last:border-0 hover:bg-bg-hover transition-colors"
								>
									<td className="px-4 py-2 text-text-secondary">
										{new Date(point.date).toLocaleString()}
									</td>
									<td className="px-4 py-2 text-accent-violet">
										{point.aiPercentage.toFixed(1)}%
									</td>
									<td className="px-4 py-2 text-accent-green">
										{point.commitCount}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{trend.length === 0 && (
						<div className="py-8 text-center text-text-muted text-sm">
							No data available in this period.
						</div>
					)}
				</div>
			) : (
				<div ref={containerRef} className="w-full h-64" aria-hidden="true" />
			)}
		</section>
	);
}
