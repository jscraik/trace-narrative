import type { TestCase, TestRun } from "../types";
import { getDb } from "./db";

function newId(): string {
	const c = globalThis.crypto as Crypto | undefined;
	if (c?.randomUUID) return c.randomUUID();
	// Fallback (not a real UUID, but stable enough for local IDs)
	return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export type SaveTestRunInput = {
	repoId: number;
	commitSha: string;
	format: "junit";
	importedAtISO: string;
	sourceBasename: string;
	rawRelPath: string;
	durationSec: number;
	passed: number;
	failed: number;
	skipped: number;
	cases: Omit<TestCase, "id">[];
};

export async function saveTestRun(input: SaveTestRunInput): Promise<TestRun> {
	const db = await getDb();
	const runId = newId();

	await db.execute(
		`INSERT INTO test_runs (
      id, repo_id, commit_sha, format, imported_at, source_basename, raw_rel_path,
      duration_sec, passed, failed, skipped
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		[
			runId,
			input.repoId,
			input.commitSha,
			input.format,
			input.importedAtISO,
			input.sourceBasename,
			input.rawRelPath,
			input.durationSec,
			input.passed,
			input.failed,
			input.skipped,
		],
	);

	const tests: TestCase[] = [];
	for (const tc of input.cases) {
		const caseId = newId();
		await db.execute(
			`INSERT INTO test_cases (
        id, run_id, name, status, duration_ms, error_message, file_path
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			[
				caseId,
				runId,
				tc.name,
				tc.status,
				tc.durationMs ?? 0,
				tc.errorMessage ?? null,
				tc.filePath ?? null,
			],
		);

		tests.push({
			id: caseId,
			name: tc.name,
			status: tc.status,
			durationMs: tc.durationMs ?? 0,
			errorMessage: tc.errorMessage,
			filePath: tc.filePath,
		});
	}

	return {
		id: runId,
		importedAtISO: input.importedAtISO,
		sourceBasename: input.sourceBasename,
		rawRelPath: input.rawRelPath,
		commitSha: input.commitSha,
		atISO: input.importedAtISO,
		durationSec: input.durationSec,
		passed: input.passed,
		failed: input.failed,
		skipped: input.skipped,
		tests,
	};
}

type TestRunRow = {
	id: string;
	commit_sha: string;
	imported_at: string;
	source_basename: string;
	raw_rel_path: string;
	duration_sec: number | null;
	passed: number;
	failed: number;
	skipped: number;
};

type TestCaseRow = {
	id: string;
	name: string;
	status: "passed" | "failed" | "skipped";
	duration_ms: number;
	error_message: string | null;
	file_path: string | null;
};

export async function getLatestTestRunForCommit(
	repoId: number,
	commitSha: string,
): Promise<TestRun | null> {
	const db = await getDb();
	const rows = await db.select<TestRunRow[]>(
		`SELECT id, commit_sha, imported_at, source_basename, raw_rel_path, duration_sec, passed, failed, skipped
     FROM test_runs
     WHERE repo_id = $1 AND commit_sha = $2
     ORDER BY imported_at DESC
     LIMIT 1`,
		[repoId, commitSha],
	);
	const run = rows?.[0];
	if (!run) return null;

	const cases = await db.select<TestCaseRow[]>(
		`SELECT id, name, status, duration_ms, error_message, file_path
     FROM test_cases
     WHERE run_id = $1
     ORDER BY status = 'failed' DESC, duration_ms DESC`,
		[run.id],
	);

	const tests: TestCase[] = (cases ?? []).map((c) => ({
		id: c.id,
		name: c.name,
		status: c.status,
		durationMs: c.duration_ms ?? 0,
		errorMessage: c.error_message ?? undefined,
		filePath: c.file_path ?? undefined,
	}));

	return {
		id: run.id,
		importedAtISO: run.imported_at,
		sourceBasename: run.source_basename,
		rawRelPath: run.raw_rel_path,
		commitSha: run.commit_sha,
		atISO: run.imported_at,
		durationSec: run.duration_sec ?? 0,
		passed: run.passed,
		failed: run.failed,
		skipped: run.skipped,
		tests,
	};
}

export type TestRunSummary = {
	runId: string;
	passed: number;
	failed: number;
	skipped: number;
	durationSec: number;
};

/**
 * Get latest (by imported_at) summary for each commit SHA.
 * Used to hydrate timeline badges during indexing.
 */
export async function getLatestTestRunSummaryByCommit(
	repoId: number,
	commitShas: string[],
): Promise<Record<string, TestRunSummary>> {
	if (commitShas.length === 0) return {};
	const db = await getDb();

	// Build `IN ($2,$3,...)` placeholders.
	const placeholders = commitShas.map((_, i) => `$${i + 2}`).join(", ");
	const rows = await db.select<
		Array<{
			id: string;
			commit_sha: string;
			duration_sec: number | null;
			passed: number;
			failed: number;
			skipped: number;
			imported_at: string;
		}>
	>(
		`SELECT tr.id, tr.commit_sha, tr.duration_sec, tr.passed, tr.failed, tr.skipped, tr.imported_at
     FROM test_runs tr
     INNER JOIN (
       SELECT commit_sha, MAX(imported_at) AS imported_at
       FROM test_runs
       WHERE repo_id = $1 AND commit_sha IN (${placeholders})
       GROUP BY commit_sha
     ) latest
     ON latest.commit_sha = tr.commit_sha AND latest.imported_at = tr.imported_at
     WHERE tr.repo_id = $1`,
		[repoId, ...commitShas],
	);

	const out: Record<string, TestRunSummary> = {};
	for (const r of rows ?? []) {
		out[r.commit_sha] = {
			runId: r.id,
			passed: r.passed,
			failed: r.failed,
			skipped: r.skipped,
			durationSec: r.duration_sec ?? 0,
		};
	}
	return out;
}
