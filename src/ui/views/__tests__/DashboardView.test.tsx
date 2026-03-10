import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardStats } from '../../../core/attribution-api';
import type { BranchViewModel } from '../../../core/types';
import type { CaptureReliabilityStatus } from '../../../core/tauri/ingestConfig';
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
  DashboardErrorState: ({
    error,
    state,
    canRetry,
  }: {
    error: string;
    state?: string;
    canRetry?: boolean;
  }) => (
    <div
      data-testid="dashboard-error"
      data-state={state ?? 'error'}
      data-can-retry={String(canRetry ?? true)}
    >
      {error}
    </div>
  ),
}));

vi.mock('../../components/dashboard/DashboardEmptyState', () => ({
  DashboardEmptyState: ({ reason }: { reason: string }) => <div data-testid="dashboard-empty">{reason}</div>,
}));

vi.mock('../../components/dashboard/DashboardHeader', () => ({
  DashboardHeader: ({
    repoName,
    trustState,
  }: {
    repoName: string;
    trustState?: string;
  }) => (
    <div data-testid="dashboard-header" data-trust-state={trustState ?? 'healthy'}>
      {repoName}
    </div>
  ),
}));

vi.mock('../../components/dashboard/MetricsGrid', () => ({
  MetricsGrid: () => <div data-testid="metrics-grid">metrics</div>,
}));

vi.mock('../../components/dashboard/TopFilesTable', () => ({
  TopFilesTable: ({ files }: { files: Array<{ filePath: string }> }) => (
    <div data-testid="top-files">{files.map((file) => file.filePath).join(',')}</div>
  ),
}));

vi.mock('../../components/dashboard/TrendChart', () => ({
  TrendChart: () => <div data-testid="trend-chart">trend chart</div>,
}));

vi.mock('../../components/dashboard/QuickActions', () => ({
  QuickActions: () => <div data-testid="quick-actions">quick actions</div>,
}));

vi.mock('../../components/dashboard/RecentActivity', () => ({
  RecentActivity: () => <div data-testid="recent-activity">recent activity</div>,
}));

vi.mock('../../components/dashboard/BottomStats', () => ({
  BottomStats: () => <div data-testid="bottom-stats">bottom stats</div>,
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

function createCaptureReliabilityStatus(
  overrides: Partial<CaptureReliabilityStatus> = {},
): CaptureReliabilityStatus {
  return {
    mode: 'HYBRID_ACTIVE',
    otelBaselineHealthy: true,
    streamExpected: true,
    streamHealthy: true,
    reasons: [],
    metrics: {
      streamEventsAccepted: 10,
      streamEventsDuplicates: 0,
      streamEventsDropped: 0,
      streamEventsReplaced: 0,
    },
    transitions: [],
    appServer: {
      state: 'running',
      initialized: true,
      initializeSent: true,
      authState: 'authenticated',
      authMode: 'device_code',
      streamHealthy: true,
      streamKillSwitch: false,
      restartBudget: 3,
      restartAttemptsInWindow: 0,
    },
    ...overrides,
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

  it('surfaces degraded trust state in the dashboard header', async () => {
    mockGetDashboardStats.mockResolvedValue(createDashboardStats(1, 'repo-one'));

    render(
      <DashboardView
        repoState={createRepoState(1)}
        setRepoState={vi.fn()}
        setActionError={vi.fn()}
        onDrillDown={vi.fn()}
        onModeChange={vi.fn()}
        captureReliabilityStatus={createCaptureReliabilityStatus({
          mode: 'DEGRADED_STREAMING',
          streamHealthy: false,
          reasons: ['Stream stalled'],
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-header')).toHaveAttribute(
        'data-trust-state',
        'degraded',
      );
    });
  });

  it('treats permission denied failures as non-retryable', async () => {
    mockGetDashboardStats.mockRejectedValue(new Error('Permission denied for dashboard command'));
    const setActionError = vi.fn();

    render(
      <DashboardView
        repoState={createRepoState(1)}
        setRepoState={vi.fn()}
        setActionError={setActionError}
        onDrillDown={vi.fn()}
        onModeChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toHaveAttribute(
        'data-state',
        'permission_denied',
      );
      expect(screen.getByTestId('dashboard-error')).toHaveAttribute(
        'data-can-retry',
        'false',
      );
    });

    expect(setActionError).toHaveBeenCalledWith('Permission denied for dashboard command');
  });

  it('maps capture failure mode errors to offline state', async () => {
    mockGetDashboardStats.mockRejectedValue(new Error('dashboard unavailable'));

    render(
      <DashboardView
        repoState={createRepoState(1)}
        setRepoState={vi.fn()}
        setActionError={vi.fn()}
        onDrillDown={vi.fn()}
        onModeChange={vi.fn()}
        captureReliabilityStatus={createCaptureReliabilityStatus({
          mode: 'FAILURE',
          streamHealthy: false,
          reasons: ['Collector unavailable'],
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toHaveAttribute('data-state', 'offline');
      expect(screen.getByTestId('dashboard-error')).toHaveAttribute('data-can-retry', 'true');
    });
  });
});
