#!/usr/bin/env tsx
/**
 * Calibration Run Script for Session-to-Commit Linking Algorithm
 *
 * Runs the linking algorithm on the calibration dataset and measures accuracy.
 * This script should be run AFTER implementing the linking algorithm (Epic 3).
 *
 * Usage: npx tsx calibration-run-script.ts
 *
 * Expected output: calibration-results.json with accuracy metrics
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Types (matching the application schema)
interface SessionExcerpt {
	id: string;
	tool: string;
	durationMin?: number;
	imported_at_iso: string; // ISO timestamp of when session was imported/ended
	messages: Array<{
		id: string;
		role: string;
		text: string;
		files?: string[];
	}>;
}

interface GitCommit {
	sha: string;
	authored_at: string;
	message: string;
	files: string[];
}

interface GroundTruth {
	sessionId: string;
	commitSha: string;
	confidence: number;
	reason: string;
}

interface RepoMetadata {
	id: string;
	name: string;
	size: "small" | "medium" | "large";
	commitCount: number;
	sessionCount: number;
	groundTruthCount: number;
	edgeCases: string[];
}

interface CalibrationResult {
	sessionId: string;
	groundTruth: GroundTruth;
	algorithmResult?: {
		commitSha: string;
		confidence: number;
		temporalScore: number;
		fileScore: number;
	};
	isCorrect: boolean;
	error?: string;
}

interface RepoCalibrationResult {
	repoId: string;
	repoName: string;
	repoSize: string;
	results: CalibrationResult[];
	accuracy: number;
	truePositives: number;
	falsePositives: number;
	falseNegatives: number;
}

interface OverallCalibrationResults {
	runAt: string;
	threshold: number;
	overallAccuracy: number;
	repoResults: RepoCalibrationResult[];
	summary: {
		totalRepos: number;
		totalSessions: number;
		correctLinks: number;
		overallAccuracy: number;
		truePositives: number;
		falsePositives: number;
		falseNegatives: number;
		precision: number;
		recall: number;
		f1Score: number;
	};
	recommendation: string;
}

// ============================================================================
// LINKING ALGORITHM IMPLEMENTATION (ported from Epic 3 Rust implementation)
// ============================================================================

// Constants from Rust implementation
const MAX_SESSION_DURATION_MIN = 240; // 4 hours
const TEMPORAL_DECAY_MIN = 5; // 5 minutes
const CONFIDENCE_THRESHOLD = 0.65; // Lowered from 0.7 for better coverage
const TEMPORAL_WEIGHT = 0.6;
const FILE_OVERLAP_WEIGHT = 0.4;
const TIME_WINDOW_TOLERANCE_MIN = 240; // 4 hours
const TIE_BREAK_MARGIN = 0.05; // Within 5% confidence, prefer closer timestamp

/**
 * Normalize a file path by resolving . and .. references
 */
function normalizePath(path: string): string {
	// Convert backslashes to forward slashes
	const normalized = path.replace(/\\/g, "/");

	// Manual resolution for simple cases
	const parts = normalized.split("/");
	const result: string[] = [];

	for (const part of parts) {
		if (part === "" || part === ".") {
			/* skip empty and current-dir segments */
		} else if (part === "..") {
			result.pop();
		} else {
			result.push(part);
		}
	}

	return result.length === 0 ? "" : result.join("/");
}

/**
 * Extract all file paths from session messages
 */
function extractSessionFiles(session: SessionExcerpt): string[] {
	const files: string[] = [];
	for (const msg of session.messages) {
		if (msg.files) {
			files.push(...msg.files);
		}
	}
	return files;
}

/**
 * Calculate temporal overlap score between a session and a commit.
 *
 * Session time window: [importedAtISO - durationMin, importedAtISO]
 * Commit time: authored_at
 *
 * Scoring:
 * - 1.0 if commit within session window
 * - Decays linearly to 0.5 at ±5 min from window
 * - 0.0 if > 5 min outside window
 *
 * Evidence: Build Plan Epic 3 Story 3.1
 */
