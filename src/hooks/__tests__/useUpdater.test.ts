import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdater } from '../useUpdater';

const mockCheck = vi.hoisted(() => vi.fn());
const mockRelaunch = vi.hoisted(() => vi.fn());
const mockAsk = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: mockCheck,
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: mockRelaunch,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: mockAsk,
  message: mockMessage,
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

function createUpdate(version = '1.0.1') {
  return {
    version,
    currentVersion: '1.0.0',
    date: '2026-02-24T00:00:00Z',
    body: null,
    downloadAndInstall: vi.fn(),
  };
}

describe('useUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheck.mockResolvedValue(null);
    mockAsk.mockResolvedValue(false);
    mockMessage.mockResolvedValue(undefined);
    mockRelaunch.mockResolvedValue(undefined);
  });

  it('ignores stale no-update response when a newer check finds an update', async () => {
    const first = createDeferred<unknown>();
    const second = createDeferred<unknown>();

    mockCheck
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);

    const { result } = renderHook(() => useUpdater());

    let checkFirst: Promise<void> | undefined;
    let checkSecond: Promise<void> | undefined;
    await act(async () => {
      checkFirst = result.current.checkForUpdates();
      checkSecond = result.current.checkForUpdates();
      await Promise.resolve();
    });

    await act(async () => {
      second.resolve(createUpdate('2.0.0'));
      await checkSecond;
    });

    await waitFor(() => {
      expect(result.current.status?.type).toBe('available');
    });

    await act(async () => {
      first.resolve(null);
      await checkFirst;
    });

    expect(result.current.status?.type).toBe('available');
  });

  it('ignores stale check error after newer success', async () => {
    const first = createDeferred<unknown>();
    const second = createDeferred<unknown>();

    mockCheck
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);

    const { result } = renderHook(() => useUpdater());

    let checkFirst: Promise<void> | undefined;
    let checkSecond: Promise<void> | undefined;
    await act(async () => {
      checkFirst = result.current.checkForUpdates();
      checkSecond = result.current.checkForUpdates();
      await Promise.resolve();
    });

    await act(async () => {
      second.resolve(createUpdate('3.0.0'));
      await checkSecond;
    });

    await waitFor(() => {
      expect(result.current.status?.type).toBe('available');
    });

    await act(async () => {
      first.reject(new Error('stale failure'));
      await checkFirst;
    });

    expect(result.current.status?.type).toBe('available');
  });
});
