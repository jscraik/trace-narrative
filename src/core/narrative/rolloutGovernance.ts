import type {
  BranchNarrative,
  GitHubContextState,
  NarrativeObservabilityMetrics,
  NarrativeRolloutReport,
  NarrativeRubricMetric,
  StakeholderProjections,
} from '../types';
import { evaluatePromptGovernance } from './promptGovernance';

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function toMetric(args: {
  id: NarrativeRubricMetric['id'];
  label: string;
  score: number;
  threshold: number;
  rationale: string;
}): NarrativeRubricMetric {
  const score = roundScore(args.score);
  const threshold = roundScore(args.threshold);
  const gap = score - threshold;

  let status: NarrativeRubricMetric['status'] = 'pass';
  if (gap < -0.2) status = 'fail';
  else if (gap < 0) status = 'warn';

  return {
    id: args.id,
    label: args.label,
    score,
    threshold,
    status,
    rationale: args.rationale,
  };
}

export function evaluateNarrativeRollout(args: {
  narrative: BranchNarrative;
  projections: StakeholderProjections;
  githubContextState: GitHubContextState;
  observability: NarrativeObservabilityMetrics;
}): NarrativeRolloutReport {
  const { narrative, projections, githubContextState, observability } = args;
  const promptGovernance = evaluatePromptGovernance(narrative);

  const confidenceMetric = toMetric({
    id: 'confidence',
    label: 'Confidence calibration',
    score: narrative.confidence,
    threshold: 0.65,
    rationale:
      narrative.state === 'needs_attention'
        ? 'Narrative flagged for attention; confidence must improve before broad rollout.'
        : 'Narrative confidence should remain above baseline for progressive disclosure.',
  });

  const evidenceCoverageScore = Math.min(1, narrative.evidenceLinks.length / 4);
  const evidenceCoverageMetric = toMetric({
    id: 'evidence_coverage',
    label: 'Evidence coverage',
    score: evidenceCoverageScore,
    threshold: 0.7,
    rationale: `${narrative.evidenceLinks.length} evidence links detected for current branch summary.`,
  });

  const projectionCompletenessScore = (['executive', 'manager', 'engineer'] as const).reduce(
    (score, key) => {
      const projection = projections[key];
      if (!projection) return score;
      const hasHeadline = projection.headline.trim().length > 0;
      const hasBullets = projection.bullets.length >= 2;
      const hasEvidence = projection.evidenceLinks.length > 0;
      return score + (hasHeadline ? 1 / 9 : 0) + (hasBullets ? 1 / 9 : 0) + (hasEvidence ? 1 / 9 : 0);
    },
    0
  );
  const projectionMetric = toMetric({
    id: 'projection_completeness',
    label: 'Stakeholder projection completeness',
    score: projectionCompletenessScore,
    threshold: 0.7,
    rationale: 'Executive/Manager/Engineer projections should each include headline, bullets, and evidence links.',
  });

  const fallbackAttempts = observability.fallbackUsedCount;
  const interactionCount = Math.max(
    1,
    observability.layerSwitchedCount + observability.evidenceOpenedCount + fallbackAttempts
  );
  const fallbackRatio = fallbackAttempts / interactionCount;
  const fallbackMetric = toMetric({
    id: 'fallback_health',
    label: 'Fallback health',
    score: 1 - fallbackRatio,
    threshold: 0.6,
    rationale: `Fallback ratio ${Math.round(fallbackRatio * 100)}% across ${interactionCount} observed interactions.`,
  });

  const connectorMetric = toMetric({
    id: 'connector_safety',
    label: 'Connector safety',
    score:
      githubContextState.status === 'error'
        ? 0.2
        : githubContextState.status === 'partial'
          ? 0.55
          : 1,
    threshold: 0.7,
    rationale:
      githubContextState.status === 'error'
        ? githubContextState.error ?? 'GitHub connector reported an ingestion error.'
        : githubContextState.status === 'partial'
          ? githubContextState.error ?? 'GitHub connector loaded partially with recoverable errors.'
        : 'Connector status healthy or disabled with no ingestion errors.',
  });

  const rubric = [
    confidenceMetric,
    evidenceCoverageMetric,
    projectionMetric,
    fallbackMetric,
    connectorMetric,
  ];

  const rules = [
    {
      id: 'narrative_failed',
      label: 'Narrative state failed',
      severity: 'critical' as const,
      triggered: narrative.state === 'failed',
      rationale: 'Failed narrative synthesis must force raw-diff fallback.',
    },
    {
      id: 'low_confidence_sparse_evidence',
      label: 'Low confidence + sparse evidence',
      severity: 'critical' as const,
      triggered: narrative.confidence < 0.45 && narrative.evidenceLinks.length < 2,
      rationale: 'Low-confidence summaries without enough evidence are unsafe to present as primary output.',
    },
    {
      id: 'connector_error',
      label: 'Connector ingest error',
      severity: 'warning' as const,
      triggered: githubContextState.status === 'error' || githubContextState.status === 'partial',
      rationale: 'Connector errors should degrade confidence and be reviewed before rollout expansion.',
    },
    {
      id: 'fallback_ratio_spike',
      label: 'Fallback ratio spike',
      severity: 'warning' as const,
      triggered: fallbackRatio > 0.4 && interactionCount >= 5,
      rationale: 'Frequent fallback usage indicates narrative trust erosion.',
    },
    {
      id: 'prompt_template_unversioned',
      label: 'Prompt template metadata missing',
      severity: 'warning' as const,
      triggered: !promptGovernance.isTemplateVersioned,
      rationale:
        'Narrative payloads should include prompt template id/version metadata for governance traceability.',
    },
    {
      id: 'prompt_injection_signal',
      label: 'Adversarial prompt-injection signal',
      severity: 'critical' as const,
      triggered: promptGovernance.adversarialMatches.length > 0,
      rationale:
        promptGovernance.adversarialMatches.length > 0
          ? `Detected adversarial markers: ${promptGovernance.adversarialMatches.join(', ')}.`
          : 'No adversarial prompt markers detected in narrative output.',
    },
  ];

  const averageScore = roundScore(
    rubric.reduce((sum, metric) => sum + metric.score, 0) / Math.max(1, rubric.length)
  );
  const hasCritical = rules.some((rule) => rule.triggered && rule.severity === 'critical');
  const hasWarning = rules.some((rule) => rule.triggered && rule.severity === 'warning');
  const hasRubricFail = rubric.some((metric) => metric.status === 'fail');
  const hasRubricWarn = rubric.some((metric) => metric.status === 'warn');

  return {
    status: hasCritical || hasRubricFail ? 'rollback' : hasWarning || hasRubricWarn ? 'watch' : 'healthy',
    rubric,
    rules,
    averageScore,
    generatedAtISO: new Date().toISOString(),
  };
}
