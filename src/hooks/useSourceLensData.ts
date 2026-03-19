import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
	AttributionNoteSummary,
	AttributionPrefs,
} from "../core/attribution-api";
import {
	type ContributionStats,
	exportAttributionNote,
	getAttributionNoteSummary,
	getAttributionPrefs,
	getCommitContributionStats,
	importAttributionNote,
	setAttributionPrefs,
} from "../core/attribution-api";
import type { SourceLine } from "../ui/components/AuthorBadge";

const LIMIT = 200; // Balance between UX (context) and render cost for large files.

export interface SourceLensResult {
	lines: SourceLine[];
	totalLines: number;
	hasMore: boolean;
}

export interface UseSourceLensDataProps {
	repoId: number;
	commitSha: string;
	filePath: string;
}

export interface UseSourceLensDataReturn {
	// Data
	lines: SourceLine[];
	stats: ContributionStats | null;
	noteSummary: AttributionNoteSummary | null;
	prefs: AttributionPrefs | null;
	// Loading states
	loading: boolean;
	syncing: boolean;
	// Pagination
	offset: number;
	hasMore: boolean;
	// Error states
	error: string | null;
	statsError: string | null;
	noteSummaryError: string | null;
	syncStatus: string | null;
	// Actions
	loadMore: () => void;
	refreshAttribution: () => void;
	handleImportNote: () => Promise<void>;
	handleExportNote: () => Promise<void>;
	handleEnableMetadata: () => Promise<void>;
}

