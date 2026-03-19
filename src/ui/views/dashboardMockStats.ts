import type { DashboardStats } from "../../core/attribution-api";

export const MOCK_DASHBOARD_STATS: DashboardStats = {
	repo: {
		id: 1,
		path: "~/dev/trace-narrative",
		name: "trace-narrative",
	},
	timeRange: "30d",
	currentPeriod: {
		period: {
			start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
			end: new Date().toISOString(),
			commits: 47,
		},
		attribution: {
			totalLines: 12450,
			humanLines: 3980,
			aiAgentLines: 5200,
			aiAssistLines: 3270,
			collaborativeLines: 0,
			aiPercentage: 68,
		},
		toolBreakdown: [
			{ tool: "claude_code", model: "sonnet-3.7", lineCount: 4500 },
			{ tool: "cursor", model: "gpt-4o", lineCount: 2800 },
			{ tool: "codex", model: "o1-mini", lineCount: 1170 },
		],
		trend: [
			{
				date: "2026-03-01",
				granularity: "day",
				aiPercentage: 45,
				commitCount: 2,
			},
			{
				date: "2026-03-02",
				granularity: "day",
				aiPercentage: 50,
				commitCount: 4,
			},
			{
				date: "2026-03-03",
				granularity: "day",
				aiPercentage: 55,
				commitCount: 3,
			},
			{
				date: "2026-03-04",
				granularity: "day",
				aiPercentage: 60,
				commitCount: 5,
			},
			{
				date: "2026-03-05",
				granularity: "day",
				aiPercentage: 62,
				commitCount: 4,
			},
			{
				date: "2026-03-06",
				granularity: "day",
				aiPercentage: 65,
				commitCount: 6,
			},
			{
				date: "2026-03-07",
				granularity: "day",
				aiPercentage: 68,
				commitCount: 3,
			},
		],
	},
	previousPeriod: {
		period: {
			start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
			end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
			commits: 35,
		},
		attribution: {
			totalLines: 10200,
			humanLines: 3774,
			aiAgentLines: 4000,
			aiAssistLines: 2426,
			collaborativeLines: 0,
			aiPercentage: 63,
		},
		toolBreakdown: [],
		trend: [],
	},
	topFiles: {
		files: [
			{
				filePath: "src/core/attribution-api.ts",
				totalLines: 506,
				aiLines: 410,
				aiPercentage: 81,
				commitCount: 12,
			},
			{
				filePath: "src/ui/views/DashboardView.tsx",
				totalLines: 584,
				aiLines: 210,
				aiPercentage: 36,
				commitCount: 8,
			},
			{
				filePath: "src-tauri/src/lib.rs",
				totalLines: 840,
				aiLines: 520,
				aiPercentage: 62,
				commitCount: 15,
			},
			{
				filePath: "src/hooks/useAutoIngest.ts",
				totalLines: 320,
				aiLines: 280,
				aiPercentage: 88,
				commitCount: 5,
			},
			{
				filePath: "src/App.tsx",
				totalLines: 387,
				aiLines: 120,
				aiPercentage: 31,
				commitCount: 10,
			},
		],
		total: 5,
		offset: 0,
		limit: 20,
		hasMore: false,
	},
};
