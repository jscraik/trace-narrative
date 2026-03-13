import clsx from 'clsx';
import {
  GitCommitHorizontal,
  Milestone,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { SurfaceHeader } from '../components/SurfaceHeader';
import { buildNarrativeSurfaceViewModel, type SurfaceAction } from './narrativeSurfaceData';
import { describeSurfaceTrust } from './dashboardState';
import { ProvenanceSection } from './narrativeSurfaceProvenance';
import { AuthorityCue } from './narrativeSurfaceSections';

interface CausalTimelineViewProps {
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  autoIngestEnabled?: boolean;
  onModeChange: (mode: Mode) => void;
  onOpenRepo: () => void;
  onImportSession?: () => void;
  onAction?: (action: SurfaceAction) => void;
}

function getRepoPath(repoState: RepoState): string {
  if (repoState.status === 'ready') return repoState.repo.root;
  if (repoState.status !== 'idle') return repoState.path ?? '~/dev/trace-narrative';
  return '~/dev/trace-narrative';
}

export function CausalTimelineView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onModeChange,
  onOpenRepo,
  onImportSession,
  onAction,
}: CausalTimelineViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('timeline', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);
  const trustDescriptor = describeSurfaceTrust(captureReliabilityStatus);
  const nextMode = trustDescriptor.trustState === 'healthy' ? 'repo' : 'status';
  const nextLabel = trustDescriptor.trustState === 'healthy' ? 'Inspect repo evidence' : 'Inspect trust center';
  const NextIcon = trustDescriptor.trustState === 'healthy' ? ShieldCheck : ShieldAlert;
  const timelineNodes = repoState.status === 'ready' ? repoState.model.timeline : [];
  const sessionExcerpts = repoState.status === 'ready' ? repoState.model.sessionExcerpts ?? [] : [];
  const linkedSessionCount = sessionExcerpts.filter((session) => Boolean(session.linkedCommitSha)).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <SurfaceHeader
        title={viewModel.title}
        category="Evidence"
        repoPath={repoPath}
        trustState={viewModel.trustState}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
      >
        <button
          type="button"
          onClick={() => onModeChange(nextMode)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:brightness-110 active:scale-[0.98]"
        >
          <NextIcon className="h-3.5 w-3.5" />
          {nextLabel}
        </button>
      </SurfaceHeader>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-[100rem] flex-col gap-5">
          <div className="mb-1">
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">{viewModel.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary max-w-3xl">
              Causal Timeline earns its place when the chronology dominates the page and the review gates sit alongside it instead of competing with it.
            </p>
          </div>
          <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <article
              className="rounded-[1.6rem] border border-border-subtle bg-bg-secondary/80 p-4"
              data-authority-tier={viewModel.heroAuthorityTier}
              data-authority-label={viewModel.heroAuthorityLabel}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Timeline spine</p>
                  <h2 className="mt-1 text-lg font-semibold text-text-primary">Ordered commit and milestone sequence</h2>
                </div>
                <AuthorityCue authorityTier={viewModel.heroAuthorityTier} authorityLabel={viewModel.heroAuthorityLabel} />
              </div>

              <div className="mt-4 space-y-0">
                {timelineNodes.length > 0 ? (
                  timelineNodes.map((node, index) => {
                    const linkedSessionsForNode = sessionExcerpts.filter((session) => session.linkedCommitSha === node.id).length;
                    const stateTone = linkedSessionsForNode > 0 ? 'green' : index === timelineNodes.length - 1 ? 'blue' : 'amber';
                    return (
                      <article
                        key={node.id}
                        className="relative pl-7"
                        data-authority-tier={viewModel.heroAuthorityTier}
                        data-authority-label={viewModel.heroAuthorityLabel}
                      >
                        {index < timelineNodes.length - 1 ? (
                          <div className="absolute left-[0.75rem] top-7 h-[calc(100%-0.75rem)] w-px bg-border-light" aria-hidden="true" />
                        ) : null}
                        <div className="absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-border-light bg-bg-primary">
                          {node.type === 'milestone' ? (
                            <Milestone className="h-3.5 w-3.5 text-accent-violet" />
                          ) : (
                            <GitCommitHorizontal className="h-3.5 w-3.5 text-accent-blue" />
                          )}
                        </div>
                        <div className="rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Step {index + 1}</p>
                                <span className={clsx('inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]', {
                                  'border-accent-green-light bg-accent-green-bg text-accent-green': stateTone === 'green',
                                  'border-accent-blue-light bg-accent-blue/10 text-accent-blue': stateTone === 'blue',
                                  'border-accent-amber-light bg-accent-amber-bg text-accent-amber': stateTone === 'amber',
                                })}>
                                  {linkedSessionsForNode > 0 ? 'joined' : 'review'}
                                </span>
                              </div>
                              <p className="mt-1.5 text-sm font-semibold text-text-primary">{node.label ?? node.id.slice(0, 7)}</p>
                              <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                                {linkedSessionsForNode > 0
                                  ? `${linkedSessionsForNode} linked session join${linkedSessionsForNode === 1 ? '' : 's'} already support this step.`
                                  : node.type === 'milestone'
                                    ? 'Milestone boundary in the branch story that still needs supporting evidence or checkpoint context.'
                                    : 'This commit still needs stronger causal context from sessions, evidence links, or trust review.'}
                              </p>
                            </div>
                            <AuthorityCue authorityTier={viewModel.heroAuthorityTier} authorityLabel={viewModel.heroAuthorityLabel} />
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <article className="rounded-[1.25rem] border border-dashed border-border-light bg-bg-primary/70 p-4 text-sm text-text-secondary">
                    Timeline evidence has not been indexed yet. Import sessions or open the repo to build the first causal spine.
                  </article>
                )}
              </div>
            </article>

            <div className="grid gap-5">
              <article className="rounded-[1.6rem] border border-border-subtle bg-bg-secondary/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Review gates</p>
                    <h2 className="mt-1 text-lg font-semibold text-text-primary">What makes the sequence safe to repeat</h2>
                  </div>
                  <Waypoints className="h-4 w-4 text-text-muted" />
                </div>
                <div className="mt-3 space-y-2.5">
                  {viewModel.highlights.map((highlight) => (
                    <button
                      key={highlight.title}
                      type="button"
                      onClick={() => highlight.action && onAction?.(highlight.action)}
                      className="w-full rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-accent-blue-light hover:bg-bg-primary"
                      data-authority-tier={highlight.authorityTier}
                      data-authority-label={highlight.authorityLabel}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{highlight.eyebrow}</p>
                          <p className="mt-2 text-sm font-semibold text-text-primary">{highlight.title}</p>
                        </div>
                        <AuthorityCue authorityTier={highlight.authorityTier} authorityLabel={highlight.authorityLabel} />
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-text-secondary">{highlight.body}</p>
                    </button>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.6rem] border border-border-subtle bg-bg-secondary/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Confidence ledger</p>
                    <h2 className="mt-1 text-lg font-semibold text-text-primary">Session joins and trust posture</h2>
                  </div>
                  <AuthorityCue authorityTier={viewModel.metrics[0]?.authorityTier ?? viewModel.heroAuthorityTier} authorityLabel={viewModel.metrics[0]?.authorityLabel ?? viewModel.heroAuthorityLabel} />
                </div>
                <div className="mt-3 grid gap-2.5">
                  {viewModel.metrics.slice(0, 3).map((metric) => (
                    <article
                      key={metric.label}
                      className="rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5"
                      data-authority-tier={metric.authorityTier}
                      data-authority-label={metric.authorityLabel}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{metric.label}</p>
                          <p className="mt-1.5 text-base font-semibold text-text-primary">{metric.value}</p>
                        </div>
                        <AuthorityCue authorityTier={metric.authorityTier} authorityLabel={metric.authorityLabel} />
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-text-secondary">{metric.detail}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-3 rounded-[1.1rem] border border-border-light bg-bg-primary/70 p-3.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <ShieldCheck className={`h-4 w-4 ${linkedSessionCount > 0 ? 'text-accent-green' : 'text-accent-amber'}`} />
                    Linked sessions in this lane
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                    {linkedSessionCount > 0
                      ? `${linkedSessionCount} session join${linkedSessionCount === 1 ? '' : 's'} already support the visible sequence.`
                      : 'No session joins are attached yet, so chronology alone is not enough to explain why these changes happened.'}
                  </p>
                </div>
              </article>
            </div>
          </section>

          {viewModel.provenance ? <ProvenanceSection provenance={viewModel.provenance} onAction={onAction} /> : null}
        </div>
      </main>
    </div>
  );
}
