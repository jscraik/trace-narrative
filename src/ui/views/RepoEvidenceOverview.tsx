import {
	ArrowRight,
	Clock3,
	GitCommitHorizontal,
	Link2,
	ShieldCheck,
	ShieldX,
	Waypoints,
} from "lucide-react";

import type { CaptureReliabilityStatus } from "../../core/tauri/ingestConfig";
import type {
	BranchViewModel,
	DashboardTrustState,
	Mode,
} from "../../core/types";
import { DashboardTrustBadge } from "../components/dashboard/DashboardTrustBadge";
import { Eyebrow } from "../components/typography/Eyebrow";

interface RepoEvidenceOverviewProps {
	model: BranchViewModel;
	captureReliabilityStatus?: CaptureReliabilityStatus | null;
	onModeChange?: (mode: Mode) => void;
}

type EvidenceMetricTone = "blue" | "violet" | "green" | "amber";

const toneClasses: Record<EvidenceMetricTone, string> = {
	blue: "border-accent-blue-light bg-accent-blue/10 text-accent-blue",
	violet: "border-accent-violet-light bg-accent-violet/10 text-accent-violet",
	green: "border-accent-green-light bg-accent-green-bg text-accent-green",
	amber: "border-accent-amber-light bg-accent-amber-bg text-accent-amber",
};

function deriveTrustState(
	status?: CaptureReliabilityStatus | null,
): DashboardTrustState {
	if (!status) return "healthy";
	if (status.mode === "FAILURE") return "degraded";
	if (status.mode === "DEGRADED_STREAMING") return "degraded";
	if (status.streamExpected && !status.streamHealthy) return "degraded";
	return "healthy";
}

function deriveRepoPath(model: BranchViewModel): string {
	return model.meta?.repoPath ?? "~/dev/trace-narrative";
}

function deriveBranchLabel(model: BranchViewModel): string {
	return model.meta?.branchName ?? model.title ?? "Active branch";
}

