import type {
	BranchNarrative,
	BranchViewModel,
	NarrativeCalibrationProfile,
	NarrativeEvidenceLink,
	NarrativeHighlight,
	TimelineNode,
} from "../types";
import {
	NARRATIVE_PROMPT_TEMPLATE_ID,
	NARRATIVE_PROMPT_TEMPLATE_VERSION,
} from "./promptGovernance";

export const BRANCH_NARRATIVE_SCHEMA_VERSION = 1;
export const BRANCH_NARRATIVE_PROMPT_TEMPLATE = {
	id: NARRATIVE_PROMPT_TEMPLATE_ID,
	version: NARRATIVE_PROMPT_TEMPLATE_VERSION,
} as const;

function clamp(value: number, min = 0, max = 1): number {
	return Math.min(max, Math.max(min, value));
}

function confidence(value: number): number {
	return Math.round(clamp(value) * 100) / 100;
}

function reasonForNode(node: TimelineNode): string {
	const badges = node.badges ?? [];
	const hasFailedTests = badges.some(
		(badge) => badge.type === "test" && badge.status === "failed",
	);
	if (hasFailedTests) {
		return "This commit introduced test failures that likely changed implementation direction.";
	}

	const hasSession = badges.some((badge) => badge.type === "session");
	if (hasSession) {
		return "This commit is linked to captured agent sessions and likely contains key intent shifts.";
	}

	const traceBadge = badges.find((badge) => badge.type === "trace");
	if (traceBadge) {
		return `This commit includes attribution context (${traceBadge.label}) and is useful for evidence review.`;
	}

	return "This is a recent branch commit that contributes to the current implementation outcome.";
}

function buildCommitEvidence(node: TimelineNode): NarrativeEvidenceLink[] {
	const label = node.label?.trim() || `Commit ${node.id.slice(0, 7)}`;
	return [
		{
			id: `commit:${node.id}`,
			kind: "commit",
			label,
			commitSha: node.id,
		},
		{
			id: `diff:${node.id}`,
			kind: "diff",
			label: `Raw diff for ${node.id.slice(0, 7)}`,
			commitSha: node.id,
		},
	];
}

function uniqueEvidence(
	links: NarrativeEvidenceLink[],
): NarrativeEvidenceLink[] {
	const seen = new Set<string>();
	const deduped: NarrativeEvidenceLink[] = [];
	for (const link of links) {
		if (seen.has(link.id)) continue;
		seen.add(link.id);
		deduped.push(link);
	}
	return deduped;
}

function buildHighlights(
	model: BranchViewModel,
	commitNodes: TimelineNode[],
): NarrativeHighlight[] {
	const highlights: NarrativeHighlight[] = [];
	const recentCommits = [...commitNodes].reverse().slice(0, 3);

	for (const node of recentCommits) {
		const badges = node.badges ?? [];
		const hasAnchor = badges.some(
			(badge) => badge.type === "anchor" && badge.status !== "failed",
		);
		const hasTestBadge = badges.some((badge) => badge.type === "test");
		const hasTraceBadge = badges.some((badge) => badge.type === "trace");
		const hasSessionBadge = badges.some((badge) => badge.type === "session");

		let score = 0.58;
		if (hasAnchor) score += 0.1;
		if (hasTestBadge) score += 0.08;
		if (hasTraceBadge) score += 0.08;
		if (hasSessionBadge) score += 0.08;

		highlights.push({
			id: `highlight:${node.id}`,
			title: node.label?.trim() || `Commit ${node.id.slice(0, 7)}`,
			whyThisMatters: reasonForNode(node),
			confidence: confidence(score),
			evidenceLinks: buildCommitEvidence(node),
		});
	}

	if (highlights.length === 0 && model.intent.length > 0) {
		const item = model.intent[0];
		highlights.push({
			id: `highlight:intent:${item.id}`,
			title: item.text,
			whyThisMatters:
				"Intent extracted from commit/session context provides the best available narrative starting point.",
			confidence: 0.42,
			evidenceLinks: [],
		});
	}

	return highlights;
}

