import { describe, expect, it } from "vitest";
import type {
	BranchNarrative,
	NarrativeConfidenceTier,
	NarrativeEvidenceLink,
	NarrativeRecallLaneItemSource,
} from "../../types";
import {
	buildRecallLane,
	compareRecallLaneItems,
	sanitizeConfidence,
} from "../recallLane";

describe("sanitizeConfidence", () => {
	it("normalizes malformed confidence values", () => {
		expect(sanitizeConfidence(-1)).toBe(0);
		expect(sanitizeConfidence(2)).toBe(1);
		expect(sanitizeConfidence(NaN)).toBe(0);
	});

	it("handles edge cases: Infinity, -Infinity, undefined, null, string", () => {
		// Infinity is non-finite, so returns 0 (safer: treat infinite confidence as invalid)
		expect(sanitizeConfidence(Infinity)).toBe(0);
		expect(sanitizeConfidence(-Infinity)).toBe(0);
		expect(sanitizeConfidence(undefined)).toBe(0);
		expect(sanitizeConfidence(null)).toBe(0);
		expect(sanitizeConfidence("0.5")).toBe(0.5);
		expect(sanitizeConfidence("invalid")).toBe(0);
	});
});

describe("compareRecallLaneItems", () => {
	it("produces deterministic ordering for equal confidence and tier using sourceIndex then id", () => {
		const itemA: Parameters<typeof compareRecallLaneItems>[0] = {
			item: {
				id: "b-id",
				title: "A",
				whyThisMatters: "A",
				confidence: 0.8,
				confidenceTier: "high",
				evidenceLinks: [],
				source: "highlight" as const,
			},
			sourceIndex: 1,
		};
		const itemB: Parameters<typeof compareRecallLaneItems>[0] = {
			item: {
				id: "a-id",
				title: "B",
				whyThisMatters: "B",
				confidence: 0.8,
				confidenceTier: "high",
				evidenceLinks: [],
				source: "highlight" as const,
			},
			sourceIndex: 0,
		};

		expect(compareRecallLaneItems(itemA, itemB)).toBeGreaterThan(0);
	});

	it("orders by confidence tier when confidence is equal (high > medium > low)", () => {
		const highTier = {
			item: {
				id: "high",
				title: "High",
				whyThisMatters: "High tier",
				confidence: 0.5,
				confidenceTier: "high" as NarrativeConfidenceTier,
				evidenceLinks: [],
				source: "highlight" as const,
			},
			sourceIndex: 0,
		};
		const mediumTier = {
			item: {
				id: "medium",
				title: "Medium",
				whyThisMatters: "Medium tier",
				confidence: 0.5,
				confidenceTier: "medium" as NarrativeConfidenceTier,
				evidenceLinks: [],
				source: "highlight" as const,
			},
			sourceIndex: 0,
		};
		const lowTier = {
			item: {
				id: "low",
				title: "Low",
				whyThisMatters: "Low tier",
				confidence: 0.5,
				confidenceTier: "low" as NarrativeConfidenceTier,
				evidenceLinks: [],
				source: "highlight" as const,
			},
			sourceIndex: 0,
		};

		// High tier should come before medium
		expect(compareRecallLaneItems(mediumTier, highTier)).toBeGreaterThan(0);
		// Medium tier should come before low
		expect(compareRecallLaneItems(lowTier, mediumTier)).toBeGreaterThan(0);
		// High tier should come before low
		expect(compareRecallLaneItems(lowTier, highTier)).toBeGreaterThan(0);
	});

	it("orders by source when tier is equal (highlight > fallback)", () => {
		const highlightSource = {
			item: {
				id: "a",
				title: "Highlight",
				whyThisMatters: "Highlight",
				confidence: 0.5,
				confidenceTier: "medium" as NarrativeConfidenceTier,
				evidenceLinks: [],
				source: "highlight" as NarrativeRecallLaneItemSource,
			},
			sourceIndex: 0,
		};
		const fallbackSource = {
			item: {
				id: "b",
				title: "Fallback",
				whyThisMatters: "Fallback",
				confidence: 0.5,
				confidenceTier: "medium" as NarrativeConfidenceTier,
				evidenceLinks: [],
				source: "fallback" as NarrativeRecallLaneItemSource,
			},
			sourceIndex: 0,
		};

		// Highlight source should come before fallback
		expect(
			compareRecallLaneItems(fallbackSource, highlightSource),
		).toBeGreaterThan(0);
	});

	it("uses id as final tie-breaker when all other properties are equal", () => {
		const itemA = {
			item: {
				id: "aaa",
				title: "A",
				whyThisMatters: "A",
				confidence: 0.5,
				confidenceTier: "medium" as NarrativeConfidenceTier,
				evidenceLinks: [],
				source: "highlight" as const,
			},
			sourceIndex: 0,
		};
		const itemB = {
			item: {
				id: "zzz",
				title: "Z",
				whyThisMatters: "Z",
				confidence: 0.5,
				confidenceTier: "medium" as NarrativeConfidenceTier,
				evidenceLinks: [],
				source: "highlight" as const,
			},
			sourceIndex: 0,
		};

		// 'aaa' should come before 'zzz' (lexicographic comparison)
		expect(compareRecallLaneItems(itemB, itemA)).toBeGreaterThan(0);
		expect(compareRecallLaneItems(itemA, itemB)).toBeLessThan(0);
	});
});

