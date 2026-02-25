import { invoke } from '@tauri-apps/api/core';

export type IngestConfig = {
  autoIngestEnabled: boolean;
  watchPaths: { claude: string[]; cursor: string[]; codexLogs: string[] };
  codex: {
    receiverEnabled: boolean;
    mode: 'otlp' | 'logs' | 'both';
    endpoint: string;
    headerEnvKey: string;
    streamEnrichmentEnabled: boolean;
    streamKillSwitch: boolean;
    appServerAuthMode: string;
  };
  collector: {
    canonicalRoot: string;
    legacyRoot: string;
    migration: {
      status: 'not_started' | 'migrated' | 'deferred' | 'failed';
      lastAttemptAtIso?: string;
      lastError?: string;
      lastBackupPath?: string;
    };
  };
  retentionDays: number;
  redactionMode: 'redact';
  consent: { codexTelemetryGranted: boolean; grantedAtIso?: string };
};

export type IngestConfigUpdate = Partial<IngestConfig>;

export type OtlpEnvStatus = {
  present: boolean;
  keyName: string;
};

export type OtlpKeyStatus = {
  present: boolean;
  maskedPreview?: string;
};

export type DiscoveredSources = {
  claude: string[];
  cursor: string[];
  codexLogs: string[];
  collector: CollectorMigrationStatus;
};

export type CollectorMigrationStatus = {
  canonicalRoot: string;
  legacyRoot: string;
  canonicalExists: boolean;
  legacyExists: boolean;
  migrationRequired: boolean;
  status: 'not_started' | 'migrated' | 'deferred' | 'failed';
  lastAttemptAtIso?: string;
  lastError?: string;
  lastBackupPath?: string;
};

export type CollectorMigrationResult = {
  status: CollectorMigrationStatus;
  migrated: boolean;
  rolledBack: boolean;
  dryRun: boolean;
  actions: string[];
};

export type CodexAppServerStatus = {
  state: 'inactive' | 'starting' | 'running' | 'degraded' | 'crash_loop' | 'error' | 'stopping';
  initialized: boolean;
  initializeSent: boolean;
  authState: 'needs_login' | 'authenticating' | 'authenticated' | 'logged_out';
  authMode: string;
  streamHealthy: boolean;
  streamKillSwitch: boolean;
  restartBudget: number;
  restartAttemptsInWindow: number;
  lastError?: string;
  lastTransitionAtIso?: string;
};

export type CodexAccountStatus = {
  authState: 'needs_login' | 'authenticating' | 'authenticated' | 'logged_out';
  authMode: string;
  interactiveLoginRequired: boolean;
  supportedModes: string[];
};

export type CaptureReliabilityStatus = {
  mode: 'OTEL_ONLY' | 'HYBRID_ACTIVE' | 'DEGRADED_STREAMING' | 'FAILURE';
  otelBaselineHealthy: boolean;
  streamExpected: boolean;
  streamHealthy: boolean;
  reasons: string[];
  metrics: {
    streamEventsAccepted: number;
    streamEventsDuplicates: number;
    streamEventsDropped: number;
    streamEventsReplaced: number;
    parserValidationErrorsTotal?: number;
    rpcTimeoutsTotal?: number;
    approvalTimeoutsTotal?: number;
    restartEventsTotal?: number;
    pendingRpcs?: number;
    pendingApprovals?: number;
    sidecarStderrBuffered?: number;
    sidecarStderrDropped?: number;
    timeSinceLastStreamEventMs?: number;
  };
  transitions: Array<{ atIso: string; fromMode?: string; toMode: string; reason: string }>;
  appServer: CodexAppServerStatus;
};

export type CodexStreamEventInput = {
  provider: string;
  threadId: string;
  turnId: string;
  itemId: string;
  eventType: string;
  source: 'otel' | 'app_server_stream';
  payload?: unknown;
};

export type CodexStreamIngestResult = {
  key: string;
  decision: 'accepted' | 'duplicate' | 'replaced' | 'dropped';
  chosenSource: string;
  replacedSource?: string;
};

export type LiveSessionEventPayload =
  | {
      type: 'SessionDelta';
      threadId: string;
      turnId: string;
      itemId: string;
      eventType: string;
      source: 'app_server_stream' | 'otel' | string;
      sequenceId: number;
      receivedAtIso: string;
      payload: unknown;
    }
  | {
      type: 'ApprovalRequest';
      requestId: string;
      threadId: string;
      turnId: string;
      command: string;
      options: string[];
      timeoutMs: number;
      decisionToken?: string;
    }
  | {
      type: 'ApprovalResult';
      requestId: string;
      threadId: string;
      approved: boolean;
      decidedAtIso: string;
      decidedBy?: string;
      reason?: string;
    }
  | {
      type: 'ParserValidationError';
      kind: 'schema_mismatch' | 'missing_fields' | 'protocol_violation' | string;
      rawPreview: string;
      reason: string;
      occurredAtIso: string;
    };

export type AutoImportResult = {
  status: 'imported' | 'skipped' | 'failed';
  tool: string;
  sessionId: string;
  redactionCount: number;
  needsReview: boolean;
};

