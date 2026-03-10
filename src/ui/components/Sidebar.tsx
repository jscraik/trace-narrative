import {
    BarChart3,
    GitBranch,
    BookOpen,
    Settings,
    Activity,
    History,
    Database,
    Zap,
    Clock,
    DollarSign,
    FileCode,
    ShieldCheck,
    Search,
    MessageSquare,
    FileSearch,
    LibraryBig,
    Bot,
    Brain,
    PlugZap,
    FolderGit2,
    Layers3,
    HardDrive,
    Workflow,
    TerminalSquare,
    Sparkles,
    ShieldAlert,
    PackageSearch,
    KeyRound
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import type {
    Mode
} from '../../core/types';
import clsx from 'clsx';

interface SidebarProps {
    mode: Mode;
    onModeChange: (mode: Mode) => void;
    onOpenRepo?: () => void;
    onImportSession?: () => void;
}

export function Sidebar({ mode, onModeChange, onOpenRepo, onImportSession }: SidebarProps) {
    const NavItem = ({ id, label, icon: Icon, badge, status }: {
        id: Mode;
        label: string;
        icon: ComponentType<{ className?: string }>;
        badge?: ReactNode;
        status?: string
    }) => {
        const isActive = mode === id;

        return (
            <button
                type="button"
                onClick={() => onModeChange(id)}
                className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                    isActive
                        ? "nav-item-active shadow-sm"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                )}
            >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{label}</span>
                {badge !== undefined && (
                    <span className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        typeof badge === 'number' ? "text-accent-blue" : "bg-bg-tertiary text-text-muted"
                    )}>
                        {badge}
                    </span>
                )}
                {status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-green-bg text-accent-green font-medium">
                        {status}
                    </span>
                )}
            </button>
        );
    };

    const SectionLabel = ({ children }: { children: ReactNode }) => (
        <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted opacity-60">
            {children}
        </div>
    );

    return (
        <aside className="w-60 flex-shrink-0 flex flex-col border-r border-border-subtle bg-bg-secondary h-screen sticky top-0">
            {/* Brand */}
            <div className="h-14 flex items-center gap-3 px-4 border-b border-border-subtle relative group cursor-default">
                <div className="absolute inset-0 bg-accent-violet/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl rounded-full translate-x-[-20%] translate-y-[-20%]" />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-violet-bg shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                    <Zap className="w-5 h-5 text-accent-violet" />
                </div>
                <span className="font-bold text-sm tracking-tight text-text-primary">Trace Narrative</span>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto scrollbar-thin">
                <div>
                    <SectionLabel>Overview</SectionLabel>
                    <div className="space-y-1">
                        <NavItem id="dashboard" label="Overview" icon={BarChart3} />
                        <NavItem id="work-graph" label="Workspace Graph" icon={Activity} />
                        <NavItem id="assistant" label="Story Copilot" icon={MessageSquare} badge="Beta" />
                    </div>
                </div>

                <div>
                    <SectionLabel>Monitor</SectionLabel>
                    <div className="space-y-1">
                        <NavItem id="live" label="Live Trace" icon={Zap} />
                        <NavItem id="sessions" label="Sessions" icon={Clock} badge={12} />
                        <NavItem id="transcripts" label="Transcript Lens" icon={FileSearch} />
                        <NavItem id="tools" label="Tool Pulse" icon={Sparkles} />
                        <NavItem id="costs" label="Costs" icon={DollarSign} />
                        <NavItem id="timeline" label="Decision Timeline" icon={History} />
                    </div>
                </div>

                <div>
                    <SectionLabel>Workspace</SectionLabel>
                    <div className="space-y-1">
                        <NavItem id="repo" label="Repos" icon={GitBranch} badge={4} />
                        <NavItem id="repo-pulse" label="Workspace Pulse" icon={FolderGit2} />
                        <NavItem id="diffs" label="Diff Review" icon={FileCode} />
                        <NavItem id="snapshots" label="Checkpoints" icon={Layers3} />
                        <NavItem id="worktrees" label="Worktrees" icon={Workflow} />
                        <NavItem id="attribution" label="Trace Lens" icon={ShieldCheck} />
                    </div>
                </div>

                <div>
                    <SectionLabel>Ecosystem</SectionLabel>
                    <div className="space-y-1">
                        <NavItem id="skills" label="Skills" icon={LibraryBig} />
                        <NavItem id="agents" label="Agent Roles" icon={Bot} />
                        <NavItem id="memory" label="Memory Graph" icon={Brain} />
                        <NavItem id="hooks" label="Hooks" icon={PlugZap} />
                        <NavItem id="setup" label="Setup" icon={TerminalSquare} />
                        <NavItem id="ports" label="Ports" icon={HardDrive} />
                    </div>
                </div>

                <div>
                    <SectionLabel>Health</SectionLabel>
                    <div className="space-y-1">
                        <NavItem id="hygiene" label="Cleanup Queue" icon={ShieldAlert} />
                        <NavItem id="deps" label="Dependency Watch" icon={PackageSearch} />
                        <NavItem id="env" label="Env Hygiene" icon={KeyRound} />
                        <NavItem id="status" label="Trust Center" icon={ShieldCheck} status="OK" />
                    </div>
                </div>

                <div>
                    <SectionLabel>Config</SectionLabel>
                    <div className="space-y-1">
                        <NavItem id="docs" label="Docs" icon={BookOpen} />
                        <NavItem id="settings" label="Settings" icon={Settings} />
                    </div>
                </div>

                <div>
                    <SectionLabel>Actions</SectionLabel>
                    <div className="space-y-1">
                        <button
                            type="button"
                            onClick={onOpenRepo}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-200"
                        >
                            <GitBranch className="w-4 h-4" />
                            <span className="flex-1 text-left">Open Repo</span>
                        </button>
                        <button
                            type="button"
                            onClick={onImportSession}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-200"
                        >
                            <Database className="w-4 h-4" />
                            <span className="flex-1 text-left">Import Session</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Footer / Search */}
            <div className="p-3 border-t border-border-subtle">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-primary border border-border-subtle text-text-muted cursor-pointer hover:bg-bg-hover transition-colors">
                    <Search className="w-3.5 h-3.5" />
                    <span className="text-xs">Quick search...</span>
                    <span className="ml-auto text-[10px] border border-border-subtle px-1 rounded opacity-50">⌘K</span>
                </div>
            </div>
        </aside>
    );
}
