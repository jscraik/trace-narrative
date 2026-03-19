import clsx from "clsx";
import {
	ArrowRight,
	ArrowUpRight,
	RadioTower,
	ShieldAlert,
	ShieldCheck,
} from "lucide-react";
import type { CaptureReliabilityStatus } from "../../core/tauri/ingestConfig";
import type { Mode } from "../../core/types";
import type { RepoState } from "../../hooks/useRepoLoader";
import { DashboardTrustBadge } from "../components/dashboard/DashboardTrustBadge";
import { SectionHeader } from "../components/SectionHeader";
import { Eyebrow } from "../components/typography/Eyebrow";
import { describeSurfaceTrust } from "./dashboardState";
import {
	LiveActivityArticle,
	LiveMonitorsArticle,
} from "./LiveCaptureSections";
import {
	buildNarrativeSurfaceViewModel,
	type SurfaceAction,
} from "./narrativeSurfaceData";
import { AuthorityCue, MetricCard } from "./narrativeSurfaceSections";

interface LiveCaptureViewProps {
	repoState: RepoState;
	captureReliabilityStatus?: CaptureReliabilityStatus | null;
	autoIngestEnabled?: boolean;
	onModeChange: (mode: Mode) => void;
	onOpenRepo: () => void;
	onImportSession?: () => void;
	onAction?: (action: SurfaceAction) => void;
}

const toneClasses = {
	blue: "border-accent-blue-light bg-accent-blue/10 text-accent-blue",
	violet: "border-accent-violet-light bg-accent-violet/10 text-accent-violet",
	green: "border-accent-green-light bg-accent-green-bg text-accent-green",
	amber: "border-accent-amber-light bg-accent-amber-bg text-accent-amber",
	red: "border-accent-red-light bg-accent-red-bg text-accent-red",
	slate: "border-border-light bg-bg-primary text-text-secondary",
} as const;

const _activityStatusClasses = {
	ok: "border-accent-green-light bg-accent-green-bg text-accent-green",
	warn: "border-accent-amber-light bg-accent-amber-bg text-accent-amber",
	critical: "border-accent-red-light bg-accent-red-bg text-accent-red",
	info: "border-accent-blue-light bg-accent-blue/10 text-accent-blue",
} as const;

function getRepoPath(repoState: RepoState): string {
	if (repoState.status === "ready") return repoState.repo.root;
	if (repoState.status !== "idle")
		return repoState.path ?? "~/dev/trace-narrative";
	return "~/dev/trace-narrative";
}

