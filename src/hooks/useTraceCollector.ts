import { listen } from "@tauri-apps/api/event";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { useCallback, useEffect, useRef } from "react";
import {
	generateDerivedTraceRecord,
	ingestCodexOtelLogFile,
	scanAgentTraceRecords,
	writeGeneratedTraceRecord,
} from "../core/repo/agentTrace";
import { defaultTraceConfig, saveTraceConfig } from "../core/repo/traceConfig";
import { runOtlpSmokeTest } from "../core/tauri/otelReceiver";
import type {
	BranchViewModel,
	FileChange,
	TraceCollectorStatus,
} from "../core/types";

const CODEX_OTEL_DOCS_URL =
	"https://developers.openai.com/codex/config-advanced/#observability-and-telemetry";

type OtelIngestNotification = {
	commitShas: string[];
	recordsWritten: number;
	dropped: number;
	issues: string[];
};

function applyTraceUpdate(
	model: BranchViewModel,
	trace: Awaited<ReturnType<typeof scanAgentTraceRecords>>,
): BranchViewModel {
	const timeline = model.timeline.map((node) => {
		const traceSummary = trace.byCommit[node.id];
		if (!traceSummary) return node;
		const existing = node.badges?.filter((b) => b.type !== "trace") ?? [];

		const isUnknownOnly =
			traceSummary.unknownLines > 0 &&
			traceSummary.aiLines === 0 &&
			traceSummary.humanLines === 0 &&
			traceSummary.mixedLines === 0;

		const label = isUnknownOnly ? "Unknown" : `AI ${traceSummary.aiPercent}%`;

		return {
			...node,
			badges: [...existing, { type: "trace" as const, label }],
		};
	});

	return {
		...model,
		traceSummaries: {
			byCommit: trace.byCommit,
			byFileByCommit: trace.byFileByCommit,
		},
		stats: {
			...model.stats,
			prompts: trace.totals.conversations,
			responses: trace.totals.ranges,
		},
		timeline,
	};
}

export interface UseTraceCollectorProps {
	repoRoot: string;
	repoId: number;
	timeline: Array<{ id: string }>;
	setRepoState: (updater: (prev: BranchViewModel) => BranchViewModel) => void;
	setActionError: (error: string | null) => void;
}

export interface UseTraceCollectorReturn {
	updateCodexOtelPath: (path: string) => Promise<void>;
	exportAgentTrace: (nodeId: string, files: FileChange[]) => Promise<void>;
	runOtlpSmokeTestHandler: (
		nodeId: string,
		files: FileChange[],
	) => Promise<void>;
	openCodexOtelDocs: () => Promise<void>;
}

/**
 * Hook for managing OTLP trace collection events and actions.
 * Sets up event listeners for receiver status and ingest notifications,
 * and provides handlers for trace-related operations.
 */
