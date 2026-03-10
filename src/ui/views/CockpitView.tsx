import clsx from 'clsx';
import { ArrowRight, ArrowUpRight, Clock3, Search, Sparkles } from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { DashboardTrustBadge } from '../components/dashboard/DashboardTrustBadge';
import {
  buildCockpitViewModel,
  type CockpitAuthorityCue,
  type CockpitMetric,
  type CockpitMode,
  type CockpitTone,
} from './cockpitViewData';

interface CockpitViewProps {
  mode: CockpitMode;
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  onModeChange: (mode: Mode) => void;
  onOpenRepo: () => void;
  onImportSession?: () => void;
}

const toneClasses: Record<CockpitTone, { border: string; bg: string; text: string; dot: string }> = {
  blue: {
    border: 'border-accent-blue-light',
    bg: 'bg-accent-blue/10',
    text: 'text-accent-blue',
    dot: 'bg-accent-blue',
  },
  violet: {
    border: 'border-accent-violet-light',
    bg: 'bg-accent-violet/10',
    text: 'text-accent-violet',
    dot: 'bg-accent-violet',
  },
  green: {
    border: 'border-accent-green-light',
    bg: 'bg-accent-green-bg',
    text: 'text-accent-green',
    dot: 'bg-accent-green',
  },
  amber: {
    border: 'border-accent-amber-light',
    bg: 'bg-accent-amber-bg',
    text: 'text-accent-amber',
    dot: 'bg-accent-amber',
  },
  red: {
    border: 'border-accent-red-light',
    bg: 'bg-accent-red-bg',
    text: 'text-accent-red',
    dot: 'bg-accent-red',
  },
  slate: {
    border: 'border-border-light',
    bg: 'bg-bg-primary',
    text: 'text-text-secondary',
    dot: 'bg-text-muted',
  },
};

const statusBadgeClasses: Record<'ok' | 'warn' | 'critical' | 'info', string> = {
  ok: 'border-accent-green-light bg-accent-green-bg text-accent-green',
  warn: 'border-accent-amber-light bg-accent-amber-bg text-accent-amber',
  critical: 'border-accent-red-light bg-accent-red-bg text-accent-red',
  info: 'border-accent-blue-light bg-accent-blue/10 text-accent-blue',
};

const authorityCueClassByTier: Record<CockpitAuthorityCue['authorityTier'], string> = {
  live_repo: 'border-accent-blue-light bg-accent-blue/10 text-accent-blue',
  live_capture: 'border-accent-green-light bg-accent-green-bg text-accent-green',
  derived_summary: 'border-accent-violet-light bg-accent-violet/10 text-accent-violet',
  static_scaffold: 'border-border-subtle bg-bg-secondary text-text-muted',
};

function authorityShortLabel(tier?: CockpitAuthorityCue['authorityTier']): string {
  switch (tier) {
    case 'live_repo':
      return 'Repo';
    case 'live_capture':
      return 'Live';
    case 'derived_summary':
      return 'Derived';
    default:
      return 'Preview';
  }
}

function AuthorityCue({ authorityTier, authorityLabel }: CockpitAuthorityCue) {
  const cue = authorityLabel ?? authorityShortLabel(authorityTier);
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]',
        authorityCueClassByTier[authorityTier ?? 'static_scaffold'],
      )}
      data-authority-short-label={authorityShortLabel(authorityTier)}
    >
      {cue}
    </span>
  );
}

function MetricCard({ metric }: { metric: CockpitMetric & CockpitAuthorityCue }) {
  const tone = toneClasses[metric.tone];

  return (
    <article
      className="glass-panel rounded-2xl p-5"
      data-authority-tier={metric.authorityTier}
      data-authority-label={metric.authorityLabel}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={clsx('h-2 w-2 rounded-full', tone.dot)} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          {metric.label}
        </span>
        <AuthorityCue authorityTier={metric.authorityTier} authorityLabel={metric.authorityLabel} />
      </div>
      <div className={clsx('text-3xl font-semibold tracking-tight', tone.text)}>{metric.value}</div>
      <p className="mt-2 text-sm text-text-secondary">{metric.detail}</p>
    </article>
  );
}

