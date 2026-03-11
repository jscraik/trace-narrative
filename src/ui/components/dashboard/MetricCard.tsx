import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { TrendColor } from '../../../core/attribution-api';

type AccentColor = 'green' | 'violet' | 'blue' | 'amber';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: TrendColor;
  trendSubtitle?: string;
  icon?: React.ReactNode;
  index: number;
  /** Colored dot indicator (matches v3 HTML demo) */
  accentColor?: AccentColor;
  /** Pulse the dot (for "System Health" style) */
  pulse?: boolean;
  /** Override value color */
  valueColorClass?: string;
}

const dotColorMap: Record<AccentColor, string> = {
  green: 'bg-accent-green',
  violet: 'bg-accent-violet',
  blue: 'bg-accent-blue',
  amber: 'bg-accent-amber',
};

/**
 * MetricCard — Trace shell metric card.
 *
 * Layout matches the v3 HTML demo:
 * - Gradient background card
 * - Colored dot indicator + label row
 * - Large bold value
 * - Trend subtitle text
 */
export function MetricCard({
  label,
  value,
  trend,
  trendSubtitle,
  icon,
  index,
  accentColor = 'green',
  pulse = false,
  valueColorClass,
}: MetricCardProps) {
  const trendColorClass = trend?.color ?? 'text-text-muted';

  return (
    <section
      className={`metric-card group relative p-5 
        transition-all duration-300 ease-out 
        hover:scale-[1.02] active:scale-[0.98]
        focus-within:ring-2 focus-within:ring-accent-blue focus-within:ring-offset-2 
        animate-fade-in-up`}
      style={{ animationDelay: `${index * 80}ms` }}
      aria-label={`${label}: ${value}${trend ? `, ${trend.label}` : ''}`}
    >
      {/* Dot + Label row */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-2 h-2 rounded-full ${dotColorMap[accentColor]} ${pulse ? 'pulse-dot' : ''}`}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-text-muted">{label}</span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-3">
        <div className={`text-3xl font-bold tracking-tight ${valueColorClass ?? 'text-text-primary'}`}>
          {value}
        </div>

        {/* Optional icon (for tool badge) */}
        {icon && (
          <div className="ml-auto opacity-70 group-hover:opacity-100 transition-opacity" aria-hidden="true">
            {icon}
          </div>
        )}
      </div>

      {/* Trend subtitle */}
      {trendSubtitle && (
        <div className={`text-xs mt-1 ${trendColorClass}`}>
          {trend?.icon === 'trending_up' && <TrendingUp className="w-3 h-3 inline mr-1" aria-hidden="true" />}
          {trend?.icon === 'trending_down' && <TrendingDown className="w-3 h-3 inline mr-1" aria-hidden="true" />}
          {trend?.icon === 'minus' && <Minus className="w-3 h-3 inline mr-1" aria-hidden="true" />}
          {trendSubtitle}
        </div>
      )}
      {!trendSubtitle && trend && (
        <div className={`text-xs mt-1 ${trendColorClass}`}>
          {trend?.icon === 'trending_up' && <TrendingUp className="w-3 h-3 inline mr-1" aria-hidden="true" />}
          {trend?.icon === 'trending_down' && <TrendingDown className="w-3 h-3 inline mr-1" aria-hidden="true" />}
          {trend?.icon === 'minus' && <Minus className="w-3 h-3 inline mr-1" aria-hidden="true" />}
          <span className="sr-only">{trend.label}</span>
        </div>
      )}
    </section>
  );
}
