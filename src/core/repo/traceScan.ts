import { listNarrativeFiles, readNarrativeFile } from "../tauri/narrativeFs";
import type { TraceCommitSummary, TraceFileSummary } from "../types";
import { ingestTraceRecord } from "./traceIngest";
import { parseTraceRecord } from "./traceParser";
import type { TraceScanResult } from "./traceTypes";

const TRACE_EXTENSION = ".agent-trace.json";
const TRACE_DIR = "trace";

function normalizeCommitSummary(
	raw: Record<string, unknown>,
): TraceCommitSummary {
	const commitSha = (raw.commitSha ?? raw.commit_sha ?? "") as string;
	const aiLines = ((raw.aiLines ?? raw.ai_lines) as number) || 0;
	const humanLines = ((raw.humanLines ?? raw.human_lines) as number) || 0;
	const mixedLines = ((raw.mixedLines ?? raw.mixed_lines) as number) || 0;
	const unknownLines = ((raw.unknownLines ?? raw.unknown_lines) as number) || 0;
	const aiPercent = ((raw.aiPercent ?? raw.ai_percent) as number) || 0;
	const modelIds = ((raw.modelIds ?? raw.model_ids) as string[]) || [];
	const toolNames = ((raw.toolNames ?? raw.tool_names) as string[]) || [];

	return {
		commitSha,
		aiLines,
		humanLines,
		mixedLines,
		unknownLines,
		aiPercent,
		modelIds,
		toolNames,
	};
}

function normalizeFileSummary(raw: Record<string, unknown>): TraceFileSummary {
	return {
		path: (raw.path as string) || "",
		aiLines: ((raw.aiLines ?? raw.ai_lines) as number) || 0,
		humanLines: ((raw.humanLines ?? raw.human_lines) as number) || 0,
		mixedLines: ((raw.mixedLines ?? raw.mixed_lines) as number) || 0,
		unknownLines: ((raw.unknownLines ?? raw.unknown_lines) as number) || 0,
		aiPercent: ((raw.aiPercent ?? raw.ai_percent) as number) || 0,
	};
}

export async function scanAgentTraceRecords(
	repoRoot: string,
	repoId: number,
	commitShas: string[],
): Promise<TraceScanResult> {
	const { invoke } = await import("@tauri-apps/api/core");
	const files = await listNarrativeFiles(repoRoot, TRACE_DIR);
	const traceFiles = files.filter((p) => p.endsWith(TRACE_EXTENSION));

	for (const rel of traceFiles) {
		try {
			const raw = await readNarrativeFile(repoRoot, rel);
			const parsed = parseTraceRecord(raw);
			if (!parsed) continue;
			if (parsed.vcs.type !== "git") continue;

			await ingestTraceRecord(repoId, parsed);
		} catch {
			// Skip files that fail to import (partial failure is OK)
		}
	}

	// Use the Rust command to get trace summaries
	const summariesResultRaw = (await invoke("get_trace_summaries_for_commits", {
		repoId,
		commitShas,
	})) as Record<
		string,
		{
			commit?: Record<string, unknown>;
			files?: Record<string, Record<string, unknown>>;
		}
	>;

	const byCommit: Record<string, TraceCommitSummary> = {};
	const byFileByCommit: Record<string, Record<string, TraceFileSummary>> = {};

	let totalConversations = 0;
	let totalRanges = 0;

	for (const [commitSha, summary] of Object.entries(summariesResultRaw)) {
		if (summary.commit) {
			byCommit[commitSha] = normalizeCommitSummary(summary.commit);
		}

		if (summary.files) {
			byFileByCommit[commitSha] = {};
			for (const [filePath, fileData] of Object.entries(summary.files)) {
				byFileByCommit[commitSha][filePath] = normalizeFileSummary(fileData);
				if (fileData.conversation_count) {
					totalConversations += (fileData.conversation_count as number) || 0;
				}
				if (fileData.range_count) {
					totalRanges += (fileData.range_count as number) || 0;
				}
			}
		}
	}

	return {
		byCommit,
		byFileByCommit,
		totals: {
			conversations: totalConversations,
			ranges: totalRanges,
		},
	};
}