export async function getIngestConfig(): Promise<IngestConfig> {
  return await invoke<IngestConfig>('get_ingest_config');
}

export async function setIngestConfig(update: IngestConfigUpdate): Promise<IngestConfig> {
  return await invoke<IngestConfig>('set_ingest_config', { update });
}

export async function getOtlpEnvStatus(): Promise<OtlpEnvStatus> {
  return await invoke<OtlpEnvStatus>('get_otlp_env_status');
}

export async function getOtlpKeyStatus(): Promise<OtlpKeyStatus> {
  return await invoke<OtlpKeyStatus>('get_otlp_key_status');
}

export async function ensureOtlpApiKey(): Promise<OtlpKeyStatus> {
  return await invoke<OtlpKeyStatus>('ensure_otlp_api_key');
}

export async function resetOtlpApiKey(): Promise<OtlpKeyStatus> {
  return await invoke<OtlpKeyStatus>('reset_otlp_api_key');
}

export async function discoverCaptureSources(): Promise<DiscoveredSources> {
  return await invoke<DiscoveredSources>('discover_capture_sources');
}

export async function getCollectorMigrationStatus(): Promise<CollectorMigrationStatus> {
  return await invoke<CollectorMigrationStatus>('get_collector_migration_status');
}

export async function runCollectorMigration(dryRun = false): Promise<CollectorMigrationResult> {
  return await invoke<CollectorMigrationResult>('run_collector_migration', { dryRun });
}

export async function rollbackCollectorMigration(): Promise<CollectorMigrationResult> {
  return await invoke<CollectorMigrationResult>('rollback_collector_migration');
}

export async function configureCodexOtel(endpoint: string): Promise<void> {
  await invoke('configure_codex_otel', { endpoint });
}

export async function getCodexAppServerStatus(): Promise<CodexAppServerStatus> {
  return await invoke<CodexAppServerStatus>('get_codex_app_server_status');
}

export async function startCodexAppServer(): Promise<CodexAppServerStatus> {
  return await invoke<CodexAppServerStatus>('start_codex_app_server');
}

export async function stopCodexAppServer(): Promise<CodexAppServerStatus> {
  return await invoke<CodexAppServerStatus>('stop_codex_app_server');
}

export async function codexAppServerInitialize(): Promise<CodexAppServerStatus> {
  return await invoke<CodexAppServerStatus>('codex_app_server_initialize');
}

export async function codexAppServerInitialized(): Promise<CodexAppServerStatus> {
  return await invoke<CodexAppServerStatus>('codex_app_server_initialized');
}

export async function codexAppServerAccountRead(): Promise<CodexAccountStatus> {
  return await invoke<CodexAccountStatus>('codex_app_server_account_read');
}

export async function codexAppServerLoginStart(authMode?: 'apikey' | 'chatgpt' | 'chatgptAuthTokens'): Promise<CodexAccountStatus> {
  return await invoke<CodexAccountStatus>('codex_app_server_account_login_start', { authMode });
}

export async function codexAppServerChatgptAuthTokensRefresh(
  accessToken: string,
  refreshToken?: string,
): Promise<CodexAccountStatus> {
  return await invoke<CodexAccountStatus>('codex_app_server_account_chatgpt_auth_tokens_refresh', {
    accessToken,
    refreshToken,
  });
}

export async function codexAppServerLogout(): Promise<CodexAccountStatus> {
  return await invoke<CodexAccountStatus>('codex_app_server_account_logout');
}

export async function codexAppServerSetStreamKillSwitch(enabled: boolean): Promise<CodexAppServerStatus> {
  return await invoke<CodexAppServerStatus>('codex_app_server_set_stream_kill_switch', { enabled });
}

export async function codexAppServerSubmitApproval(
  requestId: string,
  threadId: string,
  decisionToken: string,
  approved: boolean,
  reason?: string,
): Promise<LiveSessionEventPayload> {
  return await invoke<LiveSessionEventPayload>('codex_app_server_submit_approval', {
    requestId,
    threadId,
    decisionToken,
    approved,
    reason,
  });
}

export async function getCaptureReliabilityStatus(): Promise<CaptureReliabilityStatus> {
  return await invoke<CaptureReliabilityStatus>('get_capture_reliability_status');
}

export type BackfillResult = {
  attempted: number;
  imported: number;
  skipped: number;
  failed: number;
};

export async function backfillRecentSessions(repoId: number, limitPerTool = 10): Promise<BackfillResult> {
  return await invoke<BackfillResult>('backfill_recent_sessions', { repoId, limitPerTool });
}

export async function startFileWatcher(paths: string[]): Promise<void> {
  await invoke('start_file_watcher', { watchPaths: paths });
}

export async function stopFileWatcher(): Promise<void> {
  await invoke('stop_file_watcher');
}

export async function autoImportSessionFile(repoId: number, filePath: string): Promise<AutoImportResult> {
  return await invoke<AutoImportResult>('auto_import_session_file', { repoId, filePath });
}

export async function purgeExpiredSessions(repoId: number, retentionDays: number): Promise<number> {
  return await invoke<number>('purge_expired_sessions', { repoId, retentionDays });
}
