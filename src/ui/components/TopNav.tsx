import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import { BarChart3, BookOpen, FileText, FolderOpen, GitBranch } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';

import type { Mode } from '../../core/types';


export function TopNav(props: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  repoPath?: string | null;
  onOpenRepo: () => void;
  onImportSession?: () => void;
  onImportKimiSession?: () => void;
  onImportAgentTrace?: () => void;
  importEnabled?: boolean;
  children?: ReactNode;
}) {
  const {
    mode,
    onModeChange,
    repoPath,
    onOpenRepo,
    onImportSession,
    onImportKimiSession,
    onImportAgentTrace,
    importEnabled,
    children
  } = props;

  const isCockpitMode = (m: Mode) => m !== 'repo' && m !== 'docs';
  const surfaceLabel = mode === 'repo'
    ? 'Repo evidence'
    : mode === 'docs'
      ? 'Docs workspace'
      : 'Narrative surface';
  const surfaceNote = mode === 'repo'
    ? 'Commit-linked files, diffs, and trace evidence'
    : mode === 'docs'
      ? 'Guides, runbooks, and repo-facing documentation'
      : 'Codex-first reconstruction across story, evidence, and trust';

  const Tab = (p: { id: Mode; label: string; icon: ReactNode }) => {
    const isActive = p.id === 'dashboard' ? isCockpitMode(mode) : mode === p.id;
    return (
      <button
        role="tab"
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        className={clsx(
          'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75',
          isActive
            ? 'bg-bg-secondary text-text-primary shadow-sm'
            : 'text-text-tertiary hover:bg-bg-hover hover:text-text-secondary hover:scale-105 active:scale-95'
        )}
        onClick={() => onModeChange(p.id)}
        type="button"
      >
        {p.icon}
        <span>{p.label}</span>
      </button>
    );
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const order: Mode[] = ['repo', 'dashboard', 'docs'];
    const currentMode = isCockpitMode(mode) ? 'dashboard' : mode;
    const currentIndex = order.indexOf(currentMode as Mode);
    if (currentIndex === -1) return;
    if (event.key === 'Home') {
      onModeChange(order[0]);
      return;
    }
    if (event.key === 'End') {
      onModeChange(order[order.length - 1]);
      return;
    }
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + order.length) % order.length;
    onModeChange(order[nextIndex]);
  };

  return (
    <header className="grid h-14 w-full grid-cols-[1fr_auto_1fr] items-center border-b border-border-light bg-bg-secondary px-4">
      <div className="flex items-center gap-3 justify-self-start">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Trace Narrative
          </span>
          <span className="text-sm font-medium text-text-primary">{surfaceLabel}</span>
          <span className="hidden text-xs text-text-muted xl:block">{surfaceNote}</span>
        </div>
      </div>

      <nav className="justify-self-center" aria-label="Primary navigation">
        <div
          className="flex items-center gap-1 bg-bg-primary rounded-lg p-1"
          role="tablist"
          aria-label="View mode"
          onKeyDown={handleTabKeyDown}
        >


          <Tab id="repo" label="Repo" icon={<GitBranch className="h-4 w-4" />} />
          <Tab id="dashboard" label="Narrative" icon={<BarChart3 className="h-4 w-4" />} />
          <Tab id="docs" label="Docs" icon={<BookOpen className="h-4 w-4" />} />
        </div>
      </nav>

      <div className="flex items-center gap-3 justify-self-end">
        {repoPath ? (
          <div className="max-w-[44ch] truncate text-xs text-text-muted" title={repoPath}>
            {repoPath}
          </div>
        ) : null}

        {(
          <ImportMenu
            onImportSession={onImportSession}
            onImportKimiSession={onImportKimiSession}
            onImportAgentTrace={onImportAgentTrace}
            importEnabled={importEnabled}
          />
        )}

        {children}

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-3 py-1.5 text-sm font-medium text-accent-foreground hover:brightness-95 transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
          onClick={onOpenRepo}
        >
          <FolderOpen className="h-4 w-4" />
          Open repo…
        </button>
      </div>
    </header>
  );
}

function ImportMenu(props: {
  onImportSession?: () => void;
  onImportKimiSession?: () => void;
  onImportAgentTrace?: () => void;
  importEnabled?: boolean;
}) {
  const { onImportSession, onImportKimiSession, onImportAgentTrace, importEnabled } = props;

  if (!onImportSession && !onImportKimiSession && !onImportAgentTrace) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={!importEnabled}
          className={clsx(
            'inline-flex items-center justify-center rounded-lg p-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75',
            importEnabled
              ? 'bg-bg-primary text-text-secondary hover:bg-border-light hover:scale-110 active:scale-90'
              : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
          )}
          title="Import data"
          aria-label="Import data"
        >
          <FileText className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={clsx(
            'z-50 w-56 rounded-xl border border-border-light bg-bg-secondary p-1 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          {onImportSession && (
            <DropdownMenu.Item
              onSelect={onImportSession}
              className={clsx(
                'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors text-left',
                'text-text-secondary',
                'data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary'
              )}
            >
              Import session JSON…
            </DropdownMenu.Item>
          )}
          {onImportKimiSession && (
            <DropdownMenu.Item
              onSelect={onImportKimiSession}
              className={clsx(
                'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors text-left',
                'text-text-secondary',
                'data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary'
              )}
            >
              Import Kimi log…
            </DropdownMenu.Item>
          )}
          {onImportAgentTrace && (
            <DropdownMenu.Item
              onSelect={onImportAgentTrace}
              className={clsx(
                'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors text-left',
                'text-text-secondary',
                'data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary'
              )}
            >
              Import Agent Trace…
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
