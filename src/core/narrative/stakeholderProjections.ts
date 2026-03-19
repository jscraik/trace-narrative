import type {
	BranchNarrative,
	BranchViewModel,
	GitHubContextEntry,
	StakeholderProjections,
} from "../types";

function topRisk(narrative: BranchNarrative): string {
	if (narrative.state === "needs_attention") {
		return (
			narrative.fallbackReason ??
			"Narrative confidence is low; verify via evidence."
		);
	}
	if (narrative.state === "failed") {
		return "Narrative generation failed; use raw commit and diff evidence.";
	}
	return "No blocking risks detected in current narrative synthesis.";
}

export function buildStakeholderProjections(args: {
	narrative: BranchNarrative;
	model: BranchViewModel;
	githubEntry?: GitHubContextEntry;
}): StakeholderProjections {
	const { narrative, model, githubEntry } = args;
	const highlights = narrative.highlights.slice(0, 3);
	const risk = topRisk(narrative);
	const sharedEvidence = narrative.evidenceLinks.slice(0, 4);

	const executiveHeadline = githubEntry?.title
		? `Branch outcome aligned to PR context: ${githubEntry.title}`
		: "Branch outcome summary for non-technical stakeholders";

	return {
		executive: {
			audience: "executive",
			headline: executiveHeadline,
			bullets: [
				narrative.summary,
				`Delivery footprint: ${model.stats.commits} commits across ${model.stats.files} files.`,
				`Current confidence: ${(narrative.confidence * 100).toFixed(0)}%.`,
			],
			risks: [risk],
			evidenceLinks: sharedEvidence,
		},
		manager: {
			audience: "manager",
			headline: "Workstream, ownership, and risk view",
			bullets: [
				...highlights.map(
					(highlight) => `${highlight.title}: ${highlight.whyThisMatters}`,
				),
				githubEntry?.reviewSummary
					? `Review context: ${githubEntry.reviewSummary}`
					: "No external review context linked yet.",
			],
			risks: [
				risk,
				"Track manual pin/unpin feedback to improve highlight precision.",
			],
			evidenceLinks: sharedEvidence,
		},
		engineer: {
			audience: "engineer",
			headline: "Implementation-level evidence and traceability",
			bullets: [
				`Trace + diff route available for ${sharedEvidence.length} evidence links.`,
				`Top highlight confidence range: ${
					highlights.length
						? `${Math.round(
								Math.min(...highlights.map((h) => h.confidence)) * 100,
							)}%–${Math.round(Math.max(...highlights.map((h) => h.confidence)) * 100)}%`
						: "n/a"
				}.`,
				"Use raw diff fallback when narrative confidence is below expected threshold.",
			],
			risks: [risk],
			evidenceLinks: sharedEvidence,
		},
	};
}
