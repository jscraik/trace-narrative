import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exportSessionLinkNote,
  getStoryAnchorStatus,
  getRepoHooksStatus,
  importSessionLinkNotesBatch,
  installRepoHooks,
  migrateAttributionNotesRef,
  reconcileAfterRewrite,
  uninstallRepoHooks,
  type StoryAnchorCommitStatus,
} from '../../core/story-anchors-api';

function areStringArraysEqual(left: string[] | null, right: string[] | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function StoryAnchorsPanel(props: {
  repoId: number | null;
  repoRoot: string | null;
  selectedCommitSha: string | null;
  indexedCommitShas?: string[] | null;
}) {
  const { repoId, repoRoot, selectedCommitSha, indexedCommitShas } = props;
  const [hookInstalled, setHookInstalled] = useState<boolean | null>(null);
  const [hooksDir, setHooksDir] = useState<string | null>(null);
  const [status, setStatus] = useState<StoryAnchorCommitStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const actionRequestVersionRef = useRef(0);
  const [repoCounts, setRepoCounts] = useState<{
    total: number;
    attribution: number;
    sessions: number;
    lineage: number;
    complete: number;
  } | null>(null);
  const refreshRequestVersionRef = useRef(0);
  const isMountedRef = useRef(true);
  const repoIdRef = useRef<number | null>(repoId);
  const repoRootRef = useRef<string | null>(repoRoot);
  const selectedCommitShaRef = useRef<string | null>(selectedCommitSha);
  const indexedCommitShasRef = useRef<string[] | null>(indexedCommitShas ?? null);

  useEffect(() => {
    repoIdRef.current = repoId;
    repoRootRef.current = repoRoot;
    selectedCommitShaRef.current = selectedCommitSha;
    indexedCommitShasRef.current = indexedCommitShas ?? null;
    setBusy(false);
    setExportProgress(null);
  }, [repoId, repoRoot, selectedCommitSha, indexedCommitShas]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canRun = Boolean(repoId && repoRoot);
  const canRunCommitActions = Boolean(repoId && selectedCommitSha);
  const canRunRepoActions = Boolean(repoId && indexedCommitShas && indexedCommitShas.length > 0);

  const refresh = useCallback(async () => {
    const expectedRepoId = repoId;
    const expectedRepoRoot = repoRoot;
    const expectedSelectedCommitSha = selectedCommitSha;
    const requestVersion = refreshRequestVersionRef.current + 1;
    refreshRequestVersionRef.current = requestVersion;
    const isStaleRequest = () =>
      !isMountedRef.current ||
      refreshRequestVersionRef.current !== requestVersion ||
      repoIdRef.current !== expectedRepoId ||
      repoRootRef.current !== expectedRepoRoot ||
      selectedCommitShaRef.current !== expectedSelectedCommitSha;

    if (!expectedRepoId || !expectedRepoRoot) return;

    try {
      const res = await getRepoHooksStatus(expectedRepoId);
      if (isStaleRequest()) return;
      setHookInstalled(res.installed);
      setHooksDir(res.hooksDir);
    } catch {
      if (isStaleRequest()) return;
      setHookInstalled(null);
      setHooksDir(null);
    }

    if (expectedSelectedCommitSha) {
      try {
        const rows = await getStoryAnchorStatus(expectedRepoId, [expectedSelectedCommitSha]);
        if (isStaleRequest()) return;
        setStatus(rows[0] ?? null);
      } catch {
        if (isStaleRequest()) return;
        setStatus(null);
      }
    } else {
      if (isStaleRequest()) return;
      setStatus(null);
    }
  }, [repoId, repoRoot, selectedCommitSha]);

  const beginAction = useCallback(() => {
    const expectedRepoId = repoIdRef.current;
    const expectedRepoRoot = repoRootRef.current;
    const expectedSelectedCommitSha = selectedCommitShaRef.current;
    const expectedIndexedCommitShas = indexedCommitShasRef.current
      ? [...indexedCommitShasRef.current]
      : null;
    const requestVersion = actionRequestVersionRef.current + 1;
    actionRequestVersionRef.current = requestVersion;
    const isStaleRequest = () =>
      !isMountedRef.current ||
      actionRequestVersionRef.current !== requestVersion ||
      repoIdRef.current !== expectedRepoId ||
      repoRootRef.current !== expectedRepoRoot ||
      selectedCommitShaRef.current !== expectedSelectedCommitSha ||
      !areStringArraysEqual(indexedCommitShasRef.current, expectedIndexedCommitShas);

    return {
      expectedRepoId,
      expectedSelectedCommitSha,
      expectedIndexedCommitShas,
      isStaleRequest,
    };
  }, []);

  const finalizeAction = useCallback(
    (isStaleRequest: () => boolean, clearExportProgress = false) => {
      if (!isMountedRef.current) return;
      if (isStaleRequest()) return;

      if (clearExportProgress) {
        setExportProgress(null);
      }
      setBusy(false);
      void refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border-light bg-bg-secondary p-4">
      <div>
        <div className="text-xs font-semibold text-text-secondary">Story Anchors</div>
        <div className="text-[11px] text-text-muted">
          Keep attribution + session links attached to commits via Git Notes, and sync automatically via git hooks.
        </div>
      </div>

      {!canRun ? (
        <div className="text-[11px] text-text-muted">Open a repo to manage Story Anchors.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-text-tertiary">
              Hooks: {hookInstalled === null ? 'Unknown' : hookInstalled ? 'Installed' : 'Not installed'}
            </span>
            {hooksDir ? (
              <span className="text-[11px] text-text-muted">
                (<span className="font-mono">{hooksDir}</span>)
              </span>
            ) : null}
            <button
              type="button"
              disabled={busy || !repoId}
              className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
              onClick={async () => {
                const { expectedRepoId, isStaleRequest } = beginAction();
                if (!expectedRepoId) return;
                setBusy(true);
                setMessage(null);
                try {
                  await installRepoHooks(expectedRepoId);
                  if (isStaleRequest()) return;
                  setMessage('Installed repo hooks.');
                } catch (e) {
                  if (isStaleRequest()) return;
                  setMessage(e instanceof Error ? e.message : String(e));
                } finally {
                  finalizeAction(isStaleRequest);
                }
              }}
            >
              Install hooks
            </button>
            <button
              type="button"
              disabled={busy || !repoId}
              className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
              onClick={async () => {
                const { expectedRepoId, isStaleRequest } = beginAction();
                if (!expectedRepoId) return;
                setBusy(true);
                setMessage(null);
                try {
                  await uninstallRepoHooks(expectedRepoId);
                  if (isStaleRequest()) return;
                  setMessage('Uninstalled repo hooks.');
                } catch (e) {
                  if (isStaleRequest()) return;
                  setMessage(e instanceof Error ? e.message : String(e));
                } finally {
                  finalizeAction(isStaleRequest);
                }
              }}
            >
              Uninstall hooks
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
              onClick={async () => {
                setMessage(null);
                await refresh();
              }}
            >
              Refresh
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-tertiary px-3 py-2">
            <div className="text-[11px] text-text-secondary font-semibold">
              Indexed commits: <span className="font-mono">{indexedCommitShas?.length ?? 0}</span>
            </div>
            {repoCounts ? (
              <div className="text-[11px] text-text-tertiary">
                Anchors: attribution {repoCounts.attribution}/{repoCounts.total} · sessions {repoCounts.sessions}/
                {repoCounts.total} · lineage {repoCounts.lineage}/{repoCounts.total} · complete {repoCounts.complete}/
                {repoCounts.total}
              </div>
            ) : (
              <div className="text-[11px] text-text-tertiary">
                Refresh to summarize Story Anchors coverage across indexed commits.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !canRunRepoActions || !repoId || !indexedCommitShas}
                className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                onClick={async () => {
                  const { expectedRepoId, expectedIndexedCommitShas, isStaleRequest } = beginAction();
                  if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
                  setBusy(true);
                  setMessage(null);
                  try {
                    const rows = await getStoryAnchorStatus(expectedRepoId, expectedIndexedCommitShas);
                    if (isStaleRequest()) return;
                    const total = rows.length;
                    const attribution = rows.filter((r) => r.hasAttributionNote).length;
                    const sessions = rows.filter((r) => r.hasSessionsNote).length;
                    const lineage = rows.filter((r) => r.hasLineageNote).length;
                    const complete = rows.filter(
                      (r) => r.hasAttributionNote && r.hasSessionsNote && r.hasLineageNote
                    ).length;
                    setRepoCounts({ total, attribution, sessions, lineage, complete });
                    setMessage(`Refreshed Story Anchors status for ${total} commits.`);
                } catch (e) {
                  if (isStaleRequest()) return;
                  setRepoCounts(null);
                  setMessage(e instanceof Error ? e.message : String(e));
                } finally {
                  finalizeAction(isStaleRequest);
                }
              }}
              >
                Refresh indexed status
              </button>
              <button
                type="button"
                disabled={busy || !canRunRepoActions || !repoId || !indexedCommitShas}
                className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                onClick={async () => {
                  const { expectedRepoId, expectedIndexedCommitShas, isStaleRequest } = beginAction();
                  if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
                  setBusy(true);
                  setMessage(null);
                  try {
                    const res = await importSessionLinkNotesBatch(expectedRepoId, expectedIndexedCommitShas);
                    if (isStaleRequest()) return;
                    setMessage(`Imported sessions notes: ${res.imported}/${res.total}.`);
                } catch (e) {
                  if (isStaleRequest()) return;
                  setMessage(e instanceof Error ? e.message : String(e));
                } finally {
                  finalizeAction(isStaleRequest);
                }
              }}
              >
                Import sessions notes
              </button>
              <button
                type="button"
                disabled={busy || !canRunRepoActions || !repoId || !indexedCommitShas}
                className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                onClick={async () => {
                  const { expectedRepoId, expectedIndexedCommitShas, isStaleRequest } = beginAction();
                  if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
                  setBusy(true);
                  setMessage(null);
                  setExportProgress({ done: 0, total: expectedIndexedCommitShas.length });
                  let ok = 0;
                  let failed = 0;
                  try {
                    for (let i = 0; i < expectedIndexedCommitShas.length; i += 1) {
                      const sha = expectedIndexedCommitShas[i];
                      try {
                        await exportSessionLinkNote(expectedRepoId, sha);
                        if (isStaleRequest()) return;
                        ok += 1;
                      } catch {
                        failed += 1;
                      } finally {
                        if (!isStaleRequest()) {
                          setExportProgress({ done: i + 1, total: expectedIndexedCommitShas.length });
                        }
                      }
                    }
                    if (isStaleRequest()) return;
                    setMessage(`Exported sessions notes: ok=${ok}, failed=${failed}.`);
                } finally {
                    finalizeAction(isStaleRequest, true);
                  }
                }}
              >
                Export sessions notes
              </button>
              <button
                type="button"
                disabled={busy || !canRunRepoActions || !repoId || !indexedCommitShas}
                className="inline-flex items-center rounded-md border border-accent-amber-light bg-accent-amber-bg px-2 py-1 text-[11px] font-semibold text-accent-amber hover:bg-accent-amber-light disabled:opacity-50"
                onClick={async () => {
                  const { expectedRepoId, expectedIndexedCommitShas, isStaleRequest } = beginAction();
                  if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
                  setBusy(true);
                  setMessage(null);
                  try {
                    const res = await migrateAttributionNotesRef(expectedRepoId, expectedIndexedCommitShas);
                    if (isStaleRequest()) return;
                    setMessage(`Migrate attribution ref: ${res.migrated}/${res.total}.`);
                } catch (e) {
                  if (isStaleRequest()) return;
                  setMessage(e instanceof Error ? e.message : String(e));
                } finally {
                  finalizeAction(isStaleRequest);
                }
              }}
            >
                Migrate attribution ref
              </button>
              <button
                type="button"
                disabled={busy || !canRunRepoActions || !repoId || !indexedCommitShas}
                className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                onClick={async () => {
                  const { expectedRepoId, expectedIndexedCommitShas, isStaleRequest } = beginAction();
                  if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
                  setBusy(true);
                  setMessage(null);
                  try {
                    const res = await reconcileAfterRewrite(expectedRepoId, expectedIndexedCommitShas, false);
                    if (isStaleRequest()) return;
                    setMessage(
                      `Reconcile (dry-run): recovered attribution=${res.recoveredAttribution}, sessions=${res.recoveredSessions}, wrote=${res.wroteNotes}.`
                    );
                } catch (e) {
                  if (isStaleRequest()) return;
                  setMessage(e instanceof Error ? e.message : String(e));
                } finally {
                  finalizeAction(isStaleRequest);
                }
              }}
            >
                Reconcile (dry-run)
              </button>
              <button
                type="button"
                disabled={busy || !canRunRepoActions || !repoId || !indexedCommitShas}
                className="inline-flex items-center rounded-md border border-accent-amber-light bg-accent-amber-bg px-2 py-1 text-[11px] font-semibold text-accent-amber hover:bg-accent-amber-light disabled:opacity-50"
                onClick={async () => {
                  const { expectedRepoId, expectedIndexedCommitShas, isStaleRequest } = beginAction();
                  if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
                  setBusy(true);
                  setMessage(null);
                  try {
                    const res = await reconcileAfterRewrite(expectedRepoId, expectedIndexedCommitShas, true);
                    if (isStaleRequest()) return;
                    setMessage(
                      `Reconcile (write): recovered attribution=${res.recoveredAttribution}, sessions=${res.recoveredSessions}, wrote=${res.wroteNotes}.`
                    );
                } catch (e) {
                  if (isStaleRequest()) return;
                  setMessage(e instanceof Error ? e.message : String(e));
                } finally {
                  finalizeAction(isStaleRequest);
                }
              }}
            >
                Reconcile (write)
              </button>
            </div>
            {exportProgress ? (
              <div className="text-[11px] text-text-muted">
                Exporting… {exportProgress.done}/{exportProgress.total}
              </div>
            ) : null}
          </div>

          {selectedCommitSha ? (
            <div className="mt-2 flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-tertiary px-3 py-2">
              <div className="text-[11px] text-text-secondary font-semibold">
                Selected commit: <span className="font-mono">{selectedCommitSha.slice(0, 8)}</span>
              </div>
              <div className="text-[11px] text-text-tertiary">
                Notes: attribution {status?.hasAttributionNote ? '✓' : '—'} · sessions{' '}
                {status?.hasSessionsNote ? '✓' : '—'} · lineage {status?.hasLineageNote ? '✓' : '—'}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !canRunCommitActions || !repoId || !selectedCommitSha}
                  className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                  onClick={async () => {
                    const { expectedRepoId, expectedSelectedCommitSha, isStaleRequest } = beginAction();
                    if (!expectedRepoId || !expectedSelectedCommitSha) return;
                    setBusy(true);
                    setMessage(null);
                    try {
                      const res = await importSessionLinkNotesBatch(expectedRepoId, [expectedSelectedCommitSha]);
                      if (isStaleRequest()) return;
                      setMessage(`Imported sessions note: ${res.imported}/${res.total}.`);
                    } catch (e) {
                      if (isStaleRequest()) return;
                      setMessage(e instanceof Error ? e.message : String(e));
                    } finally {
                      finalizeAction(isStaleRequest);
                    }
                  }}
                >
                  Import sessions note
                </button>
                <button
                  type="button"
                  disabled={busy || !canRunCommitActions || !repoId || !selectedCommitSha}
                  className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                  onClick={async () => {
                    const { expectedRepoId, expectedSelectedCommitSha, isStaleRequest } = beginAction();
                    if (!expectedRepoId || !expectedSelectedCommitSha) return;
                    setBusy(true);
                    setMessage(null);
                    try {
                      const res = await exportSessionLinkNote(expectedRepoId, expectedSelectedCommitSha);
                      if (isStaleRequest()) return;
                      setMessage(`Export sessions note: ${res.status}.`);
                    } catch (e) {
                      if (isStaleRequest()) return;
                      setMessage(e instanceof Error ? e.message : String(e));
                    } finally {
                      finalizeAction(isStaleRequest);
                    }
                  }}
                >
                  Export sessions note
                </button>
                <button
                  type="button"
                  disabled={busy || !canRunCommitActions || !repoId || !selectedCommitSha}
                  className="inline-flex items-center rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                  onClick={async () => {
                    const { expectedRepoId, expectedSelectedCommitSha, isStaleRequest } = beginAction();
                    if (!expectedRepoId || !expectedSelectedCommitSha) return;
                    setBusy(true);
                    setMessage(null);
                    try {
                      const res = await reconcileAfterRewrite(expectedRepoId, [expectedSelectedCommitSha], false);
                      if (isStaleRequest()) return;
                      setMessage(
                        `Reconcile: recovered attribution=${res.recoveredAttribution}, sessions=${res.recoveredSessions}.`
                      );
                    } catch (e) {
                      if (isStaleRequest()) return;
                      setMessage(e instanceof Error ? e.message : String(e));
                    } finally {
                      finalizeAction(isStaleRequest);
                    }
                  }}
                >
                  Reconcile (no write)
                </button>
                <button
                  type="button"
                  disabled={busy || !canRunCommitActions || !repoId || !selectedCommitSha}
                  className="inline-flex items-center rounded-md border border-accent-amber-light bg-accent-amber-bg px-2 py-1 text-[11px] font-semibold text-accent-amber hover:bg-accent-amber-light disabled:opacity-50"
                  onClick={async () => {
                    const { expectedRepoId, expectedSelectedCommitSha, isStaleRequest } = beginAction();
                    if (!expectedRepoId || !expectedSelectedCommitSha) return;
                    setBusy(true);
                    setMessage(null);
                    try {
                      const res = await reconcileAfterRewrite(expectedRepoId, [expectedSelectedCommitSha], true);
                      if (isStaleRequest()) return;
                      setMessage(
                        `Reconcile (write): recovered attribution=${res.recoveredAttribution}, sessions=${res.recoveredSessions}, wrote=${res.wroteNotes}.`
                      );
                    } catch (e) {
                      if (isStaleRequest()) return;
                      setMessage(e instanceof Error ? e.message : String(e));
                    } finally {
                      finalizeAction(isStaleRequest);
                    }
                  }}
                >
                  Reconcile (write)
                </button>
                <button
                  type="button"
                  disabled={busy || !canRunCommitActions || !repoId || !selectedCommitSha}
                  className="inline-flex items-center rounded-md border border-accent-amber-light bg-accent-amber-bg px-2 py-1 text-[11px] font-semibold text-accent-amber hover:bg-accent-amber-light disabled:opacity-50"
                  onClick={async () => {
                    const { expectedRepoId, expectedSelectedCommitSha, isStaleRequest } = beginAction();
                    if (!expectedRepoId || !expectedSelectedCommitSha) return;
                    setBusy(true);
                    setMessage(null);
                    try {
                      const res = await migrateAttributionNotesRef(expectedRepoId, [expectedSelectedCommitSha]);
                      if (isStaleRequest()) return;
                      setMessage(`Migrate attribution ref: ${res.migrated}/${res.total}.`);
                    } catch (e) {
                      if (isStaleRequest()) return;
                      setMessage(e instanceof Error ? e.message : String(e));
                    } finally {
                      finalizeAction(isStaleRequest);
                    }
                  }}
                >
                  Migrate attribution ref
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-text-muted">
              Select a commit to manage its session link note + reconcile status.
            </div>
          )}

          {message ? <div className="text-[11px] text-text-muted">{message}</div> : null}
        </>
      )}
    </div>
  );
}
