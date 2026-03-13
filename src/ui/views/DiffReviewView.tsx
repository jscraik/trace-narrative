import { ArrowRight, ArrowUpRight, Clock3, Bot, Code2, GitMerge } from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode, SessionExcerpt } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { DashboardTrustBadge } from '../components/dashboard/DashboardTrustBadge';
import {
  buildNarrativeSurfaceViewModel,
  type SurfaceAction,
} from './narrativeSurfaceData';
import {
  ActivitySection,
  CompactKpiStrip,
  SummaryTable,
} from './narrativeSurfaceSections';

interface DiffReviewViewProps {
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  autoIngestEnabled?: boolean;
  onModeChange: (mode: Mode) => void;
  onOpenRepo: () => void;
  onImportSession?: () => void;
  onAction?: (action: SurfaceAction) => void;
}

function getRepoPath(repoState: RepoState): string {
  if (repoState.status === 'ready') return repoState.repo.root;
  if (repoState.status !== 'idle') return repoState.path ?? '~/dev/trace-narrative';
  return '~/dev/trace-narrative';
}

function getBranchName(repoState: RepoState): string {
  if (repoState.status === 'ready' && repoState.model.meta?.branchName) {
    return repoState.model.meta.branchName;
  }
  return 'main';
}

function groupSessions(sessions: SessionExcerpt[]) {
  const today: SessionExcerpt[] = [];
  const yesterday: SessionExcerpt[] = [];
  const thisWeek: SessionExcerpt[] = [];

  const now = new Date();
  
  sessions.forEach(session => {
    if (!session.importedAtISO) {
      today.push(session);
      return;
    }
    const date = new Date(session.importedAtISO);
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays <= 1 && now.getDate() === date.getDate()) {
      today.push(session);
    } else if (diffDays <= 2) {
      yesterday.push(session);
    } else {
      thisWeek.push(session);
    }
  });

  return { today, yesterday, thisWeek };
}

function formatTimeAgo(iso?: string) {
  if (!iso) return 'just now';
  const date = new Date(iso);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function SessionRow({ session, branchName, onAction }: { session: SessionExcerpt, branchName: string, onAction?: (action: Exclude<SurfaceAction, string>) => void }) {
  const fileCount = session.messages.reduce((acc, m) => acc + (m.files?.length || 0), 0) || 1;
  const editCount = session.messages.length * 2; // mock implementation
  const title = session.agentName || `${session.tool} session`;

  return (
    <button
      type="button"
      onClick={() => onAction?.({ type: 'open_evidence', evidenceId: `session:${session.id}` })}
      className="group flex w-full items-center justify-between gap-4 rounded-xl border border-transparent p-3 transition hover:border-border-subtle hover:bg-bg-secondary/40 text-left"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-light bg-bg-primary text-text-secondary">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex flex-col truncate">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-primary group-hover:text-accent-violet transition-colors">{title}</span>
            <span className="text-border-strong">·</span>
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary"><GitMerge className="h-3 w-3" />{branchName}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-text-secondary">
              <Code2 className="h-3 w-3" />
              {fileCount} files
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-text-secondary">
              {editCount} edits
            </span>
            <span className="text-border-strong">·</span>
            <span className="text-xs text-text-muted">{formatTimeAgo(session.importedAtISO)}</span>
          </div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-text-muted opacity-0 transition group-hover:opacity-100 group-hover:translate-x-1" />
    </button>
  );
}

export function DiffReviewView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOpenRepo,
  onImportSession,
  onAction,
}: DiffReviewViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('diffs', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);
  const branchName = getBranchName(repoState);
  
  const sessions = repoState.status === 'ready' && repoState.model.sessionExcerpts 
    ? repoState.model.sessionExcerpts 
    : [
        { id: 'mock-1', tool: 'codex', agentName: 'Lede card redesign', messages: [{role: 'user', text: ''}], importedAtISO: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
        { id: 'mock-2', tool: 'claude-code', agentName: 'Fix layout bugs', messages: [{role: 'user', text: ''}, {role: 'user', text: ''}], importedAtISO: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
        { id: 'mock-3', tool: 'cursor', agentName: 'Update deps', messages: [{role: 'user', text: ''}], importedAtISO: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() },
        { id: 'mock-4', tool: 'codex', agentName: 'Refactor Timeline', messages: [{role: 'user', text: ''}], importedAtISO: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString() },
      ] as SessionExcerpt[];

  const { today, yesterday, thisWeek } = groupSessions(sessions);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className="border-b border-border-subtle bg-bg-secondary/90 px-6 py-5 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Workspace
                </span>
                <DashboardTrustBadge trustState={viewModel.trustState} />
                <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1 text-xs text-text-secondary">
                  <Clock3 className="h-3.5 w-3.5" />
                  {repoPath}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-text-primary">{viewModel.title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{viewModel.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onImportSession}
                className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
              >
                <ArrowUpRight className="h-4 w-4" />
                Import session
              </button>
              <button
                type="button"
                onClick={onOpenRepo}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-110"
              >
                Open repo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <CompactKpiStrip metrics={viewModel.metrics} />

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="flex flex-col gap-4 rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Review Window</p>
                  <h2 className="mt-1 text-xl font-semibold text-text-primary">Recent Sessions</h2>
                </div>
              </div>
              
              <div className="flex flex-col gap-6 mt-2">
                {today.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted pl-3">Today</h3>
                    <div className="flex flex-col">
                      {today.map(session => (
                        <SessionRow key={session.id} session={session} branchName={branchName} onAction={onAction} />
                      ))}
                    </div>
                  </div>
                )}
                
                {yesterday.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted pl-3">Yesterday</h3>
                    <div className="flex flex-col">
                      {yesterday.map(session => (
                        <SessionRow key={session.id} session={session} branchName={branchName} onAction={onAction} />
                      ))}
                    </div>
                  </div>
                )}
                
                {thisWeek.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted pl-3">This Week</h3>
                    <div className="flex flex-col">
                      {thisWeek.map(session => (
                        <SessionRow key={session.id} session={session} branchName={branchName} onAction={onAction} />
                      ))}
                    </div>
                  </div>
                )}

                {sessions.length === 0 && (
                  <div className="py-8 text-center text-sm text-text-secondary border border-dashed border-border-light rounded-2xl">
                    No sessions found in the recent window.
                  </div>
                )}
              </div>
            </article>

            <ActivitySection
              title={viewModel.activityTitle}
              activity={viewModel.activity}
              onAction={onAction}
            />
          </section>

          <SummaryTable
            title={viewModel.tableTitle}
            columns={viewModel.tableColumns}
            rows={viewModel.tableRows}
            onAction={onAction}
          />

          <section className="rounded-3xl border border-border-subtle bg-bg-secondary px-5 py-4">
            <p className="text-sm leading-6 text-text-secondary">{viewModel.footerNote}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
