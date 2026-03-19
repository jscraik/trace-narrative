import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Eyebrow } from "../components/typography/Eyebrow";

import type {
	NarrativeSurfaceViewModel,
	SurfaceAuthorityCue,
	SurfaceMetric,
	SurfaceTableRow,
	SurfaceTone,
} from "./narrativeSurfaceData";

const toneClasses: Record<
	SurfaceTone,
	{ border: string; bg: string; text: string; dot: string }
> = {
	blue: {
		border: "border-accent-blue-light",
		bg: "bg-accent-blue/10",
		text: "text-accent-blue",
		dot: "bg-accent-blue",
	},
	violet: {
		border: "border-accent-violet-light",
		bg: "bg-accent-violet/10",
		text: "text-accent-violet",
		dot: "bg-accent-violet",
	},
	green: {
		border: "border-accent-green-light",
		bg: "bg-accent-green-bg",
		text: "text-accent-green",
		dot: "bg-accent-green",
	},
	amber: {
		border: "border-accent-amber-light",
		bg: "bg-accent-amber-bg",
		text: "text-accent-amber",
		dot: "bg-accent-amber",
	},
	red: {
		border: "border-accent-red-light",
		bg: "bg-accent-red-bg",
		text: "text-accent-red",
		dot: "bg-accent-red",
	},
	slate: {
		border: "border-border-light",
		bg: "bg-bg-primary",
		text: "text-text-secondary",
		dot: "bg-text-muted",
	},
};

const statusBadgeClasses: Record<"ok" | "warn" | "critical" | "info", string> =
	{
		ok: "border-accent-green-light bg-accent-green-bg text-accent-green",
		warn: "border-accent-amber-light bg-accent-amber-bg text-accent-amber",
		critical: "border-accent-red-light bg-accent-red-bg text-accent-red",
		info: "border-accent-blue-light bg-accent-blue/10 text-accent-blue",
	};

const statusBadgeLabels: Record<"ok" | "warn" | "critical" | "info", string> = {
	ok: "OK",
	warn: "WATCH",
	critical: "CRITICAL",
	info: "INFO",
};

const authorityCueClassByTier: Record<
	SurfaceAuthorityCue["authorityTier"],
	string
> = {
	live_repo: "border-accent-blue-light bg-accent-blue/10 text-accent-blue",
	live_capture:
		"border-accent-green-light bg-accent-green-bg text-accent-green",
	derived_summary:
		"border-accent-violet-light bg-accent-violet/10 text-accent-violet",
	static_scaffold: "border-border-subtle bg-bg-secondary text-text-muted",
	system_signal: "border-accent-red-light bg-accent-red-bg text-accent-red",
};

type SurfaceActionHandler = (
	action: NonNullable<SurfaceTableRow["action"]>,
) => void;

function authorityShortLabel(
	tier?: SurfaceAuthorityCue["authorityTier"],
): string {
	switch (tier) {
		case "live_repo":
			return "Repo";
		case "live_capture":
			return "Live";
		case "derived_summary":
			return "Derived";
		case "static_scaffold":
			return "Mock";
		case "system_signal":
			return "Signal";
		default:
			return "Info";
	}
}

function handleActionKeyDown(
	event: KeyboardEvent<HTMLElement>,
	action: NonNullable<SurfaceTableRow["action"]> | undefined,
	onAction: SurfaceActionHandler | undefined,
) {
	if (!action) return;
	if (event.key !== "Enter" && event.key !== " ") return;
	event.preventDefault();
	onAction?.(action);
}

export function AuthorityCue({
	authorityTier,
	authorityLabel,
}: SurfaceAuthorityCue) {
	const cue = authorityLabel ?? authorityShortLabel(authorityTier);
	return (
		<span
			className={clsx(
				"inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
				authorityCueClassByTier[authorityTier ?? "static_scaffold"],
			)}
			data-authority-short-label={authorityShortLabel(authorityTier)}
		>
			{cue}
		</span>
	);
}

