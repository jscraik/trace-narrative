import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoIngest } from '../useAutoIngest';
import type { BranchViewModel } from '../../core/types';

const mockListen = vi.hoisted(() => vi.fn());
const mockGetIngestConfig = vi.hoisted(() => vi.fn());
const mockGetOtlpKeyStatus = vi.hoisted(() => vi.fn());
const mockDiscoverCaptureSources = vi.hoisted(() => vi.fn());
const mockAutoImportSessionFile = vi.hoisted(() => vi.fn());
const mockGetCollectorMigrationStatus = vi.hoisted(() => vi.fn());
const mockGetCaptureReliabilityStatus = vi.hoisted(() => vi.fn());
const mockGetCodexAppServerStatus = vi.hoisted(() => vi.fn());
const mockPurgeExpiredSessions = vi.hoisted(() => vi.fn());
const mockStartFileWatcher = vi.hoisted(() => vi.fn());
const mockStopFileWatcher = vi.hoisted(() => vi.fn());
const mockGetIngestActivity = vi.hoisted(() => vi.fn());
const mockRefreshSessionBadges = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

vi.mock('../../core/repo/sessionBadges', () => ({
  refreshSessionBadges: mockRefreshSessionBadges,
}));

vi.mock('../../core/tauri/otelReceiver', () => ({
  setOtelReceiverEnabled: vi.fn(),
}));

vi.mock('../../core/tauri/activity', () => ({
  getIngestActivity: mockGetIngestActivity,
}));

