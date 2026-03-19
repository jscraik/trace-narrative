/**
 * chartUtils.ts
 * Shared utilities for chart micro-components.
 * Mirrors the approach used in TrendChart.tsx so all charts behave consistently.
 */

import { useEffect, useState } from "react";

// ─── Colour resolution ───────────────────────────────────────────────────────

/**
 * Read a CSS custom property from :root at call time.
 * Falls back to `fallback` if the property is missing or we're in SSR.
 */
export function resolveChartColor(
	variableName: string,
	fallback: string,
): string {
	if (typeof window === "undefined") return fallback;
	const value = window
		.getComputedStyle(document.documentElement)
		.getPropertyValue(variableName)
		.trim();
	return value || fallback;
}

export interface ChartPalette {
	border: string;
	grid: string;
	textPrimary: string;
	textMuted: string;
	accentViolet: string;
	accentGreen: string;
	accentBlue: string;
	accentAmber: string;
	accentRed: string;
	tooltipBackground: string;
	tooltipShadow: string;
	bgPrimary: string;
	bgSecondary: string;
}

export function resolveChartPalette(theme: string): ChartPalette {
	const light = theme === "light";
	return {
		border: resolveChartColor(
			"--border-light",
			light ? "rgba(13,13,13,0.18)" : "rgba(86,96,122,0.72)",
		),
		grid: resolveChartColor(
			"--border-subtle",
			light ? "rgba(13,13,13,0.1)" : "rgba(76,86,110,0.4)",
		),
		textPrimary: resolveChartColor(
			"--text-primary",
			light ? "rgba(13,13,13,1)" : "rgba(224,224,224,1)",
		),
		textMuted: resolveChartColor(
			"--text-muted",
			light ? "rgba(93,93,93,1)" : "rgba(160,160,176,1)",
		),
		accentViolet: resolveChartColor(
			"--accent-violet",
			light ? "rgba(146,79,247,1)" : "rgba(139,92,246,1)",
		),
		accentGreen: resolveChartColor(
			"--accent-green",
			light ? "rgba(0,134,53,1)" : "rgba(16,185,129,1)",
		),
		accentBlue: resolveChartColor(
			"--accent-blue",
			light ? "rgba(37,99,235,1)" : "rgba(59,130,246,1)",
		),
		accentAmber: resolveChartColor(
			"--accent-amber",
			light ? "rgba(217,119,6,1)" : "rgba(245,158,11,1)",
		),
		accentRed: resolveChartColor(
			"--accent-red",
			light ? "rgba(220,38,38,1)" : "rgba(239,68,68,1)",
		),
		tooltipBackground: light ? "rgba(255,255,255,0.96)" : "rgba(13,13,18,0.92)",
		tooltipShadow: light ? "rgba(13,13,13,0.14)" : "rgba(0,0,0,0.5)",
		bgPrimary: resolveChartColor(
			"--bg-primary",
			light ? "rgba(255,255,255,1)" : "rgba(13,13,18,1)",
		),
		bgSecondary: resolveChartColor(
			"--bg-secondary",
			light ? "rgba(245,245,247,1)" : "rgba(20,20,28,1)",
		),
	};
}

// ─── Tone → palette key ──────────────────────────────────────────────────────

export type ChartTone = "violet" | "green" | "blue" | "amber" | "red" | "slate";

export function toneToColor(palette: ChartPalette, tone: ChartTone): string {
	switch (tone) {
		case "violet":
			return palette.accentViolet;
		case "green":
			return palette.accentGreen;
		case "blue":
			return palette.accentBlue;
		case "amber":
			return palette.accentAmber;
		case "red":
			return palette.accentRed;
		default:
			return palette.textMuted;
	}
}

// ─── Reduced motion hook ─────────────────────────────────────────────────────

/**
 * Returns true when `prefers-reduced-motion: reduce` is active.
 * Listens for runtime changes (e.g. user toggling system preference).
 */
export function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function"
		)
			return false;
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	});

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function"
		)
			return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	return reduced;
}