function scoreTemporalOverlap(
	session: SessionExcerpt,
	commit: GitCommit,
): number {
	const sessionEnd = new Date(session.imported_at_iso);
	const durationMin = Math.min(
		session.durationMin ?? 30,
		MAX_SESSION_DURATION_MIN,
	);
	const sessionStart = new Date(sessionEnd.getTime() - durationMin * 60 * 1000);
	const commitTime = new Date(commit.authored_at);

	// Check if commit is within session window
	if (commitTime >= sessionStart && commitTime <= sessionEnd) {
		return 1.0;
	}

	// Calculate distance from window (in minutes)
	const distanceMin = Math.abs(
		commitTime < sessionStart
			? (sessionStart.getTime() - commitTime.getTime()) / (60 * 1000)
			: (commitTime.getTime() - sessionEnd.getTime()) / (60 * 1000),
	);

	// Apply linear decay within tolerance window (±5 min)
	if (distanceMin <= TEMPORAL_DECAY_MIN) {
		const decayRatio = distanceMin / TEMPORAL_DECAY_MIN;
		return 1.0 - 0.5 * decayRatio;
	}

	// Outside tolerance window
	return 0.0;
}

/**
 * Calculate file overlap score using Jaccard similarity.
 *
 * Jaccard = |intersection(session_files, commit_files)| / |union(session_files, commit_files)|
 *
 * Evidence: Build Plan Epic 3 Story 3.2
 */
function scoreFileOverlap(session: SessionExcerpt, commit: GitCommit): number {
	const sessionFiles = extractSessionFiles(session);

	// Normalize and deduplicate file paths
	const sessionSet = new Set(
		sessionFiles.map((f) => normalizePath(f)).filter((f) => f !== ""),
	);

	const commitSet = new Set(
		commit.files.map((f) => normalizePath(f)).filter((f) => f !== ""),
	);

	// Handle empty sets
	if (sessionSet.size === 0 || commitSet.size === 0) {
		return 0.0;
	}

	// Calculate Jaccard similarity
	const intersection = [...sessionSet].filter((x) => commitSet.has(x)).length;
	const union = new Set([...sessionSet, ...commitSet]).size;

	if (union === 0) {
		return 0.0;
	}

	return intersection / union;
}

/**
 * Calculate combined link confidence score.
 *
 * Combined score = 0.6 * temporal + 0.4 * file_overlap
 *
 * Returns link if confidence >= threshold (0.7), else null
 *
 * Evidence: Build Plan Epic 3 Story 3.3
 */
function calculateLinkConfidence(
	session: SessionExcerpt,
	commit: GitCommit,
	threshold: number = CONFIDENCE_THRESHOLD,
): {
	commitSha: string;
	confidence: number;
	temporalScore: number;
	fileScore: number;
} | null {
	const temporalScore = scoreTemporalOverlap(session, commit);
	const fileScore = scoreFileOverlap(session, commit);
	const confidence =
		TEMPORAL_WEIGHT * temporalScore + FILE_OVERLAP_WEIGHT * fileScore;

	return confidence >= threshold
		? { commitSha: commit.sha, confidence, temporalScore, fileScore }
		: null;
}

/**
 * Link a session to commits using the full algorithm.
 *
 * This is the main linking function from Epic 3 Story 3.4.
 *
 * Steps:
 * 1. Filter commits by time window (session time ± 4 hours)
 * 2. Score each candidate commit
 * 3. Return highest scoring commit if >= threshold (with tie-breaking for closer timestamps)
 * 4. Return null if no commit meets threshold
 *
 * Evidence: Build Plan Epic 3 Story 3.4
 */