describe("buildRecallLane", () => {
	const narrative: BranchNarrative = {
		schemaVersion: 1,
		generatedAtISO: "2026-02-27T00:00:00.000Z",
		state: "ready",
		summary: "A short summary of branch intent.",
		confidence: 0.64,
		highlights: [
			{
				id: "highlight:aaa",
				title: "Zigzag commit",
				whyThisMatters: "Most recent commit has mixed signals.",
				confidence: 0.5,
				evidenceLinks: [
					{
						id: "commit:aaa",
						kind: "commit",
						label: "Commit aaa",
						commitSha: "aaa",
					},
				],
			},
			{
				id: "highlight:bbb",
				title: "Anchor commit",
				whyThisMatters: "Highest confidence signal.",
				confidence: 0.88,
				evidenceLinks: [],
			},
			{
				id: "highlight:ccc",
				title: "Session-sourced commit",
				whyThisMatters: "Confidence with missing evidence.",
				confidence: 0.5,
				evidenceLinks: [],
			},
		],
		evidenceLinks: [
			{
				id: "commit:aaa",
				kind: "commit",
				label: "Commit aaa",
				commitSha: "aaa",
			},
		],
	};

	it("builds ordered lane items from highlights", () => {
		const lane = buildRecallLane(narrative, {
			maxItems: 3,
			confidenceFloor: 0.25,
		});

		expect(lane).toHaveLength(3);
		expect(lane[0]).toMatchObject({
			id: "highlight:bbb",
			confidenceTier: "high",
		});
		expect(lane[1]?.id).toBe("highlight:aaa");
		expect(lane[2]?.id).toBe("highlight:ccc");
		expect(lane.every((item) => Number.isFinite(item.confidence))).toBe(true);
	});

	it("returns deterministic order across repeated calls with malformed confidence", () => {
		const mutatedHighlights = narrative.highlights.map((highlight, index) => {
			const overrides = [NaN, 2, -5][index] as unknown as number;
			return {
				...highlight,
				confidence: index < 3 ? overrides : highlight.confidence,
			};
		});

		const mutated = {
			...narrative,
			highlights: mutatedHighlights,
		} as BranchNarrative;

		const first = buildRecallLane(mutated, { maxItems: 3, confidenceFloor: 0 });
		const second = buildRecallLane(mutated, {
			maxItems: 3,
			confidenceFloor: 0,
		});
		expect(first).toEqual(second);
		expect(first.map((item) => item.id)).toEqual([
			"highlight:bbb",
			"highlight:aaa",
			"highlight:ccc",
		]);
	});

	it("falls back to summary-derived item when highlights are missing", () => {
		const lane = buildRecallLane(
			{
				...narrative,
				highlights: [],
			},
			{
				maxItems: 1,
			},
		);

		expect(lane).toHaveLength(1);
		expect(lane[0]).toMatchObject({
			source: "fallback",
			title: "Review branch summary",
		});
		expect(lane[0]?.evidenceLinks).toHaveLength(1);
	});

	it("filters items below confidenceFloor", () => {
		const lane = buildRecallLane(narrative, {
			maxItems: 3,
			confidenceFloor: 0.7,
		});

		// Only highlight:bbb (0.88) should pass the floor
		expect(lane).toHaveLength(1);
		expect(lane[0]?.id).toBe("highlight:bbb");
	});

	it("falls back when all highlights filtered by confidenceFloor", () => {
		const lane = buildRecallLane(
			{
				...narrative,
				highlights: narrative.highlights[0]
					? [{ ...narrative.highlights[0], confidence: 0.1 }]
					: [], // Low confidence
			},
			{ maxItems: 3, confidenceFloor: 0.5 },
		);

		expect(lane).toHaveLength(1);
		expect(lane[0]?.source).toBe("fallback");
	});

	it("normalizes malformed evidence links in highlights", () => {
		const lane = buildRecallLane(
			{
				...narrative,
				highlights: [
					{
						id: "highlight:malformed",
						title: "Malformed evidence",
						whyThisMatters: "Test",
						confidence: 0.8,
						evidenceLinks: [
							// Valid link
							{ id: "valid", kind: "commit", label: "Valid", commitSha: "abc" },
							// Missing required fields - should be filtered
							{
								id: "invalid-no-kind",
								label: "No Kind",
							} as unknown as NarrativeEvidenceLink,
							{
								kind: "commit",
								label: "No ID",
							} as unknown as NarrativeEvidenceLink,
							// Null/undefined - should be filtered
							null as unknown as NarrativeEvidenceLink,
							undefined as unknown as NarrativeEvidenceLink,
						],
					},
				],
			},
			{ maxItems: 1 },
		);

		expect(lane).toHaveLength(1);
		expect(lane[0]?.evidenceLinks).toHaveLength(1);
		expect(lane[0]?.evidenceLinks[0]?.id).toBe("valid");
	});

	it("returns empty array on exception in buildRecallLane", () => {
		// Create a narrative that will cause an exception in sorting
		// by having an object that throws on property access
		const throwingNarrative = {
			...narrative,
			highlights: [
				new Proxy({} as BranchNarrative["highlights"][0], {
					get(target, prop) {
						if (prop === "confidence") {
							throw new Error("Simulated error");
						}
						return Reflect.get(target, prop);
					},
				}),
			],
		};

		// This should catch the exception and return []
		const lane = buildRecallLane(
			throwingNarrative as unknown as BranchNarrative,
			{ maxItems: 3 },
		);

		expect(lane).toEqual([]);
	});
});
