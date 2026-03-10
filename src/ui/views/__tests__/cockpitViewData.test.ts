import { describe, expect, it } from 'vitest';

import type { BranchViewModel } from '../../../core/types';
import type { CaptureReliabilityStatus } from '../../../core/tauri/ingestConfig';
import type { RepoState } from '../../../hooks/useRepoLoader';
import { buildCockpitViewModel } from '../cockpitViewData';

function createRepoState(): RepoState {
  return {
    status: 'ready',
    path: '/Users/jamiecraik/dev/trace-narrative',
    repo: {
      repoId: 42,
      root: '/Users/jamiecraik/dev/trace-narrative',
      branch: 'main',
      headSha: 'abc123',
    },
    model: {
      source: 'git',
      title: 'trace-narrative',
      status: 'open',
      description: 'Trace Narrative workspace',
      stats: {
        added: 0,
        removed: 0,
        files: 0,
        commits: 0,
        prompts: 0,
        responses: 0,
      },
      intent: [],
      timeline: [
        { id: 'c1', type: 'commit', label: 'Commit 1' },
        { id: 'c2', type: 'commit', label: 'Commit 2' },
      ],
      sessionExcerpts: [
        {
          id: 's1',
          tool: 'codex',
          messages: [{ id: 'm1', role: 'user', text: 'Investigate cockpit routing' }],
        },
      ],
      meta: {
        repoId: 42,
        repoPath: '/Users/jamiecraik/dev/trace-narrative',
        branchName: 'main',
        headSha: 'abc123',
      },
    } as BranchViewModel,
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
      streamEventsAccepted: 12,
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

describe('buildCockpitViewModel', () => {
  it('maps OTEL_ONLY reliability to derived-summary authority cues', () => {
    const model = buildCockpitViewModel(
      'live',
      createRepoState(),
      createCaptureReliabilityStatus({ mode: 'OTEL_ONLY', otelBaselineHealthy: true }),
    );

    expect(model.trustState).toBe('healthy');
    expect(model.heroAuthorityTier).toBe('derived_summary');
    expect(model.heroAuthorityLabel).toBe('Derived from baseline OTEL-only telemetry');

    const captureModeMetric = model.metrics.find((metric) => metric.label === 'Capture mode');
    expect(captureModeMetric).toBeDefined();
    expect(captureModeMetric?.authorityTier).toBe('derived_summary');
    expect(captureModeMetric?.authorityLabel).toBe('Derived from baseline OTEL-only telemetry');
  });

  it('marks unknown modes as degraded trust with captured-source authority', () => {
    const unknownModeReliabilityStatus = createCaptureReliabilityStatus({
      mode: 'NONSENSE_MODE' as CaptureReliabilityStatus['mode'],
    });
    const model = buildCockpitViewModel('status', createRepoState(), unknownModeReliabilityStatus);

    expect(model.trustState).toBe('degraded');
    expect(model.heroAuthorityTier).toBe('live_capture');
    expect(model.heroAuthorityLabel).toBe('Captured from nonsense_mode');
  });
});
