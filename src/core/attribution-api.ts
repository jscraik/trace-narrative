/**
 * Attribution tracking API
 *
 * Types and functions for AI contribution tracking.
 */

import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
// Re-exported for consumer use (type-only import for re-export)
import type {
	DashboardStats,
	TimeRange,
	ToolStats,
	TrendColor,
	TrendContext,
} from "./types";

// ============================================================================
// Types (Legacy - for backward compatibility)
// ============================================================================

// Zod schemas for contract validation
const ToolStatsSchema = z.object({
	tool: z.string(),
	model: z.string().optional(),
	lineCount: z.number(),
});

const TrendPointSchema = z.object({
	date: z.string(),
	granularity: z.enum(["hour", "day", "week"]),
	aiPercentage: z.number(),
	commitCount: z.number(),
});

const FileStatsSchema = z.object({
	filePath: z.string(),
	totalLines: z.number(),
	aiLines: z.number(),
	aiPercentage: z.number(),
	commitCount: z.number(),
});

const PeriodAttributionSchema = z.object({
	totalLines: z.number(),
	humanLines: z.number(),
	aiAgentLines: z.number(),
	aiAssistLines: z.number(),
	collaborativeLines: z.number(),
	aiPercentage: z.number(),
});

const PeriodStatsSchema = z.object({
	period: z.object({
		start: z.string(),
		end: z.string(),
		commits: z.number(),
	}),
	attribution: PeriodAttributionSchema,
	toolBreakdown: z.array(ToolStatsSchema),
	trend: z.array(TrendPointSchema),
});

const PaginatedFilesSchema = z.object({
	files: z.array(FileStatsSchema),
	total: z.number(),
	offset: z.number(),
	limit: z.number(),
	hasMore: z.boolean(),
});

const DashboardStatsSchema = z.object({
	repo: z.object({
		id: z.number(),
		path: z.string(),
		name: z.string(),
	}),
	timeRange: z.union([
		z.enum(["7d", "30d", "90d", "all"]),
		z.object({ from: z.string(), to: z.string() }),
	]),
	currentPeriod: PeriodStatsSchema,
	previousPeriod: PeriodStatsSchema.optional(),
	topFiles: PaginatedFilesSchema,
});

// ============================================================================
// Dashboard API Functions
// ============================================================================

/**
 * Get complete dashboard stats in a single call.
 * Uses precomputed cache for fast queries; returns previous period for comparison.
 */
export async function getDashboardStats(
	repoId: number,
	timeRange: TimeRange = "30d",
	filesOffset: number = 0,
	filesLimit: number = 20,
): Promise<DashboardStats> {
	const raw = await invoke("get_dashboard_stats", {
		repoId,
		timeRange,
		filesOffset,
		filesLimit,
	});

	// Validate contract with Zod
	return DashboardStatsSchema.parse(raw);
}

/**
 * Convert a time range preset or custom range to date strings.
 */
export function timeRangeToDateRange(timeRange: TimeRange): {
	from: string;
	to: string;
} {
	if (typeof timeRange === "object" && "from" in timeRange) {
		return timeRange;
	}

	const to = new Date();
	const from = new Date();

	switch (timeRange) {
		case "7d":
			from.setDate(to.getDate() - 7);
			break;
		case "30d":
			from.setDate(to.getDate() - 30);
			break;
		case "90d":
			from.setDate(to.getDate() - 90);
			break;
		case "all":
			from.setFullYear(from.getFullYear() - 100); // Effectively "all time"
			break;
	}

	return {
		from: from.toISOString().split("T")[0],
		to: to.toISOString().split("T")[0],
	};
}

/**
 * Compute trend direction for metric cards.
 * Returns 'up', 'down', 'neutral', or undefined if no previous value.
 */
export function computeTrend(
	current: number,
	previous?: number,
): "up" | "down" | "neutral" | undefined {
	if (previous === undefined) return undefined;
	const delta = current - previous;
	if (Math.abs(delta) < 0.01) return "neutral";
	return delta > 0 ? "up" : "down";
}

/**
 * Determine if a trend direction is "good" or "bad" based on metric context.
 * Not all "up" trends are positive!
 */
