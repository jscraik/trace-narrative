import clsx from "clsx";
import type { CaptureReliabilityStatus } from "../../core/tauri/ingestConfig";
import type { Mode } from "../../core/types";
import type { RepoState } from "../../hooks/useRepoLoader";
import { ActivityBarChart, MiniBarChart } from "../components/charts";
import { DashboardTrustBadge } from "../components/dashboard/DashboardTrustBadge";
import { SectionHeader } from "../components/SectionHeader";
import {
	buildNarrativeSurfaceViewModel,
	type SurfaceAction,
} from "./narrativeSurfaceData";
import { CompactKpiStrip } from "./narrativeSurfaceSections";

interface RepoPulseViewProps {
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

export function RepoPulseView({
	repoState,
	captureReliabilityStatus,
	autoIngestEnabled,
	onOpenRepo: _onOpenRepo,
	onImportSession: _onImportSession,
}: RepoPulseViewProps) {
	const viewModel = buildNarrativeSurfaceViewModel(
		"repo-pulse",
		repoState,
		captureReliabilityStatus,
		autoIngestEnabled,
	);
	const _repoPath = getRepoPath(repoState);

	const mockCommitsByRepo = [
		{ label: "trace-narrative", value: 124, tone: "amber" as const },
		{ label: "codex-agent-skills", value: 89, tone: "violet" as const },
		{ label: "brainwav-com", value: 34, tone: "blue" as const },
	];

	const mockWeeklyActivity = Array.from({ length: 30 }).map((_, i) => ({
		date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString(
			"en-GB",
			{ month: "short", day: "numeric" },
		),
		value: Math.floor(Math.random() * 20),
		tone: "amber" as const,
	}));

	const mockPrList = [
		{
			title: "feat: add UI density uplift",
			repo: "trace-narrative",
			status: "Merged",
			id: "PR-342",
		},
		{
			title: "fix: resolve flaky e2e tests",
			repo: "trace-narrative",
			status: "Draft",
			id: "PR-341",
		},
		{
			title: "docs: update AGENTS.md instructions",
			repo: "codex-agent-skills",
			status: "Open",
			id: "PR-12",
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

					<div className="grid gap-6 lg:grid-cols-2">
						<article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
							<h2 className="text-sm font-semibold text-text-primary">
								Commit Activity (30d)
							</h2>
							<div className="flex-1 mt-2 min-h-40">
								<ActivityBarChart data={mockWeeklyActivity} />
							</div>
						</article>

						<article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
							<h2 className="text-sm font-semibold text-text-primary">
								Commits by Repo
							</h2>
							<MiniBarChart data={mockCommitsByRepo} />
						</article>
					</div>

					<article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
						<h2 className="text-sm font-semibold text-text-primary">
							Pull Requests
						</h2>
						<div className="flex flex-col divide-y divide-border-subtle border border-border-light rounded-xl bg-bg-primary">
							{mockPrList.map((pr) => (
								<div
									key={pr.id}
									className="flex justify-between p-3 text-sm hover:bg-bg-subtle"
								>
									<div className="flex flex-col gap-1">
										<span className="text-text-primary font-medium">
											{pr.title}
										</span>
										<span className="text-text-muted text-xs">{pr.repo}</span>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-text-muted">{pr.id}</span>
										<span
											className={clsx(
												"font-mono px-1.5 rounded text-xs py-0.5",
												pr.status === "Merged"
													? "bg-accent-violet/10 text-accent-violet"
													: pr.status === "Open"
														? "bg-accent-emerald/10 text-accent-emerald"
														: "bg-text-muted/10 text-text-muted",
											)}
										>
											{pr.status}
										</span>
									</div>
								</div>
							))}
						</div>
					</article>
				</div>
			</main>
		</div>
	);
}
