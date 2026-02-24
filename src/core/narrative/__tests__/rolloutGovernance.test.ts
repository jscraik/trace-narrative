import { describe, expect, it } from 'vitest';
import type {
  BranchNarrative,
  GitHubContextState,
  NarrativeObservabilityMetrics,
  StakeholderProjections,
} from '../../types';
import { evaluateNarrativeRollout } from '../rolloutGovernance';

const projections: StakeholderProjections = {
  executive: {
    audience: 'executive',
    headline: 'Executive headline',
    bullets: ['Executive bullet one', 'Executive bullet two'],
    risks: [],
    evidenceLinks: [{ id: 'commit:1', kind: 'commit', label: 'Commit 1', commitSha: '1' }],
  },
  manager: {
    audience: 'manager',
    headline: 'Manager headline',
    bullets: ['Manager bullet one', 'Manager bullet two'],
    risks: [],
    evidenceLinks: [{ id: 'commit:1', kind: 'commit', label: 'Commit 1', commitSha: '1' }],
  },
  engineer: {
    audience: 'engineer',
    headline: 'Engineer headline',
    bullets: ['Engineer bullet one', 'Engineer bullet two'],
    risks: [],
    evidenceLinks: [{ id: 'commit:1', kind: 'commit', label: 'Commit 1', commitSha: '1' }],
  },
};

const healthyNarrative: BranchNarrative = {
  schemaVersion: 1,
  generatedAtISO: '2026-02-18T00:00:00.000Z',
  state: 'ready',
  summary: 'Healthy summary',
  confidence: 0.74,
  highlights: [],
  evidenceLinks: [
    { id: 'commit:1', kind: 'commit', label: 'Commit 1', commitSha: '1' },
    { id: 'commit:2', kind: 'commit', label: 'Commit 2', commitSha: '2' },
    { id: 'session:s1', kind: 'session', label: 'Session s1', sessionId: 's1' },
  ],
};

const disabledConnector: GitHubContextState = {
  status: 'disabled',
  entries: [],
};

const baselineObservability: NarrativeObservabilityMetrics = {
  layerSwitchedCount: 2,
  evidenceOpenedCount: 3,
  fallbackUsedCount: 0,
  killSwitchTriggeredCount: 0,
};

describe('evaluateNarrativeRollout', () => {
  it('returns healthy status for good quality signals', () => {
    const report = evaluateNarrativeRollout({
      narrative: healthyNarrative,
      projections,
      githubContextState: disabledConnector,
      observability: baselineObservability,
    });

    expect(report.status).toBe('healthy');
    expect(report.averageScore).toBeGreaterThan(0.6);
    expect(report.rules.some((rule) => rule.triggered)).toBe(false);
  });

  it('returns rollback when critical kill-switch rule triggers', () => {
    const report = evaluateNarrativeRollout({
      narrative: {
        ...healthyNarrative,
        state: 'failed',
        confidence: 0.3,
        evidenceLinks: [{ id: 'commit:1', kind: 'commit', label: 'Commit 1', commitSha: '1' }],
      },
      projections,
      githubContextState: disabledConnector,
      observability: baselineObservability,
    });

    expect(report.status).toBe('rollback');
    expect(report.rules.some((rule) => rule.id === 'narrative_failed' && rule.triggered)).toBe(true);
  });

  it('returns rollback when rubric fails even without a critical rule', () => {
    const report = evaluateNarrativeRollout({
      narrative: {
        ...healthyNarrative,
        confidence: 0.75,
      },
      projections: {
        executive: {
          ...projections.executive,
          headline: '',
          bullets: [],
          evidenceLinks: [],
        },
        manager: {
          ...projections.manager,
          headline: '',
          bullets: [],
          evidenceLinks: [],
        },
        engineer: {
          ...projections.engineer,
          headline: '',
          bullets: [],
          evidenceLinks: [],
        },
      },
      githubContextState: disabledConnector,
      observability: baselineObservability,
    });

    expect(report.rules.some((rule) => rule.triggered && rule.severity === 'critical')).toBe(false);
    expect(report.rubric.some((metric) => metric.status === 'fail')).toBe(true);
    expect(report.status).toBe('rollback');
  });

  it('returns watch on partial connector ingestion', () => {
    const report = evaluateNarrativeRollout({
      narrative: healthyNarrative,
      projections,
      githubContextState: {
        status: 'partial',
        entries: [{ id: 'pr-1', title: 'PR 1', redactionHits: 0 }],
        failedFileCount: 1,
        error: 'Loaded with 1 connector file error.',
      },
      observability: baselineObservability,
    });

    expect(report.status).toBe('watch');
    expect(report.rules.some((rule) => rule.id === 'connector_error' && rule.triggered)).toBe(true);
  });

  it('preserves v1 rollout thresholds while calibration is introduced elsewhere', () => {
    const report = evaluateNarrativeRollout({
      narrative: healthyNarrative,
      projections,
      githubContextState: disabledConnector,
      observability: baselineObservability,
    });

    const confidenceMetric = report.rubric.find((metric) => metric.id === 'confidence');
    const fallbackMetric = report.rubric.find((metric) => metric.id === 'fallback_health');

    expect(confidenceMetric?.threshold).toBe(0.65);
    expect(fallbackMetric?.threshold).toBe(0.6);
  });
});
