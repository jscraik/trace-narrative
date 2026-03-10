import type { LucideIcon } from 'lucide-react';
import type { DashboardFilter } from '../../../core/types';

type ActivityBadge = 'ai' | 'human' | 'mixed';

export interface ActivityItem {
    id: string;
    message: string;
    branch: string;
    timeAgo: string;
    badge: ActivityBadge;
    icon: LucideIcon;
}

interface RecentActivityProps {
    items: ActivityItem[];
    onViewAll?: () => void;
    onItemClick?: (filter: DashboardFilter) => void;
}

const badgeClasses: Record<ActivityBadge, string> = {
    ai: 'badge-ai',
    human: 'badge-human',
    mixed: 'badge-mixed',
};

const badgeLabels: Record<ActivityBadge, string> = {
    ai: 'AI',
    human: 'Human',
    mixed: 'Mixed',
};

const badgeBgColors: Record<ActivityBadge, string> = {
    ai: 'bg-accent-violet-bg',
    human: 'bg-accent-blue-bg',
    mixed: 'bg-accent-amber-bg',
};

export function RecentActivity({ items, onViewAll, onItemClick }: RecentActivityProps) {
    return (
        <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary">Recent Activity</h3>
                {onViewAll && (
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="text-sm text-accent-blue hover:underline transition-colors"
                    >
                        View all activity →
                    </button>
                )}
            </div>
            <div className="space-y-1">
                {items.length === 0 ? (
                    <p className="text-sm text-text-muted py-4 text-center">No recent activity</p>
                ) : (
                    items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onItemClick?.({ type: 'file', value: item.branch })}
                            className="activity-row flex items-center gap-4 p-3 w-full text-left cursor-pointer"
                        >
                            <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${badgeBgColors[item.badge]}`}
                            >
                                <item.icon className="w-5 h-5 text-current opacity-80" aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-text-primary truncate">
                                    {item.message}
                                </div>
                                <div className="text-xs text-text-muted">
                                    {item.branch} • {item.timeAgo}
                                </div>
                            </div>
                            <span
                                className={`text-xs px-2 py-1 rounded font-medium flex-shrink-0 ${badgeClasses[item.badge]}`}
                            >
                                {badgeLabels[item.badge]}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
