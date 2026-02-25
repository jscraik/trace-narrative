import { open } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useState } from 'react';
import {
  discoverCaptureSources,
  type CaptureReliabilityStatus,
  type CollectorMigrationStatus,
  type DiscoveredSources,
  type IngestConfig
} from '../../core/tauri/ingestConfig';
import { HelpPopover } from './HelpPopover';
import { Toggle } from './Toggle';

export function AutoIngestSetupPanel(props: {
  config: IngestConfig | null;
  sources: DiscoveredSources | null;
  migrationStatus?: CollectorMigrationStatus | null;
  captureReliability?: CaptureReliabilityStatus | null;
  onToggleAutoIngest: (enabled: boolean) => void;
  onUpdateWatchPaths: (paths: { claude: string[]; cursor: string[]; codexLogs: string[] }) => void;
  onMigrateCollector?: (dryRun?: boolean) => Promise<unknown>;
  onRollbackCollector?: () => Promise<unknown>;
  onRefreshReliability?: () => Promise<unknown>;
  onAuthorizeCodexAppServerForLiveTest?: () => Promise<void>;
  onLogoutCodexAppServerAccount?: () => Promise<void>;
}) {
  const {
    config,
    sources,
    migrationStatus,
    captureReliability,
    onToggleAutoIngest,
    onUpdateWatchPaths,
    onMigrateCollector,
    onRollbackCollector,
    onRefreshReliability,
    onAuthorizeCodexAppServerForLiveTest,
    onLogoutCodexAppServerAccount,
  } = props;
  const [claudePaths, setClaudePaths] = useState('');
  const [cursorPaths, setCursorPaths] = useState('');
  const [codexPaths, setCodexPaths] = useState('');
  const [showAdvancedPaths, setShowAdvancedPaths] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'searching' | 'found' | 'not-found' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasAutoDetectedOnLoad, setHasAutoDetectedOnLoad] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const captureMode = captureReliability?.mode ?? 'UNKNOWN';
  const appServerStatus = captureReliability?.appServer;

  useEffect(() => {
    if (!config) return;
    setClaudePaths(config.watchPaths.claude.join('\n'));
    setCursorPaths(config.watchPaths.cursor.join('\n'));
    setCodexPaths((config.watchPaths.codexLogs ?? []).join('\n'));
  }, [config]);

  const applyWatchPaths = useCallback((paths: { claude: string[]; cursor: string[]; codexLogs: string[] }, persist = true) => {
    setClaudePaths(paths.claude.join('\n'));
    setCursorPaths(paths.cursor.join('\n'));
    setCodexPaths(paths.codexLogs.join('\n'));
    if (persist) {
      onUpdateWatchPaths(paths);
    }
  }, [onUpdateWatchPaths]);

  const runAutoDetect = useCallback(async (persist = true) => {
    setDetectionStatus('searching');
    setStatusMessage('Auto-detecting source paths…');
    try {
      const discovered = await discoverCaptureSources();
      const next = {
        claude: discovered.claude,
        cursor: discovered.cursor,
        codexLogs: discovered.codexLogs,
      };
      const total = next.claude.length + next.cursor.length + next.codexLogs.length;
      if (total === 0) {
        setDetectionStatus('not-found');
        setStatusMessage('No known source paths found. Add folders manually below.');
        return;
      }
      applyWatchPaths(next, persist);
      setDetectionStatus('found');
      setStatusMessage(`Detected ${total} source path${total === 1 ? '' : 's'}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setDetectionStatus('error');
      setStatusMessage(`Path auto-detect failed: ${message}`);
    }
  }, [applyWatchPaths]);

  useEffect(() => {
    if (!config || hasAutoDetectedOnLoad) return;
    const hasAnyConfiguredPath = [
      config.watchPaths.claude,
      config.watchPaths.cursor,
      config.watchPaths.codexLogs ?? [],
    ].some((group) => group.length > 0);

    if (hasAnyConfiguredPath) {
      setHasAutoDetectedOnLoad(true);
      return;
    }

    setHasAutoDetectedOnLoad(true);
    void runAutoDetect(true);
  }, [config, hasAutoDetectedOnLoad, runAutoDetect]);

  const discoveredSummary = (() => {
    if (!sources) return null;
    const items: string[] = [];
    if (sources.claude.length > 0) items.push('Claude');
    if (sources.cursor.length > 0) items.push('Cursor');
    if (sources.codexLogs.length > 0) items.push('Codex');
    return items.length > 0 ? `Detected: ${items.join(' · ')}` : 'No known sources detected on this machine.';
  })();

  if (!config) {
    return (
      <div className="card p-5">
        <div className="section-header">Auto-Ingest Setup</div>
        <div className="section-subheader">connect once</div>
        <div className="mt-3 text-xs text-text-tertiary">Open a repo to configure auto‑ingest.</div>
      </div>
    );
  }

  /* Removed telemetry consent checks */

  const pickDir = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Choose a folder to capture from' });
    if (!selected) return null;
    return typeof selected === 'string' ? selected : selected[0] ?? null;
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-header">Auto-Ingest Setup</div>
          <div className="section-subheader mt-0.5">connect once</div>
        </div>
        <HelpPopover
          content="Auto-ingest monitors your local AI interaction logs (Claude, Cursor, etc.) and automatically links them to your git commits."
          label="About auto-ingest"
        />
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-text-secondary">Capture mode</div>
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
              onClick={() => void onRefreshReliability?.()}
            >
              Refresh
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${captureMode === 'HYBRID_ACTIVE'
                ? 'bg-accent-green-bg text-accent-green border-accent-green-light'
                : captureMode === 'OTEL_ONLY'
                  ? 'bg-accent-blue-bg text-accent-blue border-accent-blue-light'
                  : captureMode === 'DEGRADED_STREAMING'
                    ? 'bg-accent-amber-bg text-accent-amber border-accent-amber-light'
                    : captureMode === 'FAILURE'
                      ? 'bg-accent-red-bg text-accent-red border-accent-red-light'
                      : 'bg-bg-tertiary text-text-secondary border-border-subtle'
                }`}
            >
              {captureMode}
            </span>
            {captureReliability?.reasons?.[0] ? (
              <span className="text-[11px] text-text-tertiary">{captureReliability.reasons[0]}</span>
            ) : (
              <span className="text-[11px] text-text-tertiary">Reliability status not yet available.</span>
            )}
          </div>
          {appServerStatus ? (
            <div className="mt-3 rounded-md border border-border-subtle bg-bg-tertiary p-2">
              <div className="text-[11px] font-semibold text-text-secondary">Codex App Server</div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                state: <span className="font-mono">{appServerStatus.state}</span> · auth:{' '}
                <span className="font-mono">{appServerStatus.authState}</span> · initialized:{' '}
                <span className="font-mono">{appServerStatus.initialized ? 'yes' : 'no'}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                  disabled={authBusy}
                  onClick={async () => {
                    if (!onAuthorizeCodexAppServerForLiveTest) return;
                    setAuthBusy(true);
                    try {
                      await onAuthorizeCodexAppServerForLiveTest();
                    } finally {
                      setAuthBusy(false);
                    }
                  }}
                >
                  {authBusy ? 'Authorizing…' : 'Authorize for live test'}
                </button>
                <button
                  type="button"
                  className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                  disabled={authBusy}
                  onClick={async () => {
                    if (!onLogoutCodexAppServerAccount) return;
                    setAuthBusy(true);
                    try {
                      await onLogoutCodexAppServerAccount();
                    } finally {
                      setAuthBusy(false);
                    }
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3">
          <div className="text-xs font-semibold text-text-secondary">Collector migration</div>
          <div className="mt-1 text-[11px] text-text-tertiary">
            Canonical root: <span className="font-mono">{migrationStatus?.canonicalRoot ?? '~/.agents/otel-collector'}</span>
          </div>
          <div className="mt-1 text-[11px] text-text-tertiary">
            Legacy root: <span className="font-mono">{migrationStatus?.legacyRoot ?? '~/.agents/otel/collector'}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${migrationStatus?.migrationRequired
                ? 'bg-accent-amber-bg text-accent-amber border-accent-amber-light'
                : 'bg-accent-green-bg text-accent-green border-accent-green-light'
                }`}
            >
              {migrationStatus?.migrationRequired ? 'Migration required' : 'Canonicalized'}
            </span>
            {migrationStatus?.status ? (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-bg-tertiary px-2 py-0.5 text-[11px] text-text-secondary">
                Status: {migrationStatus.status}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
              disabled={migrationBusy}
              onClick={async () => {
                if (!onMigrateCollector) return;
                setMigrationBusy(true);
                try {
                  await onMigrateCollector(false);
                } finally {
                  setMigrationBusy(false);
                }
              }}
            >
              {migrationBusy ? 'Migrating…' : 'Migrate now'}
            </button>
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
              disabled={migrationBusy}
              onClick={async () => {
                if (!onMigrateCollector) return;
                setMigrationBusy(true);
                try {
                  await onMigrateCollector(true);
                } finally {
                  setMigrationBusy(false);
                }
              }}
            >
              Dry run
            </button>
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
              disabled={migrationBusy}
              onClick={async () => {
                if (!onRollbackCollector) return;
                setMigrationBusy(true);
                try {
                  await onRollbackCollector();
                } finally {
                  setMigrationBusy(false);
                }
              }}
            >
              Rollback
            </button>
          </div>
          {migrationStatus?.lastError ? (
            <div className="mt-2 text-[11px] text-accent-red">{migrationStatus.lastError}</div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-secondary p-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Enable auto‑ingest</span>
            <span className="text-[11px] text-text-tertiary">Process logs in background</span>
          </div>
          <Toggle
            checked={config.autoIngestEnabled}
            onCheckedChange={(c) => onToggleAutoIngest(c)}
            aria-label="Enable auto-ingest"
          />
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.autoIngestEnabled
                ? 'bg-accent-green-bg text-accent-green border border-accent-green-light'
                : 'bg-bg-tertiary text-text-tertiary border border-border-subtle'
                }`}
            >
              {config.autoIngestEnabled ? 'Active' : 'Inactive'}
            </span>
            {discoveredSummary ? (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-bg-tertiary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                {discoveredSummary}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] text-text-tertiary">
            Add source folders quickly, then save watch paths. Open advanced editor only if you need manual path tuning.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
              onClick={() => void runAutoDetect(true)}
              disabled={detectionStatus === 'searching'}
            >
              {detectionStatus === 'searching' ? 'Auto-detecting…' : 'Auto-detect paths'}
            </button>
            {statusMessage ? (
              <span
                className={`text-[11px] ${detectionStatus === 'error'
                  ? 'text-accent-red'
                  : detectionStatus === 'not-found'
                    ? 'text-accent-orange'
                    : 'text-text-tertiary'
                  }`}
              >
                {statusMessage}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-tertiary p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-text-secondary">Watch Paths</div>
            <HelpPopover
              content={
                <div className="space-y-1">
                  <p>Locations where Narrator looks for AI conversation logs.</p>
                  <p className="font-mono text-[10px] text-text-muted">~/.codex/sessions</p>
                </div>
              }
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
              onClick={async () => {
                const dir = await pickDir();
                if (!dir) return;
                setClaudePaths((prev) => (prev.trim() ? `${prev}\n${dir}` : dir));
              }}
            >
              Add Claude folder…
            </button>
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105"
              onClick={async () => {
                const dir = await pickDir();
                if (!dir) return;
                setCursorPaths((prev) => (prev.trim() ? `${prev}\n${dir}` : dir));
              }}
            >
              Add Cursor folder…
            </button>
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105"
              onClick={async () => {
                const dir = await pickDir();
                if (!dir) return;
                setCodexPaths((prev) => (prev.trim() ? `${prev}\n${dir}` : dir));
              }}
            >
              Add Codex folder…
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-accent-blue-light bg-accent-blue-bg px-2 py-1 text-[11px] font-semibold text-accent-blue hover:bg-accent-blue-light transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105"
              onClick={() => {
                const next = {
                  claude: claudePaths.split(/\r?\n/).map((p) => p.trim()).filter(Boolean),
                  cursor: cursorPaths.split(/\r?\n/).map((p) => p.trim()).filter(Boolean),
                  codexLogs: codexPaths.split(/\r?\n/).map((p) => p.trim()).filter(Boolean),
                };
                onUpdateWatchPaths(next);
              }}
            >
              Save watch paths
            </button>
            <button
              type="button"
              className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
              onClick={() => setShowAdvancedPaths((v) => !v)}
            >
              {showAdvancedPaths ? 'Hide advanced editor' : 'Show advanced editor'}
            </button>
          </div>

          {showAdvancedPaths && (
            <div className="mt-3 space-y-2 rounded-md border border-border-subtle bg-bg-secondary p-2">
              <label htmlFor="claude-paths" className="text-xs font-semibold text-text-secondary">
                Claude paths (one per line)
              </label>
              <textarea
                id="claude-paths"
                className="mt-1 w-full rounded-md border border-border-subtle bg-bg-tertiary p-2 text-xs text-text-secondary"
                rows={3}
                value={claudePaths}
                onChange={(event) => setClaudePaths(event.target.value)}
              />
              <label htmlFor="cursor-paths" className="text-xs font-semibold text-text-secondary">
                Cursor paths (one per line)
              </label>
              <textarea
                id="cursor-paths"
                className="mt-1 w-full rounded-md border border-border-subtle bg-bg-tertiary p-2 text-xs text-text-secondary"
                rows={3}
                value={cursorPaths}
                onChange={(event) => setCursorPaths(event.target.value)}
              />
              <label htmlFor="codex-log-paths" className="text-xs font-semibold text-text-secondary">
                Codex paths (one per line)
              </label>
              <textarea
                id="codex-log-paths"
                className="mt-1 w-full rounded-md border border-border-subtle bg-bg-tertiary p-2 text-xs text-text-secondary"
                rows={2}
                value={codexPaths}
                onChange={(event) => setCodexPaths(event.target.value)}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
