import { importAttributionNotesBatch } from "../attribution-api";
import {
	BRANCH_NARRATIVE_SCHEMA_VERSION,
	composeBranchNarrative,
} from "../narrative/composeBranchNarrative";
import {
	getStoryAnchorStatus,
	importSessionLinkNotesBatch,
	type StoryAnchorCommitStatus,
} from "../story-anchors-api";
import type { BranchViewModel, IntentItem, TimelineNode } from "../types";
import { ingestCodexOtelLogFile, scanAgentTraceRecords } from "./agentTrace";
import {
	cacheCommitSummaries,
	cacheFileChanges,
	getCachedFileChanges,
	upsertRepo,
} from "./db";
import {
	getAggregateStatsForCommits,
	getCommitDetails,
	getDirtyFiles,
	getHeadBranch,
	getHeadSha,
	getWorkingTreeChurn,
	listCommits,
	resolveGitRoot,
} from "./git";
import {
	branchStatsPayload,
	ensureRepoNarrativeLayout,
	writeBranchMeta,
	writeCommitFilesMeta,
	writeCommitSummaryMeta,
	writeRepoMeta,
} from "./meta";
import { loadSessionExcerpts } from "./sessions";
import { listSnapshots } from "./snapshots";
import { getLatestTestRunSummaryByCommit } from "./testRuns";
import { loadTraceConfig } from "./traceConfig";

export type IndexingProgress = {
	phase: string;
	message: string;
	current?: number;
	total?: number;
	percent?: number;
};

export type RepoIndex = {
	repoId: number;
	root: string;
	branch: string;
	headSha: string;
};

