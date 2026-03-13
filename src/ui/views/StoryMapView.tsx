import clsx from 'clsx';
import { SurfaceHeader } from '../components/SurfaceHeader';
import {
  Network,
  Radar,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { buildNarrativeSurfaceViewModel, type SurfaceAction } from './narrativeSurfaceData';
import { describeSurfaceTrust } from './dashboardState';
import { ProvenanceSection } from './narrativeSurfaceProvenance';
import { AuthorityCue } from './narrativeSurfaceSections';

interface StoryMapViewProps {
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

function getRepoPath(repoState: RepoState): string {
  if (repoState.status === 'ready') return repoState.repo.root;
  if (repoState.status !== 'idle') return repoState.path ?? '~/dev/trace-narrative';
  return '~/dev/trace-narrative';
}

export function StoryMapView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onModeChange,
  onOpenRepo,
  onImportSession,
  onAction,
}: StoryMapViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('work-graph', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);
  const trustDescriptor = describeSurfaceTrust(captureReliabilityStatus);
  const nextMode = trustDescriptor.trustState === 'healthy' ? 'repo' : 'status';
  const nextLabel = trustDescriptor.trustState === 'healthy' ? 'Inspect repo evidence' : 'Inspect trust gate';
  const NextIcon = trustDescriptor.trustState === 'healthy' ? ShieldCheck : ShieldAlert;

  const topologyLanes = [
    {
      label: 'Observe',
      items: viewModel.tableRows.slice(0, 2).map((row) => ({
        title: row.primary,
        detail: row.tertiary,
        authorityTier: row.authorityTier,
        authorityLabel: row.authorityLabel,
      })),
      tone: 'blue' as const,
    },
    {
      label: 'Join',
      items: viewModel.tableRows.slice(2, 4).map((row) => ({
        title: row.primary,
        detail: row.tertiary,
        authorityTier: row.authorityTier,
        authorityLabel: row.authorityLabel,
      })),
      tone: 'violet' as const,
    },
    {
      label: 'Pressure',
      items: viewModel.highlights.slice(0, 2).map((highlight) => ({
        title: highlight.title,
        detail: highlight.body,
        authorityTier: highlight.authorityTier,
        authorityLabel: highlight.authorityLabel,
      })),
      tone: 'amber' as const,
    },
    {
      label: 'Route',
      items: viewModel.activity.slice(0, 2).map((activity) => ({
        title: activity.title,
        detail: activity.detail,
        authorityTier: activity.authorityTier,
        authorityLabel: activity.authorityLabel,
      })),
      tone: 'green' as const,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <SurfaceHeader
        title={viewModel.title}
        category="Narrative"
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
        <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
          <div className="mb-2">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">{viewModel.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              Topology and prioritization view for pressure points, weak joins, and next inspection.
            </p>
          </div>
          <section className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Topology lanes</p>
                <h2 className="mt-1 text-xl font-semibold text-text-primary">Narrative pressure map</h2>
              </div>
              <AuthorityCue authorityTier={viewModel.heroAuthorityTier} authorityLabel={viewModel.heroAuthorityLabel} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-4">
              {topologyLanes.map((lane) => (
                <article key={lane.label} className="rounded-[1.25rem] border border-border-light bg-bg-primary/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{lane.label}</p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] ${toneClasses[lane.tone]}`}>
                      lane
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {lane.items.map((item, _index) => (
                      <div
                        key={`${lane.label}-${item.title}`}
                        className="group rounded-[1rem] border border-border-light bg-bg-secondary/80 p-3 transition-colors hover:border-accent-[var(--base-accent)]/50 hover:bg-bg-primary"
                        style={{ '--base-accent': `var(--color-accent-${lane.tone})` } as React.CSSProperties}
                        data-authority-tier={item.authorityTier}
                        data-authority-label={item.authorityLabel}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">
                              {item.detail}
                            </p>
                          </div>
                          <AuthorityCue authorityTier={item.authorityTier} authorityLabel={item.authorityLabel} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Priority queue</p>
                  <h2 className="mt-1 text-xl font-semibold text-text-primary">What should move first</h2>
                </div>
                <Radar className="h-4 w-4 text-text-muted" />
              </div>
              <div className="mt-4 space-y-3">
                {viewModel.highlights.map((highlight) => (
                  <button
                    key={highlight.title}
                    type="button"
                    onClick={() => highlight.action && onAction?.(highlight.action)}
                    className={clsx('w-full rounded-[1.25rem] border p-4 text-left transition hover:-translate-y-0.5 hover:bg-bg-primary', toneClasses[highlight.tone])}
                    data-authority-tier={highlight.authorityTier}
                    data-authority-label={highlight.authorityLabel}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] opacity-80">{highlight.eyebrow}</p>
                        <p className="mt-2 text-sm font-semibold text-text-primary">{highlight.title}</p>
                      </div>
                      <AuthorityCue authorityTier={highlight.authorityTier} authorityLabel={highlight.authorityLabel} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{highlight.body}</p>
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Movement log</p>
                  <h2 className="mt-1 text-xl font-semibold text-text-primary">Recent shifts across the map</h2>
                </div>
                <Network className="h-4 w-4 text-text-muted" />
              </div>
              <div className="mt-4 space-y-3">
                {viewModel.activity.map((item, _index) => (
                  <article
                    key={`${item.title}-${item.meta}`}
                    className="group rounded-[1.25rem] border border-border-light bg-bg-primary/80 p-4 transition-colors hover:border-accent-blue-light/50 hover:bg-bg-primary/90"
                    data-authority-tier={item.authorityTier}
                    data-authority-label={item.authorityLabel}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">{item.meta}</p>
                      </div>
                      <AuthorityCue authorityTier={item.authorityTier} authorityLabel={item.authorityLabel} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p>
                  </article>
                ))}
              </div>
            </article>
          </section>

          {viewModel.provenance ? <ProvenanceSection provenance={viewModel.provenance} onAction={onAction} /> : null}
        </div>
      </main>
    </div>
  );
}
