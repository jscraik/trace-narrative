import type {
	DecisionArchaeologyEntry,
	NarrativeEvidenceLink,
} from "../../core/types";

type DecisionArchaeologyPanelProps = {
	entries: DecisionArchaeologyEntry[];
	onOpenEvidence: (link: NarrativeEvidenceLink) => void;
};

export function DecisionArchaeologyPanel({
	entries,
	onOpenEvidence,
}: DecisionArchaeologyPanelProps) {
	if (entries.length === 0) return null;

	return (
		<div
			className="card p-5 stagger-enter"
			style={{ "--stagger-index": 4 } as React.CSSProperties}
		>
			<div className="section-header">Decision archaeology</div>
			<div className="section-subheader mt-0.5">
				Why this was built this way
			</div>

			<div className="mt-4 space-y-3">
				{entries.map((entry) => (
					<details
						key={entry.id}
						className="rounded-lg border border-border-subtle bg-bg-primary p-3"
					>
						<summary className="cursor-pointer list-none text-sm font-medium text-text-primary">
							{entry.title}{" "}
							<span className="ml-1 text-xs text-text-muted">
								({Math.round(entry.confidence * 100)}% confidence)
							</span>
						</summary>
						<div className="mt-2 space-y-2 text-xs text-text-secondary">
							<p>{entry.intent}</p>
							<div>
								<div className="font-medium text-text-primary">Tradeoffs</div>
								<ul className="mt-1 list-disc space-y-1 pl-4">
									{entry.tradeoffs.map((tradeoff) => (
										<li key={tradeoff}>{tradeoff}</li>
									))}
								</ul>
							</div>
							<div>
								<div className="font-medium text-text-primary">
									Alternatives considered
								</div>
								<ul className="mt-1 list-disc space-y-1 pl-4">
									{entry.alternatives.map((alternative) => (
										<li key={alternative}>{alternative}</li>
									))}
								</ul>
							</div>
							{entry.evidenceLinks.length > 0 && (
								<div>
									<div className="font-medium text-text-primary">Evidence</div>
									<div className="mt-2 flex flex-wrap gap-2">
										{entry.evidenceLinks.map((link) => (
											<button
												key={link.id}
												type="button"
												onClick={() => onOpenEvidence(link)}
												className="rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[0.6875rem] text-text-secondary transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105 hover:bg-bg-primary"
											>
												{link.label}
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					</details>
				))}
			</div>
		</div>
	);
}
