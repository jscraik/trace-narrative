import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const isMountedRef = useRef(true);
  const openRepoPathRef = useRef<string | null>(null);

  // LRU cache for commit diffs - bounded to prevent memory leaks
  const diffCache = useRef(new Map<string, string>());

  const repoStateRef = useRef(repoState);
  const attributionPrefsRequestVersionRef = useRef(0);
  const openRepoRequestVersionRef = useRef(0);
  const attributionPrefsMutationVersionRef = useRef(0);
  const repoMutationScopeKey = useMemo(() => {
    switch (repoState.status) {
      case 'ready':
        return `ready:${repoState.repo.repoId}:${repoState.path}`;
      case 'loading':
        return `loading:${repoState.path}`;
      case 'error':
        return `error:${repoState.path ?? ''}:${repoState.message}`;
      default:
        return 'idle';
    }
  }, [repoState]);

  useEffect(() => {
    repoStateRef.current = repoState;
  }, [repoState]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      openRepoRequestVersionRef.current += 1;
      attributionPrefsMutationVersionRef.current += 1;
      attributionPrefsRequestVersionRef.current += 1;
    };
  }, []);

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
        if (!isMountedRef.current || attributionPrefsRequestVersionRef.current !== requestVersion) return;
        const current = repoStateRef.current;
        if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
        setAttributionPrefsState(prefs);
      })
      .catch((e) => {
        if (!isMountedRef.current || attributionPrefsRequestVersionRef.current !== requestVersion) return;
        const current = repoStateRef.current;
        if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
        setActionError(e instanceof Error ? e.message : String(e));
      });
  }, [repoState]);

  useEffect(() => {
    void repoMutationScopeKey;
    attributionPrefsMutationVersionRef.current += 1;
  }, [repoMutationScopeKey]);

  const openRepo = useCallback(async () => {
    const requestVersion = openRepoRequestVersionRef.current + 1;
    openRepoRequestVersionRef.current = requestVersion;
    const isStaleRequest = () => openRepoRequestVersionRef.current !== requestVersion;

    setActionError(null);

    let selected: string | null | string[] = null;
    try {
      selected = await open({ directory: true, multiple: false, title: 'Select a git repository folder' });
    } catch (e: unknown) {
      if (isStaleRequest()) return;
      setActionError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (isStaleRequest()) return;
    if (!selected || Array.isArray(selected)) return;

    setRepoState({ status: 'loading', path: selected });
    setIndexingProgress({ phase: 'resolve', message: 'Preparing index…', current: 0, total: 1, percent: 0 });

    const isActiveLoadingRequestForSelectedPath = () => {
      if (!isMountedRef.current || isStaleRequest()) return false;
      return openRepoPathRef.current === selected;
    };

    try {
      openRepoPathRef.current = selected;
      const { model, repo } = await indexRepo(selected, 60, (progress) => {
        if (!isActiveLoadingRequestForSelectedPath()) return;
        setIndexingProgress((prev) => {
          if (!isMountedRef.current) return prev;
          const current = repoStateRef.current;
          if (current.status !== 'loading' || current.path !== selected) return prev;
          return progress;
        });
      });
      if (!isActiveLoadingRequestForSelectedPath()) return;
      if (!isMountedRef.current) return;
      setRepoState({ status: 'ready', path: selected, model, repo });
      openRepoPathRef.current = selected;
      if (!isMountedRef.current) return;
      setIndexingProgress(null);

      // Clear cache when loading a new repo to avoid stale data
      diffCache.current.clear();

      try {
        if (!isActiveLoadingRequestForSelectedPath()) return;
        await setActiveRepoRoot(repo.root);
        if (!isActiveLoadingRequestForSelectedPath()) return;
        const receiverEnabled = model.traceConfig?.codexOtelReceiverEnabled ?? false;
        await setOtelReceiverEnabled(receiverEnabled);
        if (!isActiveLoadingRequestForSelectedPath()) return;
        const promptExport = await detectCodexOtelPromptExport();
        if (!isActiveLoadingRequestForSelectedPath()) return;
        if (!isMountedRef.current) return;
        setCodexPromptExport(promptExport);
        const prefs = await getAttributionPrefs(repo.repoId);
        if (!isActiveLoadingRequestForSelectedPath()) return;
        if (!isMountedRef.current) return;
        setAttributionPrefsState(prefs);
      } catch (e: unknown) {
        if (!isActiveLoadingRequestForSelectedPath()) return;
        if (!isMountedRef.current) return;
        setActionError(e instanceof Error ? e.message : String(e));
      }
    } catch (e: unknown) {
      if (!isActiveLoadingRequestForSelectedPath()) return;
      if (!isMountedRef.current) return;
      setRepoState({
        status: 'error',
        path: selected,
        message: e instanceof Error ? e.message : String(e)
      });
      openRepoPathRef.current = null;
      if (!isMountedRef.current) return;
      setIndexingProgress(null);
    }
  }, []);

  useEffect(() => {
    if (!openRepoPathRef.current) return;
    if (repoState.status === 'loading') return;
    if (repoState.status === 'ready' && repoState.path === openRepoPathRef.current) return;
    openRepoPathRef.current = null;
  }, [repoState]);

  const updateAttributionPrefs = useCallback(async (update: AttributionPrefsUpdate) => {
    if (repoStateRef.current.status !== 'ready') return;
    const repoId = repoStateRef.current.repo.repoId;
    const requestVersion = attributionPrefsMutationVersionRef.current + 1;
    attributionPrefsMutationVersionRef.current = requestVersion;
    const isStaleRequest = () => attributionPrefsMutationVersionRef.current !== requestVersion;
    try {
      const prefs = await setAttributionPrefs(repoId, update);
      if (isStaleRequest() || !isMountedRef.current) return;
      const current = repoStateRef.current;
      if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
      setAttributionPrefsState(prefs);
    } catch (e: unknown) {
      if (isStaleRequest() || !isMountedRef.current) return;
      const current = repoStateRef.current;
      if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const purgeAttributionMetadata = useCallback(async () => {
    if (repoStateRef.current.status !== 'ready') return;
    const repoId = repoStateRef.current.repo.repoId;
    const requestVersion = attributionPrefsMutationVersionRef.current + 1;
    attributionPrefsMutationVersionRef.current = requestVersion;
    const isStaleRequest = () => attributionPrefsMutationVersionRef.current !== requestVersion;
    try {
      await purgeAttributionPromptMeta(repoId);
      if (isStaleRequest() || !isMountedRef.current) return;
      const prefs = await getAttributionPrefs(repoId);
      if (isStaleRequest() || !isMountedRef.current) return;
      const current = repoStateRef.current;
      if (current.status !== 'ready' || current.repo.repoId !== repoId) return;
      setAttributionPrefsState(prefs);
    } catch (e: unknown) {
      if (isStaleRequest() || !isMountedRef.current) return;
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
