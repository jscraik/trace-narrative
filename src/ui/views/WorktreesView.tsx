import clsx from "clsx";
import {
	AlertCircle,
	CheckCircle2,
	FolderGit2,
	GitBranch,
	GitCommit,
} from "lucide-react";
import type { CaptureReliabilityStatus } from "../../core/tauri/ingestConfig";
import type { Mode } from "../../core/types";
import type { RepoState } from "../../hooks/useRepoLoader";
import { DashboardTrustBadge } from "../components/dashboard/DashboardTrustBadge";
import { SectionHeader } from "../components/SectionHeader";
import { Eyebrow } from "../components/typography/Eyebrow";
import {
	buildNarrativeSurfaceViewModel,
	type SurfaceAction,
} from "./narrativeSurfaceData";
import { CompactKpiStrip } from "./narrativeSurfaceSections";

interface WorktreesViewProps {
	repoState: RepoState;
	captureReliabilityStatus?: CaptureReliabilityStatus | null;
	autoIngestEnabled?: boolean;
	onModeChange: (mode: Mode) => void;
	onOpenRepo: () => void;
	onImportSession?: () => void;
	onAction?: (action: SurfaceAction) => void;
}

function getRepoPath(repoState: RepoState): string {
	if (repoState.status === "ready") return repoState.repo.root;
	if (repoState.status !== "idle")
		return repoState.path ?? "~/dev/trace-narrative";
	return "~/dev/trace-narrative";
}

function getRepoName(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1] || "trace-narrative";
}

interface Worktree {
	id: string;
	branch: string;
	repoName: string;
	path: string;
	isDirty: boolean;
	filesChanged: number;
	isMain: boolean;
	isDetachedHead?: boolean;
}

function WorktreeRow({ worktree }: { worktree: Worktree }) {
	const StatusIcon = worktree.isDirty ? AlertCircle : CheckCircle2;
	const statusColor = worktree.isDirty
		? "text-accent-amber"
		: "text-accent-green";

	return (
		<div
			className={clsx(
				"flex items-center justify-between rounded-xl border border-transparent p-3 transition hover:border-border-subtle hover:bg-bg-subtle",
				worktree.isDetachedHead && "opacity-75",
			)}
		>
			<div className="flex items-center gap-3">
				<div
					className={clsx(
						"flex h-8 w-8 items-center justify-center rounded-lg border",
						worktree.isMain
							? "bg-accent-blue/10 border-accent-blue/20 text-accent-blue"
							: "bg-bg-primary border-border-light text-text-muted",
						worktree.isDetachedHead && "border-dashed",
					)}
				>
					{worktree.isDetachedHead ? (
						<GitCommit className="h-4 w-4" />
					) : (
						<GitBranch className="h-4 w-4" />
					)}
				</div>
				<div className="flex flex-col">
					<div className="flex items-center gap-2">
						<span
							className={clsx(
								"text-sm font-medium",
								worktree.isDetachedHead
									? "text-text-secondary italic"
									: "text-text-primary",
							)}
						>
							{worktree.branch}
						</span>
						<span className="text-border-strong">·</span>
						<span className="text-xs text-text-muted flex items-center gap-1">
							<FolderGit2 className="h-3 w-3" />
							{worktree.repoName}
						</span>
					</div>
					<span
						className="mt-0.5 text-xs text-text-tertiary truncate max-w-xs"
						title={worktree.path}
					>
						{worktree.path}
					</span>
				</div>
			</div>
			<div className="flex flex-col items-end gap-1">
				<span
					className={clsx(
						"inline-flex items-center gap-1 rounded-md bg-bg-primary px-2 py-0.5 text-[0.6875rem] font-medium border border-border-light",
						statusColor,
					)}
				>
					<StatusIcon className="h-3 w-3" />
					{worktree.isDirty ? "Dirty" : "Clean"}
				</span>
				<span className="text-xs text-text-muted">
					{worktree.filesChanged} files
				</span>
			</div>
		</div>
	);
}

export function WorktreesView({
	repoState,
	captureReliabilityStatus,
	autoIngestEnabled,
	onOpenRepo: _onOpenRepo,
	onImportSession: _onImportSession,
}: WorktreesViewProps) {
	const viewModel = buildNarrativeSurfaceViewModel(
		"worktrees",
		repoState,
		captureReliabilityStatus,
		autoIngestEnabled,
	);
	const repoPath = getRepoPath(repoState);
	const repoName = getRepoName(repoPath);

	// Mock data for scaffold
	const worktrees: Worktree[] = [
		{
			id: "1",
			branch: "main",
			repoName,
			path: repoPath,
			isDirty: false,
			filesChanged: 0,
			isMain: true,
		},
		{
			id: "2",
			branch: "feature/ui-density",
			repoName,
			path: `${repoPath}-ui-density`,
			isDirty: true,
			filesChanged: 14,
			isMain: false,
		},
		{
			id: "3",
			branch: "fix/git-workflow",
			repoName,
			path: `${repoPath}-fix-git`,
			isDirty: false,
			filesChanged: 3,
			isMain: false,
		},
		{
			id: "4",
			branch: "HEAD detached at 7a8b9c0d",
			repoName,
			path: `${repoPath}-bisect`,
			isDirty: false,
			filesChanged: 0,
			isMain: false,
			isDetachedHead: true,
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col bg-bg-primary">
			<main className="flex-1 overflow-y-auto px-6 py-6">
				<div className="mx-auto flex max-w-6xl flex-col gap-6">
					<SectionHeader
						title={viewModel.title}
						description="{viewModel.subtitle}"
						badge={<DashboardTrustBadge trustState={viewModel.trustState} />}
					/>

					<CompactKpiStrip metrics={viewModel.metrics} />

					<section className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
						<div className="flex items-start justify-between gap-4">
							<div>
								<Eyebrow>Active Worktrees</Eyebrow>
								<h2 className="mt-1 text-xl font-semibold text-text-primary">
									{repoName}
								</h2>
							</div>
							<button
								type="button"
								className="rounded-lg bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary border border-border-light hover:text-text-primary hover:border-border-strong transition"
							>
								+ Add Worktree
							</button>
						</div>

						<div className="flex flex-col gap-2 mt-4">
							{worktrees.map((worktree) => (
								<WorktreeRow key={worktree.id} worktree={worktree} />
							))}
						</div>
					</section>

					<section className="rounded-3xl border border-border-subtle bg-bg-secondary px-5 py-4">
						<p className="text-sm leading-6 text-text-secondary">
							{viewModel.footerNote}
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}
