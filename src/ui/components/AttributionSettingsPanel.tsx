import { useEffect, useState } from "react";
import type {
	AttributionPrefs,
	AttributionPrefsUpdate,
} from "../../core/attribution-api";
import { HelpPopover } from "./HelpPopover";
import { Toggle } from "./Toggle";

interface AttributionSettingsPanelProps {
	attributionPrefs?: AttributionPrefs | null;
	onUpdateAttributionPrefs?: (update: AttributionPrefsUpdate) => void;
	onPurgeAttributionMetadata?: () => void;
}

export function AttributionSettingsPanel({
	attributionPrefs,
	onUpdateAttributionPrefs,
	onPurgeAttributionMetadata,
}: AttributionSettingsPanelProps) {
	const [retentionDays, setRetentionDays] = useState(
		attributionPrefs?.retentionDays
			? String(attributionPrefs.retentionDays)
			: "",
	);

	useEffect(() => {
		setRetentionDays(
			attributionPrefs?.retentionDays
				? String(attributionPrefs.retentionDays)
				: "",
		);
	}, [attributionPrefs?.retentionDays]);

	return (
		<div className="card p-5">
			<div className="flex items-center justify-between">
				<div>
					<div className="section-header">Attribution Notes</div>
					<div className="section-subheader mt-0.5">
						Control attribution metadata caching and overlays.
					</div>
				</div>
				<HelpPopover content="These settings affect how Narrator displays AI attribution in the UI." />
			</div>

			<div className="mt-4 flex flex-col gap-3 rounded-lg border border-border-light bg-bg-secondary p-4">
				<div className="flex items-center justify-between py-1">
					<span className="text-xs text-text-secondary">
						Cache prompt metadata locally
					</span>
					<Toggle
						checked={attributionPrefs?.cachePromptMetadata ?? false}
						onCheckedChange={(c) =>
							onUpdateAttributionPrefs?.({ cachePromptMetadata: c })
						}
						aria-label="Cache prompt metadata locally"
					/>
				</div>

				<div className="flex items-center justify-between py-1">
					<span className="text-xs text-text-secondary">Store prompt text</span>
					<Toggle
						checked={attributionPrefs?.storePromptText ?? false}
						onCheckedChange={(c) =>
							onUpdateAttributionPrefs?.({ storePromptText: c })
						}
						aria-label="Store prompt text"
					/>
				</div>

				<div className="flex items-center justify-between py-1">
					<span className="text-xs text-text-secondary">
						Show line overlays in Source Lens
					</span>
					<Toggle
						checked={attributionPrefs?.showLineOverlays ?? true}
						onCheckedChange={(c) =>
							onUpdateAttributionPrefs?.({ showLineOverlays: c })
						}
						aria-label="Show line overlays"
					/>
				</div>

				<div className="border-t border-border-subtle pt-3 mt-1">
					<div className="flex items-center justify-between mb-2">
						<label
							htmlFor="codex-otel-retention"
							className="text-xs font-semibold text-text-secondary"
						>
							Retention days
						</label>
						<HelpPopover content="How long to keep cached attribution data." />
					</div>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex gap-2">
							<input
								id="codex-otel-retention"
								type="number"
								min={1}
								value={retentionDays}
								onChange={(event) => setRetentionDays(event.target.value)}
								className="w-16 rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-xs text-text-secondary"
								placeholder="Days"
							/>
							<button
								type="button"
								className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[0.6875rem] font-semibold text-text-secondary hover:bg-bg-hover"
								onClick={() => {
									const trimmed = retentionDays.trim();
									if (!trimmed) {
										onUpdateAttributionPrefs?.({ clearRetentionDays: true });
										return;
									}
									const parsed = Number.parseInt(trimmed, 10);
									if (Number.isFinite(parsed) && parsed > 0) {
										onUpdateAttributionPrefs?.({ retentionDays: parsed });
									}
								}}
							>
								Save
							</button>
						</div>

						<button
							type="button"
							className="inline-flex items-center rounded-md border border-accent-amber-light bg-accent-amber-bg px-2 py-1 text-[0.6875rem] font-semibold text-accent-amber hover:bg-accent-amber-light"
							onClick={onPurgeAttributionMetadata}
						>
							Purge cache
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
