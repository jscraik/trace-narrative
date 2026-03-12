import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import {
  BookOpen,
  Compass,
  FileText,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  Waypoints,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { Mode } from '../../core/types';

type ModeMeta = {
  label: string;
  note: string;
  section: 'Narrative' | 'Evidence' | 'Workspace' | 'Integrations' | 'Health' | 'Configure';
};

const MODE_LABELS: Record<Mode, ModeMeta> = {
  dashboard: {
    label: 'Narrative Brief',
    note: 'Dense operator overview for what moved, what is risky, and where to verify next.',
    section: 'Narrative',
  },
  repo: {
    label: 'Repo Evidence',
    note: 'Commit-linked files, diffs, sessions, and checkpoints for branch verification.',
    section: 'Workspace',
  },
  docs: {
    label: 'Docs',
    note: 'Secondary reference lane for runbooks, guides, and repo-facing documentation.',
    section: 'Configure',
  },
  live: {
    label: 'Live Capture',
    note: 'Operator tape for active sessions, stream health, and capture posture.',
    section: 'Evidence',
  },
  sessions: {
    label: 'Sessions',
    note: 'Indexed session ledger with join confidence, follow-through, and next action.',
    section: 'Evidence',
  },
  transcripts: {
    label: 'Transcript Lens',
    note: 'Query-first search surface for transcript snippets and source coverage.',
    section: 'Evidence',
  },
  tools: {
    label: 'Tool Pulse',
    note: 'Secondary operator summary for tool usage and retry signals.',
    section: 'Evidence',
  },
  costs: {
    label: 'Cost Watch',
    note: 'Secondary operator summary for spend posture and burn signals.',
    section: 'Evidence',
  },
  setup: {
    label: 'Setup',
    note: 'Configure imports, capture, and Codex-first operator readiness.',
    section: 'Integrations',
  },
  ports: {
    label: 'Ports',
    note: 'Watch runtime surfaces and connection points.',
    section: 'Integrations',
  },
  'work-graph': {
    label: 'Story Map',
    note: 'Topology and prioritization view for pressure points, weak joins, and next inspection.',
    section: 'Narrative',
  },
  'repo-pulse': {
    label: 'Workspace Pulse',
    note: 'Secondary workspace summary around the active repo lane.',
    section: 'Workspace',
  },
  timeline: {
    label: 'Causal Timeline',
    note: 'Chronology-first review of change sequence, evidence joins, and trust handoffs.',
    section: 'Evidence',
  },
  diffs: {
    label: 'Diff Review',
    note: 'Inspect raw file deltas and branch-level evidence changes.',
    section: 'Workspace',
  },
  snapshots: {
    label: 'Checkpoints',
    note: 'Compare branch state against saved checkpoints and rollback markers.',
    section: 'Workspace',
  },
  skills: {
    label: 'Codex Skills',
    note: 'Skill and tool-chain surfaces connected to the repo workflow.',
    section: 'Integrations',
  },
  agents: {
    label: 'Agent Roles',
    note: 'Role surfaces and operator lanes for agent execution.',
    section: 'Integrations',
  },
  memory: {
    label: 'Memory Graph',
    note: 'Persistent memory links that support repo narrative context.',
    section: 'Integrations',
  },
  hooks: {
    label: 'Hooks',
    note: 'Observe and refine shell-level automation touchpoints.',
    section: 'Integrations',
  },
  hygiene: {
    label: 'Hygiene',
    note: 'Cleanup, stale-state checks, and safe maintenance work.',
    section: 'Health',
  },
  deps: {
    label: 'Dependency Watch',
    note: 'Track dependency risk without overselling it as a primary workflow.',
    section: 'Health',
  },
  worktrees: {
    label: 'Worktrees',
    note: 'Compare parallel lanes and branch isolation state.',
    section: 'Workspace',
  },
  env: {
    label: 'Env Hygiene',
    note: 'Environment drift and credential posture checks.',
    section: 'Health',
  },
  settings: {
    label: 'Settings',
    note: 'Operator contract for capture, trust, scope, and Codex-first defaults.',
    section: 'Configure',
  },
  assistant: {
    label: 'Narrative Brief',
    note: 'Codex-guided asks now live inside stronger evidence views.',
    section: 'Narrative',
  },
  attribution: {
    label: 'Attribution Lens',
    note: 'Inspect contributor and provenance metadata behind branch claims.',
    section: 'Workspace',
  },
  status: {
    label: 'Trust Center',
    note: 'Decide what is safe to believe now and which verification lane opens next.',
    section: 'Health',
  },
};

const sectionIcon = {
  Narrative: LayoutDashboard,
  Evidence: Waypoints,
  Workspace: GitBranch,
  Integrations: Compass,
  Health: FileText,
  Configure: BookOpen,
} as const;

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
    children,
  } = props;

  const currentModeMeta = MODE_LABELS[mode];
  const CurrentSectionIcon = sectionIcon[currentModeMeta.section];
  const secondaryRoutes = mode === 'docs'
    ? [{ mode: 'dashboard' as const, label: 'Back to Brief' }]
    : [{ mode: 'repo' as const, label: 'Repo Evidence' }, { mode: 'dashboard' as const, label: 'Narrative Brief' }]
        .filter((route) => route.mode !== mode);

  return (
    <header className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border-light bg-bg-secondary/95 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            <span>Trace Narrative</span>
            <span className="text-border-light">/</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-bg-primary px-2 py-0.5 text-text-secondary">
              <CurrentSectionIcon className="h-3 w-3" />
              {currentModeMeta.section}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-3">
            <span className="truncate text-sm font-medium text-text-primary">{currentModeMeta.label}</span>
            <span className="hidden truncate text-xs text-text-muted xl:block">{currentModeMeta.note}</span>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {secondaryRoutes.map((route) => (
            <button
              key={route.mode}
              type="button"
              onClick={() => onModeChange(route.mode)}
              className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
            >
              {route.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 justify-self-end">
        {repoPath ? (
          <div className="hidden max-w-[32ch] truncate rounded-full border border-border-light bg-bg-primary px-3 py-1 text-xs text-text-muted xl:block" title={repoPath}>
            {repoPath}
          </div>
        ) : null}

        <ImportMenu
          onImportSession={onImportSession}
          onImportKimiSession={onImportKimiSession}
          onImportAgentTrace={onImportAgentTrace}
          importEnabled={importEnabled}
        />

        {children}

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-3 py-1.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:brightness-95"
          onClick={onOpenRepo}
        >
          <FolderOpen className="h-4 w-4" />
          Open repo...
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
          className="inline-flex items-center gap-2 rounded-lg border border-border-light bg-bg-primary px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
        >
          Import
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="end"
          className="z-50 min-w-[14rem] rounded-2xl border border-border-light bg-bg-primary p-2 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.7)]"
        >
          {onImportSession ? (
            <DropdownMenu.Item
              onSelect={onImportSession}
              disabled={importEnabled === false}
              className={menuItemClass}
            >
              Import Codex Session
            </DropdownMenu.Item>
          ) : null}
          {onImportKimiSession ? (
            <DropdownMenu.Item onSelect={onImportKimiSession} className={menuItemClass}>
              Import Kimi Session
            </DropdownMenu.Item>
          ) : null}
          {onImportAgentTrace ? (
            <DropdownMenu.Item onSelect={onImportAgentTrace} className={menuItemClass}>
              Import Agent Trace
            </DropdownMenu.Item>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const menuItemClass = clsx(
  'rounded-xl px-3 py-2 text-sm text-text-secondary outline-none transition',
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
  'data-[highlighted]:bg-bg-secondary data-[highlighted]:text-text-primary',
);
