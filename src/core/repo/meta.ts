import { ensureNarrativeDirs, writeNarrativeFile } from "../tauri/narrativeFs";
import type { CommitSummary, FileChange, Stats } from "../types";

function safeName(name: string) {
	// Keep branch refs filename-safe across platforms.
	// Git refs can contain characters that are illegal on Windows filesystems.
	return name
		.replace(/\.\./g, "__")
		.replace(/\//g, "__")
		.replace(/\\/g, "__")
		.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function ensureRepoNarrativeLayout(repoRoot: string) {
	await ensureNarrativeDirs(repoRoot);
}

export async function writeRepoMeta(repoRoot: string, payload: unknown) {
	await writeNarrativeFile(
		repoRoot,
		"meta/repo.json",
		JSON.stringify(payload, null, 2),
	);
}

export async function writeBranchMeta(
	repoRoot: string,
	branch: string,
	payload: unknown,
) {
	const file = `meta/branches/${safeName(branch)}.json`;
	await writeNarrativeFile(repoRoot, file, JSON.stringify(payload, null, 2));
}

export async function writeCommitSummaryMeta(
	repoRoot: string,
	commit: CommitSummary,
) {
	const file = `meta/commits/${commit.sha}.json`;
	await writeNarrativeFile(
		repoRoot,
		file,
		JSON.stringify(
			{
				sha: commit.sha,
				subject: commit.subject,
				author: commit.author,
				authoredAtISO: commit.authoredAtISO,
				source: "git",
			},
			null,
			2,
		),
	);
}

export async function writeCommitFilesMeta(
	repoRoot: string,
	sha: string,
	fileChanges: FileChange[],
) {
	const totalAdded = fileChanges.reduce((a, f) => a + f.additions, 0);
	const totalRemoved = fileChanges.reduce((a, f) => a + f.deletions, 0);

	const file = `meta/commits/${sha}.files.json`;
	await writeNarrativeFile(
		repoRoot,
		file,
		JSON.stringify(
			{
				sha,
				totals: {
					added: totalAdded,
					removed: totalRemoved,
					files: fileChanges.length,
				},
				files: fileChanges,
			},
			null,
			2,
		),
	);
}

export function branchStatsPayload(params: {
	repoRoot: string;
	branch: string;
	headSha: string;
	stats: Stats;
	commitShas: string[];
	narrative?: {
		schemaVersion: number;
		phase: number;
	};
}) {
	return {
		repoRoot: params.repoRoot,
		branch: params.branch,
		headSha: params.headSha,
		indexedAtISO: new Date().toISOString(),
		stats: params.stats,
		commits: params.commitShas,
		...(params.narrative ? { narrative: params.narrative } : {}),
	};
}
