import { useDialKit } from 'dialkit';
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
 * MetricsGrid — Displays 4 key metrics with trend indicators.
 *
 * Metrics:
 * 1. Total Commits — trend down is good (faster iterations)
 * 2. AI Percentage — trend up indicates more AI usage
 * 3. AI Lines — absolute count of AI-contributed code
 * 4. Top Tool — most-used AI tool in period
 *
 * Per dashboard-layout-spec.yml:
 * - 4-column grid on medium/wide, 2-column on narrow
 * - Min-height 128px per card
 * - Gap 1.5rem (6 in Tailwind)
 */
export function MetricsGrid({
  currentPeriod,
  previousPeriod,
  toolBreakdown,
}: MetricsGridProps) {
  const tune = useDialKit('Dashboard', {
    layout: {
      sectionGap: [48, 12, 120, 2],
      gridGap: [24, 8, 48, 2],
    }
  });
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

  const aiLines = currentPeriod.attribution.aiAgentLines + currentPeriod.attribution.aiAssistLines;
  const previousAiLines =
    previousPeriod?.attribution.aiAgentLines && previousPeriod?.attribution.aiAssistLines
      ? previousPeriod.attribution.aiAgentLines + previousPeriod.attribution.aiAssistLines
      : undefined;
  const aiLinesTrend = computeTrend(aiLines, previousAiLines);
  const aiLinesColor = aiLinesTrend
    ? getTrendColor({
      metric: 'ai-lines',
      direction: aiLinesTrend,
      currentValue: aiLines,
      previousValue: previousAiLines,
    })
    : undefined;

  // Top tool badge
  const topTool = toolBreakdown[0];
  const toolIcon = (
    <div className="flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary">
      <Cpu className="w-3 h-3" aria-hidden="true" />
      <span>{topTool?.tool ?? 'N/A'}</span>
    </div>
  );

  return (
    <section
      data-metrics-grid
      aria-label="Key metrics"
      style={{ marginBottom: `${tune.layout.sectionGap}px` }}
    >
      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ gap: `${tune.layout.gridGap}px` }}
      >
        {/* Total Commits */}
        <MetricCard
          index={0}
          label="Total Commits"
          value={currentPeriod.period.commits}
          trend={commitsColor}
        />

        {/* AI % */}
        <MetricCard
          index={1}
          label="AI %"
          value={`${currentPeriod.attribution.aiPercentage.toFixed(0)}%`}
          trend={aiPercentageColor}
        />

        {/* AI Lines */}
        <MetricCard
          index={2}
          label="AI Lines"
          value={aiLines.toLocaleString()}
          trend={aiLinesColor}
        />

        {/* Top Tool */}
        <MetricCard
          index={3}
          label="Top Tool"
          value={topTool?.lineCount ? topTool.lineCount.toLocaleString() : '—'}
          icon={toolIcon}
        />
      </div>
    </section>
  );
}
