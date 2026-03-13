import { SectionHeader } from '../components/SectionHeader';
import { DashboardTrustBadge } from '../components/dashboard/DashboardTrustBadge';


import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
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
  const _repoPath = getRepoPath(repoState);

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
      

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <SectionHeader
  title={viewModel.title}
  description="{viewModel.subtitle}"
  badge={<DashboardTrustBadge trustState={viewModel.trustState} />}
/>

          <CompactKpiStrip metrics={viewModel.metrics} />

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
              <h2 className="text-sm font-semibold text-text-primary">Spend by Model</h2>
              <MiniBarChart data={mockCostByModel} />
            </article>

            <article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5 min-h-52">
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
