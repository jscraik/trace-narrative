import { describe, expect, it } from 'vitest';
import type {
  AskWhyCitation,
  AskWhyQuestionInput,
  BranchNarrative,
  NarrativeEvidenceLink,
} from '../../types';
import {
  ASK_WHY_CITATION_CAP,
  buildSentenceCitationMap,
  classifyConfidenceBand,
  composeAskWhyAnswer,
  convertEvidenceLinks,
  generateQueryId,
  hashQuestion,
  rankAndCapCitations,
} from '../causalRecall';

// ============================================================================
// Confidence Band Classification
// ============================================================================

describe('classifyConfidenceBand', () => {
  it('classifies high confidence (>= 0.75)', () => {
    expect(classifyConfidenceBand(0.75)).toBe('high');
    expect(classifyConfidenceBand(0.88)).toBe('high');
    expect(classifyConfidenceBand(1.0)).toBe('high');
  });

  it('classifies medium confidence (>= 0.55, < 0.75)', () => {
    expect(classifyConfidenceBand(0.55)).toBe('medium');
    expect(classifyConfidenceBand(0.65)).toBe('medium');
    expect(classifyConfidenceBand(0.74)).toBe('medium');
  });

  it('classifies low confidence (< 0.55)', () => {
    expect(classifyConfidenceBand(0.0)).toBe('low');
    expect(classifyConfidenceBand(0.54)).toBe('low');
    expect(classifyConfidenceBand(0.1)).toBe('low');
  });
});

// ============================================================================
// Citation Conversion & Ranking
// ============================================================================

const sampleEvidenceLinks: NarrativeEvidenceLink[] = [
  { id: 'commit:abc123', kind: 'commit', label: 'Commit abc123', commitSha: 'abc123' },
  { id: 'session:s1', kind: 'session', label: 'Session s1', sessionId: 's1' },
  { id: 'file:src/foo.ts', kind: 'file', label: 'src/foo.ts', filePath: 'src/foo.ts' },
  { id: 'diff:patch1', kind: 'diff', label: 'Diff patch1' },
];

describe('convertEvidenceLinks', () => {
  it('converts all evidence link types', () => {
    const citations = convertEvidenceLinks(sampleEvidenceLinks);
    expect(citations).toHaveLength(4);
    expect(citations[0]).toEqual({
      id: 'commit:abc123',
      type: 'commit',
      label: 'Commit abc123',
      commitSha: 'abc123',
    });
    expect(citations[1]).toEqual({
      id: 'session:s1',
      type: 'session',
      label: 'Session s1',
      sessionId: 's1',
    });
    expect(citations[2]).toEqual({
      id: 'file:src/foo.ts',
      type: 'file',
      label: 'src/foo.ts',
      filePath: 'src/foo.ts',
    });
    expect(citations[3]).toEqual({
      id: 'diff:patch1',
      type: 'diff',
      label: 'Diff patch1',
    });
  });

  it('returns empty array for empty input', () => {
    expect(convertEvidenceLinks([])).toEqual([]);
  });
});

describe('rankAndCapCitations', () => {
  it('ranks commit > session > file (capped at 3)', () => {
    const citations: AskWhyCitation[] = [
      { id: 'diff:1', type: 'diff', label: 'Diff 1' },
      { id: 'commit:abc', type: 'commit', label: 'Commit abc', commitSha: 'abc' },
      { id: 'file:foo.ts', type: 'file', label: 'foo.ts', filePath: 'foo.ts' },
      { id: 'session:s1', type: 'session', label: 'Session s1', sessionId: 's1' },
    ];

    const ranked = rankAndCapCitations(citations);
    // Cap is 3, so diff is excluded even though it would be last
    expect(ranked.map((c) => c.type)).toEqual(['commit', 'session', 'file']);
  });

  it('preserves all types when <= 3 citations', () => {
    const citations: AskWhyCitation[] = [
      { id: 'commit:abc', type: 'commit', label: 'Commit abc', commitSha: 'abc' },
      { id: 'file:foo.ts', type: 'file', label: 'foo.ts', filePath: 'foo.ts' },
      { id: 'session:s1', type: 'session', label: 'Session s1', sessionId: 's1' },
    ];

    const ranked = rankAndCapCitations(citations);
    expect(ranked.map((c) => c.type)).toEqual(['commit', 'session', 'file']);
  });

  it('caps citations to ASK_WHY_CITATION_CAP (3)', () => {
    const citations: AskWhyCitation[] = [
      { id: 'commit:1', type: 'commit', label: 'C1', commitSha: '1' },
      { id: 'commit:2', type: 'commit', label: 'C2', commitSha: '2' },
      { id: 'commit:3', type: 'commit', label: 'C3', commitSha: '3' },
      { id: 'commit:4', type: 'commit', label: 'C4', commitSha: '4' },
      { id: 'commit:5', type: 'commit', label: 'C5', commitSha: '5' },
    ];

    const ranked = rankAndCapCitations(citations);
    expect(ranked).toHaveLength(ASK_WHY_CITATION_CAP);
  });

  it('sorts same-type citations by id for determinism', () => {
    const citations: AskWhyCitation[] = [
      { id: 'commit:zebra', type: 'commit', label: 'Zebra', commitSha: 'zebra' },
      { id: 'commit:alpha', type: 'commit', label: 'Alpha', commitSha: 'alpha' },
      { id: 'commit:middle', type: 'commit', label: 'Middle', commitSha: 'middle' },
    ];

    const ranked = rankAndCapCitations(citations);
    expect(ranked.map((c) => c.id)).toEqual(['commit:alpha', 'commit:middle', 'commit:zebra']);
  });

  it('returns empty array for empty input', () => {
    expect(rankAndCapCitations([])).toEqual([]);
  });
});

