interface BottomStatsProps {
    repoCount?: number;
    sessionCount?: number;
    aiPercentage?: number;
    costThisWeek?: string;
    openPRs?: number;
}

export function BottomStats({
    repoCount = 0,
    sessionCount = 0,
    aiPercentage = 0,
    costThisWeek,
    openPRs,
}: BottomStatsProps) {
    const stats = [
        { value: repoCount, label: 'repos active' },
        { value: sessionCount, label: 'sessions' },
        { value: `${aiPercentage}%`, label: 'AI' },
        ...(costThisWeek ? [{ value: costThisWeek, label: 'cost' }] : []),
        ...(openPRs !== undefined ? [{ value: openPRs, label: 'open PRs' }] : []),
    ];

    return (
        <div className="bottom-stats-bar h-12 flex items-center justify-center gap-8 px-6 text-sm">
            {stats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-1.5 text-text-muted">
                    <span className="font-semibold text-text-primary">{stat.value}</span>
                    <span>{stat.label}</span>
                </div>
            ))}
        </div>
    );
}