export function MetricCard({
	metric,
}: {
	metric: SurfaceMetric & SurfaceAuthorityCue;
}) {
	const tone = toneClasses[metric.tone];

	return (
		<article
			className="glass-panel rounded-2xl p-5"
			data-authority-tier={metric.authorityTier}
			data-authority-label={metric.authorityLabel}
		>
			<div className="mb-3 flex items-center gap-2">
				<span className={clsx("h-2 w-2 rounded-full", tone.dot)} />
				<Eyebrow>{metric.label}</Eyebrow>
				<AuthorityCue
					authorityTier={metric.authorityTier}
					authorityLabel={metric.authorityLabel}
				/>
			</div>
			<div className={clsx("text-3xl font-semibold tracking-tight", tone.text)}>
				{metric.value}
			</div>
			<p className="mt-2 text-sm text-text-secondary">{metric.detail}</p>
		</article>
	);
}

// ─── CompactKpiStrip ─────────────────────────────────────────────────────────
// A single-row strip of KPI tiles, ~h-12 tall — replaces the 4-column card
// grid to reclaim vertical space while keeping all metric values visible.

export function CompactKpiStrip({
	metrics,
}: {
	metrics: Array<SurfaceMetric & SurfaceAuthorityCue>;
}) {
	if (metrics.length === 0) return null;
	return (
		<ul
			className="glass-panel flex flex-wrap divide-x divide-border-subtle rounded-2xl overflow-hidden"
			aria-label="Key metrics"
		>
			{metrics.map((metric, _i) => {
				const tone = toneClasses[metric.tone];
				return (
					<li
						key={metric.label}
						className="flex min-w-32 flex-1 items-center gap-3 px-4 py-3"
						data-authority-tier={metric.authorityTier}
					>
						<span
							className={clsx("h-2 w-2 shrink-0 rounded-full", tone.dot)}
							aria-hidden="true"
						/>
						<div className="min-w-0 flex-1">
							<div
								className={clsx(
									"text-base font-semibold leading-tight tracking-tight",
									tone.text,
								)}
							>
								{metric.value}
							</div>
							<div className="truncate text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
								{metric.label}
							</div>
						</div>
						<AuthorityCue
							authorityTier={metric.authorityTier}
							authorityLabel={metric.authorityLabel}
						/>
					</li>
				);
			})}
		</ul>
	);
}

export function HighlightsSection({
	title,
	highlights,
	onAction,
}: {
	title: string;
	highlights: NarrativeSurfaceViewModel["highlights"];
	onAction?: SurfaceActionHandler;
}) {
	return (
		<div className="glass-panel rounded-3xl p-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
						{title}
					</p>
					<h3 className="mt-1 text-lg font-semibold text-text-primary">
						What this view should make obvious
					</h3>
				</div>
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				{highlights.map((highlight) => {
					const tone = toneClasses[highlight.tone];
					return (
						<article
							key={highlight.title}
							onClick={() => highlight.action && onAction?.(highlight.action)}
							onKeyDown={(event) =>
								handleActionKeyDown(event, highlight.action, onAction)
							}
							role={highlight.action ? "button" : undefined}
							tabIndex={highlight.action ? 0 : undefined}
							className={clsx(
								"group rounded-2xl border p-4 transition duration-200",
								tone.border,
								tone.bg,
								highlight.action &&
									"cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]",
							)}
							data-authority-tier={highlight.authorityTier}
							data-authority-label={highlight.authorityLabel}
						>
							<div className="flex items-start justify-between">
								<p
									className={clsx(
										"text-[0.6875rem] font-semibold uppercase tracking-[0.18em]",
										tone.text,
									)}
								>
									{highlight.eyebrow}
								</p>
								{highlight.action && (
									<ArrowUpRight
										className={clsx(
											"h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-100",
											tone.text,
										)}
									/>
								)}
							</div>
							<AuthorityCue
								authorityTier={highlight.authorityTier}
								authorityLabel={highlight.authorityLabel}
							/>
							<h4 className="mt-3 text-base font-semibold text-text-primary">
								{highlight.title}
							</h4>
							<p className="mt-2 text-sm leading-6 text-text-secondary">
								{highlight.body}
							</p>
						</article>
					);
				})}
			</div>
		</div>
	);
}