// ============================================================================
// Sentence Citation Map (Grounding Validation)
// ============================================================================

describe('buildSentenceCitationMap', () => {
  it('maps sentence index 0 to all citation IDs', () => {
    const citations: AskWhyCitation[] = [
      { id: 'c1', type: 'commit', label: 'C1', commitSha: 'abc' },
      { id: 'c2', type: 'session', label: 'S1', sessionId: 's1' },
    ];

    const map = buildSentenceCitationMap(citations);
    expect(map).toHaveLength(1);
    expect(map[0]).toEqual({
      sentenceIndex: 0,
      citationIds: ['c1', 'c2'],
      uncertain: false,
    });
  });

  it('marks uncertain=true when no citations exist', () => {
    const map = buildSentenceCitationMap([]);
    expect(map).toEqual([{ sentenceIndex: 0, citationIds: [], uncertain: true }]);
  });
});

// ============================================================================
// Query ID Generation & Hashing
// ============================================================================

describe('generateQueryId', () => {
  it('produces deterministic 8-char hex IDs', () => {
    const input: AskWhyQuestionInput = {
      question: 'Why was this branch created?',
      branchId: 'feature/test',
      repoId: 123,
    };

    const id = generateQueryId(input);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('includes minute bucket for dedupe within time window', () => {
    const input: AskWhyQuestionInput = {
      question: 'Why?',
      branchId: 'main',
      repoId: 1,
    };

    // Mock Date.now to control minute bucket
    const originalDateNow = Date.now;
    const baseTime = 1709341200000; // Fixed timestamp (minute 0)
    let callCount = 0;
    Date.now = () => {
      callCount++;
      if (callCount === 1) return baseTime; // Minute 0
      if (callCount === 2) return baseTime + 30000; // Still minute 0 (30s later)
      return baseTime + 60000; // Minute 1
    };

    const id1 = generateQueryId(input); // Minute 0
    const id2 = generateQueryId(input); // Still minute 0
    const id3 = generateQueryId(input); // Minute 1

    expect(id1).toBe(id2);
    expect(id3).not.toBe(id1);

    Date.now = originalDateNow;
  });

  it('varies by question content', () => {
    const base: AskWhyQuestionInput = { question: 'Why?', branchId: 'main', repoId: 1 };
    const id1 = generateQueryId(base);
    const id2 = generateQueryId({ ...base, question: 'Why not?' });
    expect(id1).not.toBe(id2);
  });

  it('varies by branch', () => {
    const base: AskWhyQuestionInput = { question: 'Why?', branchId: 'main', repoId: 1 };
    const id1 = generateQueryId(base);
    const id2 = generateQueryId({ ...base, branchId: 'feature/x' });
    expect(id1).not.toBe(id2);
  });
});

describe('hashQuestion', () => {
  it('produces 8-char hex SHA-256 prefix', async () => {
    const hash = await hashQuestion('Why was this branch created?');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic for same input', async () => {
    const q = 'Why?';
    const h1 = await hashQuestion(q);
    const h2 = await hashQuestion(q);
    expect(h1).toBe(h2);
  });

  it('varies for different inputs', async () => {
    const h1 = await hashQuestion('Why?');
    const h2 = await hashQuestion('Why not?');
    expect(h1).not.toBe(h2);
  });
});

// ============================================================================
// Answer Composition
// ============================================================================

const baseNarrative: BranchNarrative = {
  schemaVersion: 1,
  generatedAtISO: '2026-03-02T00:00:00.000Z',
  state: 'ready',
  summary: 'This branch implements a new feature for user authentication.',
  confidence: 0.85,
  highlights: [],
  evidenceLinks: [
    { id: 'commit:abc123', kind: 'commit', label: 'Commit abc123', commitSha: 'abc123' },
  ],
};

const baseInput: AskWhyQuestionInput = {
  question: 'Why was this branch created?',
  branchId: 'feature/auth',
  repoId: 1,
};

describe('composeAskWhyAnswer', () => {
  describe('success cases', () => {
    it('returns success with high confidence when evidence exists', async () => {
      const result = await composeAskWhyAnswer(baseInput, baseNarrative);
      expect(result.kind).toBe('success');
      if (result.kind !== 'success') return;

      expect(result.answer.confidenceBand).toBe('high');
      expect(result.answer.answerParagraph).toBe(baseNarrative.summary);
      expect(result.answer.fallbackUsed).toBe(false);
      expect(result.answer.citations).toHaveLength(1);
      expect(result.answer.citations[0].id).toBe('commit:abc123');
    });

    it('includes queryId and questionHash', async () => {
      const result = await composeAskWhyAnswer(baseInput, baseNarrative);
      if (result.kind !== 'success') return;

      expect(result.answer.queryId).toMatch(/^[0-9a-f]{8}$/);
      expect(result.answer.questionHash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('includes sentenceCitationMap with grounding', async () => {
      const result = await composeAskWhyAnswer(baseInput, baseNarrative);
      if (result.kind !== 'success') return;

      expect(result.answer.sentenceCitationMap).toHaveLength(1);
      expect(result.answer.sentenceCitationMap[0]).toEqual({
        sentenceIndex: 0,
        citationIds: ['commit:abc123'],
        uncertain: false,
      });
    });

    it('clamps confidence to [0, 1]', async () => {
      const result = await composeAskWhyAnswer(baseInput, {
        ...baseNarrative,
        confidence: 1.5,
      });
      if (result.kind !== 'success') return;
      expect(result.answer.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('fallback cases', () => {
    it('returns fallback with no_evidence when evidenceLinks empty', async () => {
      const result = await composeAskWhyAnswer(baseInput, {
        ...baseNarrative,
        evidenceLinks: [],
      });
      expect(result.kind).toBe('fallback');
      if (result.kind !== 'fallback') return;

      expect(result.reasonCode).toBe('no_evidence');
      expect(result.answer.fallbackUsed).toBe(true);
      expect(result.answer.fallbackReasonCode).toBe('no_evidence');
    });

    it('returns fallback with low_confidence_override for low confidence', async () => {
      const result = await composeAskWhyAnswer(baseInput, {
        ...baseNarrative,
        confidence: 0.3,
      });
      expect(result.kind).toBe('fallback');
      if (result.kind !== 'fallback') return;

      expect(result.reasonCode).toBe('low_confidence_override');
      expect(result.answer.confidenceBand).toBe('low');
    });

    it('marks sentenceCitationMap as uncertain when no citations', async () => {
      const result = await composeAskWhyAnswer(baseInput, {
        ...baseNarrative,
        evidenceLinks: [],
      });
      if (result.kind !== 'fallback') return;

      expect(result.answer.sentenceCitationMap[0].uncertain).toBe(true);
    });
  });

  describe('error cases', () => {
    it('returns error for blank question', async () => {
      const result = await composeAskWhyAnswer(
        { ...baseInput, question: '   ' },
        baseNarrative
      );
      expect(result.kind).toBe('error');
      if (result.kind !== 'error') return;

      expect(result.errorType).toBe('invalid_input');
      expect(result.message).toContain('blank');
    });

    it('returns error for empty question', async () => {
      const result = await composeAskWhyAnswer(
        { ...baseInput, question: '' },
        baseNarrative
      );
      expect(result.kind).toBe('error');
      if (result.kind !== 'error') return;

      expect(result.errorType).toBe('invalid_input');
    });

    it('returns error when narrative summary missing', async () => {
      const result = await composeAskWhyAnswer(baseInput, {
        ...baseNarrative,
        summary: '',
      });
      expect(result.kind).toBe('error');
      if (result.kind !== 'error') return;

      expect(result.errorType).toBe('no_evidence');
      expect(result.message).toContain('No narrative summary');
    });

    it('includes queryId even in error cases', async () => {
      const result = await composeAskWhyAnswer(
        { ...baseInput, question: '' },
        baseNarrative
      );
      if (result.kind !== 'error') return;
      expect(result.queryId).toMatch(/^[0-9a-f]{8}$/);
    });
  });
});
