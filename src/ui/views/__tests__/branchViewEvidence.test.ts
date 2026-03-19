import { describe, expect, it } from "vitest";
import type { NarrativeEvidenceLink } from "../../../core/types";
import { shouldRouteEvidenceToRawDiff } from "../branchViewEvidence";

describe("shouldRouteEvidenceToRawDiff", () => {
	it("returns true for diff evidence links", () => {
		const link: NarrativeEvidenceLink = {
			id: "diff:1",
			kind: "diff",
			label: "Open raw diff",
			commitSha: "abc1234",
			filePath: "src/file.ts",
		};

		expect(shouldRouteEvidenceToRawDiff(link)).toBe(true);
	});

	it("returns false for non-diff evidence links", () => {
		const link: NarrativeEvidenceLink = {
			id: "commit:abc1234",
			kind: "commit",
			label: "Commit abc1234",
			commitSha: "abc1234",
		};

		expect(shouldRouteEvidenceToRawDiff(link)).toBe(false);
	});
});
