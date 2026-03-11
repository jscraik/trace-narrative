import { Cpu } from 'lucide-react';
import type { PeriodStats, ToolStats } from '../../../core/types';
import { computeTrend, formatToolName, getTrendColor } from '../../../core/attribution-api';
import { MetricCard } from './MetricCard';

interface MetricsGridProps {
  currentPeriod: PeriodStats;
  previousPeriod?: PeriodStats;
  toolBreakdown: ToolStats[];
}

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

  const attributedLinesTrend = computeTrend(
    currentPeriod.attribution.totalLines,
    previousPeriod?.attribution.totalLines,
  );
  const attributedLinesColor = attributedLinesTrend
    ? getTrendColor({
      metric: 'ai-lines',
      direction: attributedLinesTrend,
      currentValue: currentPeriod.attribution.totalLines,
      previousValue: previousPeriod?.attribution.totalLines,
    })
    : undefined;

  const attributedLinesDelta = previousPeriod
    ? currentPeriod.attribution.totalLines - previousPeriod.attribution.totalLines
    : undefined;

  const topTool = toolBreakdown[0];
  const topToolLabel = topTool ? formatToolName(topTool.tool) : 'Codex';

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

        {/* Attributed Lines */}
        <MetricCard
          index={2}
          label="Attributed Lines"
          value={currentPeriod.attribution.totalLines.toLocaleString()}
          trend={attributedLinesColor}
          trendSubtitle={
            attributedLinesDelta !== undefined
              ? `${attributedLinesDelta >= 0 ? '+' : ''}${attributedLinesDelta.toLocaleString()} vs last period`
              : 'Lines linked to attribution evidence'
          }
          accentColor="blue"
        />

        {/* Primary Tool */}
        <MetricCard
          index={3}
          label="Primary Tool"
          value={topToolLabel}
          accentColor="violet"
          valueColorClass="text-text-primary"
          trendSubtitle={
            topTool
              ? `${topTool.lineCount.toLocaleString()} lines in this window`
              : 'Codex-first shell view'
          }
          icon={
            <div className="flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary">
              <Cpu className="w-3 h-3" aria-hidden="true" />
              <span>source</span>
            </div>
          }
        />
      </div>
    </section>
  );
}
