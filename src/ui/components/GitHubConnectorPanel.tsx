import { Toggle } from "./Toggle";

type GitHubConnectorPanelProps = {
	enabled: boolean;
	status: "disabled" | "loading" | "ready" | "partial" | "empty" | "error";
	entryCount: number;
	redactionHits: number;
	failedFileCount?: number;
	lastLoadedAtISO?: string;
	error?: string;
	onToggle: (enabled: boolean) => void;
};

export function GitHubConnectorPanel(props: GitHubConnectorPanelProps) {
	const {
		enabled,
		status,
		entryCount,
		redactionHits,
		failedFileCount,
		lastLoadedAtISO,
		error,
		onToggle,
	} = props;

	return (
		<div className="card p-4">
			<div className="section-header">GitHub Connector (Phase 2)</div>
			<div className="section-subheader mt-0.5">
				Optional context from PR title/body/review summaries
			</div>

			<div className="mt-4 flex items-center justify-between">
				<div className="flex flex-col gap-0.5">
					<span className="text-xs font-medium text-text-secondary">
						Enable GitHub metadata context
					</span>
					<span className="text-[0.625rem] text-text-tertiary">
						Opt-in only. Untrusted text is sanitized and redacted.
					</span>
				</div>
				<Toggle
					checked={enabled}
					onCheckedChange={onToggle}
					aria-label="Toggle GitHub connector context"
				/>
			</div>

			<div className="mt-3 rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-xs text-text-tertiary">
				<div>
					Status: <span className="text-text-secondary">{status}</span>
				</div>
				<div>
					Entries loaded:{" "}
					<span className="text-text-secondary">{entryCount}</span>
				</div>
				{typeof failedFileCount === "number" && failedFileCount > 0 ? (
					<div>
						Failed files:{" "}
						<span className="text-text-secondary">{failedFileCount}</span>
					</div>
				) : null}
				<div>
					Redactions applied:{" "}
					<span className="text-text-secondary">{redactionHits}</span>
				</div>
				{lastLoadedAtISO ? (
					<div>
						Last loaded:{" "}
						<span className="text-text-secondary">
							{new Date(lastLoadedAtISO).toLocaleString()}
						</span>
					</div>
				) : null}
				{error ? (
					<div className="mt-1 text-accent-red">Error: {error}</div>
				) : null}
			</div>
		</div>
	);
}
