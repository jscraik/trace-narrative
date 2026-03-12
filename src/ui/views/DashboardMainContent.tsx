import { AlertTriangle, ArrowRight, CircleDot, FileCode2, FolderGit2, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo } from 'react';

import { formatToolName, type DashboardStats, type TimeRange } from '../../core/attribution-api';
import type { DashboardFilter, DashboardTrustState, PanelStatusMap } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { BottomStats } from '../components/dashboard/BottomStats';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { TopFilesTable } from '../components/dashboard/TopFilesTable';

interface DashboardMainContentProps {
  stats: DashboardStats;
  repoState: RepoState;
  timeRange: TimeRange;
  lastUpdated?: Date;
  dashboardTrustState: DashboardTrustState;
  panelStatusMap: PanelStatusMap;
  activeRepoId: number | null;
  visibleFiles: DashboardStats['topFiles']['files'];
  loadingMore: boolean;
  hasActiveQuery: boolean;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  onImportSession: () => void;
  onModeChange: (mode: 'repo' | 'hygiene' | 'status' | 'sessions') => void;
  onFileClick: (filter: DashboardFilter) => void;
  onLoadMore: () => void;
}

type BriefSignal = {
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'amber' | 'violet';
  detail: string;
};

const toneClasses = {
  blue: 'border-accent-blue-light bg-accent-blue/10 text-accent-blue',
  green: 'border-accent-green-light bg-accent-green-bg text-accent-green',
  amber: 'border-accent-amber-light bg-accent-amber-bg text-accent-amber',
  violet: 'border-accent-violet-light bg-accent-violet/10 text-accent-violet',
} as const;

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function buildTrendLabel(value: number, previous?: number): string {
  if (previous === undefined) return 'No prior window';
  const delta = value - previous;
  if (delta === 0) return 'Flat versus previous window';
  return `${delta > 0 ? '+' : ''}${delta.toLocaleString()} vs previous window`;
}