vi.mock('../../core/tauri/ingestConfig', () => ({
  autoImportSessionFile: mockAutoImportSessionFile,
  backfillRecentSessions: vi.fn(),
  codexAppServerInitialize: vi.fn(),
  codexAppServerInitialized: vi.fn(),
  codexAppServerLoadThreadRecoveryCheckpoint: vi.fn(),
  configureCodexOtel: vi.fn(),
  discoverCaptureSources: mockDiscoverCaptureSources,
  ensureOtlpApiKey: vi.fn(),
  getCaptureReliabilityStatus: mockGetCaptureReliabilityStatus,
  getCollectorMigrationStatus: mockGetCollectorMigrationStatus,
  getCodexAppServerStatus: mockGetCodexAppServerStatus,
  getIngestConfig: mockGetIngestConfig,
  getOtlpKeyStatus: mockGetOtlpKeyStatus,
  purgeExpiredSessions: mockPurgeExpiredSessions,
  resetOtlpApiKey: vi.fn(),
  rollbackCollectorMigration: vi.fn(),
  runCollectorMigration: vi.fn(),
  setIngestConfig: vi.fn(),
  startCodexAppServer: vi.fn(),
  startFileWatcher: mockStartFileWatcher,
  stopCodexAppServer: vi.fn(),
  stopFileWatcher: mockStopFileWatcher,
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

function makeConfig({
  autoIngestEnabled,
  watchPaths,
}: {
  autoIngestEnabled: boolean;
  watchPaths: { claude: string[]; cursor: string[]; codexLogs: string[] };
}) {
  return {
    autoIngestEnabled,
    watchPaths,
    codex: {
      receiverEnabled: false,
      mode: 'otlp',
      endpoint: 'http://localhost:4318/v1/traces',
      headerEnvKey: 'CODEX_OTLP_HEADER',
      streamEnrichmentEnabled: false,
      streamKillSwitch: false,
      appServerAuthMode: 'none',
    },
    collector: {
      canonicalRoot: '/collector/canonical',
      legacyRoot: '/collector/legacy',
      migration: { status: 'not_started' },
    },
    retentionDays: 30,
    redactionMode: 'redact',
    consent: { codexTelemetryGranted: false },
  };
}

const defaultMigration = {
  canonicalRoot: '/collector/canonical',
  legacyRoot: '/collector/legacy',
  canonicalExists: true,
  legacyExists: false,
  migrationRequired: false,
  status: 'migrated',
};

const defaultAppServer = {
  state: 'inactive',
  initialized: false,
  initializeSent: false,
  authState: 'needs_login',
  authMode: 'none',
  streamHealthy: false,
  streamKillSwitch: false,
  restartBudget: 3,
  restartAttemptsInWindow: 0,
};

const defaultReliability = {
  mode: 'OTEL_ONLY',
  otelBaselineHealthy: true,
  streamExpected: false,
  streamHealthy: false,
  reasons: [],
  metrics: {
    streamEventsAccepted: 0,
    streamEventsDuplicates: 0,
    streamEventsDropped: 0,
    streamEventsReplaced: 0,
  },
  transitions: [],
  appServer: defaultAppServer,
};

const baseModel: BranchViewModel = {
  source: 'git',
  title: 'repo',
  status: 'open',
  description: '',
  stats: { added: 0, removed: 0, files: 0, commits: 0, prompts: 0, responses: 0 },
  intent: [],
  timeline: [],
  meta: { repoId: 1, repoPath: '/repo', branchName: 'main', headSha: 'head' },
};

describe('useAutoIngest listener cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOtlpKeyStatus.mockResolvedValue({ present: false });
    mockDiscoverCaptureSources.mockResolvedValue({
      claude: [],
      cursor: [],
      codexLogs: [],
      collector: defaultMigration,
    });
    mockGetCollectorMigrationStatus.mockResolvedValue(defaultMigration);
    mockGetCaptureReliabilityStatus.mockResolvedValue(defaultReliability);
    mockGetCodexAppServerStatus.mockResolvedValue(defaultAppServer);
    mockPurgeExpiredSessions.mockResolvedValue(0);
    mockGetIngestActivity.mockResolvedValue([]);
    mockStartFileWatcher.mockResolvedValue(undefined);
    mockStopFileWatcher.mockResolvedValue(undefined);
    mockRefreshSessionBadges.mockResolvedValue(undefined);
    mockListen.mockResolvedValue(vi.fn());
  });

  it('unsubscribes a late codex-app-server listener when effect unmounts before registration resolves', async () => {
    const statusDeferred = createDeferred<() => void>();
    const statusUnlisten = vi.fn();
    mockGetIngestConfig.mockResolvedValue(
      makeConfig({
        autoIngestEnabled: true,
        watchPaths: { claude: [], cursor: [], codexLogs: [] },
      })
    );
    mockListen.mockImplementationOnce(async () => statusDeferred.promise);

    const { unmount } = renderHook(() =>
      useAutoIngest({
        repoRoot: '/repo',
        repoId: 1,
        model: baseModel,
        setRepoState: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('codex-app-server-status', expect.any(Function));
    });

    unmount();

    await act(async () => {
      statusDeferred.resolve(statusUnlisten);
      await statusDeferred.promise;
      await Promise.resolve();
    });

    expect(statusUnlisten).toHaveBeenCalledTimes(1);
  });

  it('stops watcher even when startFileWatcher resolves after cleanup', async () => {
    const startDeferred = createDeferred<void>();
    mockGetIngestConfig.mockResolvedValue(
      makeConfig({
        autoIngestEnabled: true,
        watchPaths: { claude: ['/watch/claude'], cursor: [], codexLogs: [] },
      })
    );
    mockStartFileWatcher.mockImplementationOnce(async () => startDeferred.promise);

    const { unmount } = renderHook(() =>
      useAutoIngest({
        repoRoot: '/repo',
        repoId: 1,
        model: baseModel,
        setRepoState: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(mockStartFileWatcher).toHaveBeenCalledWith(['/watch/claude']);
    });

    unmount();
    expect(mockStopFileWatcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      startDeferred.resolve();
      await startDeferred.promise;
      await Promise.resolve();
    });

    expect(mockStopFileWatcher).toHaveBeenCalledTimes(2);
    expect(mockListen).toHaveBeenCalledWith('codex-app-server-status', expect.any(Function));
    expect(mockListen).not.toHaveBeenCalledWith('session-file-changed', expect.any(Function));
  });

  it('skips late bootstrap side effects after unmounting during initial load', async () => {
    const configDeferred = createDeferred<ReturnType<typeof makeConfig>>();
    const keyDeferred = createDeferred<{ present: boolean }>();
    const sourcesDeferred = createDeferred<{
      claude: string[];
      cursor: string[];
      codexLogs: string[];
      collector: typeof defaultMigration;
    }>();
    const migrationDeferred = createDeferred<typeof defaultMigration>();
    const reliabilityDeferred = createDeferred<typeof defaultReliability>();
    const appServerDeferred = createDeferred<typeof defaultAppServer>();
    mockGetIngestConfig.mockImplementation(() => configDeferred.promise);
    mockGetOtlpKeyStatus.mockImplementation(() => keyDeferred.promise);
    mockDiscoverCaptureSources.mockImplementation(() => sourcesDeferred.promise);
    mockGetCollectorMigrationStatus.mockImplementation(() => migrationDeferred.promise);
    mockGetCaptureReliabilityStatus.mockImplementation(() => reliabilityDeferred.promise);
    mockGetCodexAppServerStatus.mockImplementation(() => appServerDeferred.promise);

    const { unmount } = renderHook(() =>
      useAutoIngest({
        repoRoot: '/repo',
        repoId: 1,
        model: baseModel,
        setRepoState: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(mockGetIngestConfig).toHaveBeenCalledTimes(1);
    });

    unmount();

    await act(async () => {
      configDeferred.resolve(
        makeConfig({
          autoIngestEnabled: true,
          watchPaths: { claude: ['/watch/claude'], cursor: [], codexLogs: [] },
        })
      );
      keyDeferred.resolve({ present: true });
      sourcesDeferred.resolve({
        claude: ['/watch/claude'],
        cursor: [],
        codexLogs: [],
        collector: defaultMigration,
      });
      migrationDeferred.resolve(defaultMigration);
      reliabilityDeferred.resolve(defaultReliability);
      appServerDeferred.resolve(defaultAppServer);
      await Promise.resolve();
    });

    expect(mockPurgeExpiredSessions).not.toHaveBeenCalled();
    expect(mockGetIngestActivity).not.toHaveBeenCalled();
  });

  it('handles all session:live:event payload variants in a synthetic sequence', async () => {
    const listeners = new Map<string, (event: { payload: unknown }) => void | Promise<void>>();
    mockListen.mockImplementation(
      async (event: string, handler: (event: { payload: unknown }) => void | Promise<void>) => {
        listeners.set(event, handler);
        return vi.fn();
      }
    );

    mockGetIngestConfig.mockResolvedValue(
      makeConfig({
        autoIngestEnabled: true,
        watchPaths: { claude: [], cursor: [], codexLogs: [] },
      })
    );

    const { result } = renderHook(() =>
      useAutoIngest({
        repoRoot: '/repo',
        repoId: 1,
        model: baseModel,
        setRepoState: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(listeners.has('session:live:event')).toBe(true);
    });

    const liveEventCallback = listeners.get('session:live:event');
    expect(liveEventCallback).toBeDefined();

    let reliabilityCalls = mockGetCaptureReliabilityStatus.mock.calls.length;

    act(() => {
      void liveEventCallback?.({
        payload: {
          type: 'SessionDelta',
          threadId: 'th_1',
          turnId: 'tu_1',
          itemId: 'it_1',
          eventType: 'item/delta',
          source: 'app_server_stream',
          sequenceId: 1,
          receivedAtIso: '2026-02-24T00:00:00.000Z',
          payload: { text: 'delta' },
        },
      });
    });
    await waitFor(() => {
      expect(mockGetCaptureReliabilityStatus.mock.calls.length).toBeGreaterThan(reliabilityCalls);
    });
    reliabilityCalls = mockGetCaptureReliabilityStatus.mock.calls.length;

    act(() => {
      void liveEventCallback?.({
        payload: {
          type: 'ApprovalRequest',
          requestId: 'req_1',
          threadId: 'th_1',
          turnId: 'tu_1',
          command: 'write_file',
          options: ['allow', 'deny'],
          timeoutMs: 10_000,
        },
      });
    });
    await waitFor(() => {
      expect(mockGetCaptureReliabilityStatus.mock.calls.length).toBeGreaterThan(reliabilityCalls);
    });
    reliabilityCalls = mockGetCaptureReliabilityStatus.mock.calls.length;

    act(() => {
      void liveEventCallback?.({
        payload: {
          type: 'ApprovalResult',
          requestId: 'req_1',
          threadId: 'th_1',
          approved: false,
          decidedAtIso: '2026-02-24T00:00:01.000Z',
          reason: 'Denied',
        },
      });
    });
    await waitFor(() => {
      expect(mockGetCaptureReliabilityStatus.mock.calls.length).toBeGreaterThan(reliabilityCalls);
    });
    reliabilityCalls = mockGetCaptureReliabilityStatus.mock.calls.length;

    act(() => {
      void liveEventCallback?.({
        payload: {
          type: 'ParserValidationError',
          kind: 'protocol_violation',
          rawPreview: 'truncated',
          reason: 'Reconnect validation failed',
          occurredAtIso: '2026-02-24T00:00:02.000Z',
        },
      });
    });
    await waitFor(() => {
      expect(mockGetCaptureReliabilityStatus.mock.calls.length).toBeGreaterThan(reliabilityCalls);
    });
    await waitFor(() => {
      expect(
        result.current.issues.some(
          (issue) =>
            issue.title === 'Codex App Server parser validation error' &&
            issue.message.includes('Reconnect validation failed')
        )
      ).toBe(true);
    });
  });

  it('does not refresh badges or activity after unmounting during listener-triggered auto-import', async () => {
    const importDeferred = createDeferred<{ status: 'imported'; tool: string; redactionCount: number }>();
    type SessionEvent = { payload: { path: string; tool?: string } };

    mockAutoImportSessionFile.mockReturnValue(importDeferred.promise);

    mockListen.mockImplementation(async (_event: string, _handler: (event: SessionEvent) => Promise<void> | void) => {
      const unlisten = vi.fn();
      return unlisten;
    });

    mockGetIngestConfig.mockResolvedValue(
      makeConfig({
        autoIngestEnabled: true,
        watchPaths: { claude: ['/watch/claude'], cursor: [], codexLogs: [] },
      })
    );

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() =>
      useAutoIngest({
        repoRoot: '/repo',
        repoId: 1,
        model: baseModel,
        setRepoState: vi.fn(),
      })
    );

    let sessionCallback: ((event: SessionEvent) => Promise<void> | void) | undefined;
    await waitFor(() => {
      sessionCallback = mockListen.mock.calls.find(
        (call) => call[0] === 'session-file-changed'
      )?.[1] as ((event: SessionEvent) => Promise<void> | void) | undefined;
      expect(sessionCallback).toBeDefined();
    });

    expect(mockRefreshSessionBadges).toHaveBeenCalledTimes(0);

    act(() => {
      void sessionCallback?.({
        payload: {
          path: '/tmp/session.json',
          tool: 'claude',
        },
      });
    });
    expect(mockAutoImportSessionFile).toHaveBeenCalledWith(1, '/tmp/session.json');

    const priorActivityCalls = mockGetIngestActivity.mock.calls.length;
    unmount();

    await act(async () => {
      importDeferred.resolve({
        status: 'imported',
        tool: 'claude',
        redactionCount: 1,
      });
      await importDeferred.promise;
      await Promise.resolve();
    });

    expect(mockRefreshSessionBadges).toHaveBeenCalledTimes(0);
    expect(mockGetIngestActivity).toHaveBeenCalledTimes(priorActivityCalls);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("Can't perform a React state update on an unmounted component")
    );
    consoleError.mockRestore();
  });
});
