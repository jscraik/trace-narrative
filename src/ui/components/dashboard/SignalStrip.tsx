export type BriefTone = "blue" | "green" | "amber" | "violet";

export type BriefSignal = {
	label: string;
	value: string;
	tone: BriefTone;
	detail: string;
};

// ─── Tone maps ───────────────────────────────────────────────────────────────

export const TONE_DOT: Record<BriefTone, string> = {
	blue: "bg-accent-blue",
	green: "bg-accent-green",
	amber: "bg-accent-amber",
	violet: "bg-accent-violet",
};

export const TONE_VALUE: Record<BriefTone, string> = {
	blue: "text-accent-blue",
	green: "text-accent-green",
	amber: "text-accent-amber",
	violet: "text-accent-violet",
};

export const TONE_BADGE: Record<BriefTone, string> = {
	blue: "border-accent-blue-light bg-accent-blue/10 text-accent-blue",
	green: "border-accent-green-light bg-accent-green-bg text-accent-green",
	amber: "border-accent-amber-light bg-accent-amber-bg text-accent-amber",
	violet: "border-accent-violet-light bg-accent-violet/10 text-accent-violet",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function compactNumber(value: number): string {
	return new Intl.NumberFormat("en-GB", {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

export function buildTrendLabel(value: number, previous?: number): string {
	if (previous === undefined) return "No prior window";
	const delta = value - previous;
	if (delta === 0) return "Flat vs previous window";
	return `${delta > 0 ? "+" : ""}${delta.toLocaleString()} vs previous window`;
}

// ─── SignalStrip (local compact KPI row) ──────────────────────────────────────
// Replaces the 4-column large-value card grid.
// Renders each signal as a h-12 horizontal tile with coloured value + dot.

export function SignalStrip({ signals }: { signals: BriefSignal[] }) {
	return (
		<ul
			className="glass-panel flex flex-wrap divide-x divide-border-subtle overflow-hidden rounded-2xl"
			aria-label="Dashboard key metrics"
		>
			{signals.map((s) => (
				<li
					key={s.label}
					title={s.detail}
					className="flex min-w-32 flex-1 items-center gap-3 px-4 py-3"
				>
					<span
						className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[s.tone]}`}
						aria-hidden="true"
					/>
					<div className="min-w-0 flex-1">
						<div
							className={`text-base font-semibold leading-tight tracking-tight ${TONE_VALUE[s.tone]}`}
						>
							{s.value}
						</div>
						<div className="truncate text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
							{s.label}
						</div>
					</div>
					{/* Tone badge — carries the amber/watch signal visually */}
					{s.tone === "amber" && (
						<span
							className={`inline-flex rounded-full border px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] ${TONE_BADGE.amber}`}
						>
							watch
						</span>
					)}
				</li>
			))}
		</ul>
	);
}
