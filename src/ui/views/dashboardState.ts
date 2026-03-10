import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type {
  CommandAuthorityOutcome,
  DashboardRuntimeEnvironment,
  DashboardState,
  CockpitTrustState,
  DashboardTrustState,
  RetryBudgetProfile,
  RetryFailureClass,
} from '../../core/types';

export const COCKPIT_TRUST_LABELS = {
  healthy: {
    default: 'Capture healthy',
    liveCapture: 'Capture healthy',
    otelOnly: 'Capture baseline healthy',
  },
  degraded: {
    default: 'Capture degraded',
    hybrid: 'Capture degraded',
    otelOnly: 'Capture baseline healthy, stream unavailable',
  },
} as const;

function toCockpitTrustLabel(
  mode: string,
  trustState: CockpitTrustState,
): string {
  if (mode === 'OTEL_ONLY') {
    return trustState === 'healthy'
      ? COCKPIT_TRUST_LABELS.healthy.otelOnly
      : COCKPIT_TRUST_LABELS.degraded.otelOnly;
  }

  if (mode === 'HYBRID_ACTIVE') {
    return trustState === 'healthy'
      ? COCKPIT_TRUST_LABELS.healthy.default
      : COCKPIT_TRUST_LABELS.degraded.default;
  }

  if (mode === 'DEGRADED_STREAMING') {
    return 'Capture degraded streaming';
  }

  if (mode === 'FAILURE') {
    return 'Capture failure';
  }

  return trustState === 'healthy' ? COCKPIT_TRUST_LABELS.healthy.default : COCKPIT_TRUST_LABELS.degraded.default;
}

export function deriveCockpitTrustState(
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
): CockpitTrustState {
  if (!captureReliabilityStatus) return 'healthy';

  if (
    captureReliabilityStatus.mode === 'HYBRID_ACTIVE' &&
    captureReliabilityStatus.streamExpected &&
    captureReliabilityStatus.streamHealthy
  ) {
    return 'healthy';
  }

  if (captureReliabilityStatus.mode === 'OTEL_ONLY') {
    return captureReliabilityStatus.otelBaselineHealthy ? 'healthy' : 'degraded';
  }

  if (
    captureReliabilityStatus.mode === 'DEGRADED_STREAMING' ||
    captureReliabilityStatus.mode === 'FAILURE' ||
    (captureReliabilityStatus.streamExpected && !captureReliabilityStatus.streamHealthy) ||
    !captureReliabilityStatus.appServer.streamHealthy
  ) {
    return 'degraded';
  }

  return 'degraded';
}

export function describeCockpitTrust(
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
): { trustState: CockpitTrustState; trustLabel: string; reliabilityMode: string } {
  const reliabilityMode = captureReliabilityStatus?.mode ?? 'HYBRID_ACTIVE';
  const trustState = deriveCockpitTrustState(captureReliabilityStatus);

  return {
    trustState,
    trustLabel: toCockpitTrustLabel(
      reliabilityMode,
      trustState,
    ),
    reliabilityMode,
  };
}

export const DASHBOARD_CHORD_TIMEOUT_MS = 750;
export const DASHBOARD_FOCUS_RESTORE_MS = 180;
export const DASHBOARD_DROPPED_REQUEST_LIMIT = 50;
export const DASHBOARD_DROPPED_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

const PERMISSION_DENIED_PATTERN =
  /\b(permission denied|not permitted|forbidden|capability|scope|window denied|access denied)\b/i;
const OFFLINE_PATTERN =
  /\b(offline|unavailable|timed out|connection refused|network error|stream unavailable)\b/i;
const TIMEOUT_PATTERN = /\b(timeout|timed out)\b/i;

type RetryBudgetProfileByClass = Record<RetryFailureClass, RetryBudgetProfile>;

export const DASHBOARD_RETRY_PROFILES: Record<
  DashboardRuntimeEnvironment,
  RetryBudgetProfileByClass
