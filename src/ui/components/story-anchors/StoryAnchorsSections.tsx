export type RepoAnchorCounts = {
	total: number;
	attribution: number;
	sessions: number;
	lineage: number;
	complete: number;
};

function ActionButton(props: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	accent?: boolean;
}) {
	const { label, onClick, disabled = false, accent = false } = props;

	return (
		<button
			type="button"
			disabled={disabled}
			className={[
				"inline-flex items-center rounded-md border px-2 py-1 text-[0.6875rem] font-semibold disabled:opacity-50",
				accent
					? "border-accent-amber-light bg-accent-amber-bg text-accent-amber hover:bg-accent-amber-light"
					: "border-border-light bg-bg-secondary text-text-secondary hover:bg-bg-hover",
			].join(" ")}
			onClick={onClick}
		>
			{label}
		</button>
	);
}

export function HooksStatusRow(props: {
	hookInstalled: boolean | null;
	hooksDir: string | null;
	busy: boolean;
	canRun: boolean;
	onInstallHooks: () => void;
	onUninstallHooks: () => void;
	onRefresh: () => void;
}) {
	const {
		hookInstalled,
		hooksDir,
		busy,
		canRun,
		onInstallHooks,
		onUninstallHooks,
		onRefresh,
	} = props;

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-[0.6875rem] text-text-tertiary">
				Hooks:{" "}
				{hookInstalled === null
					? "Unknown"
					: hookInstalled
						? "Installed"
						: "Not installed"}
			</span>
			{hooksDir ? (
				<span className="text-[0.6875rem] text-text-muted">
					(<span className="font-mono">{hooksDir}</span>)
				</span>
			) : null}
			<ActionButton
				label="Install hooks"
				disabled={busy || !canRun}
				onClick={onInstallHooks}
			/>
			<ActionButton
				label="Uninstall hooks"
				disabled={busy || !canRun}
				onClick={onUninstallHooks}
			/>
			<ActionButton label="Refresh" disabled={busy} onClick={onRefresh} />
		</div>
	);
}

export function RepoActionsCard(props: {
	indexedCount: number;
	repoCounts: RepoAnchorCounts | null;
	exportProgress: { done: number; total: number } | null;
	busy: boolean;
	canRunRepoActions: boolean;
	onRefreshIndexedStatus: () => void;
	onImportSessionsNotes: () => void;
	onExportSessionsNotes: () => void;
	onMigrateAttributionRef: () => void;
	onReconcileDryRun: () => void;
	onReconcileWrite: () => void;
}) {
	const {
		indexedCount,
		repoCounts,
		exportProgress,
		busy,
		canRunRepoActions,
		onRefreshIndexedStatus,
		onImportSessionsNotes,
		onExportSessionsNotes,
		onMigrateAttributionRef,
		onReconcileDryRun,
		onReconcileWrite,
	} = props;

	return (
		<div className="mt-2 flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-tertiary px-3 py-2">
			<div className="text-[0.6875rem] text-text-secondary font-semibold">
				Indexed commits: <span className="font-mono">{indexedCount}</span>
			</div>
			{repoCounts ? (
				<div className="text-[0.6875rem] text-text-tertiary">
					Anchors: attribution {repoCounts.attribution}/{repoCounts.total} ·
					sessions {repoCounts.sessions}/{repoCounts.total} · lineage{" "}
					{repoCounts.lineage}/{repoCounts.total} · complete{" "}
					{repoCounts.complete}/{repoCounts.total}
				</div>
			) : (
				<div className="text-[0.6875rem] text-text-tertiary">
					Refresh to summarize Story Anchors coverage across indexed commits.
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				<ActionButton
					label="Refresh indexed status"
					disabled={busy || !canRunRepoActions}
					onClick={onRefreshIndexedStatus}
				/>
				<ActionButton
					label="Import sessions notes"
					disabled={busy || !canRunRepoActions}
					onClick={onImportSessionsNotes}
				/>
				<ActionButton
					label="Export sessions notes"
					disabled={busy || !canRunRepoActions}
					onClick={onExportSessionsNotes}
				/>
				<ActionButton
					label="Migrate attribution ref"
					disabled={busy || !canRunRepoActions}
					accent
					onClick={onMigrateAttributionRef}
				/>
				<ActionButton
					label="Reconcile (dry-run)"
					disabled={busy || !canRunRepoActions}
					onClick={onReconcileDryRun}
				/>
				<ActionButton
					label="Reconcile (write)"
					disabled={busy || !canRunRepoActions}
					accent
					onClick={onReconcileWrite}
				/>
			</div>
			{exportProgress ? (
				<div className="text-[0.6875rem] text-text-muted">
					Exporting… {exportProgress.done}/{exportProgress.total}
				</div>
			) : null}
		</div>
	);
}

export function CommitActionsCard(props: {
	selectedCommitSha: string;
	status: {
		hasAttributionNote?: boolean;
		hasSessionsNote?: boolean;
		hasLineageNote?: boolean;
	} | null;
	busy: boolean;
	canRunCommitActions: boolean;
	onImportSessionNote: () => void;
	onExportSessionNote: () => void;
	onReconcileNoWrite: () => void;
	onReconcileWrite: () => void;
	onMigrateAttributionRef: () => void;
}) {
	const {
		selectedCommitSha,
		status,
		busy,
		canRunCommitActions,
		onImportSessionNote,
		onExportSessionNote,
		onReconcileNoWrite,
		onReconcileWrite,
		onMigrateAttributionRef,
	} = props;

	return (
		<div className="mt-2 flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-tertiary px-3 py-2">
			<div className="text-[0.6875rem] text-text-secondary font-semibold">
				Selected commit:{" "}
				<span className="font-mono">{selectedCommitSha.slice(0, 8)}</span>
			</div>
			<div className="text-[0.6875rem] text-text-tertiary">
				Notes: attribution {status?.hasAttributionNote ? "✓" : "—"} · sessions{" "}
				{status?.hasSessionsNote ? "✓" : "—"} · lineage{" "}
				{status?.hasLineageNote ? "✓" : "—"}
			</div>
			<div className="flex flex-wrap gap-2">
				<ActionButton
					label="Import sessions note"
					disabled={busy || !canRunCommitActions}
					onClick={onImportSessionNote}
				/>
				<ActionButton
					label="Export sessions note"
					disabled={busy || !canRunCommitActions}
					onClick={onExportSessionNote}
				/>
				<ActionButton
					label="Reconcile (no write)"
					disabled={busy || !canRunCommitActions}
					onClick={onReconcileNoWrite}
				/>
				<ActionButton
					label="Reconcile (write)"
					disabled={busy || !canRunCommitActions}
					accent
					onClick={onReconcileWrite}
				/>
				<ActionButton
					label="Migrate attribution ref"
					disabled={busy || !canRunCommitActions}
					accent
					onClick={onMigrateAttributionRef}
				/>
			</div>
		</div>
	);
}