export function CockpitView({
  mode,
  repoState,
  captureReliabilityStatus,
  onModeChange,
  onOpenRepo,
  onImportSession,
}: CockpitViewProps) {
  const viewModel = buildCockpitViewModel(mode, repoState, captureReliabilityStatus);
  const repoPath = repoState.status === 'ready' ? repoState.repo.root : repoState.status !== 'idle' ? repoState.path ?? '~/dev/trace-narrative' : '~/dev/trace-narrative';

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className="border-b border-border-subtle bg-bg-secondary/90 px-6 py-5 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {viewModel.section}
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
                onClick={onOpenRepo}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-110"
              >
                Open repo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="glass-panel rounded-3xl px-5 py-5"
            data-authority-tier={viewModel.heroAuthorityTier}
            data-authority-label={viewModel.heroAuthorityLabel}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1 text-xs font-medium text-text-secondary">
                  <Sparkles className="h-3.5 w-3.5 text-accent-violet" />
                  Updated Trace Narrative cockpit
                </div>
                <AuthorityCue
                  authorityTier={viewModel.heroAuthorityTier}
                  authorityLabel={viewModel.heroAuthorityLabel}
                />
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">{viewModel.heroTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{viewModel.heroBody}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onModeChange('repo')}
                className="inline-flex items-center gap-2 rounded-2xl border border-border-light bg-bg-primary px-4 py-3 text-sm font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
              >
                <Search className="h-4 w-4" />
                Jump into repo evidence
              </button>
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

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="glass-panel rounded-3xl p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {viewModel.highlightsTitle}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-text-primary">What this view should make obvious</h3>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {viewModel.highlights.map((highlight) => {
                  const tone = toneClasses[highlight.tone];
                  return (
                    <article
                      key={highlight.title}
                      className={clsx('rounded-2xl border p-4', tone.border, tone.bg)}
                      data-authority-tier={highlight.authorityTier}
                      data-authority-label={highlight.authorityLabel}
                    >
                      <p className={clsx('text-[11px] font-semibold uppercase tracking-[0.18em]', tone.text)}>
                        {highlight.eyebrow}
                      </p>
                      <AuthorityCue
                        authorityTier={highlight.authorityTier}
                        authorityLabel={highlight.authorityLabel}
                      />
                      <h4 className="mt-3 text-base font-semibold text-text-primary">{highlight.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">{highlight.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                {viewModel.activityTitle}
              </p>
              <div className="mt-4 space-y-3">
                {viewModel.activity.map((item) => (
                  <article
                    key={`${item.title}-${item.meta}`}
                    className="rounded-2xl border border-border-subtle bg-bg-primary/80 p-4"
                      data-authority-tier={item.authorityTier}
                      data-authority-label={item.authorityLabel}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-text-primary">{item.title}</h4>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-muted">{item.meta}</p>
                        </div>
                        <AuthorityCue
                          authorityTier={item.authorityTier}
                          authorityLabel={item.authorityLabel}
                        />
                        <span
                          className={clsx(
                            'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
                            statusBadgeClasses[item.status],
                          )}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text-secondary">{item.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                {viewModel.tableTitle}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-text-primary">Operator-ready summary</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr>
                    {viewModel.tableColumns.map((column) => (
                      <th
                        key={column}
                        className="px-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewModel.tableRows.map((row) => (
                    <tr
                      key={row.primary}
                      className="rounded-2xl bg-bg-primary"
                      data-authority-tier={row.authorityTier}
                      data-authority-label={row.authorityLabel}
                    >
                      <td className="rounded-l-2xl border-y border-l border-border-subtle px-4 py-4 text-sm font-semibold text-text-primary">
                        {row.primary}
                        <div className="mt-2">
                          <AuthorityCue
                            authorityTier={row.authorityTier}
                            authorityLabel={row.authorityLabel}
                          />
                        </div>
                      </td>
                      <td className="border-y border-border-subtle px-4 py-4 text-sm text-text-secondary">
                        {row.secondary}
                      </td>
                      <td className="rounded-r-2xl border-y border-r border-border-subtle px-4 py-4 text-sm text-text-secondary">
                        {row.tertiary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-border-subtle bg-bg-secondary px-5 py-4">
            <p className="text-sm leading-6 text-text-secondary">{viewModel.footerNote}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
