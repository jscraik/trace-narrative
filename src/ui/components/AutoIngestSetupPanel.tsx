import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import {
	type CaptureReliabilityStatus,
	type CollectorMigrationStatus,
	type DiscoveredSources,
	discoverCaptureSources,
	type IngestConfig,
} from "../../core/tauri/ingestConfig";
import {
	AutoIngestToggleCard,
	CaptureModeCard,
	CollectorMigrationCard,
	DiscoveryCard,
	PanelHeader,
	type WatchPaths,
	WatchPathsCard,
} from "./auto-ingest-setup/AutoIngestSetupSections";

export function AutoIngestSetupPanel(props: {
	config: IngestConfig | null;
	sources: DiscoveredSources | null;
	migrationStatus?: CollectorMigrationStatus | null;
	captureReliability?: CaptureReliabilityStatus | null;
	onToggleAutoIngest: (enabled: boolean) => void;
	onUpdateWatchPaths: (paths: WatchPaths) => void;
	onMigrateCollector?: (dryRun?: boolean) => Promise<unknown>;
	onRollbackCollector?: () => Promise<unknown>;
	onRefreshReliability?: () => Promise<unknown>;
	onAuthorizeCodexAppServerForLiveTest?: () => Promise<void>;
	onLogoutCodexAppServerAccount?: () => Promise<void>;
}) {
	const {
		config,
		sources,
		migrationStatus,
		captureReliability,
		onToggleAutoIngest,
		onUpdateWatchPaths,
		onMigrateCollector,
		onRollbackCollector,
		onRefreshReliability,
		onAuthorizeCodexAppServerForLiveTest,
		onLogoutCodexAppServerAccount,
	} = props;

	const [claudePaths, setClaudePaths] = useState("");
	const [cursorPaths, setCursorPaths] = useState("");
	const [codexPaths, setCodexPaths] = useState("");
	const [showAdvancedPaths, setShowAdvancedPaths] = useState(false);
	const [detectionStatus, setDetectionStatus] = useState<
		"idle" | "searching" | "found" | "not-found" | "error"
	>("idle");
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [hasAutoDetectedOnLoad, setHasAutoDetectedOnLoad] = useState(false);
	const [migrationBusy, setMigrationBusy] = useState(false);
	const [authBusy, setAuthBusy] = useState(false);

	const captureMode = captureReliability?.mode ?? "UNKNOWN";

	useEffect(() => {
		if (!config) return;
		setClaudePaths(config.watchPaths.claude.join("\n"));
		setCursorPaths(config.watchPaths.cursor.join("\n"));
		setCodexPaths((config.watchPaths.codexLogs ?? []).join("\n"));
	}, [config]);

	const applyWatchPaths = useCallback(
		(paths: WatchPaths, persist = true) => {
			setClaudePaths(paths.claude.join("\n"));
			setCursorPaths(paths.cursor.join("\n"));
			setCodexPaths(paths.codexLogs.join("\n"));
			if (persist) {
				onUpdateWatchPaths(paths);
			}
		},
		[onUpdateWatchPaths],
	);

	const runAutoDetect = useCallback(
		async (persist = true) => {
			setDetectionStatus("searching");
			setStatusMessage("Auto-detecting source paths…");
			try {
				const discovered = await discoverCaptureSources();
				const next = {
					claude: discovered.claude,
					cursor: discovered.cursor,
					codexLogs: discovered.codexLogs,
				};
				const total =
					next.claude.length + next.cursor.length + next.codexLogs.length;
				if (total === 0) {
					setDetectionStatus("not-found");
					setStatusMessage(
						"No known source paths found. Add folders manually below.",
					);
					return;
				}
				applyWatchPaths(next, persist);
				setDetectionStatus("found");
				setStatusMessage(
					`Detected ${total} source path${total === 1 ? "" : "s"}.`,
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				setDetectionStatus("error");
				setStatusMessage(`Path auto-detect failed: ${message}`);
			}
		},
		[applyWatchPaths],
	);

	useEffect(() => {
		if (!config || hasAutoDetectedOnLoad) return;
		const hasAnyConfiguredPath = [
			config.watchPaths.claude,
			config.watchPaths.cursor,
			config.watchPaths.codexLogs ?? [],
		].some((group) => group.length > 0);

		if (hasAnyConfiguredPath) {
			setHasAutoDetectedOnLoad(true);
			return;
		}

		setHasAutoDetectedOnLoad(true);
		void runAutoDetect(true);
	}, [config, hasAutoDetectedOnLoad, runAutoDetect]);

	const discoveredSummary = (() => {
		if (!sources) return null;
		const items: string[] = [];
		if (sources.claude.length > 0) items.push("Claude");
		if (sources.cursor.length > 0) items.push("Cursor");
		if (sources.codexLogs.length > 0) items.push("Codex");
		return items.length > 0
			? `Detected: ${items.join(" · ")}`
			: "No known sources detected on this machine.";
	})();

	if (!config) {
		return (
			<div className="card p-5">
				<div className="section-header">Auto-Ingest Setup</div>
				<div className="section-subheader">connect once</div>
				<div className="mt-3 text-xs text-text-tertiary">
					Open a repo to configure auto‑ingest.
				</div>
			</div>
		);
	}

	const pickDir = async () => {
		const selected = await open({
			directory: true,
			multiple: false,
			title: "Choose a folder to capture from",
		});
		if (!selected) return null;
		return typeof selected === "string" ? selected : (selected[0] ?? null);
	};

	const appendPath = async (
		current: string,
		onChange: (value: string) => void,
	) => {
		const dir = await pickDir();
		if (!dir) return;
		onChange(current.trim() ? `${current}\n${dir}` : dir);
	};

	const saveWatchPaths = () => {
		onUpdateWatchPaths({
			claude: toPathList(claudePaths),
			cursor: toPathList(cursorPaths),
			codexLogs: toPathList(codexPaths),
		});
	};

	const runMigrationAction = async (action: () => Promise<unknown>) => {
		setMigrationBusy(true);
		try {
			await action();
		} finally {
			setMigrationBusy(false);
		}
	};

	const runAuthAction = async (action?: () => Promise<void>) => {
		if (!action) return;
		setAuthBusy(true);
		try {
			await action();
		} finally {
			setAuthBusy(false);
		}
	};

	return (
		<div className="card p-5">
			<PanelHeader />

			<div className="mt-4 space-y-4">
				<CaptureModeCard
					captureMode={captureMode}
					captureReliability={captureReliability}
					authBusy={authBusy}
					onRefreshReliability={() => void onRefreshReliability?.()}
					onAuthorize={() =>
						runAuthAction(onAuthorizeCodexAppServerForLiveTest)
					}
					onLogout={() => runAuthAction(onLogoutCodexAppServerAccount)}
				/>

				<CollectorMigrationCard
					migrationStatus={migrationStatus}
					migrationBusy={migrationBusy}
					onMigrateNow={() =>
						onMigrateCollector
							? runMigrationAction(() => onMigrateCollector(false))
							: Promise.resolve()
					}
					onDryRun={() =>
						onMigrateCollector
							? runMigrationAction(() => onMigrateCollector(true))
							: Promise.resolve()
					}
					onRollback={() =>
						onRollbackCollector
							? runMigrationAction(onRollbackCollector)
							: Promise.resolve()
					}
				/>

				<AutoIngestToggleCard
					enabled={config.autoIngestEnabled}
					onToggle={onToggleAutoIngest}
				/>

				<DiscoveryCard
					autoIngestEnabled={config.autoIngestEnabled}
					discoveredSummary={discoveredSummary}
					detectionStatus={detectionStatus}
					statusMessage={statusMessage}
					onAutoDetect={() => void runAutoDetect(true)}
				/>

				<WatchPathsCard
					claudePaths={claudePaths}
					cursorPaths={cursorPaths}
					codexPaths={codexPaths}
					showAdvancedPaths={showAdvancedPaths}
					onAddClaudeFolder={() => void appendPath(claudePaths, setClaudePaths)}
					onAddCursorFolder={() => void appendPath(cursorPaths, setCursorPaths)}
					onAddCodexFolder={() => void appendPath(codexPaths, setCodexPaths)}
					onSaveWatchPaths={saveWatchPaths}
					onToggleAdvanced={() => setShowAdvancedPaths((value) => !value)}
					onClaudePathsChange={setClaudePaths}
					onCursorPathsChange={setCursorPaths}
					onCodexPathsChange={setCodexPaths}
				/>
			</div>
		</div>
	);
}

function toPathList(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((item) => item.trim())
		.filter(Boolean);
}
