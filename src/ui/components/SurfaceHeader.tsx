import type { ReactNode } from 'react';
import { DatabaseZap, FolderOpen } from 'lucide-react';
import type { DashboardTrustState } from '../../core/types';
import { DashboardTrustBadge } from './dashboard/DashboardTrustBadge';

interface SurfaceHeaderProps {
  title: string;
  category?: string;
  repoPath?: string;
  trustState?: DashboardTrustState;
  onOpenRepo?: () => void;
  onImportSession?: () => void;
  children?: ReactNode;
}

export function SurfaceHeader({
  title,
  category = 'Workspace',
  repoPath,
  trustState = 'healthy',
  onImportSession,
  onOpenRepo,
  children,
}: SurfaceHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-secondary/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {/* Category badge */}
        <span className="rounded-full border border-border-light bg-bg-primary px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted">
          {category}
        </span>
        
        <div className="h-3 w-px bg-border-strong opacity-50" />

        <h1 className="text-sm font-semibold text-text-primary">
          {title}
        </h1>

        <DashboardTrustBadge trustState={trustState} />

        {repoPath && (
          <span className="ml-2 truncate max-w-[200px] text-xs font-mono text-text-tertiary opacity-70">
            {repoPath}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onOpenRepo && (
          <button
            type="button"
            onClick={onOpenRepo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary active:scale-[0.98]"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open repo
          </button>
        )}
        {onImportSession && (
          <button
            type="button"
            onClick={onImportSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary active:scale-[0.98]"
          >
            <DatabaseZap className="h-3.5 w-3.5" />
            Import session
          </button>
        )}
        {children}
      </div>
    </header>
  );
}
