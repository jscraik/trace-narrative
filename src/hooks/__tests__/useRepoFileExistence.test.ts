import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRepoFileExistence } from '../useRepoFileExistence';

const mockFileExists = vi.hoisted(() => vi.fn());

vi.mock('../../core/tauri/narrativeFs', () => ({
  fileExists: mockFileExists,
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

describe('useRepoFileExistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists.mockResolvedValue(true);
  });

  it('clears cached file existence when repo root changes', async () => {
    mockFileExists.mockImplementation((repoRoot: string) => {
      if (repoRoot === '/repo/1') return Promise.resolve(true);
      return Promise.reject(new Error('unavailable'));
    });

    const { result, rerender } = renderHook(
      ({ repoRoot }) => useRepoFileExistence(repoRoot, ['src/file.ts']),
      { initialProps: { repoRoot: '/repo/1' } }
    );

    await waitFor(() => {
      expect(result.current['src/file.ts']).toBe(true);
    });

    rerender({ repoRoot: '/repo/2' });

    await waitFor(() => {
      expect(result.current['src/file.ts']).toBeUndefined();
    });
  });

  it('ignores stale in-flight checks from a previous repo root', async () => {
    const oldCheck = createDeferred<boolean>();
    mockFileExists.mockImplementation((repoRoot: string) => {
      if (repoRoot === '/repo/1') return oldCheck.promise;
      return Promise.resolve(false);
    });

    const { result, rerender } = renderHook(
      ({ repoRoot }) => useRepoFileExistence(repoRoot, ['src/file.ts']),
      { initialProps: { repoRoot: '/repo/1' } }
    );

    await waitFor(() => {
      expect(mockFileExists).toHaveBeenCalledWith('/repo/1', 'src/file.ts');
    });

    rerender({ repoRoot: '/repo/2' });

    await waitFor(() => {
      expect(mockFileExists).toHaveBeenCalledWith('/repo/2', 'src/file.ts');
      expect(result.current['src/file.ts']).toBe(false);
    });

    await act(async () => {
      oldCheck.resolve(true);
      await oldCheck.promise;
      await Promise.resolve();
    });

    expect(result.current['src/file.ts']).toBe(false);
  });
});