export function getTrendColor(context: TrendContext): TrendColor {
	const { metric, direction, currentValue, previousValue } = context;
	const delta =
		previousValue !== undefined
			? ((currentValue - previousValue) / previousValue) * 100
			: 0;

	if (direction === "neutral") {
		return {
			// Used directly as a Tailwind class in the UI.
			color: "text-text-muted",
			label: "No change",
			icon: "minus",
			ariaLabel: `${metric}: no change from previous period`,
		};
	}

	// Determine if this direction is "good" for the metric
	const isPositive = isTrendPositive(metric, direction);
	// Used directly as a Tailwind class in the UI.
	const color = isPositive ? "text-accent-green" : "text-accent-red";
	const sign = direction === "up" ? "+" : "";

	return {
		color,
		label: `${sign}${delta.toFixed(1)}% from last period`,
		icon: direction === "up" ? "trending_up" : "trending_down",
		ariaLabel: `${metric}: ${direction} by ${Math.abs(delta).toFixed(1)}% from previous period`,
	};
}

/**
 * Internal: Determine if trend direction is positive for given metric.
 */
function isTrendPositive(
	metric: TrendContext["metric"],
	direction: "up" | "down",
): boolean {
	const positiveRules: Record<
		TrendContext["metric"],
		"up" | "down" | "context"
	> = {
		"ai-percentage": "up", // More AI = generally good
		commits: "down", // Fewer commits = faster (good)
		"ai-lines": "context", // Depends on situation
		"human-lines": "up", // More human = good
	};

	const rule = positiveRules[metric];

	if (rule === "context") {
		// For context-dependent metrics, default to neutral
		return false;
	}

	return direction === rule;
}

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

export interface ContributionStats {
	humanLines: number;
	aiAgentLines: number;
	aiAssistLines: number;
	collaborativeLines: number;
	totalLines: number;
	aiPercentage: number;
	toolBreakdown?: ToolStats[];
	primaryTool?: string;
	model?: string;
}

// Re-export ToolStats and dashboard types from types.ts for backward compatibility
export type {
	CommandAuthorityOutcome,
	DashboardEmptyReason,
	DashboardPanelStatus,
	DashboardState,
	DashboardStats,
	DashboardTrustState,
	FileStats,
	PanelStatusMap,
	RetryBudgetProfile,
	TimeRange,
	ToolStats,
	TrendColor,
	TrendContext,
} from "./types";

export interface ImportSuccess {
	path: string;
	sessionId: string;
	warnings: string[];
}

export interface ImportFailure {
	path: string;
	error: string;
	retryable: boolean;
}

export interface BatchImportResult {
	total: number;
	succeeded: ImportSuccess[];
	failed: ImportFailure[];
}

export interface ScannedSession {
	path: string;
	tool: string;
	detectedAt: string;
}

export interface AttributionNoteImportSummary {
	commitSha: string;
	status: string;
	importedRanges: number;
	importedSessions: number;
}

export interface AttributionNoteBatchSummary {
	total: number;
	imported: number;
	missing: number;
	failed: number;
}

export interface AttributionNoteExportSummary {
	commitSha: string;
	status: string;
}

export interface AttributionCoverageSummary {
	totalChangedLines: number;
	attributedLines: number;
	coveragePercent: number;
}

export interface AttributionNoteSummary {
	commitSha: string;
	hasNote: boolean;
	noteRef?: string;
	noteHash?: string;
	schemaVersion?: string;
	metadataAvailable: boolean;
	metadataCached: boolean;
	promptCount?: number;
	coverage?: AttributionCoverageSummary;
	evidenceSource?: string;
}

export interface AttributionPrefs {
	repoId: number;
	cachePromptMetadata: boolean;
	storePromptText: boolean;
	showLineOverlays: boolean;
	retentionDays?: number;
	lastPurgedAt?: string | null;
}

export interface AttributionPrefsUpdate {
	cachePromptMetadata?: boolean;
	storePromptText?: boolean;
	showLineOverlays?: boolean;
	retentionDays?: number;
	clearRetentionDays?: boolean;
}