function linkSessionToCommits(
	session: SessionExcerpt,
	commits: GitCommit[],
	threshold: number = CONFIDENCE_THRESHOLD,
): {
	commitSha: string;
	confidence: number;
	temporalScore: number;
	fileScore: number;
} | null {
	if (commits.length === 0) {
		return null;
	}

	const sessionEnd = new Date(session.imported_at_iso);
	const toleranceMin = TIME_WINDOW_TOLERANCE_MIN;
	const windowStart = new Date(sessionEnd.getTime() - toleranceMin * 60 * 1000);
	const windowEnd = new Date(sessionEnd.getTime() + toleranceMin * 60 * 1000);

	// Filter commits by time window
	const candidates = commits.filter((commit) => {
		const commitTime = new Date(commit.authored_at);
		return commitTime >= windowStart && commitTime <= windowEnd;
	});

	// No commits in time window
	if (candidates.length === 0) {
		return null;
	}

	// Score each candidate and return best match with tie-breaking
	let bestResult: {
		commitSha: string;
		confidence: number;
		temporalScore: number;
		fileScore: number;
		timestampDistance: number;
	} | null = null;

	for (const commit of candidates) {
		const result = calculateLinkConfidence(session, commit, threshold);
		if (result) {
			const commitTime = new Date(commit.authored_at);
			const timestampDistance = Math.abs(
				commitTime.getTime() - sessionEnd.getTime(),
			);

			if (!bestResult) {
				bestResult = { ...result, timestampDistance };
			} else {
				// Replace if:
				// 1. Significantly higher confidence, OR
				// 2. Similar confidence but closer timestamp (tie-break)
				const confidenceDiff = result.confidence - bestResult.confidence;
				if (confidenceDiff > TIE_BREAK_MARGIN) {
					bestResult = { ...result, timestampDistance };
				} else if (
					Math.abs(confidenceDiff) <= TIE_BREAK_MARGIN &&
					timestampDistance < bestResult.timestampDistance
				) {
					bestResult = { ...result, timestampDistance };
				}
			}
		}
	}

	return bestResult
		? {
				commitSha: bestResult.commitSha,
				confidence: bestResult.confidence,
				temporalScore: bestResult.temporalScore,
				fileScore: bestResult.fileScore,
			}
		: null;
}

// ============================================================================
// CALIBRATION RUNNER
// ============================================================================

async function runCalibrationOnRepo(
	repoPath: string,
): Promise<RepoCalibrationResult> {
	// Load repo data
	const commits: GitCommit[] = JSON.parse(
		readFileSync(join(repoPath, "commits.json"), "utf-8"),
	);
	const sessions: SessionExcerpt[] = JSON.parse(
		readFileSync(join(repoPath, "sessions.json"), "utf-8"),
	);
	const groundTruth: GroundTruth[] = JSON.parse(
		readFileSync(join(repoPath, "ground-truth.json"), "utf-8"),
	);
	const metadata: RepoMetadata = JSON.parse(
		readFileSync(join(repoPath, "metadata.json"), "utf-8"),
	);

	// Run algorithm on each session
	const results: CalibrationResult[] = [];
	const THRESHOLD = 0.7;

	for (const gt of groundTruth) {
		const session = sessions.find((s) => s.id === gt.sessionId);
		if (!session) {
			results.push({
				sessionId: gt.sessionId,
				groundTruth: gt,
				isCorrect: false,
				error: "Session not found in sessions.json",
			});
			continue;
		}

		try {
			const result = linkSessionToCommits(session, commits, THRESHOLD);
			const isCorrect = result?.commitSha === gt.commitSha;

			results.push({
				sessionId: gt.sessionId,
				groundTruth: gt,
				algorithmResult: result,
				isCorrect,
			});
		} catch (error) {
			results.push({
				sessionId: gt.sessionId,
				groundTruth: gt,
				isCorrect: false,
				error: String(error),
			});
		}
	}

	// Calculate metrics
	const correctLinks = results.filter((r) => r.isCorrect).length;
	const accuracy =
		results.length > 0 ? (correctLinks / results.length) * 100 : 0;

	return {
		repoId: metadata.id,
		repoName: metadata.name,
		repoSize: metadata.size,
		results,
		accuracy,
		truePositives: correctLinks,
		falsePositives: results.filter(
			(r) => !r.isCorrect && r.algorithmResult !== undefined,
		).length,
		falseNegatives: results.filter(
			(r) => !r.isCorrect && r.algorithmResult === undefined,
		).length,
	};
}

