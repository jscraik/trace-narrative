import { useEffect, useState } from "react";
import type { AttributionPrefs } from "../../core/attribution-api";
import {
	getStoryAnchorStatus,
	type StoryAnchorCommitStatus,
} from "../../core/story-anchors-api";
import { useSourceLensData } from "../../hooks/useSourceLensData";
import type { SourceLine } from "./AuthorBadge";
import { SourceLensEmptyStates } from "./SourceLensEmptyStates";
import { SourceLensLineTable } from "./SourceLensLineTable";
import { SourceLensStats } from "./SourceLensStats";

export interface SourceLensViewProps {
	repoId: number;
	commitSha: string;
	filePath: string;
	prefsOverride?: AttributionPrefs | null;
	showHeader?: boolean;
}

export function SourceLensView({
	repoId,
	commitSha,
	filePath,
	prefsOverride,
	showHeader = true,
}: SourceLensViewProps) {
	const [anchorStatus, setAnchorStatus] =
		useState<StoryAnchorCommitStatus | null>(null);
	const [anchorStatusError, setAnchorStatusError] = useState<string | null>(
		null,
	);

	useEffect(() => {
		let cancelled = false;
		setAnchorStatus(null);
		setAnchorStatusError(null);
		getStoryAnchorStatus(repoId, [commitSha])
			.then((rows) => {
				if (cancelled) return;
				setAnchorStatus(rows[0] ?? null);
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				setAnchorStatusError(e instanceof Error ? e.message : String(e));
			});
		return () => {
			cancelled = true;
		};
	}, [repoId, commitSha]);

	const {
		lines,
		stats,
		noteSummary,
		prefs,
		loading,
		syncing,
		hasMore,
		error,
		statsError,
		noteSummaryError,
		syncStatus,
		loadMore,
		handleImportNote,
		handleExportNote,
		handleEnableMetadata,
	} = useSourceLensData({ repoId, commitSha, filePath });

	const anchorsText = (() => {
		if (anchorStatus) {
			return `Story Anchors: attribution ${anchorStatus.hasAttributionNote ? "✓" : "—"} · sessions ${
				anchorStatus.hasSessionsNote ? "✓" : "—"
			} · lineage ${anchorStatus.hasLineageNote ? "✓" : "—"}`;
		}
		if (anchorStatusError) return "Story Anchors: status unavailable";
		return null;
	})();

	if ((loading && lines.length === 0) || error || lines.length === 0) {
		return (
			<SourceLensEmptyStates
				loading={loading}
				error={error}
				lineCount={lines.length}
				showHeader={showHeader}
			/>
		);
	}

	const hasNote = noteSummary?.hasNote ?? false;
	const hasAiSignals = lines.some(
		(line) => line.authorType !== "human" && line.authorType !== "unknown",
	);
	const showSetup = !hasNote && !hasAiSignals;

	if (showSetup) {
		return (
			<div className="card p-5">
				{showHeader ? (
					<>
						<div className="section-header">SOURCE LENS</div>
						<div className="section-subheader">Line-by-line attribution</div>
					</>
				) : null}
				<div className="mt-3 text-sm text-text-secondary">
					Source Lens only works when Narrative has attribution data (notes or
					local cache). It does not guess.
				</div>
				{anchorsText ? (
					<div className="mt-2 text-[0.6875rem] text-text-muted">
						{anchorsText}
					</div>
				) : null}
				<ol className="mt-3 list-decimal pl-5 text-xs text-text-tertiary space-y-1">
					<li>
						Install Story Anchors hooks in Settings (recommended) or generate
						attribution notes via your workflow.
					</li>
					<li>Click “Import note” to pull attribution data for this commit.</li>
					<li>Re-open this file to see AI vs human lines.</li>
				</ol>
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={handleImportNote}
						disabled={syncing}
						className="inline-flex items-center gap-1 rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[0.6875rem] font-medium text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
					>
						Import note
					</button>
				</div>
				{syncStatus ? (
					<div className="mt-2 text-[0.6875rem] text-text-muted">
						{syncStatus}
					</div>
				) : null}
			</div>
		);
	}

	const effectivePrefs = prefsOverride ?? prefs;
	const showLineOverlays = effectivePrefs?.showLineOverlays ?? true;

	return (
		<div className="card overflow-hidden">
			<div className="p-5 border-b border-border-subtle">
				{anchorsText ? (
					<div className="mb-2 text-[0.6875rem] text-text-muted">
						{anchorsText}
					</div>
				) : null}
				<SourceLensStats
					lines={lines}
					stats={stats}
					noteSummary={noteSummary}
					prefs={effectivePrefs}
					statsError={statsError}
					noteSummaryError={noteSummaryError}
					syncStatus={syncStatus}
					syncing={syncing}
					onImportNote={handleImportNote}
					onExportNote={handleExportNote}
					onEnableMetadata={handleEnableMetadata}
					showHeader={showHeader}
				/>
			</div>

			{!showLineOverlays ? (
				<div className="px-5 py-3 text-xs text-text-muted border-b border-border-subtle">
					Line overlays are hidden by preference.
				</div>
			) : null}

			<SourceLensLineTable lines={lines} showLineOverlays={showLineOverlays} />

			{hasMore && (
				<div className="p-3 border-t border-border-subtle text-center">
					<button
						type="button"
						onClick={loadMore}
						className="text-xs font-medium text-accent-blue hover:text-accent-blue/80"
					>
						Load more...
					</button>
				</div>
			)}
		</div>
	);
}

// Re-export types for convenience
export type { SourceLine };
