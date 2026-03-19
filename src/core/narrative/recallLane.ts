import type {
	BranchNarrative,
	NarrativeConfidenceTier,
	NarrativeEvidenceLink,
	NarrativeRecallLaneItem,
	NarrativeRecallLaneItemSource,
} from "../types";

export type RecallLaneSourceIndex = {
	item: NarrativeRecallLaneItem;
	sourceIndex: number;
};

export type BuildRecallLaneOptions = {
	maxItems?: number;
	confidenceFloor?: number;
};

export function sanitizeConfidence(rawValue: unknown): number {
	const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}

function confidenceTierFor(confidence: number): NarrativeConfidenceTier {
	if (confidence >= 0.75) return "high";
	if (confidence >= 0.55) return "medium";
	return "low";
}

const TIER_WEIGHT: Record<NarrativeConfidenceTier, number> = {
	low: 0,
	medium: 1,
	high: 2,
};

const SOURCE_WEIGHT: Record<NarrativeRecallLaneItemSource, number> = {
	fallback: 0,
	highlight: 1,
};

export function compareRecallLaneItems(
	a: RecallLaneSourceIndex,
	b: RecallLaneSourceIndex,
): number {
	const aConfidence = sanitizeConfidence(a.item.confidence);
	const bConfidence = sanitizeConfidence(b.item.confidence);

	if (aConfidence !== bConfidence) {
		return bConfidence - aConfidence;
	}

	const tierDelta =
		TIER_WEIGHT[b.item.confidenceTier] - TIER_WEIGHT[a.item.confidenceTier];
	if (tierDelta !== 0) return tierDelta;

	const sourceDelta =
		SOURCE_WEIGHT[b.item.source] - SOURCE_WEIGHT[a.item.source];
	if (sourceDelta !== 0) return sourceDelta;

	if (a.sourceIndex !== b.sourceIndex) return a.sourceIndex - b.sourceIndex;

	return a.item.id.localeCompare(b.item.id);
}

function normalizeEvidenceLinks(links: unknown): NarrativeEvidenceLink[] {
	if (!Array.isArray(links)) return [];

	return links
		.filter((link): link is NarrativeEvidenceLink => {
			if (!link || typeof link !== "object") return false;
			const candidate = link as Partial<NarrativeEvidenceLink>;
			return (
				typeof candidate.id === "string" &&
				typeof candidate.kind === "string" &&
				typeof candidate.label === "string"
			);
		})
		.map((link) => ({
			...link,
			id: String(link.id),
			kind: link.kind,
			label: String(link.label),
			commitSha: link.commitSha ? String(link.commitSha) : undefined,
			filePath: link.filePath ? String(link.filePath) : undefined,
			sessionId: link.sessionId ? String(link.sessionId) : undefined,
		}));
}

function buildFallbackFromNarrative(
	narrative: BranchNarrative,
): NarrativeRecallLaneItem {
	const confidence = sanitizeConfidence(narrative.confidence);
	return {
		id: `recall_lane_fallback:${narrative.generatedAtISO}`,
		title: "Review branch summary",
		whyThisMatters: narrative.fallbackReason || narrative.summary,
		confidence,
		confidenceTier: confidenceTierFor(confidence),
		evidenceLinks: normalizeEvidenceLinks(narrative.evidenceLinks),
		source: "fallback",
	};
}

function mapNarrativeHighlightToRecallLaneItem(
	highlight: BranchNarrative["highlights"][number],
	_sourceIndex: number,
): NarrativeRecallLaneItem {
	const confidence = sanitizeConfidence(highlight.confidence);
	return {
		id: String(highlight.id),
		title: String(highlight.title || "Narrative item"),
		whyThisMatters: String(highlight.whyThisMatters || ""),
		confidence,
		confidenceTier: confidenceTierFor(confidence),
		evidenceLinks: normalizeEvidenceLinks(highlight.evidenceLinks),
		source: "highlight",
	};
}

export function buildRecallLane(
	narrative: BranchNarrative,
	options: BuildRecallLaneOptions = {},
): NarrativeRecallLaneItem[] {
	try {
		const { maxItems = 3, confidenceFloor = 0 } = options;

		const candidatePairs: RecallLaneSourceIndex[] = [];

		if (Array.isArray(narrative.highlights)) {
			narrative.highlights.forEach((highlight, index) => {
				const item = mapNarrativeHighlightToRecallLaneItem(highlight, index);
				if (item.confidence >= confidenceFloor) {
					candidatePairs.push({ item, sourceIndex: index });
				}
			});
		}

		const fallbackItem = buildFallbackFromNarrative(narrative);
		if (candidatePairs.length === 0 && narrative.summary) {
			candidatePairs.push({ item: fallbackItem, sourceIndex: 0 });
		}

		const sorted = candidatePairs.sort(compareRecallLaneItems);
		const limited = sorted.slice(0, Math.max(1, Math.min(100, maxItems)));
		return limited.map((entry) => entry.item);
	} catch {
		return [];
	}
}