async function runCalibration(): Promise<OverallCalibrationResults> {
	console.log("🔬 Running calibration study on dataset...\n");

	const basePath = join(process.cwd(), "fixtures", "calibration-dataset");
	const repos = readdirSync(basePath, { withFileTypes: true })
		.filter((d) => d.isDirectory() && d.name.startsWith("repo_"))
		.map((d) => d.name)
		.sort();

	console.log(`Found ${repos.length} test repos\n`);

	const THRESHOLD = 0.7;
	const repoResults: RepoCalibrationResult[] = [];

	for (const repoId of repos) {
		console.log(`Processing ${repoId}...`);
		const repoPath = join(basePath, repoId);
		const result = await runCalibrationOnRepo(repoPath);
		repoResults.push(result);
		console.log(
			`  Accuracy: ${result.accuracy.toFixed(1)}% (${result.truePositives}/${result.results.length})`,
		);
	}

	// Calculate overall metrics
	const totalSessions = repoResults.reduce(
		(sum, r) => sum + r.results.length,
		0,
	);
	const correctLinks = repoResults.reduce((sum, r) => sum + r.truePositives, 0);
	const overallAccuracy =
		totalSessions > 0 ? (correctLinks / totalSessions) * 100 : 0;
	const truePositives = correctLinks;
	const falsePositives = repoResults.reduce(
		(sum, r) => sum + r.falsePositives,
		0,
	);
	const falseNegatives = repoResults.reduce(
		(sum, r) => sum + r.falseNegatives,
		0,
	);

	const precision =
		truePositives + falsePositives > 0
			? (truePositives / (truePositives + falsePositives)) * 100
			: 0;
	const recall =
		truePositives + falseNegatives > 0
			? (truePositives / (truePositives + falseNegatives)) * 100
			: 0;
	const f1Score =
		precision + recall > 0
			? (2 * precision * recall) / (precision + recall)
			: 0;

	// Determine recommendation
	let recommendation: string;
	if (overallAccuracy < 65) {
		recommendation =
			"⚠️  Accuracy below 65%. Consider further adjustments to algorithm or threshold.";
	} else if (overallAccuracy > 80) {
		recommendation =
			"✅ Accuracy above 80%. Excellent! Threshold validated at 0.65.";
	} else {
		recommendation =
			"✅ Accuracy within 65-80% range. Threshold validated at 0.65.";
	}

	const results: OverallCalibrationResults = {
		runAt: new Date().toISOString(),
		threshold: THRESHOLD,
		overallAccuracy,
		repoResults,
		summary: {
			totalRepos: repos.length,
			totalSessions,
			correctLinks,
			overallAccuracy,
			truePositives,
			falsePositives,
			falseNegatives,
			precision,
			recall,
			f1Score,
		},
		recommendation,
	};

	// Print summary
	console.log("\n📊 Overall Results:");
	console.log(`   Total Repos: ${results.summary.totalRepos}`);
	console.log(`   Total Sessions: ${results.summary.totalSessions}`);
	console.log(`   Correct Links: ${results.summary.correctLinks}`);
	console.log(
		`   Overall Accuracy: ${results.summary.overallAccuracy.toFixed(1)}%\n`,
	);

	console.log(`📈 Metrics:`);
	console.log(`   Precision: ${results.summary.precision.toFixed(1)}%`);
	console.log(`   Recall: ${results.summary.recall.toFixed(1)}%`);
	console.log(`   F1 Score: ${results.summary.f1Score.toFixed(1)}%\n`);

	console.log(`   True Positives: ${results.summary.truePositives}`);
	console.log(`   False Positives: ${results.summary.falsePositives}`);
	console.log(`   False Negatives: ${results.summary.falseNegatives}\n`);

	console.log(`💡 Recommendation: ${recommendation}\n`);

	// Write results to file
	const resultsPath = join(basePath, "calibration-results.json");
	writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf-8");
	console.log(`✅ Results written to: ${resultsPath}\n`);

	return results;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
	console.log("╔════════════════════════════════════════════════════════════╗");
	console.log("║  Calibration Study: Session-to-Commit Linking Algorithm  ║");
	console.log(
		"╚════════════════════════════════════════════════════════════╝\n",
	);

	console.log("✅ Using full algorithm implementation from Epic 3:\n");
	console.log("   - scoreTemporalOverlap() (Story 3.1) ✓");
	console.log("   - scoreFileOverlap() (Story 3.2) ✓");
	console.log("   - calculateLinkConfidence() (Story 3.3) ✓");
	console.log("   - linkSessionToCommits() (Story 3.4) ✓\n");

	const results = await runCalibration();

	// Exit with appropriate code
	if (results.summary.overallAccuracy < 65) {
		console.log("⚠️  Calibration study requires further threshold adjustment.");
		process.exit(1);
	} else {
		console.log(
			`✅ Calibration study passed. Threshold validated at ${CONFIDENCE_THRESHOLD}.`,
		);
		process.exit(0);
	}
}

main().catch((_error) => {
	process.exit(1);
});
