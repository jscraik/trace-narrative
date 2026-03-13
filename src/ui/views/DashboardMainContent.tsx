import { AlertTriangle, ArrowRight, CircleDot, FileCode2, FolderGit2, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { formatToolName, type DashboardStats, type TimeRange } from '../../core/attribution-api';
import type { DashboardFilter, DashboardTrustState, PanelStatusMap } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { ActivityBarChart, MiniBarChart, type ChartTone } from '../components/charts';
import { BottomStats } from '../components/dashboard/BottomStats';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { SignalStrip, type BriefSignal, TONE_BADGE, compactNumber, buildTrendLabel } from '../components/dashboard/SignalStrip';
import { TopFilesTable } from '../components/dashboard/TopFilesTable';
import { Eyebrow } from '../components/typography/Eyebrow';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

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
  const shouldReduceMotion = useReducedMotion();

  // ── Derived values ─────────────────────────────────────────────────────────
  const topTool = stats.currentPeriod.toolBreakdown[0];
  const topToolLabel = topTool ? formatToolName(topTool.tool) : 'Codex';
  const repoBranch = repoState.status === 'ready' ? repoState.repo.branch : null;
  const trustIsHealthy = dashboardTrustState === 'healthy';
  const linkedFile = visibleFiles[0];
  const nextFile = visibleFiles[1];
  const aiPct = Math.round(stats.currentPeriod.attribution.aiPercentage);

  // ── Activity chart data ────────────────────────────────────────────────────
  const activityData = useMemo(
    () => stats.currentPeriod.trend.map((p) => ({ date: p.date, value: p.commitCount })),
    [stats.currentPeriod.trend],
  );

  // ── Tool breakdown chart data ──────────────────────────────────────────────
  const toolChartData = useMemo(
    () =>
      stats.currentPeriod.toolBreakdown.slice(0, 5).map((t) => ({
        label: formatToolName(t.tool),
        value: t.lineCount,
        tone: 'violet' as ChartTone,
      })),
    [stats.currentPeriod.toolBreakdown],
  );

  // ── KPI signals ───────────────────────────────────────────────────────────
  const briefSignals = useMemo<BriefSignal[]>(
    () => [
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
        detail: `${aiPct}% AI-linked evidence in this window.`,
      },
      {
        label: 'Top tool lane',
        value: topToolLabel,
        tone: 'green',
        detail: topTool
          ? `${topTool.lineCount.toLocaleString()} lines in the current window.`
          : 'No dominant tool in the current window.',
      },
      {
        label: 'Trust posture',
        value: trustIsHealthy ? 'Ready' : 'Trust gate',
        tone: trustIsHealthy ? 'green' : 'amber',
        detail: trustIsHealthy
          ? 'Capture is healthy. Move directly into repo evidence.'
          : 'Resolve capture posture before repeating the branch story.',
      },
    ],
    [
      stats.currentPeriod.period.commits,
      stats.previousPeriod?.period.commits,
      stats.currentPeriod.attribution.totalLines,
      aiPct,
      topTool,
      topToolLabel,
      trustIsHealthy,
    ],
  );

  // ── Session lanes ──────────────────────────────────────────────────────────
  const sessionLane = [
    {
      title: 'Open repo evidence',
      detail: linkedFile
        ? `Start with ${linkedFile.filePath} — walk back to commits, sessions, and diffs.`
        : 'Start from the highest-signal file and verify the branch story directly.',
      action: () => onModeChange('repo'),
      icon: FolderGit2,
    },
    {
      title: 'Resolve trust posture',
      detail: trustIsHealthy
        ? 'Trust Center stays green, but stay here if capture drifts.'
        : 'Trust Center should decide what is still provisional before cleanup.',
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

  // ── Render ─────────────────────────────────────────────────────────────────
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

      <main className="flex-1 overflow-y-auto px-6 py-5" data-dashboard-content>
        <div className="mx-auto flex max-w-[100rem] flex-col gap-5">

          {/* ── Row 1: Compact brief header + 30-day activity chart ───────── */}
          <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">

            {/* Brief — tight header only, no large prose block */}
            <article className="rounded-3xl border border-border-subtle bg-bg-subtle p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Narrative Brief
                </span>
                {repoBranch && (
                  <span className="rounded-full border border-accent-blue-light bg-accent-blue/10 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-blue">
                    {repoBranch}
                  </span>
                )}
                <span className={`rounded-full border px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] ${TONE_BADGE[aiPct >= 30 ? 'violet' : 'blue']}`}>
                  {aiPct}% AI
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-text-primary">
                What moved, what is risky, and where to inspect next.
              </h2>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                Signal density first. Proof concentration, then tool lane.
              </p>

              {/* Tight pressure summary — replaces the separate pressure-watch section on small screens */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-3 py-2 text-sm">
                  <CircleDot className="h-3.5 w-3.5 shrink-0 text-accent-blue" />
                  <span className="truncate font-medium text-text-primary">
                    {linkedFile ? linkedFile.filePath : 'No evidence file yet'}
                  </span>
                  {linkedFile && (
                    <span className="ml-auto whitespace-nowrap rounded-full bg-accent-violet/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-accent-violet">
                      {linkedFile.aiPercentage.toFixed(0)}% AI
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-3 py-2 text-sm">
                  <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${trustIsHealthy ? 'text-accent-green' : 'text-accent-amber'}`} />
                  <span className="truncate text-text-secondary">
                    {trustIsHealthy ? 'Trust is healthy — proceed to repo' : 'Trust gate active — resolve before handoff'}
                  </span>
                </div>
              </div>
            </article>

            {/* Activity chart — replaces the hand-rolled SparkStrip */}
            <article
              className="rounded-3xl border border-border-subtle bg-bg-subtle p-4"
              data-panel-status={panelStatusMap.metrics}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <Eyebrow>
                    Change pulse
                  </Eyebrow>
                  <h3 className="mt-0.5 text-sm font-semibold text-text-primary">
                    Commits per day · last {activityData.length} days
                  </h3>
                </div>
                <span className="rounded-full border border-border-light bg-bg-primary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {activityData.length} days
                </span>
              </div>
              <ActivityBarChart
                data={activityData}
                height={134}
                tone="violet"
                unit=" commits"
                label={`Daily commit activity — last ${activityData.length} days`}
                showXLabels={activityData.length <= 21}
              />
            </article>
          </section>

          {/* ── Row 2: Compact KPI strip (full width, ~h-12) ─────────────── */}
          <SignalStrip signals={briefSignals} />

          {/* ── Row 3: Tool breakdown + Next lanes ───────────────────────── */}
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">

            {/* Tool distribution — new MiniBarChart */}
            {toolChartData.length > 0 ? (
              <article className="rounded-3xl border border-border-subtle bg-bg-subtle p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <Eyebrow>
                      Tool distribution
                    </Eyebrow>
                    <h3 className="mt-0.5 text-sm font-semibold text-text-primary">
                      Line attribution by tool · top {toolChartData.length}
                    </h3>
                  </div>
                  <span className="rounded-full border border-accent-violet-light bg-accent-violet/10 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-accent-violet">
                    {toolChartData.length} tools
                  </span>
                </div>
                <MiniBarChart
                  data={toolChartData}
                  height={Math.max(72, toolChartData.length * 26)}
                  unit=" lines"
                  label="Tool line attribution breakdown"
                />
              </article>
            ) : (
              /* Empty tool state — shown when no tool breakdown data */
              <article className="flex items-center justify-center rounded-3xl border border-border-subtle bg-bg-subtle p-4">
                <p className="text-sm text-text-muted">No tool data in this window</p>
              </article>
            )}

            {/* Next lanes */}
            <article className="rounded-2xl border border-border-subtle bg-bg-subtle p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow>
                    Next lanes
                  </Eyebrow>
                  <h3 className="mt-1 text-base font-semibold text-text-primary">Keep Codex asks inside proof</h3>
                </div>
                <button
                  type="button"
                  onClick={onImportSession}
                  className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
                >
                  Import session
                </button>
              </div>

              <div className="mt-3 grid gap-2.5">
                {sessionLane.map((lane) => (
                  <motion.button
                    key={lane.title}
                    type="button"
                    onClick={lane.action}
                    whileTap={shouldReduceMotion ? { opacity: 0.8 } : { scale: 0.98 }}
                    className="flex w-full items-start gap-3 rounded-xl border border-border-light bg-bg-primary p-3 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] active:duration-75 hover:border-accent-blue-light hover:bg-bg-primary"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-accent-blue">
                      <lane.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-text-primary">{lane.title}</p>
                        <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-text-secondary">{lane.detail}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </article>
          </section>

          {/* ── Row 4: Pressure watch + Top files ────────────────────────── */}
          <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">

            {/* Pressure watch */}
            <article className="rounded-3xl border border-border-subtle bg-bg-subtle p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow>
                    Pressure watch
                  </Eyebrow>
                  <h3 className="mt-1 text-base font-semibold text-text-primary">
                    Lanes that need operator attention
                  </h3>
                </div>
                <span className="rounded-full border border-border-light bg-bg-primary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  3 signals
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <article className="group rounded-xl border border-border-light bg-bg-primary p-4 transition-all duration-200 ease-out active:scale-[0.98] active:duration-75 hover:border-accent-blue-light/50 hover:bg-bg-primary">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <CircleDot className="h-4 w-4 text-accent-blue" />
                    Evidence concentration
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {linkedFile
                      ? `${linkedFile.filePath} carries the strongest evidence signal at ${linkedFile.aiPercentage.toFixed(0)}% AI across ${linkedFile.commitCount} commits.`
                      : 'No evidence-ranked file available yet.'}
                  </p>
                </article>

                <article className="group rounded-xl border border-border-light bg-bg-primary p-4 transition-all duration-200 ease-out active:scale-[0.98] active:duration-75 hover:border-accent-blue-light/50 hover:bg-bg-primary">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <AlertTriangle className={`h-4 w-4 ${trustIsHealthy ? 'text-accent-green' : 'text-accent-amber'}`} />
                    Trust posture
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {trustIsHealthy
                      ? 'Capture looks stable enough for direct repo inspection.'
                      : 'Trust is degraded — branch conclusions should stay provisional until the trust gate is reviewed.'}
                  </p>
                </article>

                <article className="group rounded-xl border border-border-light bg-bg-primary p-4 transition-all duration-200 ease-out active:scale-[0.98] active:duration-75 hover:border-accent-blue-light/50 hover:bg-bg-primary">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <FileCode2 className="h-4 w-4 text-accent-violet" />
                    Second file to inspect
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {nextFile
                      ? `${nextFile.filePath} is the next best evidence hop if the first file does not explain the branch shift.`
                      : 'The current window is thin — the first evidence hop likely owns most of the story.'}
                  </p>
                </article>
              </div>
            </article>

            {/* Top files table */}
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
        aiPercentage={aiPct}
      />
    </div>
  );
}
