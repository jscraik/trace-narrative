import type {
	NarrativeObservabilityMetrics,
	NarrativeRolloutReport,
} from "../../core/types";

type NarrativeGovernancePanelProps = {
	report: NarrativeRolloutReport;
	observability: NarrativeObservabilityMetrics;
};

function statusClasses(status: NarrativeRolloutReport["status"]): string {
	if (status === "rollback")
		return "border-accent-red-light bg-accent-red-bg text-accent-red";
	if (status === "watch")
		return "border-accent-amber-light bg-accent-amber-bg text-accent-amber";
	return "border-accent-green-light bg-accent-green-bg text-accent-green";
}

export function NarrativeGovernancePanel({
	report,
	observability,
}: NarrativeGovernancePanelProps) {
	const triggered = report.rules.filter((rule) => rule.triggered);

	return (
		<div className="card p-5">
			<div className="flex items-center justify-between gap-3">
				<div>
					<div className="section-header">Rollout governance</div>
					<div className="section-subheader mt-0.5">
						Rubric, kill-switch matrix, and observability
					</div>
				</div>
				<div
					className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses(report.status)}`}
				>
					{report.status}
				</div>
			</div>

			<div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary sm:grid-cols-4">
				<div className="rounded-md border border-border-subtle bg-bg-primary px-2.5 py-2">
					<div className="text-text-muted">Layer switches</div>
					<div className="mt-1 text-sm font-semibold text-text-primary">
						{observability.layerSwitchedCount}
					</div>
				</div>
				<div className="rounded-md border border-border-subtle bg-bg-primary px-2.5 py-2">
					<div className="text-text-muted">Evidence opens</div>
					<div className="mt-1 text-sm font-semibold text-text-primary">
						{observability.evidenceOpenedCount}
					</div>
				</div>
				<div className="rounded-md border border-border-subtle bg-bg-primary px-2.5 py-2">
					<div className="text-text-muted">Fallback usage</div>
					<div className="mt-1 text-sm font-semibold text-text-primary">
						{observability.fallbackUsedCount}
					</div>
				</div>
				<div className="rounded-md border border-border-subtle bg-bg-primary px-2.5 py-2">
					<div className="text-text-muted">Kill-switch triggers</div>
					<div className="mt-1 text-sm font-semibold text-text-primary">
						{observability.killSwitchTriggeredCount}
					</div>
				</div>
			</div>

			<div className="mt-4 space-y-2">
				{report.rubric.map((metric) => (
					<div
						key={metric.id}
						className="rounded-md border border-border-subtle bg-bg-primary px-3 py-2"
					>
						<div className="flex items-center justify-between gap-3 text-xs">
							<span className="font-medium text-text-secondary">
								{metric.label}
							</span>
							<span className="text-text-muted">
								{Math.round(metric.score * 100)}% / target{" "}
								{Math.round(metric.threshold * 100)}%
							</span>
						</div>
						<div className="mt-1 text-[0.6875rem] text-text-tertiary">
							{metric.rationale}
						</div>
					</div>
				))}
			</div>

			<div className="mt-4 rounded-md border border-border-subtle bg-bg-primary px-3 py-2">
				<div className="text-xs font-medium text-text-secondary">
					Kill-switch matrix
				</div>
				{triggered.length === 0 ? (
					<div className="mt-1 text-[0.6875rem] text-text-tertiary">
						No rules triggered in this branch view.
					</div>
				) : (
					<ul className="mt-2 list-disc space-y-1 pl-4 text-[0.6875rem] text-text-secondary">
						{triggered.map((rule) => (
							<li key={rule.id}>
								<span className="font-medium">{rule.label}</span> (
								{rule.severity}): {rule.rationale}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