> = {
  dev: {
    ipc_timeout: {
      failureClass: 'ipc_timeout',
      maxAttempts: 3,
      maxTotalRetryMs: 4000,
      backoffScheduleMs: [250, 500, 1000],
      jitterPercent: 20,
    },
    io_transient: {
      failureClass: 'io_transient',
      maxAttempts: 3,
      maxTotalRetryMs: 4000,
      backoffScheduleMs: [250, 500, 1000],
      jitterPercent: 20,
    },
    offline_source: {
      failureClass: 'offline_source',
      maxAttempts: 1,
      maxTotalRetryMs: 0,
      backoffScheduleMs: [],
      jitterPercent: 0,
    },
    authority_denied: {
      failureClass: 'authority_denied',
      maxAttempts: 1,
      maxTotalRetryMs: 0,
      backoffScheduleMs: [],
      jitterPercent: 0,
    },
  },
  ci: {
    ipc_timeout: {
      failureClass: 'ipc_timeout',
      maxAttempts: 3,
      maxTotalRetryMs: 6000,
      backoffScheduleMs: [250, 500, 1000],
      jitterPercent: 20,
    },
    io_transient: {
      failureClass: 'io_transient',
      maxAttempts: 3,
      maxTotalRetryMs: 6000,
      backoffScheduleMs: [250, 500, 1000],
      jitterPercent: 20,
    },
    offline_source: {
      failureClass: 'offline_source',
      maxAttempts: 1,
      maxTotalRetryMs: 0,
      backoffScheduleMs: [],
      jitterPercent: 0,
    },
    authority_denied: {
      failureClass: 'authority_denied',
      maxAttempts: 1,
      maxTotalRetryMs: 0,
      backoffScheduleMs: [],
      jitterPercent: 0,
    },
  },
  prod: {
    ipc_timeout: {
      failureClass: 'ipc_timeout',
      maxAttempts: 3,
      maxTotalRetryMs: 12000,
      backoffScheduleMs: [250, 500, 1000],
      jitterPercent: 20,
    },
    io_transient: {
      failureClass: 'io_transient',
      maxAttempts: 3,
      maxTotalRetryMs: 12000,
      backoffScheduleMs: [250, 500, 1000],
      jitterPercent: 20,
    },
    offline_source: {
      failureClass: 'offline_source',
      maxAttempts: 1,
      maxTotalRetryMs: 0,
      backoffScheduleMs: [],
      jitterPercent: 0,
    },
    authority_denied: {
      failureClass: 'authority_denied',
      maxAttempts: 1,
      maxTotalRetryMs: 0,
      backoffScheduleMs: [],
      jitterPercent: 0,
    },
  },
};

export function deriveDashboardTrustState(
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
): DashboardTrustState {
  return deriveCockpitTrustState(captureReliabilityStatus);
}

export function classifyDashboardFailure(
  error: unknown,
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
): {
  state: Extract<DashboardState, 'error' | 'offline' | 'permission_denied'>;
  message: string;
  failureClass: RetryFailureClass;
  authorityOutcome?: Exclude<CommandAuthorityOutcome, 'allowed'>;
  canRetry: boolean;
} {
  const message = error instanceof Error ? error.message : 'Failed to load dashboard';

  if (PERMISSION_DENIED_PATTERN.test(message)) {
    const authorityOutcome = message.toLowerCase().includes('scope')
      ? 'denied_scope'
      : message.toLowerCase().includes('window')
        ? 'denied_window'
        : 'denied_capability';
    return {
      state: 'permission_denied',
      message,
      failureClass: 'authority_denied',
      authorityOutcome,
      canRetry: false,
    };
  }

  if (
    captureReliabilityStatus?.mode === 'FAILURE' ||
    OFFLINE_PATTERN.test(message)
  ) {
    return {
      state: 'offline',
      message,
      failureClass: TIMEOUT_PATTERN.test(message) ? 'ipc_timeout' : 'offline_source',
      canRetry: true,
    };
  }

  return {
    state: 'error',
    message,
    failureClass: TIMEOUT_PATTERN.test(message) ? 'ipc_timeout' : 'io_transient',
    canRetry: true,
  };
}

export function resolveDashboardRuntimeEnvironment(): DashboardRuntimeEnvironment {
  if (import.meta.env.VITEST || import.meta.env.MODE === 'test') {
    return 'ci';
  }
  if (import.meta.env.DEV) {
    return 'dev';
  }
  return 'prod';
}

export function hashDashboardRequestKey(parts: {
  repoId: number;
  timeRange: string;
  filesOffset: number;
}): string {
  const input = `${parts.repoId}:${parts.timeRange}:${parts.filesOffset}`;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
