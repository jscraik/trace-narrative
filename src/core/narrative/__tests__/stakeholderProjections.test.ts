import { describe, expect, it } from "vitest";
import type { BranchNarrative, BranchViewModel } from "../../types";
import { buildStakeholderProjections } from "../stakeholderProjections";

function model(): BranchViewModel {
	return {
		source: "git",
		title: "feature/test",
		status: "open",
		description: "/tmp/repo",
		stats: {
			added: 10,
			removed: 4,
			files: 2,
			commits: 1,
			prompts: 1,
			responses: 2,
		},
		intent: [{ id: "i1", text: "Add phase 2 stakeholder view" }],
		timeline: [{ id: "abc123", type: "commit", label: "feat: add view model" }],
	};
}

const narrative: BranchNarrative = {
	schemaVersion: 1,
	generatedAtISO: "2026-02-18T00:00:00.000Z",
	state: "ready",
	summary: "Narrative summary",
	confidence: 0.7,
	highlights: [
		{
			id: "h1",
			title: "Highlight",
			whyThisMatters: "Important shift",
			confidence: 0.68,
			evidenceLinks: [
				{
					id: "commit:abc123",
					kind: "commit",
					label: "Commit abc123",
					commitSha: "abc123",
				},
			],
		},
	],
	evidenceLinks: [
		{
			id: "commit:abc123",
			kind: "commit",
			label: "Commit abc123",
			commitSha: "abc123",
		},
	],
};

describe("buildStakeholderProjections", () => {
	it("returns all audience projections with headline and bullets", () => {
		const projections = buildStakeholderProjections({
			narrative,
			model: model(),
		});
		expect(projections.executive.headline.length).toBeGreaterThan(0);
		expect(projections.manager.bullets.length).toBeGreaterThan(0);
		expect(projections.engineer.evidenceLinks.length).toBeGreaterThan(0);
	});
});
