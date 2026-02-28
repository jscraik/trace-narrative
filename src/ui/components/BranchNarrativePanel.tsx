import type {
  BranchNarrative,
  NarrativeConfidenceTier,
  NarrativeEvidenceLink,
  NarrativeFeedbackAction,
  NarrativeFeedbackActorRole,
  NarrativeDetailLevel,
  NarrativeRecallLaneItem,
  StakeholderAudience,
  StakeholderProjection,
  StakeholderProjections,
} from '../../core/types';

type RecallLaneEvidenceContext = {
  source?: 'recall_lane';
  recallLaneItemId?: string;
  recallLaneConfidenceBand?: NarrativeConfidenceTier;
};

type OpenEvidenceHandler = (link: NarrativeEvidenceLink, context?: RecallLaneEvidenceContext) => void;

type BranchNarrativePanelProps = {
  narrative: BranchNarrative;
  projections: StakeholderProjections;
  audience: StakeholderAudience;
  detailLevel: NarrativeDetailLevel;
  feedbackActorRole: NarrativeFeedbackActorRole;
  killSwitchActive?: boolean;
  killSwitchReason?: string;
  recallLaneItems?: NarrativeRecallLaneItem[];
  onAudienceChange: (audience: StakeholderAudience) => void;
  onFeedbackActorRoleChange: (role: NarrativeFeedbackActorRole) => void;
  onDetailLevelChange: (level: NarrativeDetailLevel) => void;
  onSubmitFeedback: (feedback: NarrativeFeedbackAction) => void;
  onOpenEvidence: OpenEvidenceHandler;
  onOpenRawDiff: (laneContext?: RecallLaneEvidenceContext) => void;
};

