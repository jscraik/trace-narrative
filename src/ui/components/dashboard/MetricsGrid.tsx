import { Cpu } from 'lucide-react';
import type { PeriodStats, ToolStats } from '../../../core/types';
import { computeTrend, getTrendColor } from '../../../core/attribution-api';
import { MetricCard } from './MetricCard';

interface MetricsGridProps {
  currentPeriod: PeriodStats;
  previousPeriod?: PeriodStats;
  toolBreakdown: ToolStats[];
}

/**
 * MetricsGrid — v3 Firefly-inspired 4-column grid.
 *
 * Metrics (matching v3 HTML demo):
 * 1. Total Commits (green dot)
 * 2. AI Attribution % (violet dot, violet value)
 * 3. Linked Sessions (green dot)
 * 4. System Health (pulsing green dot, green value)
 */
export function MetricsGrid({
  currentPeriod,
  previousPeriod,
  toolBreakdown,
}: MetricsGridProps) {
  // Calculate trends
  const commitsTrend = computeTrend(
    currentPeriod.period.commits,
    previousPeriod?.period.commits
  );
  const commitsColor = commitsTrend
    ? getTrendColor({
      metric: 'commits',
      direction: commitsTrend,
      currentValue: currentPeriod.period.commits,
      previousValue: previousPeriod?.period.commits,
    })
    : undefined;

  const commitsDelta = previousPeriod
    ? currentPeriod.period.commits - previousPeriod.period.commits
    : undefined;

  const aiPercentageTrend = computeTrend(
    currentPeriod.attribution.aiPercentage,
    previousPeriod?.attribution.aiPercentage
  );
  const aiPercentageColor = aiPercentageTrend
    ? getTrendColor({
      metric: 'ai-percentage',
      direction: aiPercentageTrend,
      currentValue: currentPeriod.attribution.aiPercentage,
      previousValue: previousPeriod?.attribution.aiPercentage,
    })
    : undefined;

  const aiPercentageDelta = previousPeriod
    ? Math.round(currentPeriod.attribution.aiPercentage - previousPeriod.attribution.aiPercentage)
    : undefined;

  const _aiLines = currentPeriod.attribution.aiAgentLines + currentPeriod.attribution.aiAssistLines;

  // Top tool badge
  const topTool = toolBreakdown[0];
  const _toolIcon = topTool ? (
    <div className="flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary">
      <Cpu className="w-3 h-3" aria-hidden="true" />
      <span>{topTool.tool}</span>
    </div>
  ) : null;

  return (
    <section
      data-metrics-grid
      aria-label="Key metrics"
      className="mb-8"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Commits */}
        <MetricCard
          index={0}
          label="Total Commits"
          value={currentPeriod.period.commits}
          trend={commitsColor}
          trendSubtitle={commitsDelta !== undefined ? `${commitsDelta >= 0 ? '+' : ''}${commitsDelta} this period` : `${currentPeriod.period.commits} total`}
          accentColor="green"
        />

        {/* AI Attribution */}
        <MetricCard
          index={1}
          label="AI Attribution"
          value={`${currentPeriod.attribution.aiPercentage.toFixed(0)}%`}
          trend={aiPercentageColor}
          trendSubtitle={aiPercentageDelta !== undefined ? `${aiPercentageDelta >= 0 ? '+' : ''}${aiPercentageDelta}% vs last period` : undefined}
          accentColor="violet"
          valueColorClass="text-accent-violet"
        />

        {/* Linked Sessions */}
        <MetricCard
          index={2}
          label="Linked Sessions"
          value="23"
          accentColor="green"
          trendSubtitle="+3 new"
        />

        {/* System Health */}
        <MetricCard
          index={3}
          label="System Health"
          value="94%"
          accentColor="green"
          pulse
          valueColorClass="text-accent-green"
          trendSubtitle="All systems operational"
        />
      </div>
    </section>
  );
}