function SparkStrip({ trend }: { trend: DashboardStats['currentPeriod']['trend'] }) {
  const maxCommitCount = Math.max(...trend.map((point) => point.commitCount), 1);

  return (
    <div className="rounded-[1.5rem] border border-border-subtle bg-bg-primary/80 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Change pulse
          </p>
          <h3 className="mt-1 text-base font-semibold text-text-primary">What moved across the latest window</h3>
        </div>
        <span className="rounded-full border border-border-light bg-bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
          {trend.length} slices
        </span>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2.5">
        {trend.map((point) => {
          const height = Math.max((point.commitCount / maxCommitCount) * 4.6, 1.1);
          return (
            <div key={point.date} className="space-y-2">
              <div className="flex h-[5.35rem] items-end rounded-2xl border border-border-light bg-bg-secondary/70 p-2">
                <div
                  className="w-full rounded-xl bg-gradient-to-t from-accent-blue to-accent-violet transition-[height] duration-300"
                  style={{ height: `${height}rem` }}
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {new Date(point.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                </p>
                <p className="text-sm font-semibold text-text-primary">{point.commitCount}</p>
                <p className="text-[0.6875rem] text-text-secondary">{Math.round(point.aiPercentage)}% AI</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardMainContent({
  stats,
  repoState,
  timeRange,
  lastUpdated,
  dashboardTrustState,
  panelStatusMap,
  activeRepoId: _activeRepoId,
  visibleFiles,
  loadingMore,
  hasActiveQuery,
  onTimeRangeChange,
  onImportSession,
  onModeChange,
  onFileClick,
  onLoadMore,
}: DashboardMainContentProps) {
  const topTool = stats.currentPeriod.toolBreakdown[0];
  const topToolLabel = topTool ? formatToolName(topTool.tool) : 'Codex';
  const repoBranch = repoState.status === 'ready' ? repoState.repo.branch : null;
  const trustIsHealthy = dashboardTrustState === 'healthy';
  const linkedFile = visibleFiles[0];
  const nextFile = visibleFiles[1];

  const briefSignals = useMemo<BriefSignal[]>(() => [
    {
      label: 'Commits moved',
      value: `${stats.currentPeriod.period.commits}`,
      tone: 'blue',
      detail: buildTrendLabel(stats.currentPeriod.period.commits, stats.previousPeriod?.period.commits),
    },
    {
      label: 'Attributed lines',
      value: compactNumber(stats.currentPeriod.attribution.totalLines),
      tone: 'violet',
      detail: `${Math.round(stats.currentPeriod.attribution.aiPercentage)}% AI-linked evidence in this window.`,
    },
    {
      label: 'Top tool lane',
      value: topToolLabel,
      tone: 'green',
      detail: topTool ? `${topTool.lineCount.toLocaleString()} lines in the current window.` : 'No dominant tool in the current window.',
    },
    {
      label: 'Trust posture',
      value: trustIsHealthy ? 'Ready to inspect' : 'Trust gate active',
      tone: trustIsHealthy ? 'green' : 'amber',
      detail: trustIsHealthy
        ? 'Capture looks healthy enough to move straight into repo evidence.'
        : 'Resolve capture posture before you repeat the branch story out loud.',
    },
  ], [
    stats.currentPeriod.period.commits,
    stats.previousPeriod?.period.commits,
    stats.currentPeriod.attribution.totalLines,
    stats.currentPeriod.attribution.aiPercentage,
    topTool,
    topToolLabel,
    trustIsHealthy,
  ]);

  const sessionLane = [
    {
      title: 'Open repo evidence',
      detail: linkedFile
        ? `Start with ${linkedFile.filePath} and walk back to commits, sessions, and diffs.`
        : 'Start from the highest-signal file and verify the branch story directly.',
      action: () => onModeChange('repo'),
      icon: FolderGit2,
    },
    {
      title: 'Resolve trust posture',
      detail: trustIsHealthy
        ? 'Trust Center stays green, but it should still be the first stop if capture drifts.'
        : 'Trust Center should decide what is still provisional before cleanup or handoff.',
      action: () => onModeChange('status'),
      icon: ShieldCheck,
    },
    {
      title: 'Close session joins',
      detail: 'Use the session ledger to tighten weak joins before cleanup or summarization.',
      action: () => onModeChange('sessions'),
      icon: Sparkles,
    },
    {
      title: 'Triage hygiene',
      detail: 'Only clean aggressively once the branch story is stable enough to survive replay.',
      action: () => onModeChange('hygiene'),
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="dashboard-container flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-bottom-1 motion-page-enter">
      <DashboardHeader
        repoName={stats.repo.name}
        repoPath={stats.repo.path}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        lastUpdated={lastUpdated}
        trustState={dashboardTrustState}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6" data-dashboard-content>
        <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
          <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/90 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.8)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Narrative Brief
                    </span>
                    {repoBranch ? (
                      <span className="rounded-full border border-accent-blue-light bg-accent-blue/10 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-blue">
                        {repoBranch}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                      Operator cockpit
                    </span>
                  </div>
                  <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-text-primary">
                    What moved, what is risky, and where we should inspect next.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                    Start with signal density, not explanation. This frame should tell us how much changed, where proof is concentrated, and which lane deserves the next five minutes.
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-border-light bg-bg-primary/80 px-4 py-3 text-sm text-text-secondary">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Operator rule</p>
                  <p className="mt-1.5 max-w-[18rem] leading-6">
                    If this screen needs paragraphs to explain what changed, it is already losing to repo evidence.
                  </p>
                </div>
              </div>
            </article>

            <SparkStrip trend={stats.currentPeriod.trend.slice(-7)} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="grid gap-4 lg:grid-cols-4" data-panel-status={panelStatusMap.metrics}>
              {briefSignals.map((signal) => (
                <article key={signal.label} className="rounded-[1.35rem] border border-border-subtle bg-bg-secondary/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      {signal.label}
                    </p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] ${toneClasses[signal.tone]}`}>
                      {signal.tone === 'amber' ? 'watch' : 'signal'}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[1.9rem] font-semibold tracking-tight text-text-primary">{signal.value}</p>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary">{signal.detail}</p>
                </article>
              ))}
            </div>

            <article className="rounded-[1.5rem] border border-border-subtle bg-bg-secondary/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Next lanes
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-text-primary">Keep Codex asks inside proof</h3>
                </div>
                <button
                  type="button"
                  onClick={onImportSession}
                  className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
                >
                  Import session
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                {sessionLane.map((lane) => (
                  <button
                    key={lane.title}
                    type="button"
                    onClick={lane.action}
                    className="flex w-full items-start gap-3 rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-accent-blue-light hover:bg-bg-primary"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-bg-secondary text-accent-blue">
                      <lane.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-text-primary">{lane.title}</p>
                        <ArrowRight className="h-4 w-4 text-text-muted" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">{lane.detail}</p>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Pressure watch
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-text-primary">Lanes that need operator attention</h3>
                </div>
                <span className="rounded-full border border-border-light bg-bg-primary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  4 signals
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <article className="rounded-[1.25rem] border border-border-light bg-bg-primary/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <CircleDot className="h-4 w-4 text-accent-blue" />
                    Evidence concentration
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {linkedFile
                      ? `${linkedFile.filePath} currently carries the strongest evidence signal at ${linkedFile.aiPercentage.toFixed(0)}% AI attribution across ${linkedFile.commitCount} commits.`
                      : 'No evidence-ranked file is available yet.'}
                  </p>
                </article>

                <article className="rounded-[1.25rem] border border-border-light bg-bg-primary/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <AlertTriangle className={`h-4 w-4 ${trustIsHealthy ? 'text-accent-green' : 'text-accent-amber'}`} />
                    Trust posture
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {trustIsHealthy
                      ? 'Capture looks stable enough for direct repo inspection, but this should flip the moment the stream degrades.'
                      : 'Trust is degraded, so branch conclusions should stay provisional until the trust gate is reviewed.'}
                  </p>
                </article>

                <article className="rounded-[1.25rem] border border-border-light bg-bg-primary/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <FileCode2 className="h-4 w-4 text-accent-violet" />
                    Second file to inspect
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {nextFile
                      ? `${nextFile.filePath} is the next best evidence hop if the first file does not explain the branch shift on its own.`
                      : 'The current window is thin enough that the first evidence hop likely owns most of the story.'}
                  </p>
                </article>
              </div>
            </article>

            <div data-panel-status={panelStatusMap.topFiles}>
              <TopFilesTable
                files={visibleFiles}
                hasMore={!hasActiveQuery && stats.topFiles.hasMore}
                isLoading={loadingMore}
                onFileClick={onFileClick}
                onLoadMore={onLoadMore}
              />
            </div>
          </section>
        </div>
      </main>

      <BottomStats
        repoCount={1}
        sessionCount={stats.currentPeriod.period.commits}
        aiPercentage={Math.round(stats.currentPeriod.attribution.aiPercentage)}
      />
    </div>
  );
}
