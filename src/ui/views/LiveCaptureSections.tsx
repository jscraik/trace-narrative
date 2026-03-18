import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Eyebrow } from "../components/typography/Eyebrow";
import type {
	NarrativeSurfaceViewModel,
	SurfaceAction,
	SurfaceAuthorityCue,
	SurfaceMetric,
} from "./narrativeSurfaceData";
import { AuthorityCue } from "./narrativeSurfaceSections";

const toneClasses = {
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

export function LiveActivityArticle({
	viewModel,
	activeSessionsMetric,
	onAction,
}: {
	viewModel: NarrativeSurfaceViewModel;
	activeSessionsMetric: SurfaceMetric & SurfaceAuthorityCue;
	onAction?: (action: SurfaceAction) => void;
}) {
	return (
		<article
			className="rounded-3xl border border-border-subtle bg-bg-subtle p-5"
			data-authority-tier={activeSessionsMetric.authorityTier}
			data-authority-label={activeSessionsMetric.authorityLabel}
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
						{viewModel.activityTitle}
					</p>
					<h2 className="mt-2 text-xl font-semibold text-text-primary">
						Current stream
					</h2>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
						Recent capture signals should read like an operator tape, not a
						decorative activity feed.
					</p>
				</div>
				<AuthorityCue
					authorityTier={activeSessionsMetric.authorityTier}
					authorityLabel={activeSessionsMetric.authorityLabel}
				/>
			</div>

			<div className="mt-5 min-h-[24rem] space-y-3">
				<AnimatePresence initial={false}>
					{viewModel.activity.map((item) => (
						<motion.article
							key={`${item.title}-${item.meta}`}
							layout
							initial={{ opacity: 0, x: -10 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, scale: 0.95 }}
							transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
							className="rounded-2xl border border-border-light bg-bg-primary p-4"
							data-authority-tier={item.authorityTier}
							data-authority-label={item.authorityLabel}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span
											className={clsx(
												"h-2 w-2 rounded-full",
												item.status === "ok"
													? "bg-accent-green"
													: item.status === "warn"
														? "bg-accent-amber"
														: item.status === "critical"
															? "bg-accent-red"
															: "bg-accent-blue",
											)}
										/>
										<p className="text-sm font-semibold text-text-primary">
											{item.title}
										</p>
									</div>
									<p className="text-xs uppercase tracking-[0.18em] text-text-muted">
										{item.meta}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<AuthorityCue
										authorityTier={item.authorityTier}
										authorityLabel={item.authorityLabel}
									/>
									<span
										className={clsx(
											"inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]",
											activityStatusClasses[item.status],
										)}
									>
										{item.status}
									</span>
								</div>
							</div>
							<p className="mt-3 text-sm leading-6 text-text-secondary">
								{item.detail}
							</p>
							{item.action ? (
								<button
									type="button"
									onClick={() => {
										if (!onAction || !item.action) return;
										onAction(item.action);
									}}
									className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
								>
									Follow signal
									<ArrowUpRight className="h-3.5 w-3.5" />
								</button>
							) : null}
						</motion.article>
					))}
				</AnimatePresence>
			</div>
		</article>
	);
}

export function LiveMonitorsArticle({
	viewModel,
	captureModeMetric,
	onAction,
}: {
	viewModel: NarrativeSurfaceViewModel;
	captureModeMetric: SurfaceMetric & SurfaceAuthorityCue;
	onAction?: (action: SurfaceAction) => void;
}) {
	return (
		<article
			className="rounded-3xl border border-border-subtle bg-bg-subtle p-5"
			data-authority-tier={captureModeMetric.authorityTier}
			data-authority-label={captureModeMetric.authorityLabel}
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
						{viewModel.highlightsTitle}
					</p>
					<h2 className="mt-2 text-xl font-semibold text-text-primary">
						Live monitors
					</h2>
					<p className="mt-2 text-sm leading-6 text-text-secondary">
						These are the three checks that should keep the live surface honest.
					</p>
				</div>
				<AuthorityCue
					authorityTier={captureModeMetric.authorityTier}
					authorityLabel={captureModeMetric.authorityLabel}
				/>
			</div>

			<div className="mt-5 space-y-3">
				{viewModel.highlights.map((highlight) => (
					<article
						key={highlight.title}
						className={clsx(
							"rounded-2xl border p-4",
							toneClasses[highlight.tone],
						)}
						data-authority-tier={highlight.authorityTier}
						data-authority-label={highlight.authorityLabel}
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<Eyebrow className="opacity-80 text-foreground">
									{highlight.eyebrow}
								</Eyebrow>
								<h3 className="mt-2 text-base font-semibold text-text-primary">
									{highlight.title}
								</h3>
							</div>
							<AuthorityCue
								authorityTier={highlight.authorityTier}
								authorityLabel={highlight.authorityLabel}
							/>
						</div>
						<p className="mt-2 text-sm leading-6 text-text-secondary">
							{highlight.body}
						</p>
						{highlight.action ? (
							<button
								type="button"
								onClick={() => {
									if (!onAction || !highlight.action) return;
									onAction(highlight.action);
								}}
								className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"
							>
								Open evidence
								<ArrowUpRight className="h-3.5 w-3.5" />
							</button>
						) : null}
					</article>
				))}
			</div>
		</article>
	);
}
