export type NarrativeTelemetrySchemaVersion = 'v1';

export type NarrativeTelemetryEventName =
  | 'narrative_viewed'
  | 'layer_switched'
  | 'audience_switched'
  | 'evidence_opened'
  | 'fallback_used'
  | 'feedback_submitted'
  | 'rollout_scored'
  | 'kill_switch_triggered'
  | 'ui.quality.render_decision';

export type NarrativeHeaderKind = 'hidden' | 'shell' | 'full';
export type NarrativeRepoStatus = 'idle' | 'loading' | 'ready' | 'error';
export type NarrativeTransitionType = 'initial' | 'state_change';

export type HeaderQualityReasonCode =
  | 'mode_unsupported'
  | 'repo_idle'
  | 'model_missing'
  | 'feature_disabled'
  | 'loading'
  | 'error'
  | 'ready'
  | 'unknown';

export type NarrativeTelemetryPayload = {
  schemaVersion?: NarrativeTelemetrySchemaVersion;
  branch?: string;
  viewInstanceId?: string;
  source?: 'demo' | 'git';
  detailLevel?: 'summary' | 'evidence' | 'diff';
  audience?: 'executive' | 'manager' | 'engineer';
  evidenceKind?: 'commit' | 'session' | 'file' | 'diff';
  confidence?: number;
  rolloutStatus?: 'healthy' | 'watch' | 'rollback';
  score?: number;
  reason?: string;
  reasonCode?: HeaderQualityReasonCode;
  headerKind?: NarrativeHeaderKind;
  repoStatus?: NarrativeRepoStatus;
  transition?: NarrativeTransitionType;
  durationMs?: number;
  budgetMs?: number;
  overBudget?: boolean;
  feedbackType?: 'highlight_key' | 'highlight_wrong' | 'branch_missing_decision';
  feedbackTargetKind?: 'highlight' | 'branch';
  feedbackActorRole?: 'developer' | 'reviewer';
};

export type NarrativeRenderDecisionInput = {
  branch?: string;
  source: 'demo' | 'git';
  headerKind: NarrativeHeaderKind;
  repoStatus: NarrativeRepoStatus;
  transition: NarrativeTransitionType;
  reasonCode: HeaderQualityReasonCode;
  durationMs: number;
  budgetMs: number;
};

function sanitizeMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1000) / 1000;
}

export function trackNarrativeEvent(
  event: NarrativeTelemetryEventName,
  payload: NarrativeTelemetryPayload = {}
) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('narrative:telemetry', {
      detail: {
        schemaVersion: 'v1' as NarrativeTelemetrySchemaVersion,
        event,
        payload,
        atISO: new Date().toISOString(),
      },
    })
  );
}

export function trackQualityRenderDecision(input: NarrativeRenderDecisionInput) {
  const durationMs = sanitizeMs(input.durationMs);
  const budgetMs = sanitizeMs(input.budgetMs);

  trackNarrativeEvent('ui.quality.render_decision', {
    schemaVersion: 'v1',
    branch: input.branch,
    source: input.source,
    headerKind: input.headerKind,
    repoStatus: input.repoStatus,
    transition: input.transition,
    reasonCode: input.reasonCode,
    durationMs,
    budgetMs,
    overBudget: durationMs > budgetMs,
  });
}
