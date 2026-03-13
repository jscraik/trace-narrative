import clsx from 'clsx';
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { DashboardTrustBadge } from '../components/dashboard/DashboardTrustBadge';
import {
  buildNarrativeSurfaceViewModel,
  type SurfaceAction,
} from './narrativeSurfaceData';
import { describeSurfaceTrust } from './dashboardState';
import { AuthorityCue, MetricCard } from './narrativeSurfaceSections';

interface LiveCaptureViewProps {
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  autoIngestEnabled?: boolean;
  onModeChange: (mode: Mode) => void;
  onOpenRepo: () => void;
  onImportSession?: () => void;
  onAction?: (action: SurfaceAction) => void;
}

const toneClasses = {
  blue: 'border-accent-blue-light bg-accent-blue/10 text-accent-blue',
  violet: 'border-accent-violet-light bg-accent-violet/10 text-accent-violet',
  green: 'border-accent-green-light bg-accent-green-bg text-accent-green',
  amber: 'border-accent-amber-light bg-accent-amber-bg text-accent-amber',
  red: 'border-accent-red-light bg-accent-red-bg text-accent-red',
  slate: 'border-border-light bg-bg-primary text-text-secondary',
} as const;

const activityStatusClasses = {
  ok: 'border-accent-green-light bg-accent-green-bg text-accent-green',
  warn: 'border-accent-amber-light bg-accent-amber-bg text-accent-amber',
  critical: 'border-accent-red-light bg-accent-red-bg text-accent-red',
  info: 'border-accent-blue-light bg-accent-blue/10 text-accent-blue',
} as const;

function getRepoPath(repoState: RepoState): string {
  if (repoState.status === 'ready') return repoState.repo.root;
  if (repoState.status !== 'idle') return repoState.path ?? '~/dev/trace-narrative';
  return '~/dev/trace-narrative';
}

