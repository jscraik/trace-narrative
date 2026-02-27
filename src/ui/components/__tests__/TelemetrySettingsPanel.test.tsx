import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TelemetrySettingsPanel } from '../TelemetrySettingsPanel';

describe('TelemetrySettingsPanel', () => {
  it('hides file-path controls when embedded receiver is active', () => {
    render(
      <TelemetrySettingsPanel
        traceConfig={{
          codexOtelLogPath: '/tmp/codex-otel.json',
          codexOtelReceiverEnabled: true,
        }}
        onToggleCodexOtelReceiver={vi.fn()}
      />
    );

    expect(screen.queryByText('Codex OTel log file path')).not.toBeInTheDocument();
    expect(screen.getByText('Embedded receiver active')).toBeInTheDocument();
    expect(
      screen.getByText('Embedded receiver is active. File-path OTEL import is hidden.')
    ).toBeInTheDocument();
  });

  it('shows file-path controls when embedded receiver is disabled', () => {
    render(
      <TelemetrySettingsPanel
        traceConfig={{
          codexOtelLogPath: '/tmp/codex-otel.json',
          codexOtelReceiverEnabled: false,
        }}
        onToggleCodexOtelReceiver={vi.fn()}
      />
    );

    expect(screen.getByText('Codex OTel log file path')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync' })).toBeInTheDocument();
  });

  it('hides file-path controls when codex app server stream is active', () => {
    render(
      <TelemetrySettingsPanel
        traceConfig={{
          codexOtelLogPath: '/tmp/codex-otel.json',
          codexOtelReceiverEnabled: false,
        }}
        captureReliabilityStatus={{
          mode: 'HYBRID_ACTIVE',
          otelBaselineHealthy: true,
          streamExpected: true,
          streamHealthy: true,
          reasons: [],
          metrics: {
            streamEventsAccepted: 0,
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
            authMode: 'chatgpt',
            streamHealthy: true,
            streamKillSwitch: false,
            restartBudget: 3,
            restartAttemptsInWindow: 0,
          },
        }}
        onToggleCodexOtelReceiver={vi.fn()}
      />
    );

    expect(screen.queryByText('Codex OTel log file path')).not.toBeInTheDocument();
    expect(screen.getByText('App Server stream active')).toBeInTheDocument();
    expect(
      screen.getByText('Codex App Server stream is active. File-path OTEL import is hidden.')
    ).toBeInTheDocument();
  });
});
