import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlasEnvelope, AtlasGetSessionResponse, AtlasSearchResponse, AtlasSearchHit } from '../../core/atlas-api';
import { useAtlasSearch } from '../useAtlasSearch';

const mockAtlasSearch = vi.hoisted(() => vi.fn());
const mockAtlasGetSession = vi.hoisted(() => vi.fn());

vi.mock('../../core/atlas-api', () => ({
  atlasSearch: mockAtlasSearch,
  atlasGetSession: mockAtlasGetSession,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createSearchHit(sessionId: string): AtlasSearchHit {
  return {
    chunkUid: `${sessionId}:0`,
    sessionId,
    chunkIndex: 0,
    score: 1,
    snippet: 'snippet',
    sessionImportedAt: null,
    sessionTool: 'codex',
    sessionModel: 'gpt',
  };
}

function okSearchEnvelope(results: AtlasSearchHit[]): AtlasEnvelope<AtlasSearchResponse> {
  return {
    ok: true,
    value: { results },
    meta: { truncated: false },
  };
}

function okSessionEnvelope(sessionId: string): AtlasEnvelope<AtlasGetSessionResponse> {
  return {
    ok: true,
    value: {
      session: {
        id: sessionId,
        tool: 'codex',
        model: 'gpt',
        importedAt: null,
        durationMin: null,
        messageCount: null,
        purgedAt: null,
      },
      chunks: [
        {
          chunkUid: `${sessionId}:0`,
          chunkIndex: 0,
          roleMask: 'assistant',
          text: 'hello',
        },
      ],
    },
  };
}

describe('useAtlasSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAtlasSearch.mockResolvedValue(okSearchEnvelope([]));
    mockAtlasGetSession.mockResolvedValue(okSessionEnvelope('default'));
  });

  it('ignores stale search responses after repository switch', async () => {
    const staleSearch = createDeferred<AtlasEnvelope<AtlasSearchResponse>>();
    mockAtlasSearch.mockImplementation(({ repoId }: { repoId: number }) => {
      if (repoId === 1) return staleSearch.promise;
      return Promise.resolve(okSearchEnvelope([]));
    });

    const { result, rerender } = renderHook(
      ({ repoId }) => useAtlasSearch(repoId, { debounceMs: 0 }),
      { initialProps: { repoId: 1 as number | null } }
    );

    act(() => {
      result.current.setQuery('stale query');
    });

    await waitFor(() => {
      expect(mockAtlasSearch).toHaveBeenCalledWith({ repoId: 1, query: 'stale query', limit: 20 });
    });

    rerender({ repoId: 2 });

    await act(async () => {
      staleSearch.resolve(okSearchEnvelope([createSearchHit('session-1')]));
      await staleSearch.promise;
      await Promise.resolve();
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('ignores stale session loads after repository switch', async () => {
    const staleSession = createDeferred<AtlasEnvelope<AtlasGetSessionResponse>>();
    mockAtlasGetSession.mockImplementation(() => staleSession.promise);

    const { result, rerender } = renderHook(
      ({ repoId }) => useAtlasSearch(repoId, { debounceMs: 0 }),
      { initialProps: { repoId: 1 as number | null } }
    );

    const hit = createSearchHit('session-1');
    act(() => {
      result.current.selectHit(hit);
    });

    await waitFor(() => {
      expect(mockAtlasGetSession).toHaveBeenCalledWith({ repoId: 1, sessionId: 'session-1', maxChunks: 12 });
    });

    rerender({ repoId: 2 });

    await act(async () => {
      staleSession.resolve(okSessionEnvelope('session-1'));
      await staleSession.promise;
      await Promise.resolve();
    });

    expect(result.current.selectedHit).toBeNull();
    expect(result.current.selectedSession).toBeNull();
    expect(result.current.sessionLoading).toBe(false);
  });
});
