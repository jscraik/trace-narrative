import type { BranchViewModel } from '../../core/types';

/**
 * BranchSummaryBar — a compact, one-line summary at the top of BranchView.
 *
 * Answers "what happened?" at a glance: commit count, file count,
 * and the narrative headline.
 */
export function BranchSummaryBar({
    model,
}: {
    model: BranchViewModel;
}) {
    const commitCount = model.timeline.filter((n) => n.type === 'commit').length;
    const fileCount = model.stats.files;
    const headline =
        model.narrative?.summary ||
        model.title ||
        (commitCount === 1
            ? '1 commit'
            : `${commitCount} commits`) +
        (fileCount ? ` across ${fileCount} files` : '');

    return (
        <div
            className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-secondary px-4 py-2.5 stagger-enter"
            style={{ '--stagger-index': 0 } as React.CSSProperties}
        >
            <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1 rounded-md bg-accent-amber-bg border border-accent-amber-light px-2 py-0.5 text-accent-amber font-semibold">
                    {commitCount}
                </span>
                <span>commits</span>
                <span className="text-border-light">·</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-primary border border-border-subtle px-2 py-0.5 text-text-secondary font-semibold">
                    {fileCount}
                </span>
                <span>files</span>
            </div>
            {model.narrative && (
                <>
                    <div className="h-3 w-px bg-border-light" aria-hidden="true" />
                    <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${model.narrative.confidence > 0.8 ? 'bg-accent-green' : 'bg-accent-amber'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                            Narration {Math.round(model.narrative.confidence * 100)}%
                        </span>
                    </div>
                </>
            )}
            <div className="h-3 w-px bg-border-light" aria-hidden="true" />
            <div className="flex-1 truncate text-sm font-medium text-text-primary">
                {headline}
            </div>
        </div>
    );
}
