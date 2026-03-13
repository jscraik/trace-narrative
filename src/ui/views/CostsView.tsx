// clsx removed
import { ArrowRight, ArrowUpRight, Clock3 } from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { DashboardTrustBadge } from '../components/dashboard/DashboardTrustBadge';
import {
  buildNarrativeSurfaceViewModel,
  type SurfaceAction,
} from './narrativeSurfaceData';
import { CompactKpiStrip } from './narrativeSurfaceSections';
import { MiniBarChart, ActivityBarChart } from '../components/charts';

interface CostsViewProps {
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

export function CostsView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onOpenRepo,
  onImportSession,
}: CostsViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('costs', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);

  const mockCostByModel = [
    { label: 'Claude 3.5 Sonnet', value: 45.30, tone: 'violet' as const },
    { label: 'GPT-4o', value: 12.50, tone: 'amber' as const },
    { label: 'Gemini 2.5 Flash', value: 2.10, tone: 'blue' as const },
  ];

  const mockDailyCost = Array.from({ length: 30 }).map((_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    value: Math.random() * 5,
    tone: 'violet' as const,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className="border-b border-border-subtle bg-bg-secondary/90 px-6 py-5 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Workspace
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
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <CompactKpiStrip metrics={viewModel.metrics} />

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="flex flex-col gap-4 rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
              <h2 className="text-sm font-semibold text-text-primary">Spend by Model</h2>
              <MiniBarChart data={mockCostByModel} />
            </article>

            <article className="flex flex-col gap-4 rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5 min-h-52">
              <h2 className="text-sm font-semibold text-text-primary">Daily API Cost</h2>
              <div className="flex-1 mt-2">
                 <ActivityBarChart data={mockDailyCost} />
              </div>
            </article>
          </div>

          <section className="rounded-3xl border border-border-subtle bg-bg-secondary px-5 py-4">
            <p className="text-sm leading-6 text-text-secondary">{viewModel.footerNote}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