export function ActivitySection({
	title,
	activity,
	onAction,
}: {
	title: string;
	activity: NarrativeSurfaceViewModel["activity"];
	onAction?: SurfaceActionHandler;
}) {
	return (
		<div className="glass-panel rounded-3xl p-5">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
				{title}
			</p>
			<div className="mt-4 space-y-3">
				{activity.map((item, _index) => (
					<article
						key={`${item.title}-${item.meta}`}
						onClick={() => item.action && onAction?.(item.action)}
						onKeyDown={(event) =>
							handleActionKeyDown(event, item.action, onAction)
						}
						role={item.action ? "button" : undefined}
						tabIndex={item.action ? 0 : undefined}
						className={clsx(
							"group rounded-2xl border border-border-subtle bg-bg-primary p-4 transition duration-200",
							item.action &&
								"cursor-pointer hover:translate-x-1 hover:bg-bg-secondary hover:shadow-sm active:scale-[0.99]",
						)}
						data-authority-tier={item.authorityTier}
						data-authority-label={item.authorityLabel}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="flex-1 space-y-1">
								<div className="flex items-center gap-2">
									<div
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
									<h4 className="text-sm font-semibold text-text-primary">
										{item.title}
									</h4>
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
										"inline-flex min-w-[3.125rem] items-center justify-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
										statusBadgeClasses[item.status],
									)}
								>
									{statusBadgeLabels[item.status]}
								</span>
							</div>
						</div>
						<p className="mt-3 text-sm leading-6 text-text-secondary">
							{item.detail}
						</p>
						{item.action && (
							<div className="mt-2 flex items-center gap-1 text-[0.625rem] font-medium text-accent-violet opacity-0 transition-opacity group-hover:opacity-100">
								<ArrowUpRight className="h-3 w-3" />
								Execute suggestion
							</div>
						)}
					</article>
				))}
			</div>
		</div>
	);
}

export function SummaryTable({
	title,
	columns,
	rows,
	onAction,
}: {
	title: string;
	columns: string[];
	rows: NarrativeSurfaceViewModel["tableRows"];
	onAction?: SurfaceActionHandler;
}) {
	return (
		<section className="glass-panel rounded-3xl p-5">
			<div className="mb-4">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
					{title}
				</p>
				<h3 className="mt-1 text-lg font-semibold text-text-primary">
					Operator-ready summary
				</h3>
			</div>

			<div className="overflow-x-auto">
				<table className="min-w-full border-separate border-spacing-y-3">
					<thead>
						<tr>
							{columns.map((column) => (
								<th
									key={column}
									className="px-4 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted"
								>
									{column}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row.primary}
								onClick={() => row.action && onAction?.(row.action)}
								onKeyDown={(event) =>
									handleActionKeyDown(event, row.action, onAction)
								}
								role={row.action ? "button" : undefined}
								tabIndex={row.action ? 0 : undefined}
								className={clsx(
									"group rounded-2xl bg-bg-primary transition duration-200",
									row.action &&
										"cursor-pointer hover:translate-x-1 hover:bg-bg-secondary hover:shadow-sm active:scale-[0.99]",
								)}
								data-authority-tier={row.authorityTier}
								data-authority-label={row.authorityLabel}
							>
								<td className="rounded-l-2xl border-y border-l border-border-subtle px-4 py-4 text-sm font-semibold text-text-primary">
									<div className="flex items-center gap-2">
										{row.primary}
										{row.action && (
											<ArrowUpRight className="h-3.5 w-3.5 text-accent-violet opacity-0 transition-opacity group-hover:opacity-100" />
										)}
									</div>
									<div className="mt-2">
										<AuthorityCue
											authorityTier={row.authorityTier}
											authorityLabel={row.authorityLabel}
										/>
									</div>
								</td>
								<td className="border-y border-border-subtle px-4 py-4 text-sm text-text-secondary">
									{row.secondary}
								</td>
								<td className="rounded-r-2xl border-y border-r border-border-subtle px-4 py-4 text-sm text-text-secondary">
									<div className="flex items-center justify-between gap-4">
										{row.tertiary}
										{row.action && (
											<span className="text-[0.625rem] font-semibold uppercase tracking-wider text-accent-violet">
												Open
											</span>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
