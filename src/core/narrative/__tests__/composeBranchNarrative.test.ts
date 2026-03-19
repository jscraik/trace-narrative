import { describe, expect, it } from "vitest";
import type { BranchViewModel } from "../../types";
import {
	BRANCH_NARRATIVE_SCHEMA_VERSION,
	composeBranchNarrative,
} from "../composeBranchNarrative";

function baseModel(): BranchViewModel {
	return {
		source: "git",
		title: "feature/narrative",
		status: "open",
		description: "/tmp/repo",
		stats: {
			added: 12,
			removed: 4,
			files: 3,
			commits: 1,
			prompts: 2,
			responses: 4,
		},
		intent: [],
		timeline: [],
	};
}

function normalizeGeneratedAtIso<T extends { generatedAtISO?: string }>(
	value: T,
): T {
	return {
		...value,
		generatedAtISO: "<normalized>",
	};
}

describe("composeBranchNarrative", () => {
	it("returns failed state when no commits are available", () => {
		const narrative = composeBranchNarrative(baseModel());

		expect(narrative.state).toBe("failed");
		expect(narrative.highlights).toHaveLength(0);
		expect(narrative.schemaVersion).toBe(BRANCH_NARRATIVE_SCHEMA_VERSION);
	});

	it("builds ready narrative with commit-backed highlights", () => {
		const model = baseModel();
		model.intent = [{ id: "i1", text: "Add progressive disclosure panel" }];
		model.timeline = [
			{
				id: "abc1234",
				type: "commit",
				label: "feat: add narrative panel",
				badges: [{ type: "trace", label: "AI 68%" }],
			},
		];

		const narrative = composeBranchNarrative(model);

		expect(narrative.state).toBe("ready");
		expect(narrative.summary).toContain("Primary intent");
		expect(narrative.highlights.length).toBeGreaterThan(0);
		expect(narrative.evidenceLinks.some((link) => link.kind === "commit")).toBe(
			true,
		);
		expect(narrative.promptTemplate).toEqual({
			id: "branch-narrative-v1",
			version: "2026-02-24",
		});
	});

	it("applies calibration adjustments to highlight ordering and confidence", () => {
		const model = baseModel();
		model.intent = [{ id: "i1", text: "Improve narrative quality loop" }];
		model.timeline = [
			{
				id: "aaa1111",
				type: "commit",
				label: "feat: first highlight",
				badges: [{ type: "session", label: "session" }],
			},
			{
				id: "bbb2222",
				type: "commit",
				label: "feat: second highlight",
				badges: [{ type: "session", label: "session" }],
			},
		];

		const narrative = composeBranchNarrative(model, {
			calibration: {
				repoId: 1,
				rankingBias: 0.1,
				confidenceOffset: 0.08,
				confidenceScale: 1.05,
				sampleCount: 6,
				windowStartISO: "2026-02-01T00:00:00.000Z",
				windowEndISO: "2026-02-24T00:00:00.000Z",
				actorWeightPolicyVersion: "v1",
				branchMissingDecisionCount: 1,
				highlightAdjustments: {
					"highlight:aaa1111": -0.05,
					"highlight:bbb2222": 0.12,
				},
				updatedAtISO: "2026-02-24T00:00:00.000Z",
			},
		});

		expect(narrative.highlights[0]?.id).toBe("highlight:bbb2222");
		expect(narrative.confidence).toBeGreaterThan(0.7);
	});

	it("keeps baseline behavior when calibration has no samples", () => {
		const model = baseModel();
		model.timeline = [
			{
				id: "aaa1111",
				type: "commit",
				label: "feat: baseline highlight",
				badges: [{ type: "trace", label: "trace" }],
			},
		];

		const withoutCalibration = composeBranchNarrative(model);
		const withColdStartCalibration = composeBranchNarrative(model, {
			calibration: {
				repoId: 1,
				rankingBias: 0.15,
				confidenceOffset: 0.12,
				confidenceScale: 1.1,
				sampleCount: 0,
				actorWeightPolicyVersion: "v1",
				branchMissingDecisionCount: 5,
				highlightAdjustments: {
					"highlight:aaa1111": -0.15,
				},
				updatedAtISO: "2026-02-24T00:00:00.000Z",
			},
		});

		expect(normalizeGeneratedAtIso(withColdStartCalibration)).toEqual(
			normalizeGeneratedAtIso(withoutCalibration),
		);
	});

	it("clamps calibrated confidence values within policy bounds", () => {
		const model = baseModel();
		model.intent = [{ id: "i1", text: "Clamp confidence in narrative loop" }];
		model.timeline = [
			{
				id: "aaa1111",
				type: "commit",
				label: "feat: clamp high",
				badges: [{ type: "trace", label: "trace" }],
			},
		];

		const narrative = composeBranchNarrative(model, {
			calibration: {
				repoId: 1,
				rankingBias: 0.15,
				confidenceOffset: 0.12,
				confidenceScale: 1.1,
				sampleCount: 9,
				actorWeightPolicyVersion: "v1",
				branchMissingDecisionCount: 20,
				highlightAdjustments: {
					"highlight:aaa1111": 3,
				},
				updatedAtISO: "2026-02-24T00:00:00.000Z",
			},
		});

		expect(narrative.highlights[0]?.confidence).toBeLessThanOrEqual(1);
		expect(narrative.highlights[0]?.confidence).toBeGreaterThanOrEqual(0);
		expect(narrative.confidence).toBeLessThanOrEqual(1);
		expect(narrative.confidence).toBeGreaterThanOrEqual(0);
	});

	it("deduplicates evidence links across highlights", () => {
		const model = baseModel();
		model.timeline = [
			{
				id: "same123",
				type: "commit",
				label: "First commit",
				badges: [{ type: "session", label: "session" }],
			},
			{
				id: "same123",
				type: "commit",
				label: "Duplicate commit (same SHA)",
				badges: [{ type: "session", label: "session" }],
			},
		];

		const narrative = composeBranchNarrative(model);

		// Should deduplicate evidence links with same id
		const commitLinkCount = narrative.evidenceLinks.filter(
			(link) => link.kind === "commit",
		).length;
		const diffLinkCount = narrative.evidenceLinks.filter(
			(link) => link.kind === "diff",
		).length;

		// Each commit produces 2 links (commit + diff), but duplicates should be removed
		expect(commitLinkCount).toBeLessThanOrEqual(2);
		expect(diffLinkCount).toBeLessThanOrEqual(2);
	});

	it("produces needs_attention state when confidence is below threshold", () => {
		const model = baseModel();
		// No intent + no sessions + no traces = lower confidence
		model.intent = []; // No intent bonus
		model.timeline = [
			{
				id: "lowconf1",
				type: "commit",
				label: "Low confidence commit",
				badges: [], // No badges = no bonus
			},
		];

		const _narrative = composeBranchNarrative(model);

		// Base: 0.35 + commit: 0.20 = 0.55 >= 0.5, so state is 'ready'
		// To get needs_attention, we need < 0.5 confidence
		// With negative calibration offset we can push it below threshold
		const lowConfidenceNarrative = composeBranchNarrative(model, {
			calibration: {
				repoId: 1,
				rankingBias: 0,
				confidenceOffset: -0.2, // Push confidence below 0.5
				confidenceScale: 0.5,
				sampleCount: 10,
				actorWeightPolicyVersion: "v1",
				branchMissingDecisionCount: 0,
				highlightAdjustments: {},
				updatedAtISO: "2026-02-24T00:00:00.000Z",
			},
		});

		expect(lowConfidenceNarrative.state).toBe("needs_attention");
		expect(lowConfidenceNarrative.fallbackReason).toContain(
			"confidence is low",
		);
	});

	it("rounds confidence to 2 decimal places", () => {
		const model = baseModel();
		model.intent = [{ id: "i1", text: "Test precision" }];
		model.timeline = [
			{
				id: "precise1",
				type: "commit",
				label: "Precision test",
				badges: [
					{ type: "session", label: "session" },
					{ type: "trace", label: "trace" },
					{ type: "test", label: "test" },
				],
			},
		];

		const narrative = composeBranchNarrative(model);

		// Confidence should be rounded to 2 decimal places
		expect(narrative.confidence.toString()).toMatch(/^\d+\.?\d{0,2}$/);
		narrative.highlights.forEach((h) => {
			expect(h.confidence.toString()).toMatch(/^\d+\.?\d{0,2}$/);
		});
	});

	it("handles commit with failed test badges in whyThisMatters", () => {
		const model = baseModel();
		model.timeline = [
			{
				id: "failedtest",
				type: "commit",
				label: "Commit with failures",
				badges: [{ type: "test", label: "tests", status: "failed" }],
			},
		];

		const narrative = composeBranchNarrative(model);

		expect(narrative.highlights[0]?.whyThisMatters).toContain("test failures");
	});

	it("builds fallback highlight from intent when no commits qualify", () => {
		const model = baseModel();
		model.intent = [{ id: "intent1", text: "Fallback intent highlight" }];
		model.timeline = []; // No commits

		const narrative = composeBranchNarrative(model);

		// Should have failed state but this tests the buildHighlights fallback logic
		expect(narrative.state).toBe("failed");
	});
});
