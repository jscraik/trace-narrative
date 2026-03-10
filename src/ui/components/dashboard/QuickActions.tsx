import { FolderOpen, Upload, Sparkles } from 'lucide-react';

interface QuickAction {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick?: () => void;
}

interface QuickActionsProps {
    repoName?: string;
    branchName?: string;
    onAnalyzeBranch?: () => void;
    onImportSession?: () => void;
    onAskAboutCode?: () => void;
}

export function QuickActions({
    repoName: _repoName,
    branchName,
    onAnalyzeBranch,
    onImportSession,
    onAskAboutCode,
}: QuickActionsProps) {
    const actions: QuickAction[] = [
        {
            title: 'Analyze Latest Branch',
            description: `Review recent changes and AI contributions${branchName ? ` on ${branchName}` : ''}`,
            icon: <FolderOpen className="w-5 h-5 text-accent-violet" />,
            onClick: onAnalyzeBranch,
        },
        {
            title: 'Import Session',
            description: 'Add Claude, Codex, or Kimi session logs to your timeline',
            icon: <Upload className="w-5 h-5 text-accent-blue" />,
            onClick: onImportSession,
        },
        {
            title: 'Ask About Your Code',
            description: 'Get AI-powered insights about patterns and decisions',
            icon: <Sparkles className="w-5 h-5 text-accent-amber" />,
            onClick: onAskAboutCode,
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {actions.map((action) => (
                <button
                    key={action.title}
                    type="button"
                    onClick={action.onClick}
                    className="glass-panel rounded-xl p-4 text-left cursor-pointer hover:border-border-light transition-colors group"
                >
                    <div className="flex items-center gap-2 mb-1.5">
                        {action.icon}
                        <span className="font-medium text-sm text-text-primary group-hover:text-accent-blue transition-colors">
                            {action.title}
                        </span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">
                        {action.description}
                    </p>
                </button>
            ))}
        </div>
    );
}
