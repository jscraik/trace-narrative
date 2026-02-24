import { useCallback, useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { detectCodexOtelPromptExport } from '../core/repo/codexConfig';
import { indexRepo, type IndexingProgress, type RepoIndex } from '../core/repo/indexer';
import { setActiveRepoRoot, setOtelReceiverEnabled } from '../core/tauri/otelReceiver';
import type { BranchViewModel } from '../core/types';
import {
  getAttributionPrefs,
  purgeAttributionPromptMeta,
  setAttributionPrefs,
  type AttributionPrefs,
  type AttributionPrefsUpdate
} from '../core/attribution-api';

export type RepoState =
  | { status: 'idle' }
  | { status: 'loading'; path: string }
  | { status: 'ready'; path: string; model: BranchViewModel; repo: RepoIndex }
  | { status: 'error'; path?: string; message: string };

export interface UseRepoLoaderReturn {
  repoState: RepoState;
  setRepoState: React.Dispatch<React.SetStateAction<RepoState>>;
  indexingProgress: IndexingProgress | null;
  codexPromptExport: { enabled: boolean | null; configPath: string | null };
  attributionPrefs: AttributionPrefs | null;
  actionError: string | null;
  setActionError: (error: string | null) => void;
  openRepo: () => Promise<void>;
  updateAttributionPrefs: (update: AttributionPrefsUpdate) => Promise<void>;
  purgeAttributionMetadata: () => Promise<void>;
  diffCache: React.MutableRefObject<{ clear(): void }>;
}

/**
 * Hook for loading and managing git repository state.
 * Handles repo selection, indexing, and OTLP receiver setup.
 */
export function useRepoLoader(): UseRepoLoaderReturn {
  const [repoState, setRepoState] = useState<RepoState>({ status: 'idle' });
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgress | null>(null);
  const [codexPromptExport, setCodexPromptExport] = useState<{
    enabled: boolean | null;
    configPath: string | null;
  }>({ enabled: null, configPath: null });
  const [attributionPrefs, setAttributionPrefsState] = useState<AttributionPrefs | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // LRU cache for commit diffs - bounded to prevent memory leaks
  const diffCache = useRef(new Map<string, string>());

  const repoStateRef = useRef(repoState);
  const attributionPrefsRequestVersionRef = useRef(0);
  const openRepoRequestVersionRef = useRef(0);

  useEffect(() => {
    repoStateRef.current = repoState;
  }, [repoState]);

  useEffect(() => {
    attributionPrefsRequestVersionRef.current += 1;
    const requestVersion = attributionPrefsRequestVersionRef.current;

    if (repoState.status !== 'ready') {
      setAttributionPrefsState(null);
      return;
    }

    const repoId = repoState.repo.repoId;
    getAttributionPrefs(repoId)
      .then((prefs) => {
        if (attributionPrefsRequestVersionRef.current !== requestVersion) return;
        const current = repoStateRef.current;
        if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
        setAttributionPrefsState(prefs);
      })
      .catch((e) => {
        if (attributionPrefsRequestVersionRef.current !== requestVersion) return;
        const current = repoStateRef.current;
        if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
        setActionError(e instanceof Error ? e.message : String(e));
      });
  }, [repoState]);

  const openRepo = useCallback(async () => {
    const requestVersion = openRepoRequestVersionRef.current + 1;
    openRepoRequestVersionRef.current = requestVersion;
    const isStaleRequest = () => openRepoRequestVersionRef.current !== requestVersion;

    const selected = await open({ directory: true, multiple: false, title: 'Select a git repository folder' });
    if (isStaleRequest()) return;
    if (!selected || Array.isArray(selected)) return;

    setRepoState({ status: 'loading', path: selected });
    setIndexingProgress({ phase: 'resolve', message: 'Preparing index…', current: 0, total: 1, percent: 0 });
    setActionError(null);

    const isActiveLoadingRequestForSelectedPath = () => {
      if (isStaleRequest()) return false;
      const current = repoStateRef.current;
      return current.status === 'loading' && current.path === selected;
    };

    try {
      const { model, repo } = await indexRepo(selected, 60, (progress) => {
        if (!isActiveLoadingRequestForSelectedPath()) return;
        setIndexingProgress((prev) => {
          const current = repoStateRef.current;
          if (current.status !== 'loading' || current.path !== selected) return prev;
          return progress;
        });
      });
      if (!isActiveLoadingRequestForSelectedPath()) return;
      setRepoState({ status: 'ready', path: selected, model, repo });
      setIndexingProgress(null);

      // Clear cache when loading a new repo to avoid stale data
      diffCache.current.clear();

      try {
        await setActiveRepoRoot(repo.root);
        if (isStaleRequest()) return;
        const receiverEnabled = model.traceConfig?.codexOtelReceiverEnabled ?? false;
        await setOtelReceiverEnabled(receiverEnabled);
        if (isStaleRequest()) return;
        const promptExport = await detectCodexOtelPromptExport();
        if (isStaleRequest()) return;
        setCodexPromptExport(promptExport);
        const prefs = await getAttributionPrefs(repo.repoId);
        if (isStaleRequest()) return;
        setAttributionPrefsState(prefs);
      } catch (e: unknown) {
        if (isStaleRequest()) return;
        setActionError(e instanceof Error ? e.message : String(e));
      }
    } catch (e: unknown) {
      if (!isActiveLoadingRequestForSelectedPath()) return;
      setRepoState({
        status: 'error',
        path: selected,
        message: e instanceof Error ? e.message : String(e)
      });
      setIndexingProgress(null);
    }
  }, []);

  const updateAttributionPrefs = useCallback(async (update: AttributionPrefsUpdate) => {
    if (repoStateRef.current.status !== 'ready') return;
    const repoId = repoStateRef.current.repo.repoId;
    try {
      const prefs = await setAttributionPrefs(repoId, update);
      const current = repoStateRef.current;
      if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
      setAttributionPrefsState(prefs);
    } catch (e: unknown) {
      const current = repoStateRef.current;
      if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const purgeAttributionMetadata = useCallback(async () => {
    if (repoStateRef.current.status !== 'ready') return;
    const repoId = repoStateRef.current.repo.repoId;
    try {
      await purgeAttributionPromptMeta(repoId);
      const prefs = await getAttributionPrefs(repoId);
      const current = repoStateRef.current;
      if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
      setAttributionPrefsState(prefs);
    } catch (e: unknown) {
      const current = repoStateRef.current;
      if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return {
    repoState,
    setRepoState,
    indexingProgress,
    codexPromptExport,
    attributionPrefs,
    actionError,
    setActionError,
    openRepo,
    updateAttributionPrefs,
    purgeAttributionMetadata,
    diffCache: diffCache as unknown as React.MutableRefObject<{ clear(): void }>,
  };
}
