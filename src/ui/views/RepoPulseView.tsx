import clsx from 'clsx';
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

interface RepoPulseViewProps {
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

export function RepoPulseView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onOpenRepo,
  onImportSession,
}: RepoPulseViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('repo-pulse', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);

  const mockCommitsByRepo = [
    { label: 'trace-narrative', value: 124, tone: 'amber' as const },
    { label: 'codex-agent-skills', value: 89, tone: 'violet' as const },
    { label: 'brainwav-com', value: 34, tone: 'blue' as const },
  ];

  const mockWeeklyActivity = Array.from({ length: 30 }).map((_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    value: Math.floor(Math.random() * 20),
    tone: 'amber' as const,
  }));

  const mockPrList = [
    { title: 'feat: add UI density uplift', repo: 'trace-narrative', status: 'Merged', id: 'PR-342' },
    { title: 'fix: resolve flaky e2e tests', repo: 'trace-narrative', status: 'Draft', id: 'PR-341' },
    { title: 'docs: update AGENTS.md instructions', repo: 'codex-agent-skills', status: 'Open', id: 'PR-12' },
  ];

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
              <h2 className="text-sm font-semibold text-text-primary">Commit Activity (30d)</h2>
              <div className="flex-1 mt-2 min-h-40">
                 <ActivityBarChart data={mockWeeklyActivity} />
              </div>
            </article>

            <article className="flex flex-col gap-4 rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
              <h2 className="text-sm font-semibold text-text-primary">Commits by Repo</h2>
              <MiniBarChart data={mockCommitsByRepo} />
            </article>
          </div>

          <article className="flex flex-col gap-4 rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
            <h2 className="text-sm font-semibold text-text-primary">Pull Requests</h2>
             <div className="flex flex-col divide-y divide-border-subtle border border-border-light rounded-xl bg-bg-primary">
               {mockPrList.map(pr => (
                 <div key={pr.id} className="flex justify-between p-3 text-sm hover:bg-bg-secondary/50">
                   <div className="flex flex-col gap-1">
                     <span className="text-text-primary font-medium">{pr.title}</span>
                     <span className="text-text-muted text-xs">{pr.repo}</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <span className="text-text-muted">{pr.id}</span>
                      <span className={clsx(
                        "font-mono px-1.5 rounded text-xs py-0.5",
                        pr.status === 'Merged' ? 'bg-accent-violet/10 text-accent-violet' :
                        pr.status === 'Open' ? 'bg-accent-emerald/10 text-accent-emerald' :
                        'bg-text-muted/10 text-text-muted'
                      )}>{pr.status}</span>
                   </div>
                 </div>
               ))}
             </div>
          </article>

        </div>
      </main>
    </div>
  );
}
