/**
 * Unit tests for ingestConfig.ts — IPC command-shape and input-validation.
 *
 * Two things under test:
 *  1. Each exported function sends the correct Tauri command + argument shape.
 *  2. configureCodexOtel validates endpoint URLs before invoking the backend.
 *
 * Full coverage of all 30+ commands is impractical; we cover:
 *  - Representative read-only commands (getIngestConfig, getOtlpEnvStatus, etc.)
 *  - write commands with interesting argument shapes
 *  - The validation-bearing configureCodexOtel
 *  - Error propagation for all categories
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getIngestConfig,
  setIngestConfig,
  getOtlpEnvStatus,
  getOtlpKeyStatus,
  ensureOtlpApiKey,
  resetOtlpApiKey,
  discoverCaptureSources,
  configureCodexOtel,
  getCodexAppServerStatus,
  startCodexAppServer,
  stopCodexAppServer,
  backfillRecentSessions,
  startFileWatcher,
  stopFileWatcher,
  autoImportSessionFile,
  purgeExpiredSessions,
  codexAppServerSubmitApproval,
  codexAppServerChatgptAuthTokensRefresh,
} from '../ingestConfig';

// ---------------------------------------------------------------------------
// Mock Tauri invoke
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Read-only IPC passthroughs
// ---------------------------------------------------------------------------

describe('read-only IPC commands', () => {
  it('getIngestConfig — calls get_ingest_config with no args', async () => {
    const stub = { autoIngestEnabled: true };
    mockInvoke.mockResolvedValue(stub);

    const result = await getIngestConfig();
    expect(mockInvoke).toHaveBeenCalledWith('get_ingest_config');
    expect(result).toBe(stub);
  });

  it('getOtlpEnvStatus — calls get_otlp_env_status', async () => {
    mockInvoke.mockResolvedValue({ present: true, keyName: 'OTEL_KEY' });
    await getOtlpEnvStatus();
    expect(mockInvoke).toHaveBeenCalledWith('get_otlp_env_status');
  });

  it('getOtlpKeyStatus — calls get_otlp_key_status', async () => {
    mockInvoke.mockResolvedValue({ present: false });
    await getOtlpKeyStatus();
    expect(mockInvoke).toHaveBeenCalledWith('get_otlp_key_status');
  });

  it('ensureOtlpApiKey — calls ensure_otlp_api_key', async () => {
    mockInvoke.mockResolvedValue({ present: true, maskedPreview: '***1234' });
    await ensureOtlpApiKey();
    expect(mockInvoke).toHaveBeenCalledWith('ensure_otlp_api_key');
  });

  it('resetOtlpApiKey — calls reset_otlp_api_key', async () => {
    mockInvoke.mockResolvedValue({ present: false });
    await resetOtlpApiKey();
    expect(mockInvoke).toHaveBeenCalledWith('reset_otlp_api_key');
  });

  it('discoverCaptureSources — calls discover_capture_sources', async () => {
    mockInvoke.mockResolvedValue({ claude: [], cursor: [], codexLogs: [], collector: {} });
    await discoverCaptureSources();
    expect(mockInvoke).toHaveBeenCalledWith('discover_capture_sources');
  });

  it('getCodexAppServerStatus — calls get_codex_app_server_status', async () => {
    mockInvoke.mockResolvedValue({ state: 'running' });
    await getCodexAppServerStatus();
    expect(mockInvoke).toHaveBeenCalledWith('get_codex_app_server_status');
  });
});

// ---------------------------------------------------------------------------
// Write commands with interesting arg shapes
// ---------------------------------------------------------------------------

describe('setIngestConfig', () => {
  it('sends the update object under the "update" key', async () => {
    mockInvoke.mockResolvedValue({ autoIngestEnabled: false });

    await setIngestConfig({ autoIngestEnabled: false });

    expect(mockInvoke).toHaveBeenCalledWith('set_ingest_config', {
      update: { autoIngestEnabled: false },
    });
  });

  it('accepts a partial update (only the changed keys)', async () => {
    mockInvoke.mockResolvedValue({});

    await setIngestConfig({ retentionDays: 30 });

    const [, args] = mockInvoke.mock.calls[0] as [string, { update: object }];
    expect(args.update).toEqual({ retentionDays: 30 });
  });

  it('propagates errors from the backend', async () => {
    mockInvoke.mockRejectedValue(new Error('validation failed'));

    await expect(setIngestConfig({ retentionDays: -1 })).rejects.toThrow('validation failed');
  });
});

describe('startCodexAppServer / stopCodexAppServer', () => {
  it('startCodexAppServer calls start_codex_app_server', async () => {
    mockInvoke.mockResolvedValue({ state: 'starting' });
    await startCodexAppServer();
    expect(mockInvoke).toHaveBeenCalledWith('start_codex_app_server');
  });

  it('stopCodexAppServer calls stop_codex_app_server', async () => {
    mockInvoke.mockResolvedValue({ state: 'stopping' });
    await stopCodexAppServer();
    expect(mockInvoke).toHaveBeenCalledWith('stop_codex_app_server');
  });
});

describe('startFileWatcher / stopFileWatcher', () => {
  it('startFileWatcher sends paths under watchPaths key', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await startFileWatcher(['/tmp/claude', '/tmp/cursor']);

    expect(mockInvoke).toHaveBeenCalledWith('start_file_watcher', {
      watchPaths: ['/tmp/claude', '/tmp/cursor'],
    });
  });

  it('stopFileWatcher sends no args', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await stopFileWatcher();
    expect(mockInvoke).toHaveBeenCalledWith('stop_file_watcher');
  });
});

describe('autoImportSessionFile', () => {
  it('sends repoId and filePath', async () => {
    mockInvoke.mockResolvedValue({ status: 'imported', tool: 'claude-code', sessionId: 'abc' });

    await autoImportSessionFile(42, '/tmp/session.json');

    expect(mockInvoke).toHaveBeenCalledWith('auto_import_session_file', {
      repoId: 42,
      filePath: '/tmp/session.json',
    });
  });
});

describe('purgeExpiredSessions', () => {
  it('sends repoId and retentionDays', async () => {
    mockInvoke.mockResolvedValue(7);

    const deleted = await purgeExpiredSessions(1, 14);
    expect(mockInvoke).toHaveBeenCalledWith('purge_expired_sessions', {
      repoId: 1,
      retentionDays: 14,
    });
    expect(deleted).toBe(7);
  });
});

describe('backfillRecentSessions', () => {
  it('sends repoId and limitPerTool', async () => {
    mockInvoke.mockResolvedValue({ attempted: 5, imported: 4, skipped: 1, failed: 0 });

    await backfillRecentSessions(3, 20);
    expect(mockInvoke).toHaveBeenCalledWith('backfill_recent_sessions', {
      repoId: 3,
      limitPerTool: 20,
    });
  });

  it('uses default limitPerTool of 10 when omitted', async () => {
    mockInvoke.mockResolvedValue({ attempted: 0, imported: 0, skipped: 0, failed: 0 });

    await backfillRecentSessions(1);
    const [, args] = mockInvoke.mock.calls[0] as [string, { limitPerTool: number }];
    expect(args.limitPerTool).toBe(10);
  });
});

describe('codexAppServerSubmitApproval', () => {
  it('sends all required approval fields', async () => {
    mockInvoke.mockResolvedValue({ type: 'ApprovalResult' });

    await codexAppServerSubmitApproval('req-1', 'thread-1', 'token-abc', true, 'approved by user');

    expect(mockInvoke).toHaveBeenCalledWith('codex_app_server_submit_approval', {
      requestId: 'req-1',
      threadId: 'thread-1',
      decisionToken: 'token-abc',
      approved: true,
      reason: 'approved by user',
    });
  });

  it('sends undefined reason when omitted', async () => {
    mockInvoke.mockResolvedValue({ type: 'ApprovalResult' });

    await codexAppServerSubmitApproval('req-2', 'thread-2', 'token-xyz', false);

    const [, args] = mockInvoke.mock.calls[0] as [string, { reason?: string }];
    expect(args.reason).toBeUndefined();
  });
});

describe('codexAppServerChatgptAuthTokensRefresh', () => {
  it('sends accessToken and refreshToken', async () => {
    mockInvoke.mockResolvedValue({ authState: 'authenticated' });

    await codexAppServerChatgptAuthTokensRefresh('access-tok', 'refresh-tok');

    expect(mockInvoke).toHaveBeenCalledWith(
      'codex_app_server_account_chatgpt_auth_tokens_refresh',
      { accessToken: 'access-tok', refreshToken: 'refresh-tok' }
    );
  });

  it('sends undefined refreshToken when omitted (optional)', async () => {
    mockInvoke.mockResolvedValue({ authState: 'authenticated' });

    await codexAppServerChatgptAuthTokensRefresh('access-tok');
    const [, args] = mockInvoke.mock.calls[0] as [string, { refreshToken?: string }];
    expect(args.refreshToken).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// configureCodexOtel — input validation
// ---------------------------------------------------------------------------

describe('configureCodexOtel — URL validation', () => {
  it('accepts a valid http endpoint and invokes configure_codex_otel', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await configureCodexOtel('http://localhost:4317/v1/traces');

    expect(mockInvoke).toHaveBeenCalledWith('configure_codex_otel', {
      endpoint: 'http://localhost:4317/v1/traces',
    });
  });

  it('accepts a valid https endpoint', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await configureCodexOtel('https://api.example.com/otlp');

    expect(mockInvoke).toHaveBeenCalledWith('configure_codex_otel', {
      endpoint: 'https://api.example.com/otlp',
    });
  });

  it('throws before invoking for a completely invalid URL', async () => {
    await expect(configureCodexOtel('not a url at all')).rejects.toThrow(
      'Invalid endpoint URL'
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('throws for a javascript: protocol URL (not http/https)', async () => {
    await expect(
      configureCodexOtel('javascript:alert(1)')
    ).rejects.toThrow('http or https protocol');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('throws for a file: URL', async () => {
    await expect(
      configureCodexOtel('file:///etc/passwd')
    ).rejects.toThrow('http or https protocol');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('throws for an empty string', async () => {
    await expect(configureCodexOtel('')).rejects.toThrow('Invalid endpoint URL');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('propagates backend errors for valid URLs', async () => {
    mockInvoke.mockRejectedValue(new Error('connection refused'));

    await expect(
      configureCodexOtel('http://localhost:4317')
    ).rejects.toThrow('connection refused');
  });
});
