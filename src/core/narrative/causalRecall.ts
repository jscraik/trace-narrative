import type {
  AskWhyAnswerPayload,
  AskWhyCitation,
  AskWhyConfidenceBand,
  AskWhyFallbackReasonCode,
  AskWhyQuestionInput,
  AskWhySentenceCitationMapEntry,
  BranchNarrative,
  NarrativeEvidenceLink,
} from '../types';

export const ASK_WHY_CITATION_CAP = 3;

// Simple deterministic hash (djb2 algorithm) - NOT cryptographically secure
// Used for query IDs where collision risk is acceptable
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
}

export function fingerprintQuestion(question: string): string {
  return simpleHash(question).slice(0, 8);
}

// SHA-256 hash for question fingerprinting (per telemetry contract)
// Returns first 8 chars of SHA-256 hex digest
export async function hashQuestion(question: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return fingerprintQuestion(question);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(question);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

// Query ID with repo scope and minute bucket for telemetry dedupe
export function generateQueryId(input: AskWhyQuestionInput): string {
  const minuteBucket = Math.floor(Date.now() / 60000);
  return simpleHash(`${input.repoId}:${input.branchId}:${input.question}:${minuteBucket}`);
}

export function classifyConfidenceBand(confidence: number): AskWhyConfidenceBand {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.55) return 'medium';
  return 'low';
}

// Citation Conversion & Ranking
const CITATION_TYPE_WEIGHT: Record<string, number> = { commit: 3, session: 2, file: 1, diff: 0 };

export function convertEvidenceLinks(links: NarrativeEvidenceLink[]): AskWhyCitation[] {
  return links.map((link) => ({
    id: link.id,
    type: link.kind as AskWhyCitation['type'],
    label: link.label,
    commitSha: link.commitSha,
    filePath: link.filePath,
    sessionId: link.sessionId,
  }));
}

export function rankAndCapCitations(citations: AskWhyCitation[]): AskWhyCitation[] {
  return [...citations]
    .sort((a, b) => (CITATION_TYPE_WEIGHT[b.type] ?? 0) - (CITATION_TYPE_WEIGHT[a.type] ?? 0) || a.id.localeCompare(b.id))
    .slice(0, ASK_WHY_CITATION_CAP);
}

// Sentence Citation Map (Phase 1: single sentence)
export function buildSentenceCitationMap(citations: AskWhyCitation[]): AskWhySentenceCitationMapEntry[] {
  const citationIds = citations.map((c) => c.id);
  return [{ sentenceIndex: 0, citationIds, uncertain: citationIds.length === 0 }];
}

// Answer Composition
export type ComposeAskWhyResult =
  | { kind: 'success'; answer: AskWhyAnswerPayload }
  | { kind: 'fallback'; answer: AskWhyAnswerPayload; reasonCode: AskWhyFallbackReasonCode }
  | { kind: 'error'; queryId: string; errorType: string; message: string };

export async function composeAskWhyAnswer(
  input: AskWhyQuestionInput,
  narrative: BranchNarrative,
  precomputed?: {
    queryId?: string;
    questionHash?: string;
  }
): Promise<ComposeAskWhyResult> {
  const queryId = precomputed?.queryId ?? generateQueryId(input);

  if (!input.question?.trim()) {
    return { kind: 'error', queryId, errorType: 'invalid_input', message: 'Question cannot be blank.' };
  }

  const questionHash = precomputed?.questionHash ?? await hashQuestion(input.question);

  if (!narrative.summary?.trim()) {
    return { kind: 'error', queryId, errorType: 'no_evidence', message: 'No narrative summary available.' };
  }

  const citations = rankAndCapCitations(convertEvidenceLinks(narrative.evidenceLinks ?? []));
  const confidence = Math.max(0, Math.min(1, narrative.confidence ?? 0.5));
  const confidenceBand = classifyConfidenceBand(confidence);
  const hasEvidence = narrative.evidenceLinks && narrative.evidenceLinks.length > 0;

  const answer: AskWhyAnswerPayload = {
    queryId,
    questionHash,
    answerParagraph: narrative.summary,
    confidenceBand,
    confidence,
    citations,
    sentenceCitationMap: buildSentenceCitationMap(citations),
    fallbackUsed: false,
    generatedAtISO: new Date().toISOString(),
  };

  if (confidenceBand === 'low' || !hasEvidence) {
    const reasonCode: AskWhyFallbackReasonCode = !hasEvidence ? 'no_evidence' : 'low_confidence_override';
    return { kind: 'fallback', answer: { ...answer, fallbackUsed: true, fallbackReasonCode: reasonCode }, reasonCode };
  }

  return { kind: 'success', answer };
}
