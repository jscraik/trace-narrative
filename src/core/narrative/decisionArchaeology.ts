import type {
	BranchNarrative,
	DecisionArchaeologyEntry,
	GitHubContextEntry,
} from "../types";

function inferTradeoffs(reason: string): string[] {
	const lower = reason.toLowerCase();
	if (lower.includes("test")) {
		return [
			"Delivery speed vs reliability hardening",
			"Coverage expansion vs merge velocity",
		];
	}
	if (lower.includes("attribution") || lower.includes("trace")) {
		return [
			"Transparency depth vs interface complexity",
			"Evidence richness vs runtime cost",
		];
	}
	return [
		"Narrative clarity vs implementation scope",
		"Confidence calibration vs generation speed",
	];
}

function inferAlternatives(reason: string): string[] {
	const lower = reason.toLowerCase();
	if (lower.includes("fallback")) {
		return ["Show only raw diff by default", "Defer narrative to manual run"];
	}
	return [
		"Implement as a direct diff-only workflow",
		"Defer deeper context until later phase",
	];
}

export function buildDecisionArchaeology(args: {
	narrative: BranchNarrative;
	githubEntry?: GitHubContextEntry;
}): DecisionArchaeologyEntry[] {
	const { narrative, githubEntry } = args;

	const entries = narrative.highlights.slice(0, 3).map((highlight) => ({
		id: `decision:${highlight.id}`,
		title: highlight.title,
		intent: highlight.whyThisMatters,
		tradeoffs: inferTradeoffs(highlight.whyThisMatters),
		alternatives: inferAlternatives(highlight.whyThisMatters),
		evidenceLinks: highlight.evidenceLinks,
		confidence: highlight.confidence,
	}));

	if (githubEntry?.reviewSummary) {
		entries.push({
			id: `decision:github:${githubEntry.id}`,
			title: githubEntry.title,
			intent: `External review context: ${githubEntry.reviewSummary}`,
			tradeoffs: [
				"External context depth vs ingestion complexity",
				"Review breadth vs redaction strictness",
			],
			alternatives: ["Keep connector disabled and rely on local sessions only"],
			evidenceLinks: [],
			confidence: 0.55,
		});
	}

	return entries;
}
