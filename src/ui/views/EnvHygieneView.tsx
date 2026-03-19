import clsx from "clsx";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	FileKey2,
	ShieldAlert,
} from "lucide-react";
import { useState } from "react";
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

interface EnvHygieneViewProps {
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

interface HygieneIssue {
	id: string;
	repoName: string;
	description: string;
	severity: "amber" | "red";
}

function HygieneIssueRow({ issue }: { issue: HygieneIssue }) {
	const Icon = issue.severity === "red" ? ShieldAlert : AlertTriangle;
	const colors =
		issue.severity === "red"
			? "bg-accent-red-bg text-accent-red border-accent-red-light"
			: "bg-accent-amber-bg text-accent-amber border-accent-amber-light";

	return (
		<div className="flex items-center justify-between rounded-xl border border-transparent p-3 transition hover:border-border-subtle hover:bg-bg-subtle text-left w-full group">
			<div className="flex items-center gap-3 w-full">
				<div
					className={clsx(
						"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
						colors,
					)}
				>
					<Icon className="h-4 w-4" />
				</div>
				<div className="flex flex-col min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-text-primary group-hover:text-accent-violet transition-colors truncate">
							{issue.repoName}
						</span>
						<span className="text-border-strong px-1">·</span>
						<span className="text-sm text-text-secondary truncate pr-4">
							{issue.description}
						</span>
					</div>
				</div>
				<button
					type="button"
					className="shrink-0 text-xs px-2 py-1 bg-bg-primary rounded border border-border-light hover:border-border-strong text-text-secondary transition duration-200 ease-out active:duration-75 active:scale-[0.98]"
				>
					Review
				</button>
			</div>
		</div>
	);
}

interface EnvRepo {
	name: string;
	expanded: boolean;
	files: { name: string; ignored: boolean }[];
}

function EnvRepoGroup({
	repo,
	onToggle,
}: {
	repo: EnvRepo;
	onToggle: () => void;
}) {
	return (
		<div className="flex flex-col border border-border-light rounded-2xl overflow-hidden bg-bg-primary">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center justify-between p-3 bg-bg-secondary hover:bg-bg-subtle transition"
			>
				<div className="flex items-center gap-2">
					{repo.expanded ? (
						<ChevronDown className="h-4 w-4 text-text-muted" />
					) : (
						<ChevronRight className="h-4 w-4 text-text-muted" />
					)}
					<span className="text-sm font-semibold text-text-primary">
						{repo.name}
					</span>
					<span className="text-xs text-text-muted bg-bg-primary px-1.5 rounded-md border border-border-light">
						{repo.files.length}
					</span>
				</div>
			</button>

			{repo.expanded && (
				<div className="flex flex-col p-2 border-t border-border-light divide-y divide-border-subtle">
					{repo.files.map((file) => (
						<div
							key={file.name}
							className="flex items-center justify-between p-2 pl-8 hover:bg-bg-subtle rounded-lg"
						>
							<div className="flex items-center gap-3">
								<FileKey2 className="h-4 w-4 text-text-secondary" />
								<span className="text-sm font-mono text-text-secondary">
									{file.name}
								</span>
							</div>
							<div className="flex items-center gap-2">
								{file.ignored ? (
									<span className="inline-flex items-center gap-1 rounded-md bg-accent-green/10 px-2 py-0.5 text-xs font-medium text-accent-green border border-accent-green/20">
										<EyeOff className="h-3 w-3" /> Ignored
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-md bg-accent-red-bg px-2 py-0.5 text-xs font-medium text-accent-red border border-accent-red-light">
										<Eye className="h-3 w-3" /> Tracked!
									</span>
								)}
							</div>
						</div>
					))}
					{repo.files.length === 0 && (
						<div className="p-4 text-center text-xs text-text-muted">
							No .env files detected.
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export function EnvHygieneView({
	repoState,
	captureReliabilityStatus,
	autoIngestEnabled,
	onOpenRepo: _onOpenRepo,
	onImportSession: _onImportSession,
}: EnvHygieneViewProps) {
	const viewModel = buildNarrativeSurfaceViewModel(
		"hygiene",
		repoState,
		captureReliabilityStatus,
		autoIngestEnabled,
	);
	const repoPath = getRepoPath(repoState);
	const repoName = getRepoName(repoPath);

	const [repos, setRepos] = useState<EnvRepo[]>([
		{
			name: repoName,
			expanded: true,
			files: [
				{ name: ".env", ignored: true },
				{ name: ".env.local", ignored: true },
				{ name: "config/.env.production", ignored: false },
			],
		},
		{
			name: "agent-skills",
			expanded: false,
			files: [{ name: ".env", ignored: true }],
		},
	]);

	const toggleRepo = (index: number) => {
		setRepos((prev) =>
			prev.map((r, i) => (i === index ? { ...r, expanded: !r.expanded } : r)),
		);
	};

	const issues: HygieneIssue[] = [
		{
			id: "1",
			repoName,
			description:
				"Tracked environment file config/.env.production contains potential secrets",
			severity: "red",
		},
		{
			id: "2",
			repoName: "agent-skills",
			description: "Stale configuration detected in .codex/project.rules",
			severity: "amber",
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

					<div className="grid gap-6 xl:grid-cols-2">
						<section className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
							<div className="flex items-start justify-between gap-4 border-b border-border-light pb-4">
								<div>
									<Eyebrow>Security & Standards</Eyebrow>
									<h2 className="mt-1 text-xl font-semibold text-text-primary flex items-center gap-2">
										<AlertTriangle className="h-5 w-5 text-accent-amber" />
										Issues
									</h2>
								</div>
							</div>

							<div className="flex flex-col gap-2 mt-2">
								{issues.map((issue) => (
									<HygieneIssueRow key={issue.id} issue={issue} />
								))}
								{issues.length === 0 && (
									<div className="py-8 text-center text-sm text-text-secondary border border-dashed border-border-light rounded-2xl flex flex-col items-center gap-3">
										<CheckCircle2 className="h-8 w-8 text-accent-green/50" />
										No hygiene issues detected!
									</div>
								)}
							</div>
						</section>

						<section className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
							<div className="flex items-start justify-between gap-4 border-b border-border-light pb-4">
								<div>
									<Eyebrow>Secret Management</Eyebrow>
									<h2 className="mt-1 text-xl font-semibold text-text-primary flex items-center gap-2">
										<FileKey2 className="h-5 w-5 text-text-secondary" />
										Env Files
									</h2>
								</div>
								<button
									type="button"
									className="rounded-lg bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary border border-border-light hover:text-text-primary hover:border-border-strong transition"
								>
									Scan All
								</button>
							</div>

							<div className="flex flex-col gap-3 mt-2">
								{repos.map((repo, i) => (
									<EnvRepoGroup
										key={repo.name}
										repo={repo}
										onToggle={() => toggleRepo(i)}
									/>
								))}
							</div>
						</section>
					</div>

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
