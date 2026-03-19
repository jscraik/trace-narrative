import { HelpCircle, RefreshCw, Save } from "lucide-react";
import type {
	AttributionNoteSummary,
	AttributionPrefs,
	ContributionStats,
} from "../../core/attribution-api";
import { formatToolName } from "../../core/attribution-api";
import type { SourceLine } from "./AuthorBadge";

export interface SourceLensStatsProps {
	lines: SourceLine[];
	stats: ContributionStats | null;
	noteSummary: AttributionNoteSummary | null;
	prefs: AttributionPrefs | null;
	statsError: string | null;
	noteSummaryError: string | null;
	syncStatus: string | null;
	syncing: boolean;
	onImportNote: () => void;
	onExportNote: () => void;
	onEnableMetadata: () => void;
	showHeader?: boolean;
}

export function SourceLensStats({
	lines,
	stats,
	noteSummary,
	prefs,
	statsError,
	noteSummaryError,
	syncStatus,
	syncing,
	onImportNote,
	onExportNote,
	onEnableMetadata,
	showHeader = true,
}: SourceLensStatsProps) {
	// Calculate stats from current lines
	const agentLines = lines.filter(
		(l) => l.authorType === "ai_agent" || l.authorType === "ai_tab",
	).length;
	const mixedLines = lines.filter((l) => l.authorType === "mixed").length;
	const humanLines = lines.filter((l) => l.authorType === "human").length;
	const agentPercentage =
		lines.length > 0
			? Math.round(((agentLines + mixedLines * 0.5) / lines.length) * 100)
			: 0;
	const hasLocalOnly = lines.some(
		(line) => line.authorType !== "human" && line.traceAvailable === false,
	);
	const hasNote = noteSummary?.hasNote ?? false;
	const metadataAvailable = noteSummary?.metadataAvailable ?? false;
	const metadataCached = noteSummary?.metadataCached ?? false;
	const coveragePercent = noteSummary?.coverage?.coveragePercent;
	const coverageLabel =
		typeof coveragePercent === "number"
			? `${Math.round(coveragePercent)}%`
			: "Unknown";
	const evidenceLabel = (() => {
		if (!noteSummary?.hasNote) return "No notes";
		if (metadataCached) return "Notes + cached metadata";
		if (metadataAvailable) return "Notes only (metadata not cached)";
		return "Notes only (no metadata in note)";
	})();
	const evidenceTitle = (() => {
		if (!noteSummary?.hasNote)
			return "No attribution note found for this commit.";
		if (metadataCached) return "Prompt metadata cached locally.";
		if (metadataAvailable) return "Metadata is available but not cached yet.";
		return "Note contains ranges only (no prompt metadata).";
	})();
	const evidenceTone = (() => {
		if (!noteSummary?.hasNote) return "bg-bg-primary text-text-tertiary";
		if (metadataCached) return "bg-accent-green-bg text-accent-green";
		return "bg-accent-amber-bg text-accent-amber";
	})();
	const cacheEnabled = prefs?.cachePromptMetadata ?? false;
	const showMetadataOptIn =
		metadataAvailable && !metadataCached && !cacheEnabled;
	const showMetadataPending =
		metadataAvailable && !metadataCached && cacheEnabled;
	return (
		<>
			{/* Header with stats */}
			<div className="flex items-center justify-between">
				<div>
					{showHeader ? (
						<>
							<div className="section-header">SOURCE LENS</div>
							<div className="section-subheader">Line-by-line attribution</div>
						</>
					) : null}
					{!hasNote ? (
						<div className="mt-2 text-[0.6875rem] text-text-muted">
							No attribution note yet. Source Lens only shows data written by
							your tools.
						</div>
					) : null}
					{hasLocalOnly ? (
						<div className="mt-2 text-[0.6875rem] text-text-muted">
							Session traces are local-only. Import local sessions to view trace
							details.
						</div>
					) : null}
					<div className="mt-2 flex flex-wrap items-center gap-2 text-[0.6875rem] text-text-muted">
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${evidenceTone}`}
							title={evidenceTitle}
						>
							Data source: {evidenceLabel}
						</span>
						<span title="Coverage = percent of lines with attribution data">
							Coverage: {coverageLabel}
						</span>
					</div>
				</div>
				<div className="flex flex-col items-end gap-2">
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-accent-green" />
						<span className="text-xs text-text-tertiary">
							{agentLines} Agent (AI generated)
						</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-accent-amber" />
						<span className="text-xs text-text-tertiary">
							{mixedLines} Mixed (AI + edits)
						</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-border-medium" />
						<span className="text-xs text-text-tertiary">
							{humanLines} Human (no AI trace)
						</span>
					</div>
					{mixedLines > 0 ? (
						<div className="text-[0.6875rem] text-text-muted inline-flex items-center gap-1">
							<span>Mixed = AI text that was later edited.</span>
							<span title="Legend: AI-generated vs AI-assisted vs human edits.">
								<HelpCircle
									className="h-3 w-3 text-text-muted"
									aria-hidden="true"
								/>
							</span>
						</div>
					) : null}
					<div className="mt-2 flex items-center gap-2">
						<button
							type="button"
							onClick={onImportNote}
							disabled={syncing}
							className="inline-flex items-center gap-1 rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[0.6875rem] font-medium text-text-secondary transition-colors motion-reduce:transition-none hover:bg-bg-tertiary disabled:opacity-50"
						>
							<RefreshCw
								className={`h-3 w-3 ${syncing ? "motion-safe:animate-spin" : ""}`}
							/>
							Import note
						</button>
						<button
							type="button"
							onClick={onExportNote}
							disabled={syncing}
							className="inline-flex items-center gap-1 rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[0.6875rem] font-medium text-text-secondary transition-colors motion-reduce:transition-none hover:bg-bg-tertiary disabled:opacity-50"
						>
							<Save className="h-3 w-3" />
							Export note
						</button>
					</div>
				</div>
			</div>

			{/* Stats bar */}
			<div className="mt-4 flex h-2 rounded-full overflow-hidden">
				{agentLines > 0 && (
					<div
						className="bg-accent-green"
						style={{ width: `${(agentLines / lines.length) * 100}%` }}
					/>
				)}
				{mixedLines > 0 && (
					<div
						className="bg-accent-amber"
						style={{ width: `${(mixedLines / lines.length) * 100}%` }}
					/>
				)}
				{humanLines > 0 && (
					<div
						className="bg-border-medium"
						style={{ width: `${(humanLines / lines.length) * 100}%` }}
					/>
				)}
			</div>
			<div className="mt-1 text-xs text-text-tertiary text-right">
				{agentPercentage}% agent-generated
			</div>
			{stats?.toolBreakdown && stats.toolBreakdown.length > 0 ? (
				<div className="mt-2 text-[0.6875rem] text-text-tertiary text-right">
					Tools:{" "}
					{stats.toolBreakdown.slice(0, 2).map((toolStat, index) => (
						<span key={`${toolStat.tool}-${toolStat.model ?? "unknown"}`}>
							{index > 0 ? " · " : ""}
							{formatToolName(toolStat.tool)} {toolStat.lineCount}
						</span>
					))}
				</div>
			) : null}
			{noteSummary?.promptCount ? (
				<div className="mt-1 text-[0.6875rem] text-text-muted text-right">
					Prompts: {noteSummary.promptCount}
				</div>
			) : null}
			<div className="mt-3 rounded-md border border-border-subtle bg-bg-tertiary px-3 py-2 text-[0.6875rem] text-text-secondary">
				<div className="font-semibold">How to read this</div>
				<ul className="mt-1 list-disc pl-4 space-y-1 text-text-tertiary">
					<li>Badge shows the primary source for each line.</li>
					<li>Row tint shows AI influence (if any).</li>
					<li>Coverage reflects how much of the file has attribution data.</li>
				</ul>
			</div>
			{showMetadataPending ? (
				<div className="mt-3 rounded-md border border-accent-amber-light bg-accent-amber-bg px-3 py-2 text-[0.6875rem] text-text-secondary">
					<div className="font-semibold text-accent-amber">
						Prompt metadata caching is enabled.
					</div>
					<div className="mt-1">
						Re-import the attribution note to cache prompt summaries.
					</div>
				</div>
			) : null}
			{showMetadataOptIn ? (
				<div className="mt-3 rounded-md border border-accent-blue-light bg-accent-blue-bg px-3 py-2 text-[0.6875rem] text-text-secondary">
					<div className="font-semibold text-accent-blue">
						Prompt metadata is available for this repo.
					</div>
					<div className="mt-1">
						Enable caching to view prompt summaries and tool/model details.
					</div>
					<button
						type="button"
						onClick={onEnableMetadata}
						disabled={syncing}
						className="mt-2 inline-flex items-center gap-1 rounded-md border border-accent-blue-light bg-bg-secondary px-2 py-1 text-[0.6875rem] font-semibold text-accent-blue hover:bg-accent-blue-light disabled:opacity-50"
					>
						Enable metadata
					</button>
				</div>
			) : null}
			{syncStatus ? (
				<div className="mt-2 text-[0.6875rem] text-text-muted text-right">
					{syncStatus}
				</div>
			) : null}
			{statsError ? (
				<div className="mt-2 text-[0.6875rem] text-accent-amber text-right">
					{statsError}
				</div>
			) : null}
			{noteSummaryError ? (
				<div className="mt-2 text-[0.6875rem] text-accent-amber text-right">
					{noteSummaryError}
				</div>
			) : null}
			<div className="mt-3 text-[0.6875rem] text-text-muted">
				Attribution indicates how lines were generated or edited; it is not a
				legal ownership claim.
			</div>
		</>
	);
}