export function useSourceLensData({
	repoId,
	commitSha,
	filePath,
}: UseSourceLensDataProps): UseSourceLensDataReturn {
	const requestIdentityRef = useRef(`${repoId}:${commitSha}:${filePath}`);
	const syncActionVersionRef = useRef(0);
	const isMountedRef = useRef(true);

	useEffect(() => {
		requestIdentityRef.current = `${repoId}:${commitSha}:${filePath}`;
		syncActionVersionRef.current += 1;
		setSyncing(false);
		setSyncStatus(null);
	}, [repoId, commitSha, filePath]);

	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const buildRequestIdentity = useCallback(
		() => `${repoId}:${commitSha}:${filePath}`,
		[repoId, commitSha, filePath],
	);

	const isRequestCurrent = useCallback(
		(requestIdentity: string) =>
			isMountedRef.current && requestIdentityRef.current === requestIdentity,
		[],
	);

	const [lines, setLines] = useState<SourceLine[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [stats, setStats] = useState<ContributionStats | null>(null);
	const [statsError, setStatsError] = useState<string | null>(null);
	const [noteSummary, setNoteSummary] = useState<AttributionNoteSummary | null>(
		null,
	);
	const [noteSummaryError, setNoteSummaryError] = useState<string | null>(null);
	const [prefs, setPrefs] = useState<AttributionPrefs | null>(null);
	const [syncStatus, setSyncStatus] = useState<string | null>(null);
	const [syncing, setSyncing] = useState(false);

	const loadAttribution = useCallback(
		async (requestedOffset: number) => {
			const requestIdentity = buildRequestIdentity();
			setLoading(true);
			setError(null);

			try {
				const result = await invoke<SourceLensResult>("get_file_source_lens", {
					request: {
						repoId,
						commitSha,
						filePath,
						offset: requestedOffset,
						limit: LIMIT,
					},
				});

				if (!isRequestCurrent(requestIdentity)) return;
				setLines((previous) =>
					requestedOffset === 0 ? result.lines : [...previous, ...result.lines],
				);
				setHasMore(result.hasMore);
			} catch (e) {
				if (!isRequestCurrent(requestIdentity)) return;
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (isRequestCurrent(requestIdentity)) {
					setLoading(false);
				}
			}
		},
		[buildRequestIdentity, commitSha, filePath, isRequestCurrent, repoId],
	);

	const loadStats = useCallback(async () => {
		const requestIdentity = buildRequestIdentity();
		setStatsError(null);
		try {
			const result = await getCommitContributionStats(repoId, commitSha);
			if (!isRequestCurrent(requestIdentity)) return;
			setStats(result);
		} catch (e) {
			if (!isRequestCurrent(requestIdentity)) return;
			setStatsError(e instanceof Error ? e.message : String(e));
		}
	}, [buildRequestIdentity, commitSha, isRequestCurrent, repoId]);

	const loadNoteSummary = useCallback(async () => {
		const requestIdentity = buildRequestIdentity();
		setNoteSummaryError(null);
		try {
			const summary = await getAttributionNoteSummary(repoId, commitSha);
			if (!isRequestCurrent(requestIdentity)) return;
			setNoteSummary(summary);
		} catch (e) {
			if (!isRequestCurrent(requestIdentity)) return;
			setNoteSummaryError(e instanceof Error ? e.message : String(e));
		}
	}, [buildRequestIdentity, commitSha, isRequestCurrent, repoId]);

	const loadPrefs = useCallback(async () => {
		const requestIdentity = buildRequestIdentity();
		try {
			const result = await getAttributionPrefs(repoId);
			if (!isRequestCurrent(requestIdentity)) return;
			setPrefs(result);
		} catch (e) {
			if (!isRequestCurrent(requestIdentity)) return;
			setSyncStatus(e instanceof Error ? e.message : String(e));
		}
	}, [buildRequestIdentity, isRequestCurrent, repoId]);

	useEffect(() => {
		setOffset(0);
		loadAttribution(0);
		loadStats();
		loadNoteSummary();
		loadPrefs();
	}, [loadAttribution, loadStats, loadNoteSummary, loadPrefs]);

	const loadMore = useCallback(() => {
		const nextOffset = offset + LIMIT;
		setOffset(nextOffset);
		loadAttribution(nextOffset);
	}, [offset, loadAttribution]);

	const refreshAttribution = useCallback(() => {
		setOffset(0);
		loadAttribution(0);
		loadStats();
		loadNoteSummary();
	}, [loadAttribution, loadStats, loadNoteSummary]);

	const handleImportNote = useCallback(async () => {
		const requestIdentity = buildRequestIdentity();
		const actionVersion = syncActionVersionRef.current + 1;
		syncActionVersionRef.current = actionVersion;
		const isCurrentAction = () =>
			syncActionVersionRef.current === actionVersion &&
			isRequestCurrent(requestIdentity);

		setSyncing(true);
		setSyncStatus(null);
		try {
			const summary = await importAttributionNote(repoId, commitSha);
			if (!isCurrentAction()) return;
			if (summary.status === "missing") {
				setSyncStatus("No attribution note found for this commit.");
			} else if (summary.status === "invalid") {
				setSyncStatus("Attribution note was empty or invalid.");
			} else {
				setSyncStatus(
					`Imported ${summary.importedRanges} ranges from attribution note.`,
				);
			}
			refreshAttribution();
		} catch (e) {
			if (!isCurrentAction()) return;
			setSyncStatus(e instanceof Error ? e.message : String(e));
		} finally {
			if (isCurrentAction() && isMountedRef.current) {
				setSyncing(false);
			}
		}
	}, [
		buildRequestIdentity,
		commitSha,
		isRequestCurrent,
		refreshAttribution,
		repoId,
	]);

	const handleExportNote = useCallback(async () => {
		const requestIdentity = buildRequestIdentity();
		const actionVersion = syncActionVersionRef.current + 1;
		syncActionVersionRef.current = actionVersion;
		const isCurrentAction = () =>
			syncActionVersionRef.current === actionVersion &&
			isRequestCurrent(requestIdentity);

		setSyncing(true);
		setSyncStatus(null);
		try {
			await exportAttributionNote(repoId, commitSha);
			if (!isCurrentAction()) return;
			setSyncStatus("Exported attribution note to git notes.");
		} catch (e) {
			if (!isCurrentAction()) return;
			setSyncStatus(e instanceof Error ? e.message : String(e));
		} finally {
			if (isCurrentAction() && isMountedRef.current) {
				setSyncing(false);
			}
		}
	}, [buildRequestIdentity, commitSha, isRequestCurrent, repoId]);

	const handleEnableMetadata = useCallback(async () => {
		const requestIdentity = buildRequestIdentity();
		const actionVersion = syncActionVersionRef.current + 1;
		syncActionVersionRef.current = actionVersion;
		const isCurrentAction = () =>
			syncActionVersionRef.current === actionVersion &&
			isRequestCurrent(requestIdentity);

		setSyncing(true);
		setSyncStatus(null);
		try {
			await setAttributionPrefs(repoId, { cachePromptMetadata: true });
			if (!isCurrentAction()) return;
			await importAttributionNote(repoId, commitSha);
			if (!isCurrentAction()) return;
			await loadPrefs();
			if (!isCurrentAction()) return;
			await loadNoteSummary();
			if (!isCurrentAction()) return;
			setSyncStatus("Enabled prompt metadata caching for this repo.");
			refreshAttribution();
		} catch (e) {
			if (!isCurrentAction()) return;
			setSyncStatus(e instanceof Error ? e.message : String(e));
		} finally {
			if (isCurrentAction() && isMountedRef.current) {
				setSyncing(false);
			}
		}
	}, [
		buildRequestIdentity,
		commitSha,
		isRequestCurrent,
		loadNoteSummary,
		loadPrefs,
		refreshAttribution,
		repoId,
	]);

	return {
		lines,
		stats,
		noteSummary,
		prefs,
		loading,
		syncing,
		offset,
		hasMore,
		error,
		statsError,
		noteSummaryError,
		syncStatus,
		loadMore,
		refreshAttribution,
		handleImportNote,
		handleExportNote,
		handleEnableMetadata,
	};
}