export function RepoEvidenceOverview({
	model,
	captureReliabilityStatus,
	onModeChange,
}: RepoEvidenceOverviewProps) {
	const trustState = deriveTrustState(captureReliabilityStatus);
	const repoPath = deriveRepoPath(model);
	const branchLabel = deriveBranchLabel(model);
	const linkedSessions =
		model.sessionExcerpts?.filter((session) => Boolean(session.linkedCommitSha))
			.length ?? 0;
	const floatingSessions =
		(model.sessionExcerpts?.length ?? 0) - linkedSessions;
	const traceCommitCount = Object.keys(
		model.traceSummaries?.byCommit ?? {},
	).length;
	const snapshotCount = model.snapshots?.length ?? 0;
	const evidenceCount = model.narrative?.evidenceLinks.length ?? 0;
	const timelineCount = model.timeline.length;

	const evidenceMetrics: Array<{
		label: string;
		value: string;
		detail: string;
		tone: EvidenceMetricTone;
		icon: typeof GitCommitHorizontal;
	}> = [
		{
			label: "Claim support",
			value: evidenceCount > 0 ? `${evidenceCount} links` : "Needs proof",
			detail:
				evidenceCount > 0
					? "Narrative claims already point back to concrete evidence objects."
					: "No stable claim should survive without linked proof.",
			tone: evidenceCount > 0 ? "blue" : "amber",
			icon: GitCommitHorizontal,
		},
		{
			label: "Session joins",
			value: `${linkedSessions} linked`,
			detail:
				floatingSessions > 0
					? `${floatingSessions} still floating.`
					: "Current session evidence is already joined.",
			tone: floatingSessions > 0 ? "amber" : "green",
			icon: Link2,
		},
		{
			label: "Trace coverage",
			value: timelineCount > 0 ? `${traceCommitCount}/${timelineCount}` : "0/0",
			detail:
				traceCommitCount > 0
					? "Visible commit lane already exposes trace summaries."
					: "No trace coverage on the visible commit lane yet.",
			tone: traceCommitCount > 0 ? "violet" : "amber",
			icon: Waypoints,
		},
		{
			label: "Snapshots",
			value: snapshotCount > 0 ? `${snapshotCount}` : "None",
			detail:
				snapshotCount > 0
					? "Snapshot review is ready when rollback needs proof."
					: "No saved state to compare against yet.",
			tone: snapshotCount > 0 ? "green" : "amber",
			icon: Clock3,
		},
	];

	const actionCards: Array<{
		title: string;
		body: string;
		mode: Mode;
	}> = [
		{
			title: "Review trust posture",
			body: "Open Trust Center before accepting any branch conclusion that depends on degraded capture.",
			mode: "status",
		},
		{
			title: "Resolve session joins",
			body: "Use the session index to close floating traces and expose why each branch move happened.",
			mode: "sessions",
		},
		{
			title: "Compare snapshots",
			body: "Check whether the current branch story still matches the latest saved state and rollback markers.",
			mode: "snapshots",
		},
	];

	return (
		<section className="rounded-2xl border border-border-subtle bg-bg-subtle p-4 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.8)]">
			<div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
				<div className="max-w-4xl">
					<div className="flex flex-wrap items-center gap-3">
						<span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
							Repo Evidence
						</span>
						<DashboardTrustBadge trustState={trustState} />
						<span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1 text-xs text-text-secondary">
							<Clock3 className="h-3.5 w-3.5" />
							{repoPath}
						</span>
					</div>

					<div className="mt-3">
						<h1 className="text-[1.75rem] font-semibold tracking-tight text-text-primary">
							Verify {branchLabel} through commits, files, sessions, and
							snapshots.
						</h1>
						<p className="mt-1.5 max-w-3xl text-sm leading-6 text-text-secondary">
							Read the signal strip, then move straight into the branch
							workspace below.
						</p>
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-1">
					<div className="rounded-xl border border-border-light bg-bg-primary px-3.5 py-3 text-sm text-text-secondary">
						<Eyebrow>Operator rule</Eyebrow>
						<p className="mt-1.5 leading-6">
							If a branch conclusion cannot be walked back to a file, diff,
							commit, or session, keep it provisional.
						</p>
					</div>

					<div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-3">
						{actionCards.map((action) => (
							<button
								key={action.title}
								type="button"
								disabled={!onModeChange}
								onClick={() => onModeChange?.(action.mode)}
								className="group rounded-xl border border-border-light bg-bg-primary p-3 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] active:duration-75 hover:border-accent-blue-light hover:bg-bg-primary disabled:cursor-default disabled:hover:translate-y-0"
							>
								<div className="flex items-start justify-between gap-2">
									<div>
										<p className="text-sm font-semibold text-text-primary">
											{action.title}
										</p>
										<p className="mt-1.5 text-[0.8125rem] leading-5 text-text-secondary">
											{action.body}
										</p>
									</div>
									<ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted transition group-hover:text-accent-blue" />
								</div>
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				{evidenceMetrics.map((metric) => (
					<article
						key={metric.label}
						className="rounded-xl border border-border-subtle bg-bg-primary p-3.5"
					>
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<metric.icon className="h-4 w-4 text-text-muted" />
								<Eyebrow>{metric.label}</Eyebrow>
							</div>
							<span
								className={`inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] ${toneClasses[metric.tone]}`}
							>
								{metric.tone === "amber"
									? "watch"
									: metric.tone === "green"
										? "ready"
										: "signal"}
							</span>
						</div>
						<p className="mt-2.5 text-[1.7rem] font-semibold tracking-tight text-text-primary">
							{metric.value}
						</p>
						<p className="mt-1.5 text-sm leading-6 text-text-secondary">
							{metric.detail}
						</p>
					</article>
				))}
			</div>

			<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light bg-bg-primary px-3.5 py-2.5 text-sm text-text-secondary">
				<div className="flex items-center gap-2">
					{trustState === "healthy" ? (
						<ShieldCheck
							className="h-4 w-4 text-accent-green"
							aria-hidden="true"
						/>
					) : (
						<ShieldX className="h-4 w-4 text-accent-amber" aria-hidden="true" />
					)}
					<span className="font-medium text-text-primary">
						{model.narrative?.summary ??
							model.description ??
							"The branch narrative is still being assembled from repo evidence."}
					</span>
				</div>
				<span className="rounded-full border border-border-light bg-bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
					Workspace continues below
				</span>
			</div>
		</section>
	);
}
