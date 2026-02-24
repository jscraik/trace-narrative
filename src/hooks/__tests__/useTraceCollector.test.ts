import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BranchViewModel } from '../../core/types';
import { useTraceCollector } from '../useTraceCollector';

const mockListen = vi.hoisted(() => vi.fn());
const mockScanAgentTraceRecords = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('../../core/repo/agentTrace', () => ({
  generateDerivedTraceRecord: vi.fn(),
  ingestCodexOtelLogFile: vi.fn(),
  scanAgentTraceRecords: mockScanAgentTraceRecords,
  writeGeneratedTraceRecord: vi.fn(),
}));

vi.mock('../../core/tauri/otelReceiver', () => ({
  runOtlpSmokeTest: vi.fn(),
}));

vi.mock('../../core/repo/traceConfig', () => ({
  saveTraceConfig: vi.fn(),
  defaultTraceConfig: vi.fn(() => ({ codexOtelLogPath: '', codexOtelReceiverEnabled: false })),
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

describe('useTraceCollector listener cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScanAgentTraceRecords.mockResolvedValue({
      byCommit: {
        c1: {
          commitSha: 'c1',
          aiLines: 1,
          humanLines: 0,
          mixedLines: 0,
          unknownLines: 0,
          aiPercent: 100,
          modelIds: ['gpt-5'],
          toolNames: ['codex'],
        },
      },
      byFileByCommit: {},
      totals: { conversations: 1, ranges: 1 },
    });
  });

  it('unsubscribes a late status listener if effect unmounts before registration resolves', async () => {
    const statusDeferred = createDeferred<() => void>();
    const statusUnlisten = vi.fn();
    mockListen.mockImplementationOnce(async () => statusDeferred.promise);

    const setRepoState = vi.fn();
    const setActionError = vi.fn();
    const { unmount } = renderHook(() =>
      useTraceCollector({
        repoRoot: '/repo',
        repoId: 1,
        timeline: [],
        setRepoState,
        setActionError,
      })
    );

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('otel-receiver-status', expect.any(Function));
    });

    unmount();

    await act(async () => {
      statusDeferred.resolve(statusUnlisten);
      await statusDeferred.promise;
      await Promise.resolve();
    });

    expect(statusUnlisten).toHaveBeenCalledTimes(1);
    expect(mockListen).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes a late ingest listener after cleanup when second registration resolves late', async () => {
    const statusUnlisten = vi.fn();
    const ingestDeferred = createDeferred<() => void>();
    const ingestUnlisten = vi.fn();

    mockListen
      .mockImplementationOnce(async () => statusUnlisten)
      .mockImplementationOnce(async () => ingestDeferred.promise);

    const setRepoState = vi.fn();
    const setActionError = vi.fn();
    const { unmount } = renderHook(() =>
      useTraceCollector({
        repoRoot: '/repo',
        repoId: 1,
        timeline: [],
        setRepoState,
        setActionError,
      })
    );

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledTimes(2);
      expect(mockListen).toHaveBeenNthCalledWith(1, 'otel-receiver-status', expect.any(Function));
      expect(mockListen).toHaveBeenNthCalledWith(2, 'otel-trace-ingested', expect.any(Function));
    });

    unmount();
    expect(statusUnlisten).toHaveBeenCalledTimes(1);

    await act(async () => {
      ingestDeferred.resolve(ingestUnlisten);
      await ingestDeferred.promise;
      await Promise.resolve();
    });

    expect(ingestUnlisten).toHaveBeenCalledTimes(1);
  });

  it('ignores ingest updates when current model repoId does not match hook repoId', async () => {
    const eventHandlers = new Map<string, (event: { payload: unknown }) => void | Promise<void>>();
    mockListen.mockImplementation(async (eventName: string, handler: (event: { payload: unknown }) => void | Promise<void>) => {
      eventHandlers.set(eventName, handler);
      return vi.fn();
    });

    let state: BranchViewModel = {
      source: 'git',
      title: 'repo-2',
      status: 'open',
      description: '',
      stats: { added: 0, removed: 0, files: 1, commits: 1, prompts: 0, responses: 0 },
      intent: [],
      timeline: [{ id: 'c1', type: 'commit', label: 'Commit 1' }],
      meta: {
        repoId: 2,
        repoPath: '/repo/2',
        branchName: 'main',
        headSha: 'c1',
      },
    };

    const setRepoState = (updater: (prev: BranchViewModel) => BranchViewModel) => {
      state = updater(state);
    };

    renderHook(() =>
      useTraceCollector({
        repoRoot: '/repo/1',
        repoId: 1,
        timeline: [{ id: 'c1' }],
        setRepoState,
        setActionError: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(eventHandlers.has('otel-trace-ingested')).toBe(true);
    });

    const ingestHandler = eventHandlers.get('otel-trace-ingested');
    await act(async () => {
      await ingestHandler?.({ payload: {} });
    });

    expect(mockScanAgentTraceRecords).toHaveBeenCalledWith('/repo/1', 1, ['c1']);
    expect(state.meta?.repoId).toBe(2);
    expect(state.traceSummaries).toBeUndefined();
    expect(state.stats.prompts).toBe(0);
    expect(state.timeline[0].badges).toBeUndefined();
  });
});