export function useTraceCollector({
	repoRoot,
	repoId,
	timeline,
	setRepoState,
	setActionError,
}: UseTraceCollectorProps): UseTraceCollectorReturn {
	const _repoStateRef = useRef({
		repoRoot,
		repoId,
		timeline,
		model: null as BranchViewModel | null,
	});
	const isMountedRef = useRef(true);
	const repoContextRef = useRef({ repoRoot, repoId });
	const actionRequestVersionRef = useRef(0);

	useEffect(() => {
		repoContextRef.current = { repoRoot, repoId };
		actionRequestVersionRef.current += 1;
	}, [repoRoot, repoId]);

	useEffect(() => {
		return () => {
			isMountedRef.current = false;
			actionRequestVersionRef.current += 1;
		};
	}, []);

	const beginActionGuard = useCallback(() => {
		const expectedRepoRoot = repoContextRef.current.repoRoot;
		const expectedRepoId = repoContextRef.current.repoId;
		const requestVersion = actionRequestVersionRef.current + 1;
		actionRequestVersionRef.current = requestVersion;

		const isStaleRequest = () =>
			!isMountedRef.current ||
			actionRequestVersionRef.current !== requestVersion ||
			repoContextRef.current.repoRoot !== expectedRepoRoot ||
			repoContextRef.current.repoId !== expectedRepoId;

		return { expectedRepoRoot, expectedRepoId, isStaleRequest };
	}, []);

	const applyScopedRepoUpdate = useCallback(
		(
			expectedRepoId: number,
			updater: (prev: BranchViewModel) => BranchViewModel,
		) => {
			setRepoState((prev) => {
				if (
					prev.meta?.repoId !== undefined &&
					prev.meta.repoId !== expectedRepoId
				) {
					return prev;
				}
				return updater(prev);
			});
		},
		[setRepoState],
	);

	useEffect(() => {
		// These listeners can fire even when no repo is selected (e.g. receiver running in background).
		// Avoid surfacing confusing "repo root does not exist:" errors by only wiring listeners when
		// we have a valid repo context to apply updates into.
		if (!repoRoot || repoId <= 0) return;

		let unlistenStatus: (() => void) | null = null;
		let unlistenIngest: (() => void) | null = null;
		let cancelled = false;

		const setup = async () => {
			const statusUnlisten = await listen<TraceCollectorStatus>(
				"otel-receiver-status",
				(event) => {
					applyScopedRepoUpdate(repoId, (prev) => {
						return {
							...prev,
							traceStatus: event.payload,
						};
					});
				},
			);
			if (cancelled) {
				statusUnlisten();
				return;
			}
			unlistenStatus = statusUnlisten;

			const ingestUnlisten = await listen<OtelIngestNotification>(
				"otel-trace-ingested",
				async () => {
					try {
						if (timeline.length === 0) return;
						const commitShas = timeline.map((node) => node.id);
						const trace = await scanAgentTraceRecords(
							repoRoot,
							repoId,
							commitShas,
						);

						applyScopedRepoUpdate(repoId, (prev) =>
							applyTraceUpdate(prev, trace),
						);
					} catch (e: unknown) {
						const _msg = String(e);
						setActionError(e instanceof Error ? e.message : _msg);
					}
				},
			);
			if (cancelled) {
				ingestUnlisten();
				return;
			}
			unlistenIngest = ingestUnlisten;
		};

		void setup();

		return () => {
			cancelled = true;
			if (unlistenStatus) unlistenStatus();
			if (unlistenIngest) unlistenIngest();
		};
	}, [repoRoot, repoId, timeline, applyScopedRepoUpdate, setActionError]);

	const updateCodexOtelPath = useCallback(
		async (path: string) => {
			const { expectedRepoRoot, expectedRepoId, isStaleRequest } =
				beginActionGuard();
			setActionError(null);

			try {
				if (!expectedRepoRoot || expectedRepoId <= 0) {
					throw new Error(
						"Open a repository before configuring trace ingestion.",
					);
				}
				// Get current trace config from model (will need to be passed in or stored)
				const baseConfig = defaultTraceConfig();
				const nextConfig = { ...baseConfig, codexOtelLogPath: path };
				await saveTraceConfig(expectedRepoRoot, nextConfig);
				if (isStaleRequest()) return;
				const _ingest = await ingestCodexOtelLogFile({
					repoRoot: expectedRepoRoot,
					repoId: expectedRepoId,
					logPath: path,
				});
				if (isStaleRequest()) return;
				const commitShas = timeline.map((n) => n.id);
				const trace = await scanAgentTraceRecords(
					expectedRepoRoot,
					expectedRepoId,
					commitShas,
				);
				if (isStaleRequest()) return;

				applyScopedRepoUpdate(expectedRepoId, (prev) =>
					applyTraceUpdate(prev, trace),
				);
			} catch (e: unknown) {
				const _msg = String(e);
				if (isStaleRequest()) return;
				setActionError(e instanceof Error ? e.message : _msg);
			}
		},
		[beginActionGuard, timeline, applyScopedRepoUpdate, setActionError],
	);

	const exportAgentTrace = useCallback(
		async (nodeId: string, files: FileChange[]) => {
			const { expectedRepoRoot, expectedRepoId, isStaleRequest } =
				beginActionGuard();
			setActionError(null);

			try {
				if (!expectedRepoRoot || expectedRepoId <= 0) {
					throw new Error("Open a repository before exporting a trace.");
				}
				const sessionId = await getSessionLinkForCommit(expectedRepoId, nodeId);
				if (isStaleRequest()) return;
				const record = await generateDerivedTraceRecord({
					repoRoot: expectedRepoRoot,
					commitSha: nodeId,
					files,
					sessionId,
				});
				if (isStaleRequest()) return;
				await writeGeneratedTraceRecord(expectedRepoRoot, record);
				if (isStaleRequest()) return;

				const commitShas = timeline.map((n) => n.id);
				const trace = await scanAgentTraceRecords(
					expectedRepoRoot,
					expectedRepoId,
					commitShas,
				);
				if (isStaleRequest()) return;

				applyScopedRepoUpdate(expectedRepoId, (prev) =>
					applyTraceUpdate(prev, trace),
				);
			} catch (e: unknown) {
				const _msg = String(e);
				if (isStaleRequest()) return;
				setActionError(e instanceof Error ? e.message : _msg);
			}
		},
		[beginActionGuard, timeline, applyScopedRepoUpdate, setActionError],
	);

	const runOtlpSmokeTestHandler = useCallback(
		async (nodeId: string, files: FileChange[]) => {
			const { expectedRepoRoot, expectedRepoId, isStaleRequest } =
				beginActionGuard();
			setActionError(null);

			try {
				if (!expectedRepoRoot || expectedRepoId <= 0) {
					throw new Error("Open a repository before running the smoke test.");
				}
				if (files.length === 0) {
					throw new Error(
						"Select a commit with changed files to run the smoke test.",
					);
				}

				await runOtlpSmokeTest(
					expectedRepoRoot,
					nodeId,
					files.map((file) => file.path),
				);
				if (isStaleRequest()) return;

				const commitShas = timeline.map((n) => n.id);
				const trace = await scanAgentTraceRecords(
					expectedRepoRoot,
					expectedRepoId,
					commitShas,
				);
				if (isStaleRequest()) return;

				applyScopedRepoUpdate(expectedRepoId, (prev) =>
					applyTraceUpdate(prev, trace),
				);
			} catch (e: unknown) {
				const _msg = String(e);
				if (isStaleRequest()) return;
				setActionError(e instanceof Error ? e.message : _msg);
			}
		},
		[beginActionGuard, timeline, applyScopedRepoUpdate, setActionError],
	);

	const openCodexOtelDocs = useCallback(async () => {
		try {
			await openExternal(CODEX_OTEL_DOCS_URL);
		} catch (e: unknown) {
			setActionError(e instanceof Error ? e.message : String(e));
		}
	}, [setActionError]);

	return {
		updateCodexOtelPath,
		exportAgentTrace,
		runOtlpSmokeTestHandler,
		openCodexOtelDocs,
	};
}

// Import getSessionLinksForCommit to avoid dependency on linking module
async function getSessionLinkForCommit(
	repoId: number,
	commitSha: string,
): Promise<string> {
	const { getSessionLinksForCommit: getLinks } = await import(
		"../core/repo/sessionLinking"
	);
	const links = await getLinks(repoId, commitSha);
	return links[0]?.sessionId ?? "";
}