export async function indexRepo(
	selectedPath: string,
	limit = 50,
	onProgress?: (progress: IndexingProgress) => void,
): Promise<{ model: BranchViewModel; repo: RepoIndex }> {
	const phaseOrder = [
		"resolve",
		"branch",
		"repo",
		"commits",
		"summaries",
		"stats",
		"notes",
		"intent",
		"sessions",
		"trace",
		"meta",
		"done",
	];

	const reportProgress = (
		phase: string,
		message: string,
		current?: number,
		total?: number,
	) => {
		if (!onProgress) return;
		const phaseIndex = phaseOrder.indexOf(phase);
		const segment = phaseIndex >= 0 ? 100 / (phaseOrder.length - 1) : undefined;
		const ratio =
			typeof total === "number" && total > 0 && typeof current === "number"
				? Math.min(1, current / total)
				: 0;
		const percent =
			segment !== undefined
				? Math.min(100, Math.round(segment * phaseIndex + ratio * segment))
				: undefined;
		onProgress({ phase, message, current, total, percent });
	};

	const yieldToMain = () =>
		new Promise<void>((resolve) => setTimeout(resolve, 0));

	reportProgress("resolve", "Resolving repository…");
	const root = await resolveGitRoot(selectedPath);
	reportProgress("branch", "Reading branch metadata…");
	const [branch, headSha] = await Promise.all([
		getHeadBranch(root),
		getHeadSha(root),
	]);

	reportProgress("repo", "Preparing repo index…");
	const repoId = await upsertRepo(root);

	reportProgress("commits", "Listing commits…");
	const commits = await listCommits(root, limit);
	reportProgress("summaries", "Caching commit summaries…", 0, commits.length);
	const cachePromise = cacheCommitSummaries(
		repoId,
		commits,
		(current, total) => {
			reportProgress("summaries", "Caching commit summaries…", current, total);
		},
	);

	reportProgress("stats", "Computing aggregate stats…");
	const [_, agg] = await Promise.all([
		cachePromise,
		getAggregateStatsForCommits(root, limit),
	]);

	reportProgress("notes", "Importing attribution notes…");
	await Promise.allSettled([
		importAttributionNotesBatch(
			repoId,
			commits.map((c) => c.sha),
		).catch((e) => {
			console.error("[Indexer] Attribution notes import failed:", e);
		}),
		importSessionLinkNotesBatch(
			repoId,
			commits.map((c) => c.sha),
		).catch((e) => {
			console.error("[Indexer] Session link notes import failed:", e);
		}),
	]);

	// Story Anchors status hydration is best-effort (used for timeline indicators).
	let anchorStatusBySha: Record<string, StoryAnchorCommitStatus> = {};
	let dirtyFiles: string[] = [];
	let dirtyChurnLines = 0;
	let sessionExcerpts: Awaited<ReturnType<typeof loadSessionExcerpts>> = [];
	let traceConfig: Awaited<ReturnType<typeof loadTraceConfig>>;
	let snapshots: Awaited<ReturnType<typeof listSnapshots>> = [];
	let testSummaries: Awaited<
		ReturnType<typeof getLatestTestRunSummaryByCommit>
	> = {};

	reportProgress("intent", "Preparing intent summaries…");
	const intent: IntentItem[] = commits.slice(0, 6).map((c, idx) => ({
		id: `c-${idx}`,
		text: c.subject || "(no subject)",
		tag: c.sha.slice(0, 7),
	}));

	// Run all independent post-commits work concurrently
	reportProgress("sessions", "Loading session excerpts…");
	[
		anchorStatusBySha,
		sessionExcerpts,
		traceConfig,
		dirtyFiles,
		dirtyChurnLines,
		snapshots,
		testSummaries,
	] = await Promise.all([
		getStoryAnchorStatus(
			repoId,
			commits.map((c) => c.sha),
		)
			.then((rows) => Object.fromEntries(rows.map((r) => [r.commitSha, r])))
			.catch((_e) => {
				return {};
			}) as Promise<Record<string, StoryAnchorCommitStatus>>,
		loadSessionExcerpts(root, repoId, 1).catch((_e) => {
			return [];
		}),
		loadTraceConfig(root),
		getDirtyFiles(root).catch((_e) => {
			return [];
		}),
		getWorkingTreeChurn(root).catch((_e) => {
			return 0;
		}),
		listSnapshots(root).catch(() => []),
		getLatestTestRunSummaryByCommit(
			repoId,
			commits.map((c) => c.sha),
		).catch((_e) => {
			return {};
		}),
	] as const);

	const hasAnchorStatus = Object.keys(anchorStatusBySha).length > 0;

	// Trace ingestion is best-effort; don't fail repo loading if it errors.
	// OTel ingest must complete before scan (scan reads what ingest wrote).
	reportProgress("trace", "Scanning trace data…");
	let otelIngest: Awaited<ReturnType<typeof ingestCodexOtelLogFile>> = {
		status: { state: "inactive", message: "Not configured" },
		recordsWritten: 0,
	};
	let trace: Awaited<ReturnType<typeof scanAgentTraceRecords>> = {
		byCommit: {},
		byFileByCommit: {},
		totals: { conversations: 0, ranges: 0 },
	};
	try {
		otelIngest = await ingestCodexOtelLogFile({
			repoRoot: root,
			repoId,
			logPath: traceConfig.codexOtelLogPath,
		});
		trace = await scanAgentTraceRecords(
			root,
			repoId,
			commits.map((c) => c.sha),
		);
	} catch (_e) {
		/* best-effort — non-fatal */
	}

	const timeline: TimelineNode[] = commits
		.slice()
		.reverse()
		.map((c) => {
			const traceSummary = trace.byCommit[c.sha];
			const traceBadge = traceSummary
				? { type: "trace" as const, label: getTraceBadgeLabel(traceSummary) }
				: null;
			const testSummary = testSummaries[c.sha];
			const testBadge = testSummary
				? {
						type: "test" as const,
						label:
							testSummary.failed > 0
								? `${testSummary.failed} failed`
								: `${testSummary.passed} passed`,
						status: testSummary.failed > 0 ? "failed" : "passed",
					}
				: null;

			const anchorBadge = hasAnchorStatus
				? (() => {
						const anchor = anchorStatusBySha[c.sha];
						const anchorPresentCount =
							Number(anchor?.hasAttributionNote ?? 0) +
							Number(anchor?.hasSessionsNote ?? 0) +
							Number(anchor?.hasLineageNote ?? 0);
						const anchorStatus: "passed" | "failed" | "mixed" =
							anchorPresentCount === 3
								? "passed"
								: anchorPresentCount === 0
									? "failed"
									: "mixed";
						return {
							type: "anchor" as const,
							label: "Anchors",
							status: anchorStatus,
							anchor: {
								hasAttributionNote: anchor?.hasAttributionNote ?? false,
								hasSessionsNote: anchor?.hasSessionsNote ?? false,
								hasLineageNote: anchor?.hasLineageNote ?? false,
							},
						};
					})()
				: null;

			const badges = [anchorBadge, testBadge, traceBadge].filter(
				Boolean,
			) as NonNullable<TimelineNode["badges"]>;

			return {
				id: c.sha,
				type: "commit",
				label: c.subject,
				atISO: c.authoredAtISO,
				status: "ok",
				testRunId: testSummary?.runId,
				badges: badges.length ? badges : undefined,
			};
		});

	const stats = {
		added: agg.added,
		removed: agg.removed,
		files: agg.uniqueFiles,
		commits: commits.length,
		prompts: trace.totals.conversations,
		responses: trace.totals.ranges,
	};

	reportProgress("meta", "Writing metadata snapshots…", 0, commits.length);
	// Best-effort: write shareable meta snapshots into `.narrative/meta/**`
	try {
		await ensureRepoNarrativeLayout(root);

		await writeRepoMeta(root, {
			repoRoot: root,
			indexedAtISO: new Date().toISOString(),
			commitLimit: limit,
		});

		await writeBranchMeta(
			root,
			branch,
			branchStatsPayload({
				repoRoot: root,
				branch,
				headSha,
				stats,
				commitShas: commits.map((c) => c.sha),
				narrative: {
					schemaVersion: BRANCH_NARRATIVE_SCHEMA_VERSION,
					phase: 1,
				},
			}),
		);

		for (let index = 0; index < commits.length; index += 1) {
			const c = commits[index];
			await writeCommitSummaryMeta(root, c);
			const current = index + 1;
			if (current % 20 === 0 || current === commits.length) {
				reportProgress(
					"meta",
					"Writing metadata snapshots…",
					current,
					commits.length,
				);
			}
			if (current % 50 === 0) {
				await yieldToMain();
			}
		}
	} catch (e) {
		const _msg = String(e);
		console.warn(
			"[Indexer] Metadata write failed (repo may be read-only):",
			_msg,
		);
	}

	const modelBase: BranchViewModel = {
		source: "git",
		title: branch,
		status: "open",
		description: root,
		stats,
		intent,
		timeline,
		sessionExcerpts,
		dirtyFiles,
		dirtyChurnLines,
		traceSummaries: {
			byCommit: trace.byCommit,
			byFileByCommit: trace.byFileByCommit,
		},
		traceStatus: otelIngest.status,
		traceConfig,
		snapshots,
		meta: { repoPath: root, branchName: branch, headSha, repoId },
	};
	const model: BranchViewModel = {
		...modelBase,
		narrative: composeBranchNarrative(modelBase),
	};

	reportProgress("done", "Index complete", commits.length, commits.length);
	return { model, repo: { repoId, root, branch, headSha } };
}

export async function getOrLoadCommitFiles(repo: RepoIndex, sha: string) {
	const cached = await getCachedFileChanges(repo.repoId, sha);
	if (cached) return cached;

	const details = await getCommitDetails(repo.root, sha);
	await cacheFileChanges(repo.repoId, details);

	// Best-effort: write committable metadata for this commit's file list.
	try {
		await writeCommitFilesMeta(repo.root, sha, details.fileChanges);
	} catch (e) {
		const _msg = String(e);
		console.warn("[Indexer] Commit files metadata write failed:", _msg);
	}

	return details.fileChanges;
}

// Helper function to determine trace badge label
function getTraceBadgeLabel(summary: {
	aiLines: number;
	humanLines: number;
	mixedLines: number;
	unknownLines: number;
	aiPercent: number;
}): string {
	const isUnknownOnly =
		summary.unknownLines > 0 &&
		summary.aiLines === 0 &&
		summary.humanLines === 0 &&
		summary.mixedLines === 0;

	return isUnknownOnly ? "Unknown" : `AI ${summary.aiPercent}%`;
}