export function LiveCaptureView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onModeChange,
  onOpenRepo,
  onImportSession,
  onAction,
}: LiveCaptureViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('live', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);
  const trustDescriptor = describeSurfaceTrust(captureReliabilityStatus);
  const captureModeMetric = viewModel.metrics.find((metric) => metric.label === 'Capture mode') ?? viewModel.metrics[0];
  const activeSessionsMetric = viewModel.metrics.find((metric) => metric.label === 'Active sessions') ?? viewModel.metrics[0];
  const nextMode = trustDescriptor.trustState === 'healthy' ? 'repo' : 'status';
  const nextLabel = trustDescriptor.trustState === 'healthy' ? 'Inspect repo evidence' : 'Inspect trust center';
  const NextIcon = trustDescriptor.trustState === 'healthy' ? ShieldCheck : ShieldAlert;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className="border-b border-border-subtle bg-bg-secondary/90 px-6 py-5 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Evidence
                </span>
                <DashboardTrustBadge trustState={viewModel.trustState} />
                <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1 text-xs text-text-secondary">
                  <Clock3 className="h-3.5 w-3.5" />
                  {repoPath}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-text-primary">{viewModel.title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{viewModel.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onImportSession}
                className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
              >
                <ArrowUpRight className="h-4 w-4" />
                Import session
              </button>
              <button
                type="button"
                onClick={() => onModeChange(nextMode)}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-110"
              >
                <NextIcon className="h-4 w-4" />
                {nextLabel}
              </button>
              <button
                type="button"
                onClick={onOpenRepo}
                className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
              >
                Open repo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-border-subtle bg-bg-primary/70 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-secondary px-3 py-1 text-xs font-medium text-text-secondary">
                  <RadioTower className="h-3.5 w-3.5 text-accent-green" />
                  Live capture surface
                </span>
                <div
                  data-authority-tier={viewModel.heroAuthorityTier}
                  data-authority-label={viewModel.heroAuthorityLabel}
                >
                  <AuthorityCue
                    authorityTier={viewModel.heroAuthorityTier}
                    authorityLabel={viewModel.heroAuthorityLabel}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">{viewModel.heroTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{viewModel.heroBody}</p>
                </div>
              </div>

              <div
                className="rounded-2xl border border-border-light bg-bg-secondary/80 px-4 py-3 text-sm text-text-secondary"
                data-authority-tier={captureModeMetric.authorityTier}
                data-authority-label={captureModeMetric.authorityLabel}
              >
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Operator rule
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <AuthorityCue
                    authorityTier={captureModeMetric.authorityTier}
                    authorityLabel={captureModeMetric.authorityLabel}
                  />
                  <span
                    className={clsx(
                      'inline-flex rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]',
                      toneClasses[captureModeMetric.tone],
                    )}
                  >
                    {captureModeMetric.value}
                  </span>
                </div>
                <p className="mt-3 max-w-[20rem] leading-6">
                  This screen should help us notice stream drift while work is still in motion, then route into Trust
                  Center or Repo Evidence before assumptions harden into false certainty.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {viewModel.metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <article
              className="rounded-3xl border border-border-subtle bg-bg-secondary/80 p-5"
              data-authority-tier={activeSessionsMetric.authorityTier}
              data-authority-label={activeSessionsMetric.authorityLabel}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {viewModel.activityTitle}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">Current stream</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                    Recent capture signals should read like an operator tape, not a decorative activity feed.
                  </p>
                </div>
                <AuthorityCue
                  authorityTier={activeSessionsMetric.authorityTier}
                  authorityLabel={activeSessionsMetric.authorityLabel}
                />
              </div>

              <div className="mt-5 space-y-3">
                {viewModel.activity.map((item, _index) => (
                  <article
                    key={`${item.title}-${item.meta}`}
                    className="rounded-2xl border border-border-light bg-bg-primary/80 p-4"
                    data-authority-tier={item.authorityTier}
                    data-authority-label={item.authorityLabel}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              'h-2 w-2 rounded-full',
                              item.status === 'ok'
                                ? 'bg-accent-green'
                                : item.status === 'warn'
                                  ? 'bg-accent-amber'
                                  : item.status === 'critical'
                                    ? 'bg-accent-red'
                                    : 'bg-accent-blue',
                            )}
                          />
                          <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{item.meta}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <AuthorityCue authorityTier={item.authorityTier} authorityLabel={item.authorityLabel} />
                        <span
                          className={clsx(
                            'inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]',
                            activityStatusClasses[item.status],
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text-secondary">{item.detail}</p>
                    {item.action ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!onAction || !item.action) return;
                          onAction(item.action);
                        }}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
                      >
                        Follow signal
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </article>

            <article
              className="rounded-3xl border border-border-subtle bg-bg-secondary/80 p-5"
              data-authority-tier={captureModeMetric.authorityTier}
              data-authority-label={captureModeMetric.authorityLabel}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {viewModel.highlightsTitle}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">Live monitors</h2>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    These are the three checks that should keep the live surface honest.
                  </p>
                </div>
                <AuthorityCue
                  authorityTier={captureModeMetric.authorityTier}
                  authorityLabel={captureModeMetric.authorityLabel}
                />
              </div>

              <div className="mt-5 space-y-3">
                {viewModel.highlights.map((highlight) => (
                  <article
                    key={highlight.title}
                    className={clsx('rounded-2xl border p-4', toneClasses[highlight.tone])}
                    data-authority-tier={highlight.authorityTier}
                    data-authority-label={highlight.authorityLabel}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] opacity-80">
                          {highlight.eyebrow}
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-text-primary">{highlight.title}</h3>
                      </div>
                      <AuthorityCue authorityTier={highlight.authorityTier} authorityLabel={highlight.authorityLabel} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{highlight.body}</p>
                    {highlight.action ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!onAction || !highlight.action) return;
                          onAction(highlight.action);
                        }}
                        className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"
                      >
                        Open evidence
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <article
              className="rounded-3xl border border-border-subtle bg-bg-secondary/80 p-5"
              data-authority-tier={captureModeMetric.authorityTier}
              data-authority-label={captureModeMetric.authorityLabel}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Capture posture</p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">Trust and intervention</h2>
                </div>
                <AuthorityCue
                  authorityTier={captureModeMetric.authorityTier}
                  authorityLabel={captureModeMetric.authorityLabel}
                />
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-border-light bg-bg-primary/80 p-4">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Reliability state
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">{trustDescriptor.trustLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Mode: {trustDescriptor.reliabilityMode}. Treat live output as guidance until the supporting lane is
                    checked.
                  </p>
                </div>

                <div className="rounded-2xl border border-border-light bg-bg-primary/80 p-4">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Import lane
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">
                    {autoIngestEnabled ? 'Auto-ingest active' : 'Manual import only'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {autoIngestEnabled
                      ? 'The shell should expect fresh capture updates and call out gaps quickly.'
                      : 'The operator must explicitly import sessions before trusting recency or completeness.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-border-light bg-bg-primary/80 p-4">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Recommended next lane
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">
                    {trustDescriptor.trustState === 'healthy' ? 'Repo Evidence' : 'Trust Center'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {trustDescriptor.trustState === 'healthy'
                      ? 'The stream looks stable enough to confirm the narrative against repo-level evidence.'
                      : 'Resolve degraded capture conditions before treating live signals as settled narrative truth.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onModeChange(nextMode)}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-110"
                >
                  <NextIcon className="h-4 w-4" />
                  {nextLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange('sessions')}
                  className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
                >
                  Review sessions
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </article>

            <article
              className="rounded-3xl border border-border-subtle bg-bg-secondary/80 p-5"
              data-authority-tier={captureModeMetric.authorityTier}
              data-authority-label={captureModeMetric.authorityLabel}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {viewModel.tableTitle}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">Live lanes</h2>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Each lane should answer whether capture is active, stale, or ready for follow-through.
                  </p>
                </div>
                <AuthorityCue
                  authorityTier={captureModeMetric.authorityTier}
                  authorityLabel={captureModeMetric.authorityLabel}
                />
              </div>

              <div className="mt-5 space-y-3">
                {viewModel.tableRows.map((row) => {
                  const laneTone =
                    row.secondary.toLowerCase().includes('active') || row.secondary.toLowerCase().includes('watch')
                      ? 'green'
                      : row.secondary.toLowerCase().includes('degraded') || row.secondary.toLowerCase().includes('stale')
                        ? 'amber'
                        : 'blue';

                  return (
                    <article
                      key={`${row.primary}-${row.secondary}`}
                      className="rounded-2xl border border-border-light bg-bg-primary/80 p-4"
                      data-authority-tier={row.authorityTier}
                      data-authority-label={row.authorityLabel}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-text-primary">{row.primary}</p>
                          <p className="mt-2 text-sm leading-6 text-text-secondary">{row.tertiary}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <AuthorityCue authorityTier={row.authorityTier} authorityLabel={row.authorityLabel} />
                          <span
                            className={clsx(
                              'inline-flex rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]',
                              toneClasses[laneTone],
                            )}
                          >
                            {row.secondary}
                          </span>
                        </div>
                      </div>
                      {row.action ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!onAction || !row.action) return;
                            onAction(row.action);
                          }}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
                        >
                          Open lane
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </article>
          </section>

          <section className="rounded-3xl border border-border-subtle bg-bg-secondary px-5 py-4">
            <p className="text-sm leading-6 text-text-secondary">{viewModel.footerNote}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
