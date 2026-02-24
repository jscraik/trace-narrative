import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AtlasError, AtlasGetSessionResponse, AtlasSearchHit } from '../core/atlas-api';
import { atlasGetSession, atlasSearch } from '../core/atlas-api';

export type UseAtlasSearchState = {
  query: string;
  setQuery: (next: string) => void;

  loading: boolean;
  error: AtlasError | null;
  results: AtlasSearchHit[];
  truncated: boolean;

  selectedHit: AtlasSearchHit | null;
  selectHit: (hit: AtlasSearchHit) => void;

  sessionLoading: boolean;
  sessionError: AtlasError | null;
  selectedSession: AtlasGetSessionResponse | null;

  clearSelection: () => void;
  refreshSelectedSession: () => Promise<void>;
};

const DEFAULT_LIMIT = 20;
const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_MAX_SESSION_CHUNKS = 12;

export function useAtlasSearch(repoId: number | null, opts?: { limit?: number; debounceMs?: number; maxSessionChunks?: number }): UseAtlasSearchState {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const debounceMs = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const maxSessionChunks = opts?.maxSessionChunks ?? DEFAULT_MAX_SESSION_CHUNKS;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AtlasSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AtlasError | null>(null);
  const [truncated, setTruncated] = useState(false);

  const [selectedHit, setSelectedHit] = useState<AtlasSearchHit | null>(null);
  const [selectedSession, setSelectedSession] = useState<AtlasGetSessionResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<AtlasError | null>(null);

  const searchSeq = useRef(0);
  const sessionSeq = useRef(0);

  // Reset when repo changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: repoId is intentionally included so we reset local search/selection state when switching repos.
  useEffect(() => {
    // Invalidate all in-flight async work tied to the previous repository.
    searchSeq.current += 1;
    sessionSeq.current += 1;

    setQuery('');
    setResults([]);
    setLoading(false);
    setError(null);
    setTruncated(false);
    setSelectedHit(null);
    setSelectedSession(null);
    setSessionLoading(false);
    setSessionError(null);
  }, [repoId]);

  // Debounced search
  useEffect(() => {
    if (!repoId) return;

    const q = query.trim();
    if (q.length === 0) {
      setLoading(false);
      setError(null);
      setResults([]);
      setTruncated(false);
      return;
    }

    setLoading(true);
    setError(null);

    const seq = ++searchSeq.current;
    const handle = window.setTimeout(() => {
      (async () => {
        const env = await atlasSearch({ repoId, query: q, limit });
        if (seq !== searchSeq.current) return;

        if (!env.ok) {
          setLoading(false);
          setError(env.error);
          setResults([]);
          setTruncated(false);
          return;
        }

        const nextResults = Array.isArray(env.value.results) ? env.value.results : [];
        setResults(nextResults);
        setTruncated(Boolean(env.meta?.truncated));
        setLoading(false);
      })().catch((e: unknown) => {
        if (seq !== searchSeq.current) return;
        setLoading(false);
        setResults([]);
        setTruncated(false);
        setError({
          code: 'INTERNAL',
          message: e instanceof Error ? e.message : String(e),
        });
      });
    }, debounceMs);

    return () => {
      window.clearTimeout(handle);
    };
  }, [repoId, query, limit, debounceMs]);

  const loadSession = useCallback(async (hit: AtlasSearchHit) => {
    if (!repoId) return;

    setSessionLoading(true);
    setSessionError(null);

    const seq = ++sessionSeq.current;

    try {
      const env = await atlasGetSession({
        repoId,
        sessionId: hit.sessionId,
        maxChunks: maxSessionChunks,
      });

      if (seq !== sessionSeq.current) return;

      if (!env.ok) {
        setSelectedSession(null);
        setSessionLoading(false);
        setSessionError(env.error);
        return;
      }

      setSelectedSession(env.value);
      setSessionLoading(false);
    } catch (e: unknown) {
      if (seq !== sessionSeq.current) return;
      setSelectedSession(null);
      setSessionLoading(false);
      setSessionError({
        code: 'INTERNAL',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [repoId, maxSessionChunks]);

  const selectHit = useCallback((hit: AtlasSearchHit) => {
    setSelectedHit(hit);
    void loadSession(hit);
  }, [loadSession]);

  const clearSelection = useCallback(() => {
    setSelectedHit(null);
    setSelectedSession(null);
    setSessionError(null);
    setSessionLoading(false);
  }, []);

  const refreshSelectedSession = useCallback(async () => {
    if (!selectedHit) return;
    await loadSession(selectedHit);
  }, [loadSession, selectedHit]);

  const stableResults = useMemo(() => results, [results]);

  return {
    query,
    setQuery,

    loading,
    error,
    results: stableResults,
    truncated,

    selectedHit,
    selectHit,

    sessionLoading,
    sessionError,
    selectedSession,

    clearSelection,
    refreshSelectedSession,
  };
}
