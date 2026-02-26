import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exportSessionLinkNote,
  getRepoHooksStatus,
  getStoryAnchorStatus,
  importSessionLinkNotesBatch,
  installRepoHooks,
  migrateAttributionNotesRef,
  reconcileAfterRewrite,
  uninstallRepoHooks,
  type StoryAnchorCommitStatus,
} from '../../core/story-anchors-api';
import {
  CommitActionsCard,
  HooksStatusRow,
  RepoActionsCard,
  type RepoAnchorCounts,
} from './story-anchors/StoryAnchorsSections';

function areStringArraysEqual(left: string[] | null, right: string[] | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

type StoryAnchorActionContext = {
  expectedRepoId: number | null;
  expectedSelectedCommitSha: string | null;
  expectedIndexedCommitShas: string[] | null;
  isStaleRequest: () => boolean;
};

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
  const [repoCounts, setRepoCounts] = useState<RepoAnchorCounts | null>(null);

  const actionRequestVersionRef = useRef(0);
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

    if (!expectedSelectedCommitSha) {
      if (!isStaleRequest()) setStatus(null);
      return;
    }

    try {
      const rows = await getStoryAnchorStatus(expectedRepoId, [expectedSelectedCommitSha]);
      if (isStaleRequest()) return;
      setStatus(rows[0] ?? null);
    } catch {
      if (isStaleRequest()) return;
      setStatus(null);
    }
  }, [repoId, repoRoot, selectedCommitSha]);

  const beginAction = useCallback((): StoryAnchorActionContext => {
    const expectedRepoId = repoIdRef.current;
    const expectedRepoRoot = repoRootRef.current;
    const expectedSelectedCommitSha = selectedCommitShaRef.current;
    const expectedIndexedCommitShas = indexedCommitShasRef.current ? [...indexedCommitShasRef.current] : null;
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
      if (!isMountedRef.current || isStaleRequest()) return;
      if (clearExportProgress) {
        setExportProgress(null);
      }
      setBusy(false);
      void refresh();
    },
    [refresh]
  );

  const runAction = useCallback(async (action: (context: StoryAnchorActionContext) => Promise<void>, options?: { clearExportProgress?: boolean }) => {
    const context = beginAction();
    if (!context.expectedRepoId) return;

    setBusy(true);
    setMessage(null);
    try {
      await action(context);
    } catch (error) {
      if (context.isStaleRequest()) return;
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      finalizeAction(context.isStaleRequest, options?.clearExportProgress ?? false);
    }
  }, [beginAction, finalizeAction]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const installHooksAction = () => void runAction(async ({ expectedRepoId, isStaleRequest }) => {
    if (!expectedRepoId) return;
    await installRepoHooks(expectedRepoId);
    if (isStaleRequest()) return;
    setMessage('Installed repo hooks.');
  });

  const uninstallHooksAction = () => void runAction(async ({ expectedRepoId, isStaleRequest }) => {
    if (!expectedRepoId) return;
    await uninstallRepoHooks(expectedRepoId);
    if (isStaleRequest()) return;
    setMessage('Uninstalled repo hooks.');
  });

  const refreshIndexedStatusAction = () => void runAction(async ({ expectedRepoId, expectedIndexedCommitShas, isStaleRequest }) => {
    if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
    const rows = await getStoryAnchorStatus(expectedRepoId, expectedIndexedCommitShas);
    if (isStaleRequest()) return;

    const total = rows.length;
    const attribution = rows.filter((row) => row.hasAttributionNote).length;
    const sessions = rows.filter((row) => row.hasSessionsNote).length;
    const lineage = rows.filter((row) => row.hasLineageNote).length;
    const complete = rows.filter((row) => row.hasAttributionNote && row.hasSessionsNote && row.hasLineageNote).length;

    setRepoCounts({ total, attribution, sessions, lineage, complete });
    setMessage(`Refreshed Story Anchors status for ${total} commits.`);
  });

  const importIndexedSessionNotesAction = () => void runAction(async ({ expectedRepoId, expectedIndexedCommitShas, isStaleRequest }) => {
    if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
    const result = await importSessionLinkNotesBatch(expectedRepoId, expectedIndexedCommitShas);
    if (isStaleRequest()) return;
    setMessage(`Imported sessions notes: ${result.imported}/${result.total}.`);
  });

  const exportIndexedSessionNotesAction = () => void runAction(async ({ expectedRepoId, expectedIndexedCommitShas, isStaleRequest }) => {
    if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;

    setExportProgress({ done: 0, total: expectedIndexedCommitShas.length });
    let ok = 0;
    let failed = 0;

    for (let index = 0; index < expectedIndexedCommitShas.length; index += 1) {
      const sha = expectedIndexedCommitShas[index];
      try {
        await exportSessionLinkNote(expectedRepoId, sha);
        if (isStaleRequest()) return;
        ok += 1;
      } catch {
        failed += 1;
      } finally {
        if (!isStaleRequest()) {
          setExportProgress({ done: index + 1, total: expectedIndexedCommitShas.length });
        }
      }
    }

    if (isStaleRequest()) return;
    setMessage(`Exported sessions notes: ok=${ok}, failed=${failed}.`);
  }, { clearExportProgress: true });

  const migrateIndexedAttributionAction = () => void runAction(async ({ expectedRepoId, expectedIndexedCommitShas, isStaleRequest }) => {
    if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
    const result = await migrateAttributionNotesRef(expectedRepoId, expectedIndexedCommitShas);
    if (isStaleRequest()) return;
    setMessage(`Migrate attribution ref: ${result.migrated}/${result.total}.`);
  });

  const reconcileIndexedAction = (write: boolean) => void runAction(async ({ expectedRepoId, expectedIndexedCommitShas, isStaleRequest }) => {
    if (!expectedRepoId || !expectedIndexedCommitShas?.length) return;
    const result = await reconcileAfterRewrite(expectedRepoId, expectedIndexedCommitShas, write);
    if (isStaleRequest()) return;
    setMessage(
      `Reconcile (${write ? 'write' : 'dry-run'}): recovered attribution=${result.recoveredAttribution}, sessions=${result.recoveredSessions}, wrote=${result.wroteNotes}.`
    );
  });

  const importSelectedSessionNoteAction = () => void runAction(async ({ expectedRepoId, expectedSelectedCommitSha, isStaleRequest }) => {
    if (!expectedRepoId || !expectedSelectedCommitSha) return;
    const result = await importSessionLinkNotesBatch(expectedRepoId, [expectedSelectedCommitSha]);
    if (isStaleRequest()) return;
    setMessage(`Imported sessions note: ${result.imported}/${result.total}.`);
  });

  const exportSelectedSessionNoteAction = () => void runAction(async ({ expectedRepoId, expectedSelectedCommitSha, isStaleRequest }) => {
    if (!expectedRepoId || !expectedSelectedCommitSha) return;
    const result = await exportSessionLinkNote(expectedRepoId, expectedSelectedCommitSha);
    if (isStaleRequest()) return;
    setMessage(`Export sessions note: ${result.status}.`);
  });

  const reconcileSelectedAction = (write: boolean) => void runAction(async ({ expectedRepoId, expectedSelectedCommitSha, isStaleRequest }) => {
    if (!expectedRepoId || !expectedSelectedCommitSha) return;
    const result = await reconcileAfterRewrite(expectedRepoId, [expectedSelectedCommitSha], write);
    if (isStaleRequest()) return;
    setMessage(
      write
        ? `Reconcile (write): recovered attribution=${result.recoveredAttribution}, sessions=${result.recoveredSessions}, wrote=${result.wroteNotes}.`
        : `Reconcile: recovered attribution=${result.recoveredAttribution}, sessions=${result.recoveredSessions}.`
    );
  });

  const migrateSelectedAttributionAction = () => void runAction(async ({ expectedRepoId, expectedSelectedCommitSha, isStaleRequest }) => {
    if (!expectedRepoId || !expectedSelectedCommitSha) return;
    const result = await migrateAttributionNotesRef(expectedRepoId, [expectedSelectedCommitSha]);
    if (isStaleRequest()) return;
    setMessage(`Migrate attribution ref: ${result.migrated}/${result.total}.`);
  });

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border-light bg-bg-secondary p-4">
      <div>
        <div className="text-xs font-semibold text-text-secondary">Story Anchors</div>
        <div className="text-[11px] text-text-muted">Keep attribution + session links attached to commits via Git Notes, and sync automatically via git hooks.</div>
      </div>

      {!canRun ? (
        <div className="text-[11px] text-text-muted">Open a repo to manage Story Anchors.</div>
      ) : (
        <>
          <HooksStatusRow
            hookInstalled={hookInstalled}
            hooksDir={hooksDir}
            busy={busy}
            canRun={Boolean(repoId)}
            onInstallHooks={installHooksAction}
            onUninstallHooks={uninstallHooksAction}
            onRefresh={() => void refresh()}
          />

          <RepoActionsCard
            indexedCount={indexedCommitShas?.length ?? 0}
            repoCounts={repoCounts}
            exportProgress={exportProgress}
            busy={busy}
            canRunRepoActions={canRunRepoActions}
            onRefreshIndexedStatus={refreshIndexedStatusAction}
            onImportSessionsNotes={importIndexedSessionNotesAction}
            onExportSessionsNotes={exportIndexedSessionNotesAction}
            onMigrateAttributionRef={migrateIndexedAttributionAction}
            onReconcileDryRun={() => reconcileIndexedAction(false)}
            onReconcileWrite={() => reconcileIndexedAction(true)}
          />

          {selectedCommitSha ? (
            <CommitActionsCard
              selectedCommitSha={selectedCommitSha}
              status={status}
              busy={busy}
              canRunCommitActions={canRunCommitActions}
              onImportSessionNote={importSelectedSessionNoteAction}
              onExportSessionNote={exportSelectedSessionNoteAction}
              onReconcileNoWrite={() => reconcileSelectedAction(false)}
              onReconcileWrite={() => reconcileSelectedAction(true)}
              onMigrateAttributionRef={migrateSelectedAttributionAction}
            />
          ) : (
            <div className="mt-2 text-[11px] text-text-muted">Select a commit to manage its session link note + reconcile status.</div>
          )}

          {message ? <div className="text-[11px] text-text-muted">{message}</div> : null}
        </>
      )}
    </div>
  );
}
