import { ArrowLeft, FileText, GitCommit, MessageSquare } from "lucide-react";
import type React from "react";
import type { BranchHeaderViewModel, HeaderMetric } from "../../core/types";

function formatMetric(metric: HeaderMetric): string {
	if (metric.kind === "known") return String(metric.value);
	return "—";
}

function Stat({
	metric,
	label,
	tone,
	icon: Icon,
	prefix,
}: {
	metric: HeaderMetric;
	label: string;
	tone?: "neutral" | "good" | "bad";
	icon?: React.ElementType;
	prefix?: "+" | "-";
}) {
	const valueClass =
		tone === "good"
			? "text-accent-green"
			: tone === "bad"
				? "text-accent-red"
				: "text-text-secondary";

	const value = formatMetric(metric);
	const displayValue =
		metric.kind === "known" && prefix ? `${prefix}${value}` : value;
	const title =
		metric.kind === "unavailable"
			? `Unavailable (${metric.reason})`
			: undefined;

	return (
		<div className="flex items-center gap-2">
			{Icon && <Icon className="w-3.5 h-3.5 text-text-muted" />}
			<div className="flex items-baseline gap-1.5" title={title}>
				<span className={`text-base font-semibold tabular-nums ${valueClass}`}>
					{displayValue}
				</span>
				<span className="text-[0.6875rem] text-text-muted">{label}</span>
			</div>
		</div>
	);
}

function StatGroup({
	children,
	label,
}: {
	children: React.ReactNode;
	label: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<span className="text-[0.625rem] font-semibold text-text-muted uppercase tracking-wider">
				{label}
			</span>
			<div className="flex items-center gap-4">{children}</div>
		</div>
	);
}

export function BranchHeader({
	viewModel,
	onClearFilter,
}: {
	viewModel: BranchHeaderViewModel;
	onClearFilter?: () => void;
}) {
	if (viewModel.kind === "hidden") {
		return null;
	}

	if (viewModel.kind === "shell") {
		return (
			<section
				className="card p-5"
				aria-label="Repo evidence context"
				aria-live="polite"
			>
				<h2 className="text-sm font-semibold text-text-primary">
					{viewModel.state === "loading"
						? "Loading repo evidence"
						: "Repo evidence unavailable"}
				</h2>
				<p className="mt-2 text-sm text-text-tertiary">{viewModel.message}</p>
			</section>
		);
	}

	return (
		<section
			className="card p-5"
			aria-label="Repo evidence context"
			aria-live="polite"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					<div className="flex items-center gap-3">
						{viewModel.isFilteredView && onClearFilter && (
							<button
								type="button"
								onClick={onClearFilter}
								className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105"
							>
								<ArrowLeft className="w-4 h-4" aria-hidden="true" />
								<span>Back to narrative brief</span>
							</button>
						)}
						<h1 className="text-2xl font-semibold text-text-primary">
							{viewModel.title}
						</h1>
						<span className="badge-open">{viewModel.status}</span>
						{viewModel.isFilteredView && (
							<span className="inline-flex items-center rounded-md bg-accent-blue-bg px-2 py-0.5 text-xs font-medium text-accent-blue">
								Focused evidence slice
							</span>
						)}
					</div>
					<p className="mt-2 text-sm text-text-tertiary leading-relaxed">
						{viewModel.description}
					</p>
				</div>
			</div>

			<div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 pt-4 border-t border-border-subtle">
				<StatGroup label="Code">
					<Stat
						metric={viewModel.metrics.added}
						label="added"
						tone="good"
						prefix="+"
					/>
					<Stat
						metric={viewModel.metrics.removed}
						label="removed"
						tone="bad"
						prefix="-"
					/>
					<Stat
						metric={viewModel.metrics.files}
						label="files"
						icon={FileText}
					/>
				</StatGroup>

				<StatGroup label="Git">
					<Stat
						metric={viewModel.metrics.commits}
						label="commits"
						icon={GitCommit}
					/>
				</StatGroup>

				<StatGroup label="Codex">
					<Stat
						metric={viewModel.metrics.prompts}
						label="prompts"
						icon={MessageSquare}
					/>
					<Stat metric={viewModel.metrics.responses} label="responses" />
				</StatGroup>
			</div>
		</section>
	);
}