export interface AttributionPromptPurgeSummary {
	removed: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Scan for available session files in standard locations
 */
export async function scanForSessionFiles(): Promise<ScannedSession[]> {
	return invoke("scan_for_session_files");
}

/**
 * Import a single session file
 */
export async function importSessionFile(
	repoId: number,
	filePath: string,
): Promise<BatchImportResult> {
	return invoke("import_session_file", { repoId, filePath });
}

/**
 * Import multiple session files (batch)
 */
export async function importSessionFiles(
	repoId: number,
	filePaths: string[],
): Promise<BatchImportResult> {
	return invoke("import_session_files", { repoId, filePaths });
}

/**
 * Get contribution stats for a commit
 */
export async function getCommitContributionStats(
	repoId: number,
	commitSha: string,
): Promise<ContributionStats> {
	return invoke("get_commit_contribution_stats", { repoId, commitSha });
}

/**
 * Compute stats for multiple commits (batch)
 */
export async function computeStatsBatch(
	repoId: number,
	commitShas: string[],
): Promise<number> {
	return invoke("compute_stats_batch", { repoId, commitShas });
}

/**
 * Import a single attribution note (git notes) for a commit.
 */
export async function importAttributionNote(
	repoId: number,
	commitSha: string,
): Promise<AttributionNoteImportSummary> {
	return invoke("import_attribution_note", { repoId, commitSha });
}

/**
 * Import attribution notes (git notes) for multiple commits.
 */
export async function importAttributionNotesBatch(
	repoId: number,
	commitShas: string[],
): Promise<AttributionNoteBatchSummary> {
	return invoke("import_attribution_notes_batch", { repoId, commitShas });
}

/**
 * Export local attribution data back into git notes.
 */
export async function exportAttributionNote(
	repoId: number,
	commitSha: string,
): Promise<AttributionNoteExportSummary> {
	return invoke("export_attribution_note", { repoId, commitSha });
}

export async function getAttributionNoteSummary(
	repoId: number,
	commitSha: string,
): Promise<AttributionNoteSummary> {
	return invoke("get_attribution_note_summary", { repoId, commitSha });
}

export async function getAttributionPrefs(
	repoId: number,
): Promise<AttributionPrefs> {
	return invoke("get_attribution_prefs", { repoId });
}

export async function setAttributionPrefs(
	repoId: number,
	update: AttributionPrefsUpdate,
): Promise<AttributionPrefs> {
	return invoke("set_attribution_prefs", { repoId, update });
}

export async function purgeAttributionPromptMeta(
	repoId: number,
): Promise<AttributionPromptPurgeSummary> {
	return invoke("purge_attribution_prompt_meta", { repoId });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format AI percentage for display
 */
export function formatAiPercentage(percentage: number): string {
	if (percentage === 0) return "0%";
	if (percentage < 1) return "<1%";
	return `${Math.round(percentage)}%`;
}

/**
 * Get human-readable tool name
 */
export function formatToolName(tool: string): string {
	const toolNames: Record<string, string> = {
		claude_code: "Claude",
		cursor: "Cursor",
		copilot: "Copilot",
		codex: "Codex",
		gemini: "Gemini",
		continue: "Continue",
	};

	return toolNames[tool] || tool;
}

/**
 * Get badge style based on AI percentage
 */
export function getBadgeStyle(percentage: number) {
	if (percentage >= 80) {
		return {
			bg: "bg-accent-green-bg",
			text: "text-accent-green",
			border: "border-accent-green-light",
			icon: "text-accent-green",
			label: "AI",
		};
	} else if (percentage >= 40) {
		return {
			bg: "bg-accent-amber-bg",
			text: "text-accent-amber",
			border: "border-accent-amber-light",
			icon: "text-accent-amber",
			label: "Mixed",
		};
	} else if (percentage > 0) {
		return {
			bg: "bg-accent-blue-bg",
			text: "text-accent-blue",
			border: "border-accent-blue-light",
			icon: "text-accent-blue",
			label: "Low AI",
		};
	}
	return {
		bg: "bg-bg-page",
		text: "text-text-secondary",
		border: "border-border-light",
		icon: "text-text-tertiary",
		label: "Human",
	};
}
