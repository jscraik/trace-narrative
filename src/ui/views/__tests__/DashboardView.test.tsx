import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardStats } from '../../../core/attribution-api';
import type { BranchViewModel } from '../../../core/types';
import type { RepoState } from '../../../hooks/useRepoLoader';

const mockGetDashboardStats = vi.hoisted(() => vi.fn());

vi.mock('../../../core/attribution-api', async () => {
  const actual = await vi.importActual('../../../core/attribution-api');
  return {
    ...actual,
    getDashboardStats: mockGetDashboardStats,
  };
});

vi.mock('../../components/dashboard/DashboardLoadingState', () => ({
  DashboardLoadingState: () => <div data-testid="dashboard-loading">loading</div>,
}));

vi.mock('../../components/dashboard/DashboardErrorState', () => ({
  DashboardErrorState: ({ error }: { error: string }) => <div data-testid="dashboard-error">{error}</div>,
}));

vi.mock('../../components/dashboard/DashboardEmptyState', () => ({
  DashboardEmptyState: ({ reason }: { reason: string }) => <div data-testid="dashboard-empty">{reason}</div>,
}));

vi.mock('../../components/dashboard/DashboardHeader', () => ({
  DashboardHeader: ({ repoName }: { repoName: string }) => <div data-testid="dashboard-header">{repoName}</div>,
}));

vi.mock('../../components/dashboard/MetricsGrid', () => ({
  MetricsGrid: () => <div data-testid="metrics-grid">metrics</div>,
}));

vi.mock('../../components/dashboard/TopFilesTable', () => ({
  TopFilesTable: ({ files }: { files: Array<{ filePath: string }> }) => (
    <div data-testid="top-files">{files.map((file) => file.filePath).join(',')}</div>
  ),
}));

import { DashboardView } from '../DashboardView';

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

function createRepoState(repoId: number): RepoState {
  const root = `/repo/${repoId}`;
  return {
    status: 'ready',
    path: root,
    repo: {
      repoId,
      root,
      branch: 'main',
      headSha: `sha-${repoId}`,
    },
    model: {
      source: 'git',
      title: `repo-${repoId}`,
      status: 'open',
      description: `Repo ${repoId}`,
      stats: {
        added: 0,
        removed: 0,
        files: 0,
        commits: 0,
        prompts: 0,
        responses: 0,
      },
      intent: [],
      timeline: [],
      meta: {
        repoId,
        repoPath: root,
        branchName: 'main',
        headSha: `sha-${repoId}`,
      },
    } as BranchViewModel,
  };
}

function createDashboardStats(repoId: number, repoName: string): DashboardStats {
  return {
    repo: {
      id: repoId,
      path: `/repo/${repoId}`,
      name: repoName,
    },
    timeRange: '30d',
    currentPeriod: {
      period: {
        start: '2026-01-01',
        end: '2026-01-31',
        commits: 3,
      },
      attribution: {
        totalLines: 100,
        humanLines: 45,
        aiAgentLines: 50,
        aiAssistLines: 3,
        collaborativeLines: 2,
        aiPercentage: 55,
      },
      toolBreakdown: [],
      trend: [],
    },
    topFiles: {
      files: [
        {
          filePath: `src/${repoName}.ts`,
          totalLines: 100,
          aiLines: 50,
          aiPercentage: 50,
          commitCount: 2,
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
      hasMore: false,
    },
  };
}

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores stale dashboard data when repo changes mid-request', async () => {
    const staleResponse = createDeferred<DashboardStats>();

    mockGetDashboardStats.mockImplementation((repoId: number) => {
      if (repoId === 1) return staleResponse.promise;
      return Promise.resolve(createDashboardStats(2, 'repo-two'));
    });

    const setActionError = vi.fn();
    const { rerender } = render(
      <DashboardView
        repoState={createRepoState(1)}
        setRepoState={vi.fn()}
        setActionError={setActionError}
        onDrillDown={vi.fn()}
        onModeChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockGetDashboardStats).toHaveBeenCalledWith(1, '30d', 0, 20);
    });

    rerender(
      <DashboardView
        repoState={createRepoState(2)}
        setRepoState={vi.fn()}
        setActionError={setActionError}
        onDrillDown={vi.fn()}
        onModeChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockGetDashboardStats).toHaveBeenCalledWith(2, '30d', 0, 20);
      expect(screen.getByTestId('dashboard-header')).toHaveTextContent('repo-two');
    });

    await act(async () => {
      staleResponse.resolve(createDashboardStats(1, 'repo-one'));
      await staleResponse.promise;
      await Promise.resolve();
    });

    expect(screen.getByTestId('dashboard-header')).toHaveTextContent('repo-two');
    expect(screen.queryByText('repo-one')).not.toBeInTheDocument();
  });

  it('ignores stale dashboard errors from older requests', async () => {
    const staleFailure = createDeferred<DashboardStats>();

    mockGetDashboardStats.mockImplementation((repoId: number) => {
      if (repoId === 1) return staleFailure.promise;
      return Promise.resolve(createDashboardStats(2, 'repo-two'));
    });

    const setActionError = vi.fn();
    const { rerender } = render(
      <DashboardView
        repoState={createRepoState(1)}
        setRepoState={vi.fn()}
        setActionError={setActionError}
        onDrillDown={vi.fn()}
        onModeChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockGetDashboardStats).toHaveBeenCalledWith(1, '30d', 0, 20);
    });

    rerender(
      <DashboardView
        repoState={createRepoState(2)}
        setRepoState={vi.fn()}
        setActionError={setActionError}
        onDrillDown={vi.fn()}
        onModeChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockGetDashboardStats).toHaveBeenCalledWith(2, '30d', 0, 20);
      expect(screen.getByTestId('dashboard-header')).toHaveTextContent('repo-two');
    });

    await act(async () => {
      staleFailure.reject(new Error('stale dashboard failure'));
      await Promise.resolve();
    });

    expect(screen.queryByTestId('dashboard-error')).not.toBeInTheDocument();
    expect(setActionError).not.toHaveBeenCalledWith('stale dashboard failure');
    expect(screen.getByTestId('dashboard-header')).toHaveTextContent('repo-two');
  });
});