export function LiveCaptureView({
	repoState,
	captureReliabilityStatus,
	autoIngestEnabled,
	onModeChange,
	onOpenRepo: _onOpenRepo,
	onImportSession: _onImportSession,
	onAction,
}: LiveCaptureViewProps) {
	const viewModel = buildNarrativeSurfaceViewModel(
		"live",
		repoState,
		captureReliabilityStatus,
		autoIngestEnabled,
	);
	const _repoPath = getRepoPath(repoState);
	const trustDescriptor = describeSurfaceTrust(captureReliabilityStatus);
	const captureModeMetric =
		viewModel.metrics.find((metric) => metric.label === "Capture mode") ??
		viewModel.metrics[0];
	const activeSessionsMetric =
		viewModel.metrics.find((metric) => metric.label === "Active sessions") ??
		viewModel.metrics[0];
	const nextMode = trustDescriptor.trustState === "healthy" ? "repo" : "status";
	const nextLabel =
		trustDescriptor.trustState === "healthy"
			? "Inspect repo evidence"
			: "Inspect trust center";
	const NextIcon =
		trustDescriptor.trustState === "healthy" ? ShieldCheck : ShieldAlert;

	return (
		<div className="flex h-full min-h-0 flex-col bg-bg-primary">
			<main className="flex-1 overflow-y-auto px-6 py-6">
				<div className="mx-auto flex max-w-6xl flex-col gap-6">
					<SectionHeader
						title={viewModel.title}
						description="{viewModel.subtitle}"
						badge={
							<DashboardTrustBadge trustState={trustDescriptor.trustState} />
						}
						action={
							<button
								type="button"
								onClick={() => onModeChange(nextMode)}
								className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary inline-flex items-center gap-1.5 rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-medium text-accent-foreground transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.98] active:duration-75"
							>
								<NextIcon className="h-3.5 w-3.5" />
								{nextLabel}
							</button>
						}
					/>

					<div className="rounded-[1.6rem] border border-border-subtle bg-bg-primary/70 p-5">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div className="max-w-3xl space-y-3">
								<span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-secondary px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.05em] text-text-secondary">
									<RadioTower className="h-3.5 w-3.5 text-accent-green" />
									Live capture surface
								</span>
								<div
									data-authority-tier={viewModel.heroAuthorityTier}
									data-authority-label={viewModel.heroAuthorityLabel}
								>
									<AuthorityCue
										authorityTier={viewModel.heroAuthorityTier}
										authorityLabel={viewModel.heroAuthorityLabel}
									/>
								</div>
								<div>
									<h2 className="text-xl font-semibold text-text-primary">
										{viewModel.heroTitle}
									</h2>
									<p className="mt-2 text-sm leading-6 text-text-secondary">
										{viewModel.heroBody}
									</p>
								</div>
							</div>

							<div
								className="rounded-2xl border border-border-light bg-bg-secondary/80 px-4 py-3 text-sm text-text-secondary"
								data-authority-tier={captureModeMetric.authorityTier}
								data-authority-label={captureModeMetric.authorityLabel}
							>
								<p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
									Operator rule
								</p>
								<div className="mt-2 flex items-center gap-2">
									<AuthorityCue
										authorityTier={captureModeMetric.authorityTier}
										authorityLabel={captureModeMetric.authorityLabel}
									/>
									<span
										className={clsx(
											"inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]",
											toneClasses[captureModeMetric.tone],
										)}
									>
										{captureModeMetric.value}
									</span>
								</div>
								<p className="mt-3 max-w-[20rem] text-xs leading-5">
									This screen should help us notice stream drift while work is
									still in motion, then route into Trust Center or Repo Evidence
									before assumptions harden into false certainty.
								</p>
							</div>
						</div>
					</div>
					<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						{viewModel.metrics.map((metric) => (
							<MetricCard key={metric.label} metric={metric} />
						))}
					</section>

					<section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
						<LiveActivityArticle
							viewModel={viewModel}
							activeSessionsMetric={activeSessionsMetric}
							onAction={onAction}
						/>

						<LiveMonitorsArticle
							viewModel={viewModel}
							captureModeMetric={captureModeMetric}
							onAction={onAction}
						/>
					</section>

					<section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
						<article
							className="rounded-3xl border border-border-subtle bg-bg-secondary/80 p-5"
							data-authority-tier={captureModeMetric.authorityTier}
							data-authority-label={captureModeMetric.authorityLabel}
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
										Capture posture
									</p>
									<h2 className="mt-2 text-xl font-semibold text-text-primary">
										Trust and intervention
									</h2>
								</div>
								<AuthorityCue
									authorityTier={captureModeMetric.authorityTier}
									authorityLabel={captureModeMetric.authorityLabel}
								/>
							</div>

							<div className="mt-5 space-y-4">
								<div className="rounded-2xl border border-border-light bg-bg-primary/80 p-4">
									<Eyebrow>Reliability state</Eyebrow>
									<p className="mt-2 text-lg font-semibold text-text-primary">
										{trustDescriptor.trustLabel}
									</p>
									<p className="mt-2 text-sm leading-6 text-text-secondary">
										Mode: {trustDescriptor.reliabilityMode}. Treat live output
										as guidance until the supporting lane is checked.
									</p>
								</div>

								<div className="rounded-2xl border border-border-light bg-bg-primary/80 p-4">
									<Eyebrow>Import lane</Eyebrow>
									<p className="mt-2 text-lg font-semibold text-text-primary">
										{autoIngestEnabled
											? "Auto-ingest active"
											: "Manual import only"}
									</p>
									<p className="mt-2 text-sm leading-6 text-text-secondary">
										{autoIngestEnabled
											? "The shell should expect fresh capture updates and call out gaps quickly."
											: "The operator must explicitly import sessions before trusting recency or completeness."}
									</p>
								</div>

								<div className="rounded-2xl border border-border-light bg-bg-primary/80 p-4">
									<Eyebrow>Recommended next lane</Eyebrow>
									<p className="mt-2 text-lg font-semibold text-text-primary">
										{trustDescriptor.trustState === "healthy"
											? "Repo Evidence"
											: "Trust Center"}
									</p>
									<p className="mt-2 text-sm leading-6 text-text-secondary">
										{trustDescriptor.trustState === "healthy"
											? "The stream looks stable enough to confirm the narrative against repo-level evidence."
											: "Resolve degraded capture conditions before treating live signals as settled narrative truth."}
									</p>
								</div>
							</div>

							<div className="mt-5 flex flex-wrap gap-3">
								<button
									type="button"
									onClick={() => onModeChange(nextMode)}
									className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-110"
								>
									<NextIcon className="h-4 w-4" />
									{nextLabel}
								</button>
								<button
									type="button"
									onClick={() => onModeChange("sessions")}
									className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
								>
									Review sessions
									<ArrowRight className="h-4 w-4" />
								</button>
							</div>
						</article>

						<article
							className="rounded-3xl border border-border-subtle bg-bg-secondary/80 p-5"
							data-authority-tier={captureModeMetric.authorityTier}
							data-authority-label={captureModeMetric.authorityLabel}
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
										{viewModel.tableTitle}
									</p>
									<h2 className="mt-2 text-xl font-semibold text-text-primary">
										Live lanes
									</h2>
									<p className="mt-2 text-sm leading-6 text-text-secondary">
										Each lane should answer whether capture is active, stale, or
										ready for follow-through.
									</p>
								</div>
								<AuthorityCue
									authorityTier={captureModeMetric.authorityTier}
									authorityLabel={captureModeMetric.authorityLabel}
								/>
							</div>

							<div className="mt-5 space-y-3">
								{viewModel.tableRows.map((row) => {
									const laneTone =
										row.secondary.toLowerCase().includes("active") ||
										row.secondary.toLowerCase().includes("watch")
											? "green"
											: row.secondary.toLowerCase().includes("degraded") ||
													row.secondary.toLowerCase().includes("stale")
												? "amber"
												: "blue";

									return (
										<article
											key={`${row.primary}-${row.secondary}`}
											className="rounded-2xl border border-border-light bg-bg-primary/80 p-4"
											data-authority-tier={row.authorityTier}
											data-authority-label={row.authorityLabel}
										>
											<div className="flex flex-wrap items-start justify-between gap-3">
												<div>
													<p className="text-base font-semibold text-text-primary">
														{row.primary}
													</p>
													<p className="mt-2 text-sm leading-6 text-text-secondary">
														{row.tertiary}
													</p>
												</div>
												<div className="flex items-center gap-2">
													<AuthorityCue
														authorityTier={row.authorityTier}
														authorityLabel={row.authorityLabel}
													/>
													<span
														className={clsx(
															"inline-flex rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
															toneClasses[laneTone],
														)}
													>
														{row.secondary}
													</span>
												</div>
											</div>
											{row.action ? (
												<button
													type="button"
													onClick={() => {
														if (!onAction || !row.action) return;
														onAction(row.action);
													}}
													className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
												>
													Open lane
													<ArrowUpRight className="h-3.5 w-3.5" />
												</button>
											) : null}
										</article>
									);
								})}
							</div>
						</article>
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
