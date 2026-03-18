import clsx from "clsx";
import { ShieldCheck, ShieldX } from "lucide-react";
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
import { AuthorityCue } from "./narrativeSurfaceSections";

interface TrustCenterViewProps {
	repoState: RepoState;
	captureReliabilityStatus?: CaptureReliabilityStatus | null;
	autoIngestEnabled?: boolean;
	onModeChange: (mode: Mode) => void;
	onOpenRepo: () => void;
	onImportSession?: () => void;
	onAction?: (action: SurfaceAction) => void;
}

const metricToneClasses = {
	blue: "border-accent-blue-light bg-accent-blue/10 text-accent-blue",
	violet: "border-accent-violet-light bg-accent-violet/10 text-accent-violet",
	green: "border-accent-green-light bg-accent-green-bg text-accent-green",
	amber: "border-accent-amber-light bg-accent-amber-bg text-accent-amber",
	red: "border-accent-red-light bg-accent-red-bg text-accent-red",
	slate: "border-border-light bg-bg-primary text-text-secondary",
} as const;

const activityStatusClasses = {
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

export function TrustCenterView({
	repoState,
	captureReliabilityStatus,
	autoIngestEnabled,
	onModeChange,
	onOpenRepo: _onOpenRepo,
	onImportSession: _onImportSession,
	onAction,
}: TrustCenterViewProps) {
	const viewModel = buildNarrativeSurfaceViewModel(
		"status",
		repoState,
		captureReliabilityStatus,
		autoIngestEnabled,
	);
	const _repoPath = getRepoPath(repoState);
	const nextMode = viewModel.trustState === "healthy" ? "repo" : "live";
	const nextLabel =
		viewModel.trustState === "healthy"
			? "Inspect repo evidence"
			: "Review live capture";
	const nextIcon = viewModel.trustState === "healthy" ? ShieldCheck : ShieldX;
	const NextIcon = nextIcon;

	return (
		<div className="flex h-full min-h-0 flex-col bg-bg-primary">
			<main className="flex-1 overflow-y-auto px-6 py-6">
				<div className="mx-auto flex max-w-[100rem] flex-col gap-5">
					<SectionHeader
						title={viewModel.title}
						description="Review automated trust decisions and component health before trusting AI outputs."
						badge={<DashboardTrustBadge trustState={viewModel.trustState} />}
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

					<div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
						<div className="flex flex-col rounded-[1.75rem] border border-border-subtle bg-bg-secondary/40 p-4">
							<div className="mb-4 flex items-start justify-between gap-4 pl-1 pt-1">
								<div className="flex flex-col items-start gap-4">
									<span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-secondary px-3 py-1 text-xs font-medium text-text-secondary">
										Trust decision surface
									</span>
									<div>
										<h2 className="text-lg font-semibold text-text-primary">
											{viewModel.heroTitle}
										</h2>
										<p className="mt-1.5 text-sm leading-6 text-text-secondary">
											{viewModel.heroBody}
										</p>
									</div>
								</div>
								<div className="rounded-[1.1rem] border border-border-light bg-bg-secondary/80 px-3.5 py-3 text-sm text-text-secondary">
									<Eyebrow>Operator rule</Eyebrow>
									<p className="mt-1.5 max-w-xs leading-6">
										Decide what is safe to believe now, what still needs
										verification, and which lane opens next.
									</p>
								</div>
							</div>
						</div>

						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
							{viewModel.metrics.slice(0, 2).map((metric) => (
								<article
									key={metric.label}
									className="rounded-[1.2rem] border border-border-subtle bg-bg-primary/80 p-3.5"
									data-authority-tier={metric.authorityTier}
									data-authority-label={metric.authorityLabel}
								>
									<div className="flex items-start justify-between gap-3">
										<div>
											<Eyebrow>{metric.label}</Eyebrow>
											<p className="mt-2 text-[1.6rem] font-semibold text-text-primary">
												{metric.value}
											</p>
										</div>
										<AuthorityCue
											authorityTier={metric.authorityTier}
											authorityLabel={metric.authorityLabel}
										/>
									</div>
									<div
										className={clsx(
											"mt-2.5 inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]",
											metricToneClasses[metric.tone],
										)}
									>
										{metric.tone === "green"
											? "safe"
											: metric.tone === "amber"
												? "watch"
												: metric.tone === "red"
													? "block"
													: "signal"}
									</div>
									<p className="mt-2 text-sm leading-6 text-text-secondary">
										{metric.detail}
									</p>
								</article>
							))}
						</div>
					</div>
					<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						{viewModel.metrics.slice(2).map((metric) => (
							<article
								key={metric.label}
								className="rounded-[1.25rem] border border-border-subtle bg-bg-secondary/80 p-3.5"
								data-authority-tier={metric.authorityTier}
								data-authority-label={metric.authorityLabel}
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<Eyebrow>{metric.label}</Eyebrow>
										<p className="mt-2 text-[1.8rem] font-semibold text-text-primary">
											{metric.value}
										</p>
									</div>
									<AuthorityCue
										authorityTier={metric.authorityTier}
										authorityLabel={metric.authorityLabel}
									/>
								</div>
								<div
									className={clsx(
										"mt-2.5 inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]",
										metricToneClasses[metric.tone],
									)}
								>
									{metric.tone === "green"
										? "safe"
										: metric.tone === "amber"
											? "watch"
											: metric.tone === "red"
												? "block"
												: "signal"}
								</div>
								<p className="mt-2 text-sm leading-6 text-text-secondary">
									{metric.detail}
								</p>
							</article>
						))}
					</section>

					<section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
						<article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-4.5">
							<div className="flex items-start justify-between gap-4">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
										{viewModel.provenance?.eyebrow ?? "Signature view"}
									</p>
									<h2 className="mt-1.5 text-lg font-semibold text-text-primary">
										{viewModel.provenance?.title ?? "Trust decision rail"}
									</h2>
									<p className="mt-1.5 max-w-3xl text-sm leading-6 text-text-secondary">
										{viewModel.provenance?.summary}
									</p>
								</div>
							</div>

							<div className="mt-4 space-y-2.5">
								{viewModel.provenance?.nodes.map((node) => (
									<button
										key={`${node.eyebrow}-${node.title}`}
										type="button"
										onClick={() => node.action && onAction?.(node.action)}
										disabled={!node.action}
										className={clsx(
											"w-full rounded-[1.1rem] border p-3.5 text-left transition",
											node.action
												? "cursor-pointer hover:-translate-y-0.5 hover:border-accent-blue-light hover:bg-bg-primary"
												: "cursor-default",
											metricToneClasses[node.tone],
										)}
										data-authority-tier={node.authorityTier}
										data-authority-label={node.authorityLabel}
									>
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div>
												<p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] opacity-80">
													{node.eyebrow}
												</p>
												<h3 className="mt-1.5 text-sm font-semibold text-text-primary">
													{node.title}
												</h3>
											</div>
											<AuthorityCue
												authorityTier={node.authorityTier}
												authorityLabel={node.authorityLabel}
											/>
										</div>
										<p className="mt-1.5 text-sm leading-6 text-text-secondary">
											{node.detail}
										</p>
										{node.edgeLabel ? (
											<Eyebrow className="mt-2">{node.edgeLabel}</Eyebrow>
										) : null}
									</button>
								))}
							</div>

							{viewModel.provenance?.footnote ? (
								<p className="mt-4 text-sm leading-6 text-text-secondary">
									{viewModel.provenance.footnote}
								</p>
							) : null}
						</article>

						<div className="flex flex-col gap-5">
							<article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-4.5">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
									Recent trust events
								</p>
								<div className="mt-3 space-y-2.5">
									{viewModel.activity.map((item) => (
										<div
											key={`${item.title}-${item.meta}`}
											className="rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5"
											data-authority-tier={item.authorityTier}
											data-authority-label={item.authorityLabel}
										>
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="text-sm font-semibold text-text-primary">
														{item.title}
													</p>
													<p className="mt-1 text-xs text-text-muted">
														{item.meta}
													</p>
												</div>
												<span
													className={clsx(
														"inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]",
														activityStatusClasses[item.status],
													)}
												>
													{item.status}
												</span>
											</div>
											<p className="mt-1.5 text-sm leading-6 text-text-secondary">
												{item.detail}
											</p>
										</div>
									))}
								</div>
							</article>

							<article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-4.5">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
									Verification gates
								</p>
								<h2 className="mt-1.5 text-base font-semibold text-text-primary">
									{viewModel.tableTitle}
								</h2>
								<div className="mt-3 space-y-2.5">
									{viewModel.tableRows.map((row) => (
										<div
											key={row.primary}
											className="rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5"
											data-authority-tier={row.authorityTier}
											data-authority-label={row.authorityLabel}
										>
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="text-sm font-semibold text-text-primary">
														{row.primary}
													</p>
													<p className="mt-1 text-sm text-text-secondary">
														{row.secondary}
													</p>
												</div>
												<AuthorityCue
													authorityTier={row.authorityTier}
													authorityLabel={row.authorityLabel}
												/>
											</div>
											<p className="mt-2 text-sm leading-6 text-text-secondary">
												{row.tertiary}
											</p>
										</div>
									))}
								</div>
							</article>
						</div>
					</section>

					<section className="grid gap-3 md:grid-cols-2">
						<article className="rounded-[1.35rem] border border-border-subtle bg-bg-secondary/80 p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
								Safe to inspect next
							</p>
							<p className="mt-1.5 text-base font-semibold text-text-primary">
								{nextLabel}
							</p>
							<p className="mt-1.5 text-sm leading-6 text-text-secondary">
								{viewModel.metrics[3]?.detail}
							</p>
						</article>

						<article className="rounded-[1.35rem] border border-border-subtle bg-bg-secondary/80 p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
								Trust stance
							</p>
							<p className="mt-1.5 text-base font-semibold text-text-primary">
								{viewModel.trustState === "healthy"
									? "Evidence inspection is open."
									: "Verification gate is active."}
							</p>
							<p className="mt-1.5 text-sm leading-6 text-text-secondary">
								{viewModel.footerNote}
							</p>
						</article>
					</section>
				</div>
			</main>
		</div>
	);
}
