#!/usr/bin/env tsx
/**
 * Calibration Dataset Generator for Session-to-Commit Linking
 *
 * Generates 10 test repos with known correct session-to-commit mappings
 * for validating the linking algorithm before production deployment.
 *
 * Usage: npx tsx generate-dataset.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Types matching the application schema
type SessionTool = "claude-code" | "codex" | "unknown";

interface SessionMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	files?: string[];
}

interface SessionExcerpt {
	id: string;
	tool: SessionTool;
	durationMin?: number;
	imported_at_iso: string; // ISO timestamp of when session was imported/ended
	messages: SessionMessage[];
}

interface GitCommit {
	sha: string;
	authored_at: string; // ISO timestamp
	message: string;
	files: string[];
}

interface GroundTruth {
	sessionId: string;
	commitSha: string;
	confidence: number; // Expected confidence score (0-1)
	reason: string; // Why this link should be found
}

interface TestRepo {
	id: string;
	name: string;
	size: "small" | "medium" | "large";
	commits: GitCommit[];
	sessions: SessionExcerpt[];
	groundTruth: GroundTruth[];
	edgeCases: string[];
}

// Utility functions
function generateId(prefix: string): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60000);
}

function formatISO(date: Date): string {
	return date.toISOString();
}

function generateShortSha(): string {
	return Math.random().toString(16).substr(2, 8);
}

// Generate realistic file paths
const COMMON_FILE_PATTERNS = [
	"src/components/{Component}.tsx",
	"src/utils/{util}.ts",
	"src/hooks/{hook}.ts",
	"src/services/{service}.ts",
	"src/types/{type}.ts",
	"tests/{test}.test.ts",
	"README.md",
	"package.json",
	"vite.config.ts",
];

function generateFilePaths(count: number): string[] {
	const seen = new Set<string>();
	const files: string[] = [];

	while (files.length < count && seen.size < COMMON_FILE_PATTERNS.length * 3) {
		const template =
			COMMON_FILE_PATTERNS[
				Math.floor(Math.random() * COMMON_FILE_PATTERNS.length)
			];
		const file = template
			.replace(
				"{Component}",
				["Button", "Input", "Modal", "Dialog", "Badge"][
					Math.floor(Math.random() * 5)
				],
			)
			.replace(
				"{util}",
				["format", "parse", "validate", "transform", "compute"][
					Math.floor(Math.random() * 5)
				],
			)
			.replace(
				"{hook}",
				["useData", "useForm", "useAuth", "useModal", "useBadge"][
					Math.floor(Math.random() * 5)
				],
			)
			.replace(
				"{service}",
				["api", "database", "auth", "storage", "cache"][
					Math.floor(Math.random() * 5)
				],
			)
			.replace(
				"{type}",
				["User", "Session", "Commit", "Repo", "Link"][
					Math.floor(Math.random() * 5)
				],
			)
			.replace(
				"{test}",
				["utils", "components", "hooks", "services", "integration"][
					Math.floor(Math.random() * 5)
				],
			);

		if (!seen.has(file)) {
			seen.add(file);
			files.push(file);
		}
	}

	return files;
}

// Generate commit messages
const COMMIT_MESSAGE_TEMPLATES = [
	"Add {feature} component",
	"Fix {issue} in {module}",
	"Refactor {module} for clarity",
	"Update {module} to use new API",
	"Add tests for {module}",
	"Remove deprecated {feature}",
	"Improve performance of {module}",
	"Add type definitions for {module}",
];

function generateCommitMessage(): string {
	const template =
		COMMIT_MESSAGE_TEMPLATES[
			Math.floor(Math.random() * COMMIT_MESSAGE_TEMPLATES.length)
		];
	return template
		.replace(
			"{feature}",
			["Badge", "Dialog", "Modal", "Tooltip", "Panel"][
				Math.floor(Math.random() * 5)
			],
		)
		.replace(
			"{issue}",
			[
				"layout bug",
				"memory leak",
				"race condition",
				"type error",
				"accessibility issue",
			][Math.floor(Math.random() * 5)],
		)
		.replace(
			"{module}",
			["Button", "useData", "apiService", "SessionPanel", "Timeline"][
				Math.floor(Math.random() * 5)
			],
		);
}

// Test repo generators
function generateSmallRepo(repoId: string, index: number): TestRepo {
	const baseTime = new Date("2024-01-01T10:00:00Z");
	const commits: GitCommit[] = [];
	const sessions: SessionExcerpt[] = [];
	const groundTruth: GroundTruth[] = [];
	const edgeCases: string[] = [];

	// Generate 20-50 commits
	const commitCount = 20 + Math.floor(Math.random() * 30);

	for (let i = 0; i < commitCount; i++) {
		const commitTime = addMinutes(
			baseTime,
			i * 15 + Math.floor(Math.random() * 10),
		);
		const files = generateFilePaths(2 + Math.floor(Math.random() * 3));

		commits.push({
			sha: generateShortSha(),
			authored_at: formatISO(commitTime),
			message: generateCommitMessage(),
			files,
		});
	}

	// Generate 5-8 sessions with perfect overlaps
	const sessionCount = 5 + Math.floor(Math.random() * 4);
	for (let i = 0; i < sessionCount; i++) {
		const targetCommitIndex = 5 + i * 3;
		if (targetCommitIndex >= commits.length) break;

		const targetCommit = commits[targetCommitIndex];
		const sessionStart = addMinutes(
			new Date(targetCommit.authored_at),
			-10 - Math.floor(Math.random() * 5),
		);
		const sessionEnd = new Date(targetCommit.authored_at);
		const durationMin = Math.ceil(
			(sessionEnd.getTime() - sessionStart.getTime()) / 60000,
		);

		const sessionId = generateId("session");
		const sessionFiles = targetCommit.files.slice(
			0,
			2 + Math.floor(Math.random() * 2),
		);

		sessions.push({
			id: sessionId,
			tool: Math.random() > 0.3 ? "claude-code" : "codex",
			durationMin,
			imported_at_iso: formatISO(sessionEnd),
			messages: [
				{
					id: generateId("msg"),
					role: "user",
					text: `Update ${sessionFiles[0]} with new feature`,
					files: sessionFiles,
				},
				{
					id: generateId("msg"),
					role: "assistant",
					text: `I'll update ${sessionFiles.join(" and ")} with the requested changes.`,
					files: sessionFiles,
				},
			],
		});

		groundTruth.push({
			sessionId,
			commitSha: targetCommit.sha,
			confidence: 0.85 + Math.random() * 0.14, // 0.85-0.99
			reason: "Perfect temporal and file overlap",
		});
	}

	// Add one unlinked session (no matching commits)
	const unlinkedSessionEnd = addMinutes(baseTime, 1000); // Far outside commit time range
	sessions.push({
		id: generateId("session"),
		tool: "claude-code",
		durationMin: 5,
		imported_at_iso: formatISO(unlinkedSessionEnd),
		messages: [
			{
				id: generateId("msg"),
				role: "user",
				text: "Explore potential refactoring options",
				files: ["src/legacy/old-module.ts"],
			},
		],
	});
	edgeCases.push("Unlinked session: no matching commit time window");

	return {
		id: repoId,
		name: `small-repo-${index + 1}`,
		size: "small",
		commits,
		sessions,
		groundTruth,
		edgeCases,
	};
}

function generateMediumRepo(repoId: string, index: number): TestRepo {
	const baseTime = new Date("2024-02-01T10:00:00Z");
	const commits: GitCommit[] = [];
	const sessions: SessionExcerpt[] = [];
	const groundTruth: GroundTruth[] = [];
	const edgeCases: string[] = [];

	// Generate 100-1000 commits
	const commitCount = 100 + Math.floor(Math.random() * 900);

	for (let i = 0; i < commitCount; i++) {
		const commitTime = addMinutes(
			baseTime,
			i * 5 + Math.floor(Math.random() * 3),
		);
		const files = generateFilePaths(1 + Math.floor(Math.random() * 5));

		commits.push({
			sha: generateShortSha(),
			authored_at: formatISO(commitTime),
			message: generateCommitMessage(),
			files,
		});
	}

	// Generate 6-10 sessions with varying quality matches
	const sessionCount = 6 + Math.floor(Math.random() * 5);

	// High confidence session (perfect match)
	const highConfIndex = Math.floor(commitCount * 0.3);
	const highConfCommit = commits[highConfIndex];
	const highConfSessionEnd = new Date(highConfCommit.authored_at);
	const highConfSessionId = generateId("session");
	sessions.push({
		id: highConfSessionId,
		tool: "claude-code",
		durationMin: 15,
		imported_at_iso: formatISO(highConfSessionEnd),
		messages: [
			{
				id: generateId("msg"),
				role: "user",
				text: `Update ${highConfCommit.files[0]}`,
				files: highConfCommit.files.slice(0, 2),
			},
			{
				id: generateId("msg"),
				role: "assistant",
				text: "Done",
				files: highConfCommit.files.slice(0, 2),
			},
		],
	});
	groundTruth.push({
		sessionId: highConfSessionId,
		commitSha: highConfCommit.sha,
		confidence: 0.9,
		reason: "High confidence: perfect temporal and file overlap",
	});

	// Medium confidence session (partial file overlap)
	const medConfIndex = Math.floor(commitCount * 0.6);
	const medConfCommit = commits[medConfIndex];
	const medConfSessionEnd = new Date(medConfCommit.authored_at);
	const medConfSessionId = generateId("session");
	const sessionFiles = medConfCommit.files.slice(0, 1);
	sessions.push({
		id: medConfSessionId,
		tool: "codex",
		durationMin: 20,
		imported_at_iso: formatISO(medConfSessionEnd),
		messages: [
			{
				id: generateId("msg"),
				role: "user",
				text: `Update ${sessionFiles[0]}`,
				files: sessionFiles,
			},
		],
	});
	groundTruth.push({
		sessionId: medConfSessionId,
		commitSha: medConfCommit.sha,
		confidence: 0.75,
		reason: "Medium confidence: temporal match but partial file overlap",
	});

	// Low confidence session (near threshold)
	const lowConfIndex = Math.floor(commitCount * 0.8);
	const lowConfCommit = commits[lowConfIndex];
	const lowConfSessionEnd = new Date(lowConfCommit.authored_at);
	const lowConfSessionId = generateId("session");
	sessions.push({
		id: lowConfSessionId,
		tool: "claude-code",
		durationMin: 8,
		imported_at_iso: formatISO(lowConfSessionEnd),
		messages: [
			{
				id: generateId("msg"),
				role: "user",
				text: "Quick fix needed",
				files: generateFilePaths(1), // Different file
			},
		],
	});
	groundTruth.push({
		sessionId: lowConfSessionId,
		commitSha: lowConfCommit.sha,
		confidence: 0.72,
		reason: "Low confidence: temporal proximity but minimal file overlap",
	});

	// Add remaining sessions
	for (let i = 3; i < sessionCount; i++) {
		const targetCommitIndex =
			Math.floor((commitCount / sessionCount) * i) +
			Math.floor(Math.random() * 10);
		if (targetCommitIndex >= commits.length) break;

		const targetCommit = commits[targetCommitIndex];
		const sessionId = generateId("session");
		const overlap = Math.random();

		sessions.push({
			id: sessionId,
			tool: Math.random() > 0.5 ? "claude-code" : "codex",
			durationMin: 10 + Math.floor(Math.random() * 20),
			imported_at_iso: targetCommit.authored_at,
			messages: [
				{
					id: generateId("msg"),
					role: "user",
					text: `Work on ${targetCommit.files[0] || "codebase"}`,
					files:
						overlap > 0.5
							? targetCommit.files.slice(0, 2)
							: generateFilePaths(1),
				},
			],
		});

		groundTruth.push({
			sessionId,
			commitSha: targetCommit.sha,
			confidence: 0.65 + Math.random() * 0.3,
			reason:
				overlap > 0.5 ? "Good overlap" : "Weak match, may fall below threshold",
		});
	}

	// Edge case: Multi-session commit
	const multiSessionCommitIndex = Math.floor(commitCount * 0.4);
	const multiSessionCommit = commits[multiSessionCommitIndex];
	const multiSessionCommitTime = new Date(multiSessionCommit.authored_at);
	const sessionId1 = generateId("session");
	const sessionId2 = generateId("session");

	sessions.push({
		id: sessionId1,
		tool: "claude-code",
		durationMin: 10,
		imported_at_iso: formatISO(addMinutes(multiSessionCommitTime, -5)),
		messages: [
			{
				id: generateId("msg"),
				role: "user",
				text: `Start work on ${multiSessionCommit.files[0]}`,
				files: [multiSessionCommit.files[0]],
			},
		],
	});

	sessions.push({
		id: sessionId2,
		tool: "codex",
		durationMin: 15,
		imported_at_iso: formatISO(multiSessionCommitTime),
		messages: [
			{
				id: generateId("msg"),
				role: "user",
				text: `Continue work on ${multiSessionCommit.files[0] || "feature"}`,
				files: multiSessionCommit.files.slice(0, 2),
			},
		],
	});

	groundTruth.push({
		sessionId: sessionId1,
		commitSha: multiSessionCommit.sha,
		confidence: 0.78,
		reason: "Multi-session commit: session 1 of 2",
	});
	groundTruth.push({
		sessionId: sessionId2,
		commitSha: multiSessionCommit.sha,
		confidence: 0.82,
		reason: "Multi-session commit: session 2 of 2",
	});
	edgeCases.push("Multi-session commit: two sessions linked to same commit");

	return {
		id: repoId,
		name: `medium-repo-${index + 1}`,
		size: "medium",
		commits,
		sessions,
		groundTruth,
		edgeCases,
	};
}

function generateLargeRepo(repoId: string, index: number): TestRepo {
	const baseTime = new Date("2024-03-01T10:00:00Z");
	const commits: GitCommit[] = [];
	const sessions: SessionExcerpt[] = [];
	const groundTruth: GroundTruth[] = [];
	const edgeCases: string[] = [];

	// Generate 1000-10000 commits (use 2000 for practical file size)
	const commitCount = 2000;

	for (let i = 0; i < commitCount; i++) {
		const commitTime = addMinutes(
			baseTime,
			i * 2 + Math.floor(Math.random() * 2),
		);
		const files = generateFilePaths(1 + Math.floor(Math.random() * 4));

		commits.push({
			sha: generateShortSha(),
			authored_at: formatISO(commitTime),
			message: generateCommitMessage(),
			files,
		});
	}

	// Generate fewer sessions relative to commit count (8-12)
	const sessionCount = 8 + Math.floor(Math.random() * 5);

	// Sessions scattered throughout history
	for (let i = 0; i < sessionCount; i++) {
		const targetCommitIndex =
			Math.floor((commitCount / sessionCount) * i) +
			Math.floor(Math.random() * 50);
		const targetCommit = commits[targetCommitIndex];
		const sessionId = generateId("session");

		// Varying overlap scenarios
		const overlapType = Math.random();
		let sessionFiles: string[];
		let expectedConfidence: number;

		if (overlapType < 0.4) {
			// High overlap
			sessionFiles = targetCommit.files.slice(0, 3);
			expectedConfidence = 0.85 + Math.random() * 0.14;
		} else if (overlapType < 0.7) {
			// Medium overlap
			sessionFiles = [targetCommit.files[0]];
			expectedConfidence = 0.7 + Math.random() * 0.15;
		} else {
			// Low overlap
			sessionFiles = generateFilePaths(1);
			expectedConfidence = 0.65 + Math.random() * 0.1;
		}

		sessions.push({
			id: sessionId,
			tool: Math.random() > 0.3 ? "claude-code" : "codex",
			durationMin: 5 + Math.floor(Math.random() * 25),
			imported_at_iso: targetCommit.authored_at,
			messages: [
				{
					id: generateId("msg"),
					role: "user",
					text: `Update ${sessionFiles[0]}`,
					files: sessionFiles,
				},
				{
					id: generateId("msg"),
					role: "assistant",
					text: "I will implement that",
					files: sessionFiles,
				},
			],
		});

		groundTruth.push({
			sessionId,
			commitSha: targetCommit.sha,
			confidence: expectedConfidence,
			reason: `Large repo: ${expectedConfidence > 0.75 ? "high" : expectedConfidence > 0.7 ? "medium" : "low"} confidence match`,
		});
	}

	// Edge case: Session with very long duration (4 hours = max for linking)
	const longDurationSessionId = generateId("session");
	const longDurationCommitIndex = Math.floor(commitCount * 0.5);
	const longDurationCommit = commits[longDurationCommitIndex];
	const longDurationSessionEnd = new Date(longDurationCommit.authored_at);

	sessions.push({
		id: longDurationSessionId,
		tool: "claude-code",
		durationMin: 240, // 4 hours - max allowed
		imported_at_iso: formatISO(longDurationSessionEnd),
		messages: [
			{
				id: generateId("msg"),
				role: "user",
				text: "Major refactoring work",
				files: longDurationCommit.files.slice(0, 2),
			},
		],
	});
	groundTruth.push({
		sessionId: longDurationSessionId,
		commitSha: longDurationCommit.sha,
		confidence: 0.65,
		reason: "Long duration session (4h): may match multiple commits",
	});
	edgeCases.push(
		"Long duration session: 4 hour window may produce ambiguous matches",
	);

	// Edge case: Session with no duration (will be inferred)
	const noDurationSessionId = generateId("session");
	const noDurationCommitIndex = Math.floor(commitCount * 0.7);
	const noDurationCommit = commits[noDurationCommitIndex];

	sessions.push({
		id: noDurationSessionId,
		tool: "codex",
		// durationMin omitted - should be inferred
		imported_at_iso: noDurationCommit.authored_at,
		// durationMin omitted - should be inferred
		messages: [
			{
				id: generateId("msg"),
				role: "user",
				text: `Fix ${noDurationCommit.files[0]}`,
				files: [noDurationCommit.files[0]],
			},
		],
	});
	groundTruth.push({
		sessionId: noDurationSessionId,
		commitSha: noDurationCommit.sha,
		confidence: 0.8,
		reason: "No duration: should be inferred from message timestamps",
	});
	edgeCases.push(
		"Missing duration: should be inferred from message timestamps",
	);

	return {
		id: repoId,
		name: `large-repo-${index + 1}`,
		size: "large",
		commits,
		sessions,
		groundTruth,
		edgeCases,
	};
}

// Generate all repos
function generateCalibrationDataset(): TestRepo[] {
	const repos: TestRepo[] = [];

	// 3 small repos
	for (let i = 0; i < 3; i++) {
		repos.push(generateSmallRepo(`repo_small_${i}`, i));
	}

	// 5 medium repos
	for (let i = 0; i < 5; i++) {
		repos.push(generateMediumRepo(`repo_medium_${i}`, i));
	}

	// 2 large repos
	for (let i = 0; i < 2; i++) {
		repos.push(generateLargeRepo(`repo_large_${i}`, i));
	}

	return repos;
}

// Write dataset to disk
function writeDataset(repos: TestRepo[]): void {
	const basePath = join(process.cwd(), "fixtures", "calibration-dataset");

	repos.forEach((repo) => {
		const repoPath = join(basePath, repo.id);
		mkdirSync(repoPath, { recursive: true });

		// Write commits
		writeFileSync(
			join(repoPath, "commits.json"),
			JSON.stringify(repo.commits, null, 2),
			"utf-8",
		);

		// Write sessions
		writeFileSync(
			join(repoPath, "sessions.json"),
			JSON.stringify(repo.sessions, null, 2),
			"utf-8",
		);

		// Write ground truth
		writeFileSync(
			join(repoPath, "ground-truth.json"),
			JSON.stringify(repo.groundTruth, null, 2),
			"utf-8",
		);

		// Write metadata
		writeFileSync(
			join(repoPath, "metadata.json"),
			JSON.stringify(
				{
					id: repo.id,
					name: repo.name,
					size: repo.size,
					commitCount: repo.commits.length,
					sessionCount: repo.sessions.length,
					groundTruthCount: repo.groundTruth.length,
					edgeCases: repo.edgeCases,
				},
				null,
				2,
			),
			"utf-8",
		);
	});

	// Write dataset summary
	const summary = {
		generatedAt: new Date().toISOString(),
		totalRepos: repos.length,
		smallRepos: repos.filter((r) => r.size === "small").length,
		mediumRepos: repos.filter((r) => r.size === "medium").length,
		largeRepos: repos.filter((r) => r.size === "large").length,
		totalCommits: repos.reduce((sum, r) => sum + r.commits.length, 0),
		totalSessions: repos.reduce((sum, r) => sum + r.sessions.length, 0),
		totalGroundTruth: repos.reduce((sum, r) => sum + r.groundTruth.length, 0),
		allEdgeCases: repos.flatMap((r) => r.edgeCases),
		repos: repos.map((r) => ({
			id: r.id,
			name: r.name,
			size: r.size,
			commitCount: r.commits.length,
			sessionCount: r.sessions.length,
			groundTruthCount: r.groundTruth.length,
			edgeCases: r.edgeCases,
		})),
	};

	writeFileSync(
		join(basePath, "dataset-summary.json"),
		JSON.stringify(summary, null, 2),
		"utf-8",
	);

	console.log("\n✅ Calibration dataset generated successfully!\n");
	console.log(`📊 Summary:`);
	console.log(`   Total repos: ${summary.totalRepos}`);
	console.log(`   Small repos (<100 commits): ${summary.smallRepos}`);
	console.log(`   Medium repos (100-1k commits): ${summary.mediumRepos}`);
	console.log(`   Large repos (1k-10k commits): ${summary.largeRepos}`);
	console.log(`   Total commits: ${summary.totalCommits}`);
	console.log(`   Total sessions: ${summary.totalSessions}`);
	console.log(`   Total ground truth mappings: ${summary.totalGroundTruth}\n`);
	console.log(`📁 Dataset location: ${basePath}\n`);

	// List edge cases
	console.log(`🔍 Edge cases covered:`);
	summary.allEdgeCases.forEach((edgeCase, i) => {
		console.log(`   ${i + 1}. ${edgeCase}`);
	});
	console.log();

	// Expected calibration outcomes
	console.log(`📈 Expected calibration outcomes:`);
	const highConfCount = repos.reduce(
		(sum, r) => sum + r.groundTruth.filter((gt) => gt.confidence >= 0.8).length,
		0,
	);
	const medConfCount = repos.reduce(
		(sum, r) =>
			sum +
			r.groundTruth.filter((gt) => gt.confidence >= 0.7 && gt.confidence < 0.8)
				.length,
		0,
	);
	const lowConfCount = repos.reduce(
		(sum, r) => sum + r.groundTruth.filter((gt) => gt.confidence < 0.7).length,
		0,
	);

	console.log(`   High confidence links (≥0.8): ${highConfCount}`);
	console.log(`   Medium confidence links (0.7-0.8): ${medConfCount}`);
	console.log(`   Low confidence links (<0.7, unlinked): ${lowConfCount}`);
	console.log();

	const expectedAccuracy =
		((highConfCount + medConfCount) /
			(highConfCount + medConfCount + lowConfCount)) *
		100;
	console.log(
		`🎯 Expected overall accuracy at 0.7 threshold: ~${expectedAccuracy.toFixed(1)}%\n`,
	);
}

// Main execution
console.log(
	"🔧 Generating calibration dataset for session-to-commit linking...\n",
);

const dataset = generateCalibrationDataset();
writeDataset(dataset);
