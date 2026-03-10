import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { TraceCommitSummary } from '../../core/types';
import {
  TRACE_ANALYZING_DWELL_MS,
  TRACE_INSIGHT_DWELL_MS,
  useTraceSignal,
  type UseTraceSignalOptions,
} from '../useTraceSignal';

vi.mock('../../core/tauri/settings', () => ({
  getTraceSettings: vi.fn(),
  setTraceEnabled: vi.fn(),
}));

import { getTraceSettings, setTraceEnabled } from '../../core/tauri/settings';

const mockGetTraceSettings = vi.mocked(getTraceSettings);
const mockSetTraceEnabled = vi.mocked(setTraceEnabled);

function makeSummary(overrides: Partial<TraceCommitSummary> = {}): TraceCommitSummary {
  return {
    commitSha: 'c1',
    aiLines: 10,
    humanLines: 4,
    mixedLines: 1,
    unknownLines: 0,
    aiPercent: 66.7,
    modelIds: ['gpt-5'],
    toolNames: ['codex'],
    ...overrides,
  };
}

function makeOptions(overrides: Partial<UseTraceSignalOptions> = {}): UseTraceSignalOptions {
  return {
    selectedNodeId: null,
    selectedCommitSha: null,
    hasSelectedFile: false,
    trackingSettled: false,
    loadingFiles: false,
    loadingDiff: false,
    loadingTrace: false,
    traceRequestedForSelection: false,
    traceSummary: undefined,
    onPersistenceError: undefined,
    ...overrides,
  };
}

