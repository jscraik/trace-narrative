import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Link2,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { DashboardTrustBadge } from '../components/dashboard/DashboardTrustBadge';
import { buildNarrativeSurfaceViewModel, type SurfaceAction } from './narrativeSurfaceData';
import { describeSurfaceTrust } from './dashboardState';
import { AuthorityCue } from './narrativeSurfaceSections';

interface SessionsViewProps {
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  autoIngestEnabled?: boolean;
  onModeChange: (mode: Mode) => void;
  onOpenRepo: () => void;
  onImportSession?: () => void;
  onAction?: (action: SurfaceAction) => void;
}

const badgeClasses = {
  healthy: 'border-accent-green-light bg-accent-green-bg text-accent-green',
  watch: 'border-accent-amber-light bg-accent-amber-bg text-accent-amber',
  weak: 'border-accent-red-light bg-accent-red-bg text-accent-red',
} as const;

function getRepoPath(repoState: RepoState): string {
  if (repoState.status === 'ready') return repoState.repo.root;
  if (repoState.status !== 'idle') return repoState.path ?? '~/dev/trace-narrative';
  return '~/dev/trace-narrative';
}

function formatLinkState(confidence?: number, linkedCommitSha?: string) {
  if (!linkedCommitSha) return { label: 'Needs join', className: badgeClasses.weak };
  if ((confidence ?? 0) >= 0.8) return { label: 'Strong join', className: badgeClasses.healthy };
  return { label: 'Review join', className: badgeClasses.watch };
}

function formatImportedAt(importedAtISO?: string, fallbackIndex?: number) {
  if (!importedAtISO) return fallbackIndex === undefined ? 'Recent import' : `Batch ${fallbackIndex + 1}`;
  return new Date(importedAtISO).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SessionsView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onModeChange,
  onOpenRepo,
  onImportSession,
  onAction,
}: SessionsViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('sessions', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);
  const trustDescriptor = describeSurfaceTrust(captureReliabilityStatus);
  const nextMode = trustDescriptor.trustState === 'healthy' ? 'repo' : 'status';
  const nextLabel = trustDescriptor.trustState === 'healthy' ? 'Open repo evidence' : 'Resolve trust posture';
  const NextIcon = trustDescriptor.trustState === 'healthy' ? ShieldCheck : ShieldAlert;
  const sessionExcerpts = repoState.status === 'ready' ? repoState.model.sessionExcerpts ?? [] : [];
  const queueItems = viewModel.activity.slice(0, 4);
  const lensItems = viewModel.highlights.slice(0, 3);

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
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{viewModel.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              Treat sessions like an indexed ledger. The first frame should tell us which traces are joined, which are still floating, and which one deserves repo follow-through now.
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
        <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
          <section className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
            <article
              className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5"
              data-authority-tier={viewModel.heroAuthorityTier}
              data-authority-label={viewModel.heroAuthorityLabel}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Session ledger</p>
                  <h2 className="mt-1 text-xl font-semibold text-text-primary">Indexed sessions with join confidence</h2>
                </div>
                <AuthorityCue authorityTier={viewModel.heroAuthorityTier} authorityLabel={viewModel.heroAuthorityLabel} />
              </div>

              <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-border-light bg-bg-primary/80">
                <table className="w-full border-collapse">
                  <thead className="border-b border-border-light bg-bg-secondary/70">
                    <tr>
                      {['Tool', 'Imported', 'Messages', 'Link', 'Next action'].map((column) => (
                        <th key={column} className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionExcerpts.length > 0 ? (
                      sessionExcerpts.map((session, index) => {
                        const linkState = formatLinkState(session.linkConfidence, session.linkedCommitSha);
                        return (
                          <tr key={session.id} className="border-b border-border-subtle last:border-b-0">
                            <td className="px-4 py-4 align-top">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-text-primary">{session.tool}</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-text-muted">{session.agentName ?? 'Operator session'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top text-sm text-text-secondary">{formatImportedAt(session.importedAtISO, index)}</td>
                            <td className="px-4 py-4 align-top text-sm text-text-secondary">{session.messages.length}</td>
                            <td className="px-4 py-4 align-top">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] ${linkState.className}`}>
                                {linkState.label}
                              </span>
                              <p className="mt-2 text-xs text-text-muted">
                                {session.linkedCommitSha ? session.linkedCommitSha.slice(0, 7) : 'No commit linked yet'}
                              </p>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <button
                                type="button"
                                onClick={() => {
                                  if (session.linkedCommitSha) {
                                    onAction?.({ type: 'open_evidence', evidenceId: `commit:${session.linkedCommitSha}` });
                                    return;
                                  }
                                  onModeChange('repo');
                                }}
                                className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary transition hover:border-accent-blue-light hover:text-text-primary"
                              >
                                {session.linkedCommitSha ? 'Open evidence' : 'Review in repo'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-secondary">
                          No imported sessions yet. Bring one in, then use this ledger to tighten joins before cleanup or handoff.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <div className="grid gap-4">
              <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Join inspector</p>
                    <h2 className="mt-1 text-xl font-semibold text-text-primary">What makes a session usable</h2>
                  </div>
                  <AuthorityCue authorityTier={lensItems[0]?.authorityTier ?? viewModel.heroAuthorityTier} authorityLabel={lensItems[0]?.authorityLabel ?? viewModel.heroAuthorityLabel} />
                </div>
                <div className="mt-4 space-y-3">
                  {lensItems.map((highlight) => (
                    <article key={highlight.title} className="rounded-[1.25rem] border border-border-light bg-bg-primary/80 p-4">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{highlight.eyebrow}</p>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{highlight.title}</p>
                          <p className="mt-2 text-sm leading-6 text-text-secondary">{highlight.body}</p>
                        </div>
                        <AuthorityCue authorityTier={highlight.authorityTier} authorityLabel={highlight.authorityLabel} />
                      </div>
                    </article>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Queue signals</p>
                    <h2 className="mt-1 text-xl font-semibold text-text-primary">Session queues</h2>
                  </div>
                  <TimerReset className="h-4 w-4 text-text-muted" />
                </div>
                <div className="mt-4 space-y-3">
                  {queueItems.map((item, index) => (
                    <article
                      key={`${item.title}-${index}`}
                      className="rounded-[1.25rem] border border-border-light bg-bg-primary/80 p-4"
                      data-authority-tier={item.authorityTier}
                      data-authority-label={item.authorityLabel}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">{item.meta}</p>
                        </div>
                        <AuthorityCue authorityTier={item.authorityTier} authorityLabel={item.authorityLabel} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-border-light bg-bg-primary/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Link2 className="h-4 w-4 text-accent-blue" />
                    Session index surface
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    The ledger is the primary primitive here. If a session cannot be routed into evidence or trust review from one row, this surface is still too soft.
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
