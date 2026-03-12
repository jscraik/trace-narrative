import { ArrowRight, ArrowUpRight, Clock3, Search, Sparkles } from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { DashboardTrustBadge } from '../components/dashboard/DashboardTrustBadge';
import {
  buildNarrativeSurfaceViewModel,
  type SurfaceMode,
  type SurfaceTableRow,
} from './narrativeSurfaceData';
import { ProvenanceSection } from './narrativeSurfaceProvenance';
import {
  ActivitySection,
  AuthorityCue,
  HighlightsSection,
  MetricCard,
  SummaryTable,
} from './narrativeSurfaceSections';
import { LiveCaptureView } from './LiveCaptureView';
import { SessionsView } from './SessionsView';
import { StoryMapView } from './StoryMapView';
import { TranscriptLensView } from './TranscriptLensView';
import { TrustCenterView } from './TrustCenterView';
import { CausalTimelineView } from './CausalTimelineView';

interface NarrativeSurfaceViewProps {
  mode: SurfaceMode;
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  autoIngestEnabled?: boolean;
  onModeChange: (mode: Mode) => void;
  onOpenRepo: () => void;
  onImportSession?: () => void;
  onAction?: (action: NonNullable<SurfaceTableRow['action']>) => void;
}

export function NarrativeSurfaceView({
  mode,
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onModeChange,
  onOpenRepo,
  onImportSession,
  onAction,
}: NarrativeSurfaceViewProps) {
  if (mode === 'work-graph') {
    return (
      <StoryMapView
        repoState={repoState}
        captureReliabilityStatus={captureReliabilityStatus}
        autoIngestEnabled={autoIngestEnabled}
        onModeChange={onModeChange}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
        onAction={onAction}
      />
    );
  }

  if (mode === 'live') {
    return (
      <LiveCaptureView
        repoState={repoState}
        captureReliabilityStatus={captureReliabilityStatus}
        autoIngestEnabled={autoIngestEnabled}
        onModeChange={onModeChange}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
        onAction={onAction}
      />
    );
  }

  if (mode === 'sessions') {
    return (
      <SessionsView
        repoState={repoState}
        captureReliabilityStatus={captureReliabilityStatus}
        autoIngestEnabled={autoIngestEnabled}
        onModeChange={onModeChange}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
        onAction={onAction}
      />
    );
  }

  if (mode === 'transcripts') {
    return (
      <TranscriptLensView
        repoState={repoState}
        captureReliabilityStatus={captureReliabilityStatus}
        autoIngestEnabled={autoIngestEnabled}
        onModeChange={onModeChange}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
        onAction={onAction}
      />
    );
  }

  if (mode === 'status') {
    return (
      <TrustCenterView
        repoState={repoState}
        captureReliabilityStatus={captureReliabilityStatus}
        autoIngestEnabled={autoIngestEnabled}
        onModeChange={onModeChange}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
        onAction={onAction}
      />
    );
  }

  if (mode === 'timeline') {
    return (
      <CausalTimelineView
        repoState={repoState}
        captureReliabilityStatus={captureReliabilityStatus}
        autoIngestEnabled={autoIngestEnabled}
        onModeChange={onModeChange}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
        onAction={onAction}
      />
    );
  }

  const viewModel = buildNarrativeSurfaceViewModel(mode, repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = repoState.status === 'ready' ? repoState.repo.root : repoState.status !== 'idle' ? repoState.path ?? '~/dev/trace-narrative' : '~/dev/trace-narrative';

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className="border-b border-border-subtle bg-bg-secondary/90 px-6 py-5 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
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
                  Shared narrative surface
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

          {viewModel.provenance && (
            <ProvenanceSection provenance={viewModel.provenance} onAction={onAction} />
          )}

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <HighlightsSection
              title={viewModel.highlightsTitle}
              highlights={viewModel.highlights}
              onAction={onAction}
            />
            <ActivitySection
              title={viewModel.activityTitle}
              activity={viewModel.activity}
              onAction={onAction}
            />
          </section>

          <SummaryTable
            title={viewModel.tableTitle}
            columns={viewModel.tableColumns}
            rows={viewModel.tableRows}
            onAction={onAction}
          />

          <section className="rounded-3xl border border-border-subtle bg-bg-secondary px-5 py-4">
            <p className="text-sm leading-6 text-text-secondary">{viewModel.footerNote}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
