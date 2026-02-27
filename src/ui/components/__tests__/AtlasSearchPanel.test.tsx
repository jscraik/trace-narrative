import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasSearchPanel } from '../AtlasSearchPanel';

const mockAtlasCapabilities = vi.hoisted(() => vi.fn());
const mockAtlasIntrospect = vi.hoisted(() => vi.fn());
const mockAtlasDoctorReport = vi.hoisted(() => vi.fn());
const mockAtlasDoctorRebuildDerived = vi.hoisted(() => vi.fn());
const mockUseAtlasSearch = vi.hoisted(() => vi.fn());
const mockRefreshSelectedSession = vi.hoisted(() => vi.fn());

vi.mock('../../../core/atlas-api', async () => {
  const actual = await vi.importActual('../../../core/atlas-api');
  return {
    ...actual,
    atlasCapabilities: mockAtlasCapabilities,
    atlasIntrospect: mockAtlasIntrospect,
    atlasDoctorReport: mockAtlasDoctorReport,
    atlasDoctorRebuildDerived: mockAtlasDoctorRebuildDerived,
  };
});

vi.mock('../../../hooks/useAtlasSearch', () => ({
  useAtlasSearch: mockUseAtlasSearch,
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

function ok<T>(value: T) {
  return { ok: true as const, value };
}

function createCapabilities() {
  return {
    derivedVersion: 'v1',
    fts5Enabled: true,
    ftsTableReady: true,
    budgets: {
      queryMaxChars: 2000,
      queryMaxTerms: 20,
      limitMax: 50,
      snippetMaxChars: 400,
      chunkTextMaxChars: 8000,
      getSessionMaxChunks: 100,
      responseMaxChars: 20000,
    },
  };
}

function createIntrospect(repoId: number) {
  return {
    state: {
      repoId,
      derivedVersion: 'v1',
      lastRebuildAt: null,
      lastUpdatedAt: null,
      lastError: null,
      sessionsIndexed: 1,
      chunksIndexed: 1,
    },
    chunksInTable: 1,
    sessionsWithChunks: 1,
  };
}

function createDoctorReport(repoId: number) {
  return {
    repoId,
    derivedVersion: 'v1',
    ftsTableReady: true,
    indexableSessions: 1,
    sessionsWithChunks: 1,
    chunksIndexed: 1,
    missingSessions: 0,
    lastRebuildAt: null,
    lastUpdatedAt: null,
    lastError: null,
    status: 'ok',
  };
}

describe('AtlasSearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAtlasSearch.mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      loading: false,
      error: null,
      results: [],
      truncated: false,
      selectedHit: null,
      selectHit: vi.fn(),
      sessionLoading: false,
      sessionError: null,
      selectedSession: null,
      clearSelection: vi.fn(),
      refreshSelectedSession: mockRefreshSelectedSession,
    });

    mockRefreshSelectedSession.mockResolvedValue(undefined);
    mockAtlasCapabilities.mockResolvedValue(ok(createCapabilities()));
    mockAtlasDoctorRebuildDerived.mockResolvedValue(
      ok({
        repoId: 1,
        sessionsProcessed: 1,
        chunksWritten: 1,
        truncatedSessions: 0,
        deletedChunks: 0,
        ftsRebuilt: true,
      })
    );
  });

  it('ignores stale status refresh completion from previous repository', async () => {
    const staleIntro = createDeferred<{
      ok: true;
      value: ReturnType<typeof createIntrospect>;
    }>();
    const staleDoctor = createDeferred<{
      ok: true;
      value: ReturnType<typeof createDoctorReport>;
    }>();

    mockAtlasIntrospect.mockImplementation((repoId: number) => {
      if (repoId === 1) return staleIntro.promise;
      return Promise.resolve(ok(createIntrospect(2)));
    });
    mockAtlasDoctorReport.mockImplementation((repoId: number) => {
      if (repoId === 1) return staleDoctor.promise;
      return Promise.resolve(ok(createDoctorReport(2)));
    });

    const { rerender } = render(<AtlasSearchPanel repoId={1} />);

    await waitFor(() => {
      expect(mockAtlasIntrospect).toHaveBeenCalledWith(1);
      expect(mockAtlasDoctorReport).toHaveBeenCalledWith(1);
    });

    rerender(<AtlasSearchPanel repoId={2} />);

    await waitFor(() => {
      expect(screen.getAllByText(/"repoId": 2/).length).toBeGreaterThan(0);
    });

    await act(async () => {
      staleIntro.resolve(ok(createIntrospect(1)));
      staleDoctor.resolve(ok(createDoctorReport(1)));
      await staleIntro.promise;
      await staleDoctor.promise;
      await Promise.resolve();
    });

    expect(screen.getAllByText(/"repoId": 2/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/"repoId": 1/)).not.toBeInTheDocument();
  });

  it('ignores stale rebuild completion after repository switch', async () => {
    const staleRebuild = createDeferred<{
      ok: true;
      value: {
        repoId: number;
        sessionsProcessed: number;
        chunksWritten: number;
        truncatedSessions: number;
        deletedChunks: number;
        ftsRebuilt: boolean;
      };
    }>();

    mockAtlasIntrospect.mockImplementation(async (repoId: number) => ok(createIntrospect(repoId)));
    mockAtlasDoctorReport.mockImplementation(async (repoId: number) => ok(createDoctorReport(repoId)));
    mockAtlasDoctorRebuildDerived.mockImplementation((repoId: number) => {
      if (repoId === 1) return staleRebuild.promise;
      return Promise.resolve(
        ok({
          repoId,
          sessionsProcessed: 1,
          chunksWritten: 1,
          truncatedSessions: 0,
          deletedChunks: 0,
          ftsRebuilt: true,
        })
      );
    });

    const { rerender } = render(<AtlasSearchPanel repoId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Rebuild index')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Rebuild index'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockAtlasDoctorRebuildDerived).toHaveBeenCalledWith(1);
    });

    rerender(<AtlasSearchPanel repoId={2} />);

    await act(async () => {
      staleRebuild.resolve(
        ok({
          repoId: 1,
          sessionsProcessed: 9,
          chunksWritten: 9,
          truncatedSessions: 0,
          deletedChunks: 0,
          ftsRebuilt: true,
        })
      );
      await staleRebuild.promise;
      await Promise.resolve();
    });

    expect(screen.queryByText(/Rebuild complete:/)).not.toBeInTheDocument();
    expect(mockRefreshSelectedSession).not.toHaveBeenCalled();
  });

  it('resets rebuild state when switching repos', async () => {
    const { rerender } = render(<AtlasSearchPanel repoId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Rebuild index')).toBeInTheDocument();
    });

    const button = screen.getByText('Rebuild index');
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    mockRefreshSelectedSession.mockClear();
    await act(async () => {
      rerender(<AtlasSearchPanel repoId={2} />);
      await Promise.resolve();
    });

    expect(screen.queryByText(/Rebuild complete:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rebuild error/)).not.toBeInTheDocument();
  });
});
