import { describe, expect, it } from 'vitest';

import type { CaptureReliabilityStatus } from '../../../core/tauri/ingestConfig';
import { describeCockpitTrust } from '../dashboardState';

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

describe('describeCockpitTrust', () => {
  it('defaults to healthy trust when no capture status exists', () => {
    const result = describeCockpitTrust();

    expect(result.trustState).toBe('healthy');
    expect(result.trustLabel).toBe('Capture healthy');
    expect(result.reliabilityMode).toBe('HYBRID_ACTIVE');
  });

  it('treats unknown capture modes as degraded', () => {
    const unknownModeStatus = {
      ...createCaptureReliabilityStatus(),
      mode: 'NONSENSE_MODE',
    } as unknown as CaptureReliabilityStatus;

    const result = describeCockpitTrust(unknownModeStatus);

    expect(result.trustState).toBe('degraded');
    expect(result.trustLabel).toBe('Capture degraded');
    expect(result.reliabilityMode).toBe('NONSENSE_MODE');
  });

  it('uses OTEL_ONLY baseline health to determine trust state', () => {
    const healthyOtelOnly = createCaptureReliabilityStatus({
      mode: 'OTEL_ONLY',
      otelBaselineHealthy: true,
    });
    const degradedOtelOnly = createCaptureReliabilityStatus({
      mode: 'OTEL_ONLY',
      otelBaselineHealthy: false,
    });

    expect(describeCockpitTrust(healthyOtelOnly).trustState).toBe('healthy');
    expect(describeCockpitTrust(healthyOtelOnly).trustLabel).toBe('Capture baseline healthy');
    expect(describeCockpitTrust(degradedOtelOnly).trustState).toBe('degraded');
    expect(describeCockpitTrust(degradedOtelOnly).trustLabel).toBe(
      'Capture baseline healthy, stream unavailable',
    );
  });
});
