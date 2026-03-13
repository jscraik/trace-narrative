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
import { MiniBarChart } from '../components/charts';

interface ToolsViewProps {
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

export function ToolsView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onOpenRepo,
  onImportSession,
}: ToolsViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('tools', repoState, captureReliabilityStatus, autoIngestEnabled);
  const _repoPath = getRepoPath(repoState);

  const mockToolData = [
    { label: 'Claude', value: 850, tone: 'violet' as const },
    { label: 'Codex', value: 430, tone: 'blue' as const },
    { label: 'Cursor', value: 210, tone: 'slate' as const },
  ];

  const errorProneTools = [
    { name: 'Terminal (Codex)', count: 24, rate: '14%' },
    { name: 'Git (Cursor)', count: 8, rate: '5%' },
    { name: 'Filesystem (Claude)', count: 3, rate: '0.5%' },
  ];

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

          <div className="grid gap-6 md:grid-cols-2">
            <article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
              <h2 className="text-sm font-semibold text-text-primary">Tool Distribution</h2>
              <MiniBarChart data={mockToolData} />
            </article>

            <article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
              <h2 className="text-sm font-semibold text-text-primary">Error Prone Tools</h2>
               <div className="flex flex-col divide-y divide-border-subtle border border-border-light rounded-xl bg-bg-primary">
                 {errorProneTools.map(t => (
                   <div key={t.name} className="flex justify-between p-3 text-sm hover:bg-bg-subtle">
                     <span className="text-text-primary font-medium">{t.name}</span>
                     <div className="flex items-center gap-3">
                        <span className="text-text-muted">{t.count} errors</span>
                        <span className="text-accent-amber font-mono bg-accent-amber/10 px-1.5 rounded">{t.rate}</span>
                     </div>
                   </div>
                 ))}
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
