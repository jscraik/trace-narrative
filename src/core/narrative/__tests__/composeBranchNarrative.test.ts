import { describe, expect, it } from 'vitest';
import type { BranchViewModel } from '../../types';
import {
  BRANCH_NARRATIVE_SCHEMA_VERSION,
  composeBranchNarrative,
} from '../composeBranchNarrative';

function baseModel(): BranchViewModel {
  return {
    source: 'git',
    title: 'feature/narrative',
    status: 'open',
    description: '/tmp/repo',
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

describe('composeBranchNarrative', () => {
  it('returns failed state when no commits are available', () => {
    const narrative = composeBranchNarrative(baseModel());

    expect(narrative.state).toBe('failed');
    expect(narrative.highlights).toHaveLength(0);
    expect(narrative.schemaVersion).toBe(BRANCH_NARRATIVE_SCHEMA_VERSION);
  });

  it('builds ready narrative with commit-backed highlights', () => {
    const model = baseModel();
    model.intent = [{ id: 'i1', text: 'Add progressive disclosure panel' }];
    model.timeline = [
      {
        id: 'abc1234',
        type: 'commit',
        label: 'feat: add narrative panel',
        badges: [{ type: 'trace', label: 'AI 68%' }],
      },
    ];

    const narrative = composeBranchNarrative(model);

    expect(narrative.state).toBe('ready');
    expect(narrative.summary).toContain('Primary intent');
    expect(narrative.highlights.length).toBeGreaterThan(0);
    expect(narrative.evidenceLinks.some((link) => link.kind === 'commit')).toBe(true);
  });

  it('applies calibration adjustments to highlight ordering and confidence', () => {
    const model = baseModel();
    model.intent = [{ id: 'i1', text: 'Improve narrative quality loop' }];
    model.timeline = [
      {
        id: 'aaa1111',
        type: 'commit',
        label: 'feat: first highlight',
        badges: [{ type: 'session', label: 'session' }],
      },
      {
        id: 'bbb2222',
        type: 'commit',
        label: 'feat: second highlight',
        badges: [{ type: 'session', label: 'session' }],
      },
    ];

    const narrative = composeBranchNarrative(model, {
      calibration: {
        repoId: 1,
        rankingBias: 0.1,
        confidenceOffset: 0.08,
        confidenceScale: 1.05,
        sampleCount: 6,
        windowStartISO: '2026-02-01T00:00:00.000Z',
        windowEndISO: '2026-02-24T00:00:00.000Z',
        actorWeightPolicyVersion: 'v1',
        branchMissingDecisionCount: 1,
        highlightAdjustments: {
          'highlight:aaa1111': -0.05,
          'highlight:bbb2222': 0.12,
        },
        updatedAtISO: '2026-02-24T00:00:00.000Z',
      },
    });

    expect(narrative.highlights[0]?.id).toBe('highlight:bbb2222');
    expect(narrative.confidence).toBeGreaterThan(0.7);
  });

  it('keeps baseline behavior when calibration has no samples', () => {
    const model = baseModel();
    model.timeline = [
      {
        id: 'aaa1111',
        type: 'commit',
        label: 'feat: baseline highlight',
        badges: [{ type: 'trace', label: 'trace' }],
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
        actorWeightPolicyVersion: 'v1',
        branchMissingDecisionCount: 5,
        highlightAdjustments: {
          'highlight:aaa1111': -0.15,
        },
        updatedAtISO: '2026-02-24T00:00:00.000Z',
      },
    });

    expect(withColdStartCalibration).toEqual(withoutCalibration);
  });

  it('clamps calibrated confidence values within policy bounds', () => {
    const model = baseModel();
    model.intent = [{ id: 'i1', text: 'Clamp confidence in narrative loop' }];
    model.timeline = [
      {
        id: 'aaa1111',
        type: 'commit',
        label: 'feat: clamp high',
        badges: [{ type: 'trace', label: 'trace' }],
      },
    ];

    const narrative = composeBranchNarrative(model, {
      calibration: {
        repoId: 1,
        rankingBias: 0.15,
        confidenceOffset: 0.12,
        confidenceScale: 1.1,
        sampleCount: 9,
        actorWeightPolicyVersion: 'v1',
        branchMissingDecisionCount: 20,
        highlightAdjustments: {
          'highlight:aaa1111': 3,
        },
        updatedAtISO: '2026-02-24T00:00:00.000Z',
      },
    });

    expect(narrative.highlights[0]?.confidence).toBeLessThanOrEqual(1);
    expect(narrative.highlights[0]?.confidence).toBeGreaterThanOrEqual(0);
    expect(narrative.confidence).toBeLessThanOrEqual(1);
    expect(narrative.confidence).toBeGreaterThanOrEqual(0);
  });
});
