import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Sparkles } from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { SurfaceHeader } from '../components/SurfaceHeader';
import {
  buildNarrativeSurfaceViewModel,
  type SurfaceAuthorityCue,
  type SurfaceMode,
  type SurfaceTableRow,
} from './narrativeSurfaceData';
import { ProvenanceSection } from './narrativeSurfaceProvenance';
import {
  ActivitySection,
  AuthorityCue,
  CompactKpiStrip,
  HighlightsSection,
  SummaryTable,
} from './narrativeSurfaceSections';
import { LiveCaptureView } from './LiveCaptureView';
import { SessionsView } from './SessionsView';
import { StoryMapView } from './StoryMapView';
import { TranscriptLensView } from './TranscriptLensView';
import { TrustCenterView } from './TrustCenterView';
import { CausalTimelineView } from './CausalTimelineView';
import { DiffReviewView } from './DiffReviewView';
import { EnvHygieneView } from './EnvHygieneView';
import { WorktreesView } from './WorktreesView';
import { SettingsView } from './SettingsView';
import { SetupView } from './SetupView';
import { ToolsView } from './ToolsView';
import { CostsView } from './CostsView';
import { RepoPulseView } from './RepoPulseView';
// ─── Lede Banner ─────────────────────────────────────────────────────────────
// Collapses the "Shared narrative surface" lede card to a 40 px banner by
// default. State is persisted per mode in localStorage.

interface LedeBannerProps extends SurfaceAuthorityCue {
  mode: SurfaceMode;
  heroTitle: string;
  heroBody: string;
  onJump: () => void;
}

function LedeBanner({ mode, authorityTier, authorityLabel, heroTitle, heroBody, onJump }: LedeBannerProps) {
  const storageKey = `lede-collapsed-${mode}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      // Default to collapsed (true) if nothing stored yet.
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed, storageKey]);

  if (collapsed) {
    return (
      <div className="flex h-10 items-center gap-3 rounded-2xl border border-border-subtle bg-bg-secondary/60 px-4">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-violet" aria-hidden="true" />
        <span className="text-xs font-medium text-text-muted">Shared narrative surface</span>
        <span
          className="rounded-full border border-border-light bg-bg-primary px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-widest text-text-muted"
          data-authority-tier={authorityTier}
        >
          {authorityLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{heroTitle}</span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onJump}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-light bg-bg-primary px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
          >
            <Search className="h-3 w-3" />
            Jump
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-expanded={false}
            aria-controls="lede-body"
            className="inline-flex items-center gap-1 rounded-xl border border-border-light bg-bg-primary px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-border-light hover:text-text-primary"
          >
            <ChevronDown className="h-3 w-3" />
            Expand
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="lede-body"
      className="glass-panel rounded-3xl px-5 py-5"
      data-authority-tier={authorityTier}
      data-authority-label={authorityLabel}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1 text-xs font-medium text-text-secondary">
            <Sparkles className="h-3.5 w-3.5 text-accent-violet" />
            Shared narrative surface
          </div>
          <AuthorityCue authorityTier={authorityTier} authorityLabel={authorityLabel} />
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{heroTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{heroBody}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-expanded={true}
            aria-controls="lede-body"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-light bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-light hover:text-text-primary"
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Collapse
          </button>
          <button
            type="button"
            onClick={onJump}
            className="inline-flex items-center gap-2 rounded-2xl border border-border-light bg-bg-primary px-4 py-3 text-sm font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
          >
            <Search className="h-4 w-4" />
            Jump into repo evidence
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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

  if (mode === 'diffs') {
    return (
      <DiffReviewView
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

  if (mode === 'worktrees') {
    return (
      <WorktreesView
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

  if (mode === 'env') {
    return (
      <EnvHygieneView
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

  if (mode === 'settings') {
    return (
      <SettingsView
        onModeChange={onModeChange}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
      />
    );
  }

  if (mode === 'setup') {
    return (
      <SetupView
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

  if (mode === 'tools') {
    return (
      <ToolsView
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

  if (mode === 'costs') {
    return (
      <CostsView
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

  if (mode === 'repo-pulse') {
    return (
      <RepoPulseView
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
      <SurfaceHeader
        title={viewModel.title}
        category={viewModel.section}
        repoPath={repoPath}
        trustState={viewModel.trustState}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <LedeBanner
            mode={mode}
            authorityTier={viewModel.heroAuthorityTier}
            authorityLabel={viewModel.heroAuthorityLabel}
            heroTitle={viewModel.heroTitle}
            heroBody={viewModel.heroBody}
            onJump={() => onModeChange('repo')}
          />
          <CompactKpiStrip metrics={viewModel.metrics} />

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
