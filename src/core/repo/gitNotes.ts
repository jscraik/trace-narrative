import type { TraceCommitSummary } from "../types";
import { git } from "./git";

export type GitAgentNote = {
	sessionId?: string;
	traceId?: string;
	model?: string;
	tool?: string;
	confidence?: number;
	aiPercentage?: number;
	timestamp: string;
};

const NAMESPACE = "agent";

export async function readAgentNote(
	repoRoot: string,
	commitSha: string,
): Promise<GitAgentNote | null> {
	try {
		const stdout = await git(repoRoot, [
			"notes",
			`--namespace=${NAMESPACE}`,
			"show",
			commitSha,
		]);
		if (!stdout.trim()) return null;
		return JSON.parse(stdout) as GitAgentNote;
	} catch {
		return null;
	}
}

export async function writeAgentNote(
	repoRoot: string,
	commitSha: string,
	note: GitAgentNote,
): Promise<void> {
	const noteJson = JSON.stringify(note, null, 2);
	await git(repoRoot, [
		"notes",
		`--namespace=${NAMESPACE}`,
		"add",
		"-f",
		"-m",
		noteJson,
		commitSha,
	]);
}

export async function removeAgentNote(
	repoRoot: string,
	commitSha: string,
): Promise<void> {
	try {
		await git(repoRoot, [
			"notes",
			`--namespace=${NAMESPACE}`,
			"remove",
			commitSha,
		]);
	} catch {
		// Note might not exist
	}
}

export async function listAgentNotes(
	repoRoot: string,
): Promise<Array<{ sha: string; note: GitAgentNote }>> {
	try {
		const stdout = await git(repoRoot, [
			"notes",
			`--namespace=${NAMESPACE}`,
			"list",
		]);
		const notes: Array<{ sha: string; note: GitAgentNote }> = [];

		for (const line of stdout.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			// Format: <object-sha> <commit-sha>
			const parts = trimmed.split(/\s+/);
			if (parts.length >= 2) {
				const commitSha = parts[1];
				const note = await readAgentNote(repoRoot, commitSha);
				if (note) {
					notes.push({ sha: commitSha, note });
				}
			}
		}

		return notes;
	} catch {
		return [];
	}
}

export function buildAgentNote(
	traceSummary: TraceCommitSummary,
	sessionId?: string,
): GitAgentNote {
	return {
		sessionId,
		traceId: undefined, // Could add trace record ID
		model: traceSummary.modelIds[0],
		tool: traceSummary.toolNames[0],
		aiPercentage: traceSummary.aiPercent,
		timestamp: new Date().toISOString(),
	};
}

export async function syncTraceToGitNotes(
	repoRoot: string,
	commitSha: string,
	traceSummary: TraceCommitSummary,
	sessionId?: string,
): Promise<void> {
	const note = buildAgentNote(traceSummary, sessionId);
	await writeAgentNote(repoRoot, commitSha, note);
}
