import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Command,
  Hash,
  ScanSearch,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { DashboardTrustBadge } from '../components/dashboard/DashboardTrustBadge';
import { buildNarrativeSurfaceViewModel, type SurfaceAction } from './narrativeSurfaceData';
import { describeSurfaceTrust } from './dashboardState';
import { AuthorityCue } from './narrativeSurfaceSections';

interface TranscriptLensViewProps {
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  autoIngestEnabled?: boolean;
  onModeChange: (mode: Mode) => void;
  onOpenRepo: () => void;
  onImportSession?: () => void;
  onAction?: (action: SurfaceAction) => void;
}

type TranscriptResult = {
  sessionId: string;
  tool: string;
  linkedCommitSha?: string;
  importedAtISO?: string;
  role: string;
  text: string;
};

function getRepoPath(repoState: RepoState): string {
  if (repoState.status === 'ready') return repoState.repo.root;
  if (repoState.status !== 'idle') return repoState.path ?? '~/dev/trace-narrative';
  return '~/dev/trace-narrative';
}

export function TranscriptLensView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onModeChange,
  onOpenRepo,
  onImportSession,
  onAction,
}: TranscriptLensViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('transcripts', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);
  const trustDescriptor = describeSurfaceTrust(captureReliabilityStatus);
  const nextMode = trustDescriptor.trustState === 'healthy' ? 'repo' : 'status';
  const nextLabel = trustDescriptor.trustState === 'healthy' ? 'Verify in repo evidence' : 'Resolve trust first';
  const NextIcon = trustDescriptor.trustState === 'healthy' ? ShieldCheck : ShieldAlert;
  const sessionExcerpts = repoState.status === 'ready' ? repoState.model.sessionExcerpts ?? [] : [];
  const suggestedQueries = viewModel.highlights.slice(0, 4);
  const queryChips = [
    '> "update db"',
    '@a1b2c3d',
    'tool: execute',
    'revert "..."',
  ];
  const transcriptMessages: TranscriptResult[] = repoState.status === 'ready'
    ? sessionExcerpts.flatMap((session) =>
      session.messages.slice(0, 2).map((message) => ({
        sessionId: session.id,
        tool: session.tool,
        linkedCommitSha: session.linkedCommitSha,
        importedAtISO: session.importedAtISO,
        role: message.role,
        text: message.text,
      })),
    )
    : [];
  const resultGroups: TranscriptResult[] = transcriptMessages.length > 0
    ? transcriptMessages
    : [
      {
        sessionId: 'fallback-1',
        tool: 'codex',
        linkedCommitSha: undefined,
        importedAtISO: undefined,
        role: 'assistant',
        text: 'No indexed transcript snippets are available yet. Import a session to turn this into a real query-and-quote surface.',
      },
    ];
  const groupedResults = resultGroups.reduce<Array<{
    groupLabel: string;
    items: typeof resultGroups;
  }>>((groups, result) => {
    const groupLabel = result.linkedCommitSha ? `Linked ${result.linkedCommitSha.slice(0, 7)}` : `Unlinked ${result.tool}`;
    const existing = groups.find((group) => group.groupLabel === groupLabel);
    if (existing) {
      existing.items.push(result);
      return groups;
    }
    groups.push({ groupLabel, items: [result] });
    return groups;
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className="border-b border-border-subtle bg-bg-secondary/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Evidence
              </span>
              <DashboardTrustBadge trustState={viewModel.trustState} />
              <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1 text-xs text-text-secondary">
                <Clock3 className="h-3.5 w-3.5" />
                {repoPath}
              </span>
            </div>
            <h1 className="mt-2.5 text-[2rem] font-semibold tracking-tight text-text-primary">{viewModel.title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text-secondary">
              This view should behave like a query surface: suggested asks on the left, quoted snippets in the middle, coverage and follow-through on the right.
            </p>
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
              onClick={() => onModeChange(nextMode)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-110"
            >
              <NextIcon className="h-4 w-4" />
              {nextLabel}
            </button>
            <button
              type="button"
              onClick={onOpenRepo}
              className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
            >
              Open repo
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto grid max-w-[100rem] gap-5 xl:grid-cols-[0.8fr_1.22fr_0.72fr]">
          <article
            className="rounded-[1.6rem] border border-border-subtle bg-bg-secondary/80 p-4"
            data-authority-tier={viewModel.heroAuthorityTier}
            data-authority-label={viewModel.heroAuthorityLabel}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Query surface</p>
                <h2 className="mt-1 text-lg font-semibold text-text-primary">Ask transcript-first questions</h2>
              </div>
              <AuthorityCue authorityTier={viewModel.heroAuthorityTier} authorityLabel={viewModel.heroAuthorityLabel} />
            </div>

            <div className="mt-3 rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5">
              <div className="flex items-center gap-3 rounded-[0.95rem] border border-border-light bg-bg-secondary px-3 py-2.5 text-sm text-text-secondary">
                <ScanSearch className="h-4 w-4 text-accent-blue" />
                Search commits mentioned by the last planning session
                <span className="ml-auto rounded border border-border-light bg-bg-primary px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  / search
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {queryChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary"
                  >
                    <Hash className="h-3 w-3" />
                    {chip}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-sm leading-6 text-text-secondary">
                The search bar and chips stay visible first so this screen reads like a query console, not another summary page.
              </p>
            </div>

            <div className="mt-3 space-y-2.5">
              {suggestedQueries.map((highlight) => (
                <button
                  key={highlight.title}
                  type="button"
                  onClick={() => highlight.action && onAction?.(highlight.action)}
                  className="w-full rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-accent-blue-light hover:bg-bg-primary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{highlight.eyebrow}</p>
                      <p className="mt-1.5 text-sm font-semibold text-text-primary">{highlight.title}</p>
                    </div>
                    <AuthorityCue authorityTier={highlight.authorityTier} authorityLabel={highlight.authorityLabel} />
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary">{highlight.body}</p>
                </button>
              ))}
            </div>
          </article>

          <article className="rounded-[1.6rem] border border-border-subtle bg-bg-secondary/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Result groups</p>
                <h2 className="mt-1 text-lg font-semibold text-text-primary">Quoted snippets and source joins</h2>
              </div>
              <SearchCheck className="h-4 w-4 text-text-muted" />
            </div>

            <div className="mt-3 rounded-[1.1rem] border border-border-light bg-bg-primary/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    <Command className="h-3 w-3" />
                    {groupedResults.length} groups
                  </span>
                  <span className="inline-flex rounded-full border border-border-light bg-bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    {resultGroups.length} snippets
                  </span>
                </div>
                <span className="rounded-full border border-border-light bg-bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Read, verify, pivot
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {groupedResults.map((group) => (
                <section key={group.groupLabel} className="rounded-[1.1rem] border border-border-light bg-bg-primary/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                        Result lane
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-text-primary">{group.groupLabel}</h3>
                    </div>
                    <span className="rounded-full border border-border-light bg-bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                      {group.items.length} hit{group.items.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {group.items.map((result) => (
                      <article key={crypto.randomUUID()} className="group rounded-[1rem] border border-border-light bg-bg-primary/90 p-3.5 transition-colors hover:border-accent-blue-light/50 hover:bg-bg-primary">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{result.tool} · {result.role}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">
                              {result.importedAtISO
                                ? new Date(result.importedAtISO).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : 'Recent import'}
                            </p>
                          </div>
                          <span className="rounded-full border border-border-light bg-bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-secondary transition-colors group-hover:border-accent-blue-light/30">
                            {result.linkedCommitSha ? result.linkedCommitSha.slice(0, 7) : 'Unlinked'}
                          </span>
                        </div>
                        <blockquote className="mt-2.5 rounded-[0.95rem] border border-border-light bg-bg-secondary/80 px-3.5 py-2.5 text-sm leading-6 text-text-secondary transition-colors group-hover:border-accent-blue-light/30 group-hover:text-text-primary">
                          “{result.text}”
                        </blockquote>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (result.linkedCommitSha) {
                                onAction?.({ type: 'open_evidence', evidenceId: `commit:${result.linkedCommitSha}` });
                                return;
                              }
                              onModeChange('sessions');
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
                          >
                            {result.linkedCommitSha ? 'Open evidence' : 'Review joins'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onModeChange('repo')}
                            className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
                          >
                            Check repo context
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article className="rounded-[1.6rem] border border-border-subtle bg-bg-secondary/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Coverage rail</p>
                <h2 className="mt-1 text-lg font-semibold text-text-primary">Sources and follow-through</h2>
              </div>
              <AuthorityCue authorityTier={viewModel.metrics[0]?.authorityTier ?? viewModel.heroAuthorityTier} authorityLabel={viewModel.metrics[0]?.authorityLabel ?? viewModel.heroAuthorityLabel} />
            </div>

            <div className="mt-3 space-y-2.5">
              {viewModel.metrics.slice(0, 3).map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-[1.1rem] border border-border-light bg-bg-primary/80 p-3.5"
                  data-authority-tier={metric.authorityTier}
                  data-authority-label={metric.authorityLabel}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{metric.label}</p>
                      <p className="mt-1.5 text-base font-semibold text-text-primary">{metric.value}</p>
                    </div>
                    <AuthorityCue authorityTier={metric.authorityTier} authorityLabel={metric.authorityLabel} />
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary">{metric.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-3 rounded-[1.1rem] border border-border-light bg-bg-primary/70 p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <SearchCheck className="h-4 w-4 text-accent-blue" />
                Transcript query surface
              </div>
              <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                Search coverage belongs on the side rail. The quoted snippet stack should remain the dominant primitive so the operator can read, test, and pivot quickly.
              </p>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