async function flushAsyncEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useTraceSignal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTraceSettings.mockResolvedValue({ enabled: true });
    mockSetTraceEnabled.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enforces matrix + precedence (Idle cannot jump directly to Insight)', async () => {
    const { result, rerender } = renderHook((options: UseTraceSignalOptions) => useTraceSignal(options), {
      initialProps: makeOptions({
        selectedNodeId: 'c1',
        selectedCommitSha: 'c1',
        trackingSettled: false,
        loadingFiles: true,
        traceSummary: makeSummary(),
      }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event.type).toBe('analyzing');

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: false,
      traceSummary: makeSummary(),
    }));

    expect(result.current.event.type).toBe('insight');
    if (result.current.event.type === 'insight') {
      expect(result.current.event.selectedCommitSha).toBe('c1');
    }
  });

  it('applies dwell windows before dropping from Insight/Analyzing', async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook((options: UseTraceSignalOptions) => useTraceSignal(options), {
      initialProps: makeOptions({
        selectedNodeId: 'c1',
        selectedCommitSha: 'c1',
        trackingSettled: false,
        loadingFiles: true,
        traceSummary: makeSummary(),
      }),
    });

    await flushAsyncEffects();
    expect(result.current.loading).toBe(false);
    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: false,
      traceSummary: makeSummary(),
    }));
    expect(result.current.event.type).toBe('insight');

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: false,
      traceSummary: undefined,
    }));

    expect(result.current.event.type).toBe('insight');

    act(() => {
      vi.advanceTimersByTime(TRACE_INSIGHT_DWELL_MS - 1);
    });
    expect(result.current.event.type).toBe('insight');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.event.type).toBe('idle');

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: true,
    }));
    expect(result.current.event.type).toBe('analyzing');

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: false,
    }));
    expect(result.current.event.type).toBe('analyzing');

    act(() => {
      vi.advanceTimersByTime(TRACE_ANALYZING_DWELL_MS);
    });
    expect(result.current.event.type).toBe('idle');
  });

  it('uses loader applicability truth table for Analyzing', async () => {
    const { result, rerender } = renderHook((options: UseTraceSignalOptions) => useTraceSignal(options), {
      initialProps: makeOptions({
        selectedNodeId: 'c1',
        selectedCommitSha: 'c1',
        trackingSettled: true,
        hasSelectedFile: false,
        loadingDiff: true,
      }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event.type).toBe('idle');

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: true,
    }));
    expect(result.current.event.type).toBe('analyzing');
    if (result.current.event.type === 'analyzing') {
      expect(result.current.event.pendingLoaders).toEqual(['files']);
    }

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      hasSelectedFile: true,
      loadingTrace: true,
      traceRequestedForSelection: false,
    }));
    expect(result.current.event.type).toBe('analyzing');
  });

  it('requires traceRequestedForSelection before trace enters pending set', async () => {
    const { result, rerender } = renderHook((options: UseTraceSignalOptions) => useTraceSignal(options), {
      initialProps: makeOptions({
        selectedNodeId: 'c1',
        selectedCommitSha: 'c1',
        trackingSettled: true,
        hasSelectedFile: true,
        loadingTrace: true,
        traceRequestedForSelection: false,
      }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event.type).toBe('idle');

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      hasSelectedFile: true,
      loadingTrace: true,
      traceRequestedForSelection: true,
    }));

    expect(result.current.event.type).toBe('analyzing');
    if (result.current.event.type === 'analyzing') {
      expect(result.current.event.pendingLoaders).toEqual(['trace']);
    }
  });

  it('ignores stale dwell timer completions after selection changes', async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook((options: UseTraceSignalOptions) => useTraceSignal(options), {
      initialProps: makeOptions({
        selectedNodeId: 'c1',
        selectedCommitSha: 'c1',
        trackingSettled: true,
        loadingFiles: true,
      }),
    });

    await flushAsyncEffects();
    expect(result.current.loading).toBe(false);
    expect(result.current.event.type).toBe('analyzing');

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: false,
    }));

    expect(result.current.event.type).toBe('analyzing');

    rerender(makeOptions({
      selectedNodeId: 'c2',
      selectedCommitSha: 'c2',
      trackingSettled: true,
      loadingFiles: true,
    }));
    expect(result.current.event.type).toBe('analyzing');

    act(() => {
      vi.advanceTimersByTime(TRACE_ANALYZING_DWELL_MS * 2);
    });

    expect(result.current.event.type).toBe('analyzing');
    if (result.current.event.type === 'analyzing') {
      expect(result.current.event.selectedNodeId).toBe('c2');
    }
  });

  it('dedupes Insight by key and supports Insight→Insight only when key changes', async () => {
    const { result, rerender } = renderHook((options: UseTraceSignalOptions) => useTraceSignal(options), {
      initialProps: makeOptions({
        selectedNodeId: 'c1',
        selectedCommitSha: 'c1',
        trackingSettled: false,
        loadingFiles: true,
        traceSummary: makeSummary({
          modelIds: ['gpt-5', 'claude-4'],
          toolNames: ['codex', 'cursor'],
        }),
      }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: false,
      traceSummary: makeSummary({
        modelIds: ['gpt-5', 'claude-4'],
        toolNames: ['codex', 'cursor'],
      }),
    }));

    expect(result.current.event.type).toBe('insight');
    const firstKey = result.current.event.type === 'insight' ? result.current.event.insightKey : '';

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: false,
      traceSummary: makeSummary({
        modelIds: ['claude-4', 'gpt-5'],
        toolNames: ['cursor', 'codex'],
      }),
    }));

    expect(result.current.event.type).toBe('insight');
    if (result.current.event.type === 'insight') {
      expect(result.current.event.insightKey).toBe(firstKey);
    }

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: false,
      traceSummary: makeSummary({
        aiLines: 11,
        modelIds: ['claude-4', 'gpt-5'],
        toolNames: ['cursor', 'codex'],
      }),
    }));

    expect(result.current.event.type).toBe('insight');
    if (result.current.event.type === 'insight') {
      expect(result.current.event.insightKey).not.toBe(firstKey);
    }
  });

  it('surfaces persistence failure errors and reverts toggle state', async () => {
    const onPersistenceError = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSetTraceEnabled.mockRejectedValueOnce(new Error('write failed'));

    const { result } = renderHook((options: UseTraceSignalOptions) => useTraceSignal(options), {
      initialProps: makeOptions({ onPersistenceError }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(true);

    await act(async () => {
      await result.current.toggle(false);
    });

    expect(result.current.enabled).toBe(true);
    expect(onPersistenceError).toHaveBeenCalledWith(expect.stringContaining('write failed'));
    expect(consoleSpy).toHaveBeenCalledWith('[trace.toggle.persist_failed]', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('suppresses state emissions while disabled', async () => {
    const { result, rerender } = renderHook((options: UseTraceSignalOptions) => useTraceSignal(options), {
      initialProps: makeOptions({
        selectedNodeId: 'c1',
        selectedCommitSha: 'c1',
        trackingSettled: true,
        loadingFiles: true,
      }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event.type).toBe('analyzing');

    await act(async () => {
      await result.current.toggle(false);
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.event.type).toBe('idle');

    rerender(makeOptions({
      selectedNodeId: 'c1',
      selectedCommitSha: 'c1',
      trackingSettled: true,
      loadingFiles: true,
    }));
    expect(result.current.event.type).toBe('idle');
  });
});