function DetailButton(props: {
  level: NarrativeDetailLevel;
  current: NarrativeDetailLevel;
  label: string;
  disabled?: boolean;
  onClick: (level: NarrativeDetailLevel) => void;
}) {
  const { level, current, label, disabled = false, onClick } = props;
  const active = current === level;

  return (
    <button
      type="button"
      onClick={() => onClick(level)}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
        active
          ? 'border-accent-blue-light bg-accent-blue-bg text-accent-blue'
          : 'border-border-subtle bg-bg-primary text-text-secondary hover:border-border-light hover:bg-bg-secondary'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function confidenceTierStyle(tier: NarrativeRecallLaneItem['confidenceTier']): string {
  if (tier === 'high') return 'text-accent-green';
  if (tier === 'medium') return 'text-accent-amber';
  return 'text-text-muted';
}

function projectionFallback(audience: StakeholderAudience, narrative: BranchNarrative): StakeholderProjection {
  return {
    audience,
    headline: 'Narrative projection pending.',
    bullets: [narrative.summary],
    risks: [],
    evidenceLinks: narrative.evidenceLinks,
  };
}

export function BranchNarrativePanel(props: BranchNarrativePanelProps) {
  const {
    narrative,
    projections,
    audience,
    detailLevel,
    feedbackActorRole,
    killSwitchActive = false,
    killSwitchReason,
    recallLaneItems = [],
    onAudienceChange,
    onFeedbackActorRoleChange,
    onDetailLevelChange,
    onSubmitFeedback,
    onOpenEvidence,
    onOpenRawDiff,
  } = props;
  const projection = projections[audience] ?? projectionFallback(audience, narrative);
  const effectiveDetailLevel: NarrativeDetailLevel = killSwitchActive ? 'diff' : detailLevel;

  const handleRecallLaneOpen = (item: NarrativeRecallLaneItem) => {
    if (killSwitchActive) {
      onOpenRawDiff({
        source: 'recall_lane',
        recallLaneItemId: item.id,
        recallLaneConfidenceBand: item.confidenceTier,
      });
      return;
    }

    const firstEvidence = item.evidenceLinks[0];
    if (firstEvidence) {
      onOpenEvidence(firstEvidence, {
        source: 'recall_lane',
        recallLaneItemId: item.id,
        recallLaneConfidenceBand: item.confidenceTier,
      });
      return;
    }

    onOpenRawDiff({
      source: 'recall_lane',
      recallLaneItemId: item.id,
      recallLaneConfidenceBand: item.confidenceTier,
    });
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="section-header">NARRATIVE</div>
          <div className="section-subheader mt-0.5">
            confidence {(narrative.confidence * 100).toFixed(0)}% · state {narrative.state}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DetailButton
            level="summary"
            current={effectiveDetailLevel}
            label="Summary"
            disabled={killSwitchActive}
            onClick={onDetailLevelChange}
          />
          <DetailButton
            level="evidence"
            current={effectiveDetailLevel}
            label="Evidence"
            disabled={killSwitchActive}
            onClick={onDetailLevelChange}
          />
          <DetailButton level="diff" current={effectiveDetailLevel} label="Raw Diff" onClick={onDetailLevelChange} />
        </div>
      </div>

      {killSwitchActive && (
        <div className="mt-3 rounded-lg border border-accent-red-light bg-accent-red-bg px-3 py-2 text-xs text-accent-red">
          Kill switch active. Narrative layers are read-only until quality recovers.{' '}
          <span className="text-text-secondary">{killSwitchReason ?? 'Fallback to raw diff is enforced.'}</span>
        </div>
      )}

      {effectiveDetailLevel === 'summary' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-border-subtle bg-bg-primary p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Recall lane</div>
            {recallLaneItems.length === 0 ? (
              <p className="mt-2 text-xs text-text-tertiary" aria-live="polite">
                No ranked actions yet. Open evidence or raw diff to validate this branch manually.
              </p>
            ) : (
              <ol className="mt-2 space-y-2" aria-live="polite">
                {recallLaneItems.map((item) => {
                  const actionLabel = item.evidenceLinks[0] ? 'Open evidence' : 'Open raw diff';
                  return (
                    <li
                      key={item.id}
                      className="rounded-md border border-border-subtle bg-bg-secondary p-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-sm font-medium text-text-primary">{item.title}</span>
                        <span className={`text-[11px] font-medium uppercase ${confidenceTierStyle(item.confidenceTier)}`}>
                          {item.confidenceTier} {(item.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-text-tertiary">{item.whyThisMatters}</p>
                      <button
                        type="button"
                        onClick={() => handleRecallLaneOpen(item)}
                        className="mt-2 rounded-md border border-border-subtle bg-bg-primary px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-border-light hover:bg-bg-secondary"
                      >
                        {actionLabel}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="flex items-center gap-1">
            {(['executive', 'manager', 'engineer'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onAudienceChange(option)}
                disabled={killSwitchActive}
                className={`rounded-md border px-2.5 py-1 text-xs capitalize transition-colors ${
                  audience === option
                    ? 'border-accent-green-light bg-accent-green-bg text-accent-green'
                    : 'border-border-subtle bg-bg-primary text-text-secondary hover:border-border-light hover:bg-bg-secondary'
                }`}
                aria-pressed={audience === option}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(['developer', 'reviewer'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onFeedbackActorRoleChange(role)}
                disabled={killSwitchActive}
                className={`rounded-md border px-2.5 py-1 text-xs capitalize transition-colors ${
                  feedbackActorRole === role
                    ? 'border-accent-blue-light bg-accent-blue-bg text-accent-blue'
                    : 'border-border-subtle bg-bg-primary text-text-secondary hover:border-border-light hover:bg-bg-secondary'
                }`}
                aria-pressed={feedbackActorRole === role}
              >
                {role}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                onSubmitFeedback({
                  actorRole: feedbackActorRole,
                  feedbackType: 'branch_missing_decision',
                  targetKind: 'branch',
                  detailLevel,
                })
              }
              disabled={killSwitchActive}
              className="rounded-md border border-border-subtle bg-bg-primary px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-border-light hover:bg-bg-secondary"
            >
              Missing decision
            </button>
          </div>

          <div className="rounded-lg border border-border-subtle bg-bg-primary p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">{projection.audience}</div>
            <p className="mt-1 text-sm text-text-primary">{projection.headline}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-text-secondary">
              {projection.bullets.slice(0, 3).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>

          <p className="text-sm leading-relaxed text-text-secondary">{narrative.summary}</p>

          <ul className="space-y-2">
            {narrative.highlights.slice(0, 3).map((highlight) => (
              <li key={highlight.id} className="rounded-lg border border-border-subtle bg-bg-primary p-3">
                <div className="text-sm font-medium text-text-primary">{highlight.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-text-tertiary">{highlight.whyThisMatters}</p>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={killSwitchActive}
                    onClick={() =>
                      onSubmitFeedback({
                        actorRole: feedbackActorRole,
                        feedbackType: 'highlight_key',
                        targetKind: 'highlight',
                        targetId: highlight.id,
                        detailLevel,
                      })
                    }
                    className="rounded-md border border-border-subtle bg-bg-primary px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-border-light hover:bg-bg-secondary"
                  >
                    This is key
                  </button>
                  <button
                    type="button"
                    disabled={killSwitchActive}
                    onClick={() =>
                      onSubmitFeedback({
                        actorRole: feedbackActorRole,
                        feedbackType: 'highlight_wrong',
                        targetKind: 'highlight',
                        targetId: highlight.id,
                        detailLevel,
                      })
                    }
                    className="rounded-md border border-border-subtle bg-bg-primary px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-border-light hover:bg-bg-secondary"
                  >
                    Wrong
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {narrative.state === 'needs_attention' && narrative.fallbackReason && (
            <div className="rounded-lg border border-accent-amber-light bg-accent-amber-bg px-3 py-2 text-xs text-accent-amber">
              {narrative.fallbackReason}
            </div>
          )}
        </div>
      )}

      {effectiveDetailLevel === 'evidence' && (
        <div className="mt-4 space-y-3">
          {narrative.evidenceLinks.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-xs text-text-tertiary">
              No linked evidence yet. Use raw diff until more evidence is available.
            </div>
          ) : (
            narrative.evidenceLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => onOpenEvidence(link)}
                className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:border-border-light hover:bg-bg-secondary"
              >
                <span className="font-medium text-text-primary">{link.label}</span>
                <span className="ml-2 uppercase tracking-wide text-text-muted">{link.kind}</span>
              </button>
            ))
          )}
        </div>
      )}

      {effectiveDetailLevel === 'diff' && (
        <div className="mt-4 rounded-lg border border-border-subtle bg-bg-primary p-4">
          <p className="text-sm text-text-secondary">
            Open raw diff to verify narrative claims directly against commit-level evidence.
          </p>
          <button
            type="button"
            onClick={() => onOpenRawDiff()}
            className="mt-3 inline-flex rounded-md border border-border-light bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-primary"
          >
            Open raw diff context
          </button>
        </div>
      )}
    </div>
  );
}