function applyCalibrationToHighlights(
	highlights: NarrativeHighlight[],
	calibration?: NarrativeCalibrationProfile | null,
): NarrativeHighlight[] {
	if (!calibration || calibration.sampleCount <= 0) return highlights;

	// Scale factor: 0.8 to 1.2 based on rankingBias (-0.15 to 0.15)
	// rankingBias amplifies (positive) or dampens (negative) per-highlight adjustments
	const biasScale = 1 + calibration.rankingBias;

	return [...highlights]
		.map((highlight) => {
			const adjustment = calibration.highlightAdjustments[highlight.id] ?? 0;
			// Apply bias scale to per-highlight adjustment to affect sort order
			const scaledAdjustment = adjustment * biasScale;
			const rankingScore = confidence(highlight.confidence + scaledAdjustment);

			return {
				...highlight,
				confidence: rankingScore,
			};
		})
		.sort((a, b) => b.confidence - a.confidence);
}

function applyCalibrationToOverallConfidence(
	overallConfidence: number,
	calibration?: NarrativeCalibrationProfile | null,
): number {
	if (!calibration || calibration.sampleCount <= 0) return overallConfidence;

	const branchPenalty = Math.min(
		0.08,
		calibration.branchMissingDecisionCount * 0.01,
	);
	return confidence(
		overallConfidence * calibration.confidenceScale +
			calibration.confidenceOffset -
			branchPenalty,
	);
}

export function composeBranchNarrative(
	model: BranchViewModel,
	options?: { calibration?: NarrativeCalibrationProfile | null },
): BranchNarrative {
	const calibration = options?.calibration ?? null;
	const commitNodes = model.timeline.filter((node) => node.type === "commit");
	const baseHighlights = buildHighlights(model, commitNodes);
	const highlights = applyCalibrationToHighlights(baseHighlights, calibration);
	const evidenceLinks = uniqueEvidence(
		highlights.flatMap((highlight) => highlight.evidenceLinks),
	);

	const hasTrace = Boolean(
		model.traceSummaries &&
			Object.keys(model.traceSummaries.byCommit).length > 0,
	);
	const hasSessions = Boolean(
		model.sessionExcerpts && model.sessionExcerpts.length > 0,
	);

	let overallConfidence = 0.35;
	if (model.intent.length > 0) overallConfidence += 0.2;
	if (commitNodes.length > 0) overallConfidence += 0.2;
	if (hasSessions) overallConfidence += 0.15;
	if (hasTrace) overallConfidence += 0.1;
	overallConfidence = confidence(overallConfidence);
	overallConfidence = applyCalibrationToOverallConfidence(
		overallConfidence,
		calibration,
	);

	const topIntent = model.intent[0]?.text;
	const summaryBase = `${model.stats.commits} commits touched ${model.stats.files} files (+${model.stats.added} / -${model.stats.removed}).`;
	const summary = topIntent
		? `${summaryBase} Primary intent: ${topIntent}`
		: `${summaryBase} Intent is inferred from commit and trace evidence.`;

	if (commitNodes.length === 0) {
		return {
			schemaVersion: BRANCH_NARRATIVE_SCHEMA_VERSION,
			generatedAtISO: new Date().toISOString(),
			state: "failed",
			summary: "No commit history is available for narrative synthesis yet.",
			confidence: 0,
			highlights: [],
			evidenceLinks: [],
			promptTemplate: BRANCH_NARRATIVE_PROMPT_TEMPLATE,
			fallbackReason: "Open raw git history once commits are available.",
		};
	}

	if (overallConfidence < 0.5) {
		return {
			schemaVersion: BRANCH_NARRATIVE_SCHEMA_VERSION,
			generatedAtISO: new Date().toISOString(),
			state: "needs_attention",
			summary,
			confidence: overallConfidence,
			highlights,
			evidenceLinks,
			promptTemplate: BRANCH_NARRATIVE_PROMPT_TEMPLATE,
			fallbackReason:
				"Narrative confidence is low. Verify with evidence and raw diff before relying on this summary.",
		};
	}

	return {
		schemaVersion: BRANCH_NARRATIVE_SCHEMA_VERSION,
		generatedAtISO: new Date().toISOString(),
		state: "ready",
		summary,
		confidence: overallConfidence,
		highlights,
		evidenceLinks,
		promptTemplate: BRANCH_NARRATIVE_PROMPT_TEMPLATE,
	};
}
