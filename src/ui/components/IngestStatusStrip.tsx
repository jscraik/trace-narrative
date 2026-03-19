import type { IngestStatus } from "../../hooks/useAutoIngest";
import { Checkbox } from "./Checkbox";

export function IngestStatusStrip(props: {
	status: IngestStatus;
	onToggle?: (enabled: boolean) => void;
}) {
	const { status, onToggle } = props;
	const lastImport = status.lastImportAt
		? new Date(status.lastImportAt).toLocaleTimeString()
		: "—";

	return (
		<div className="card p-3 flex items-center justify-between gap-3">
			<div>
				<div className="text-xs font-semibold text-text-secondary">
					INGESTION STATUS
				</div>
				<div className="mt-0.5 text-[0.6875rem] text-text-tertiary">
					{status.enabled ? "On" : "Off"} · Last import: {lastImport} · Errors:{" "}
					{status.errorCount}
				</div>
				{status.lastSource ? (
					<div className="text-[0.6875rem] text-text-muted">
						Last source: {status.lastSource}
					</div>
				) : null}
			</div>
			{onToggle ? (
				<div className="flex items-center gap-2 text-xs text-text-secondary">
					<Checkbox
						checked={status.enabled}
						onCheckedChange={(c) => onToggle(c)}
						aria-label="Auto-ingest"
					/>
					Auto‑ingest
				</div>
			) : null}
		</div>
	);
}
