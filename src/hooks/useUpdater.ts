import { ask, message } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

export type UpdateStatus =
	| { type: "checking" }
	| { type: "no_update" }
	| { type: "available"; update: Update }
	| { type: "downloading"; progress: number }
	| { type: "ready"; update: Update }
	| { type: "error"; error: string };

interface UseUpdaterOptions {
	/** Check on mount */
	checkOnMount?: boolean;
	/** Check interval in minutes (0 = no polling) */
	pollIntervalMinutes?: number;
}

interface UseUpdaterReturn {
	status: UpdateStatus | null;
	checkForUpdates: () => Promise<void>;
	downloadAndInstall: () => Promise<void>;
	dismiss: () => void;
}

/**
 * Hook for checking and installing Tauri app updates.
 *
 * Usage:
 * ```tsx
 * function App() {
 *   const { status, checkForUpdates, downloadAndInstall } = useUpdater({ checkOnMount: true });
 *
 *   if (status?.type === 'available') {
 *     return <UpdatePrompt onUpdate={downloadAndInstall} />;
 *   }
 *
 *   return <MainApp />;
 * }
 * ```
 */
export function useUpdater(options: UseUpdaterOptions = {}): UseUpdaterReturn {
	const { checkOnMount = false, pollIntervalMinutes = 0 } = options;
	const [status, setStatus] = useState<UpdateStatus | null>(null);
	const checkRequestVersionRef = useRef(0);
	const installRequestVersionRef = useRef(0);
	const mountedRef = useRef(true);

	useEffect(() => {
		return () => {
			mountedRef.current = false;
			checkRequestVersionRef.current += 1;
			installRequestVersionRef.current += 1;
		};
	}, []);

	const checkForUpdates = useCallback(async () => {
		const requestVersion = checkRequestVersionRef.current + 1;
		checkRequestVersionRef.current = requestVersion;
		const isStaleRequest = () =>
			!mountedRef.current || checkRequestVersionRef.current !== requestVersion;

		if (isStaleRequest()) return;

		try {
			setStatus({ type: "checking" });

			const update = await check();
			if (isStaleRequest()) return;

			if (update) {
				setStatus({ type: "available", update });
			} else {
				setStatus({ type: "no_update" });
			}
		} catch (error) {
			if (isStaleRequest()) return;
			setStatus({
				type: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}, []);

	const downloadAndInstall = useCallback(async () => {
		if (status?.type !== "available") return;

		const { update } = status;
		const requestVersion = installRequestVersionRef.current + 1;
		installRequestVersionRef.current = requestVersion;
		const isStaleRequest = () =>
			!mountedRef.current ||
			installRequestVersionRef.current !== requestVersion;

		try {
			let downloaded = 0;
			let contentLength = 0;

			await update.downloadAndInstall((event) => {
				if (isStaleRequest()) return;
				switch (event.event) {
					case "Started":
						contentLength = event.data.contentLength ?? 0;
						setStatus({ type: "downloading", progress: 0 });
						break;
					case "Progress": {
						downloaded += event.data.chunkLength;
						const progress =
							contentLength > 0
								? Math.round((downloaded / contentLength) * 100)
								: 0;
						setStatus({ type: "downloading", progress });
						break;
					}
					case "Finished":
						setStatus({ type: "ready", update });
						break;
				}
			});
			if (isStaleRequest()) return;

			// Update installed, ask to restart
			const shouldRestart = await ask(
				"Update installed successfully. Restart now to apply changes?",
				{
					title: "Update Ready",
					kind: "info",
					okLabel: "Restart",
					cancelLabel: "Later",
				},
			);
			if (isStaleRequest()) return;

			if (shouldRestart) {
				await relaunch();
			}
		} catch (error) {
			if (isStaleRequest()) return;
			await message(
				`Failed to install update: ${error instanceof Error ? error.message : "Unknown error"}`,
				{ title: "Update Error", kind: "error" },
			);
			if (isStaleRequest()) return;
			setStatus({
				type: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}, [status]);

	const dismiss = useCallback(() => {
		installRequestVersionRef.current += 1;
		setStatus(null);
	}, []);

	// Check on mount if enabled
	useEffect(() => {
		if (checkOnMount) {
			// Delay slightly to not block app startup
			const timer = setTimeout(checkForUpdates, 2000);
			return () => clearTimeout(timer);
		}
	}, [checkOnMount, checkForUpdates]);

	// Set up polling if enabled
	useEffect(() => {
		if (pollIntervalMinutes <= 0) return;

		const intervalMs = pollIntervalMinutes * 60 * 1000;
		const interval = setInterval(checkForUpdates, intervalMs);

		return () => clearInterval(interval);
	}, [pollIntervalMinutes, checkForUpdates]);

	return {
		status,
		checkForUpdates,
		downloadAndInstall,
		dismiss,
	};
}
