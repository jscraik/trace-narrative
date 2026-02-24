import { useCallback, useEffect, useRef, useState } from 'react';
import { indexRepo } from './core/repo/indexer';
import { setOtelReceiverEnabled } from './core/tauri/otelReceiver';
import type {
  BranchViewModel,
  DashboardFilter,
  TraceCollectorConfig
} from './core/types';
import { useAutoIngest } from './hooks/useAutoIngest';
import { useCommitData } from './hooks/useCommitData';
import { useRepoLoader, type RepoState } from './hooks/useRepoLoader';
import { useSessionImport } from './hooks/useSessionImport';
import { useTraceCollector } from './hooks/useTraceCollector';
import { useUpdater } from './hooks/useUpdater';
import { DocsOverviewPanel } from './ui/components/DocsOverviewPanel';
import { RepoEmptyState } from './ui/components/RepoEmptyState';
import { TopNav, type Mode } from './ui/components/TopNav';
import { UpdateIndicator, UpdatePrompt } from './ui/components/UpdatePrompt';
import { BranchView } from './ui/views/BranchView';
import { DashboardView } from './ui/views/DashboardView';


type AgentationComponentType = (typeof import('agentation'))['Agentation'];
type TauriRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: { invoke?: unknown };
  __TAURI_IPC__?: unknown;
};

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const tauriWindow = window as TauriRuntimeWindow;
  return Boolean(tauriWindow.__TAURI_INTERNALS__?.invoke || tauriWindow.__TAURI_IPC__);
}

function normalizeHttpUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

const EMPTY_MODEL: BranchViewModel = {
  source: 'git',
  title: '',
  status: 'open',
  description: '',
  stats: {
    added: 0,
    removed: 0,
    files: 0,
    commits: 0,
    prompts: 0,
    responses: 0
  },
  intent: [],
  timeline: []
};

/**
 * Docs view wrapper that auto-loads the current directory as repo if needed.
 * This ensures Docs mode works even when switching from Demo mode.
 */
function DocsView(props: {
  repoState: RepoState;
  setRepoState: React.Dispatch<React.SetStateAction<RepoState>>;
  onClose: () => void;
}) {
  const { repoState, setRepoState, onClose } = props;
  const [isLoading, setIsLoading] = useState(false);

  // Auto-load current directory as repo when Docs is opened without a loaded repo
  // Only attempt auto-load once per component mount to avoid infinite loops on error.
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  useEffect(() => {
    if (repoState.status === 'ready' || repoState.status === 'loading') {
      return; // Already loaded or loading
    }

    // Only attempt auto-load once
    if (hasAttemptedLoad) return;

    const loadCurrentDir = async () => {
      setHasAttemptedLoad(true);

      // If we are in the browser (no Tauri), gracefully set to idle without crashing
      // We can't index local git repos from a browser environment.
      const isTauri = isTauriRuntime();
      if (!isTauri) {
        setRepoState(prev => prev.status === 'idle' ? prev : { status: 'idle' });
        return;
      }

      if (!import.meta.env.DEV) {
        return;
      }

      setIsLoading(true);
      try {
        // Dev-only fallback to a local repo path (when in Tauri)
        const defaultPath = '/Users/jamiecraik/dev/narrative';

        setRepoState({ status: 'loading', path: defaultPath });

        const { model, repo } = await indexRepo(defaultPath, 60);
        setRepoState({ status: 'ready', path: defaultPath, model, repo });
      } catch (e) {
        console.error('[DocsView] Failed to auto-load repo:', e);
        // Don't change state on error - let the UI show "No Repository Open" or fallback
        setRepoState({ status: 'error', message: String(e) });
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrentDir();
  }, [repoState.status, setRepoState, hasAttemptedLoad]);

  if (repoState.status === 'loading' || isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-tertiary p-6">
        <div className="rounded-2xl border border-border-light bg-bg-secondary px-6 py-5 text-center text-text-tertiary shadow-sm">
          <div className="text-sm font-medium text-text-secondary">Loading repository...</div>
        </div>
      </div>
    );
  }

  const isTauri = isTauriRuntime();
  if (!isTauri && repoState.status === 'idle') {
    return (
      <div className="flex h-full items-center justify-center bg-bg-tertiary p-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-light bg-bg-secondary px-8 py-10 text-center shadow-sm max-w-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-amber-bg text-accent-amber">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>Desktop app required warning</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-1">Desktop App Required</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              The Docs view needs access to your local file system to generate documentation. Please open Firefly Narrative in the desktop app to use this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-bg-tertiary p-6">
      <DocsOverviewPanel
        repoRoot={repoState.status === 'ready' ? repoState.repo.root : ''}
        onClose={onClose}
      />
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>('demo');
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter | null>(null);
  const [isExitingFilteredView, setIsExitingFilteredView] = useState(false);
  const clearFilterTimerRef = useRef<number | null>(null);
  const [githubConnectorEnabled, setGithubConnectorEnabled] = useState(false);
  const [AgentationComponent, setAgentationComponent] = useState<AgentationComponentType | null>(null);
  const rawAgentationEndpoint = import.meta.env.VITE_AGENTATION_ENDPOINT as string | undefined;
  const normalizedAgentationEndpoint = normalizeHttpUrl(rawAgentationEndpoint);
  const isAgentationEnabled = import.meta.env.DEV && Boolean(normalizedAgentationEndpoint);

  const rawAgentationWebhookUrl = import.meta.env.VITE_AGENTATION_WEBHOOK_URL as string | undefined;
  const normalizedAgentationWebhookUrl = normalizeHttpUrl(rawAgentationWebhookUrl);
  const agentationWebhookUrl = normalizedAgentationWebhookUrl ?? 'http://localhost:8787';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('narrative.githubConnector.enabled');
    if (stored === 'true') {
      setGithubConnectorEnabled(true);
    }
  }, []);

  const handleToggleGitHubConnector = useCallback((enabled: boolean) => {
    setGithubConnectorEnabled(enabled);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('narrative.githubConnector.enabled', enabled ? 'true' : 'false');
    }
  }, []);

  useEffect(() => {
    if (!isAgentationEnabled) {
      setAgentationComponent(null);
      return;
    }

    let cancelled = false;
    import('agentation')
      .then((mod) => {
        if (!cancelled) {
          setAgentationComponent(() => mod.Agentation);
        }
      })
      .catch((error) => {
        console.warn('[Agentation] Failed to load dev panel:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isAgentationEnabled]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    if (rawAgentationEndpoint && !normalizedAgentationEndpoint) {
      console.warn('[Agentation] VITE_AGENTATION_ENDPOINT is invalid. Use an http(s) URL.');
      return;
    }

    if (!isAgentationEnabled) {
      return;
    }

    if (rawAgentationWebhookUrl && !normalizedAgentationWebhookUrl) {
      console.warn('[Agentation] VITE_AGENTATION_WEBHOOK_URL is invalid. Use an http(s) URL.');
    }
  }, [isAgentationEnabled, normalizedAgentationEndpoint, normalizedAgentationWebhookUrl]);

  // Clear dashboard filter when switching away from repo mode (optional UX enhancement)
  useEffect(() => {
    if (mode !== 'repo' && dashboardFilter) {
      setDashboardFilter(null);
    }
  }, [mode, dashboardFilter]);

  // Repo loading and indexing
  const {
    repoState,
    setRepoState,
    indexingProgress,
    codexPromptExport,
    attributionPrefs,
    actionError,
    setActionError,
    openRepo,
    updateAttributionPrefs,
    purgeAttributionMetadata,
    diffCache
  } = useRepoLoader();

  const modelForHooks = repoState.status === 'ready' ? repoState.model : EMPTY_MODEL;

  // OTLP trace collection events and handlers
  const traceCollectorHandlers = useTraceCollector({
    repoRoot: repoState.status === 'ready' ? repoState.repo.root : '',
    repoId: repoState.status === 'ready' ? repoState.repo.repoId : 0,
    timeline: repoState.status === 'ready' ? repoState.model.timeline : [],
    setRepoState: (updater) => {
      setRepoState((prev) => {
        if (prev.status !== 'ready') return prev;
        return { ...prev, model: updater(prev.model) };
      });
    },
    setActionError
  });

  // Session import handlers
  const sessionImportHandlers = useSessionImport({
    repoRoot: repoState.status === 'ready' ? repoState.repo.root : '',
    repoId: repoState.status === 'ready' ? repoState.repo.repoId : 0,
    model: modelForHooks,
    setRepoState: (updater) => {
      setRepoState((prev) => {
        if (prev.status !== 'ready') return prev;
        return { ...prev, model: updater(prev.model) };
      });
    },
    setActionError
  });

  const autoIngest = useAutoIngest({
    repoRoot: repoState.status === 'ready' ? repoState.repo.root : '',
    repoId: repoState.status === 'ready' ? repoState.repo.repoId : 0,
    model: modelForHooks,
    setRepoState: (updater) => {
      setRepoState((prev) => {
        if (prev.status !== 'ready') return prev;
        return { ...prev, model: updater(prev.model) };
      });
    }
  });

  // Commit data loading (model, path, files, diffs, traces)
  const commitData = useCommitData({
    mode,
    repoState,
    diffCache: diffCache as unknown as React.MutableRefObject<{ get(key: string): string | undefined; set(key: string, value: string): void }>,
    model: null // Will be computed inside the hook
  });

  // Auto-updater integration
  const { status: updateStatus, checkForUpdates, downloadAndInstall, dismiss } = useUpdater({
    checkOnMount: true, // Check for updates on app launch
    pollIntervalMinutes: 60 * 24 // Check once per day
  });

  const updateCodexOtelReceiverEnabled = useCallback(
    async (enabled: boolean) => {
      try {
        await setOtelReceiverEnabled(enabled);
        setRepoState((prev) => {
          if (prev.status !== 'ready') return prev;
          return {
            ...prev,
            model: {
              ...prev.model,
              traceConfig: {
                ...(prev.model.traceConfig ?? {} as TraceCollectorConfig),
                codexOtelReceiverEnabled: enabled
              } as TraceCollectorConfig
            }
          };
        });
      } catch (e: unknown) {
        setActionError(e instanceof Error ? e.message : String(e));
      }
    },
    [setRepoState, setActionError]
  );

  const importEnabled = mode === 'repo' && repoState.status === 'ready';

  // Focus management: save active element before drill-down, restore on back
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  // Handle drill-down navigation from dashboard
  const handleDrillDown = useCallback((filter: DashboardFilter) => {
    // Save current focused element for restoration later
    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    setDashboardFilter(filter);
    setMode('repo');
  }, []);

  // Handle clear filter (back to dashboard) with exit animation
  const handleClearFilter = useCallback(() => {
    // Trigger exit animation
    setIsExitingFilteredView(true);

    if (clearFilterTimerRef.current !== null) {
      window.clearTimeout(clearFilterTimerRef.current);
      clearFilterTimerRef.current = null;
    }

    // After animation completes, clear filter and restore focus
    clearFilterTimerRef.current = window.setTimeout(() => {
      setDashboardFilter(null);
      setIsExitingFilteredView(false);
      // Restore focus to the element that was focused before drill-down
      if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus();
        lastFocusedElementRef.current = null;
      }
      clearFilterTimerRef.current = null;
    }, 180); // Match transition duration
  }, []);

  useEffect(() => {
    return () => {
      if (clearFilterTimerRef.current !== null) {
        window.clearTimeout(clearFilterTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-bg-primary text-text-primary">
      {/* Update Notification */}
      {updateStatus && (
        <UpdatePrompt
          status={updateStatus}
          onUpdate={downloadAndInstall}
          onClose={dismiss}
          onCheckAgain={checkForUpdates}
        />
      )}

      <TopNav
        mode={mode}
        onModeChange={setMode}
        repoPath={commitData.repoPath}
        onOpenRepo={openRepo}
        onImportSession={sessionImportHandlers.importSession}
        onImportKimiSession={sessionImportHandlers.importKimiSession}
        onImportAgentTrace={sessionImportHandlers.importAgentTrace}
        importEnabled={importEnabled}
      >
        {/* Update indicator in nav */}
        <UpdateIndicator status={updateStatus} onClick={checkForUpdates} />
      </TopNav>

      {/* `min-h-0` is critical so nested flex children can scroll instead of overflowing */}
      <div className="flex-1 min-h-0 overflow-hidden bg-bg-tertiary">
        {mode === 'dashboard' ? (
          <DashboardView
            repoState={repoState}
            setRepoState={setRepoState}
            setActionError={setActionError}
            onDrillDown={handleDrillDown}
            onModeChange={setMode}
          />
        ) : mode === 'docs' ? (
          <DocsView
            repoState={repoState}
            setRepoState={setRepoState}
            onClose={() => setMode('repo')}
          />
        ) : mode === 'repo' && repoState.status === 'loading' ? (
          <div className="p-8 text-sm text-text-tertiary">
            <div className="text-sm font-medium text-text-secondary">Indexing repo…</div>
            <div className="mt-2 text-xs text-text-tertiary">
              {indexingProgress?.message ?? 'Preparing index…'}
            </div>
            <div className="mt-3 h-2 w-64 max-w-full rounded-full bg-border-light overflow-hidden">
              <div
                className="h-full bg-accent-blue transition-[width] duration-300"
                style={{ width: `${indexingProgress?.percent ?? 0}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-text-muted">
              {indexingProgress?.total
                ? `${indexingProgress.current ?? 0}/${indexingProgress.total} · ${indexingProgress.phase}`
                : indexingProgress?.phase ?? 'loading'}
            </div>
          </div>
        ) : mode === 'repo' && repoState.status === 'error' ? (
          <div className="p-8">
            <div className="rounded-xl border border-accent-red-light bg-accent-red-bg p-4 text-sm text-text-secondary">
              {repoState.message}
            </div>
            <div className="mt-4 text-sm text-text-tertiary">
              Ensure the selected folder is a git repository and that <span className="font-mono">git</span> is
              available on your PATH.
            </div>
          </div>
        ) : commitData.model ? (
          <BranchView
            model={commitData.model}
            updateModel={(updater) => {
              setRepoState((prev) => {
                if (prev.status !== 'ready') return prev;
                return { ...prev, model: updater(prev.model) };
              });
            }}
            dashboardFilter={dashboardFilter}
            onClearFilter={handleClearFilter}
            isExitingFilteredView={isExitingFilteredView}
            loadFilesForNode={commitData.loadFilesForNode}
            loadDiffForFile={commitData.loadDiffForFile}
            loadTraceRangesForFile={commitData.loadTraceRangesForFile}
            onExportAgentTrace={traceCollectorHandlers.exportAgentTrace}
            onRunOtlpSmokeTest={traceCollectorHandlers.runOtlpSmokeTestHandler}
            onUpdateCodexOtelPath={traceCollectorHandlers.updateCodexOtelPath}
            onToggleCodexOtelReceiver={updateCodexOtelReceiverEnabled}
            onOpenCodexOtelDocs={traceCollectorHandlers.openCodexOtelDocs}
            codexPromptExport={codexPromptExport}
            attributionPrefs={attributionPrefs}
            onUpdateAttributionPrefs={updateAttributionPrefs}
            onPurgeAttributionMetadata={purgeAttributionMetadata}
            onUnlinkSession={sessionImportHandlers.unlinkSession}
            actionError={actionError}
            setActionError={setActionError}
            onDismissActionError={() => setActionError(null)}
            ingestStatus={autoIngest.ingestStatus}
            ingestActivityRecent={autoIngest.activityRecent}
            onRequestIngestActivityAll={autoIngest.getActivityAll}
            ingestIssues={autoIngest.issues}
            onDismissIngestIssue={autoIngest.dismissIssue}
            onToggleAutoIngest={autoIngest.toggleAutoIngest}
            ingestToast={autoIngest.toast}
            ingestConfig={autoIngest.ingestConfig}
            otlpKeyStatus={autoIngest.otlpKeyStatus}
            discoveredSources={autoIngest.discoveredSources}
            collectorMigrationStatus={autoIngest.collectorMigrationStatus}
            captureReliabilityStatus={autoIngest.captureReliabilityStatus}
            onUpdateWatchPaths={autoIngest.updateWatchPaths}
            onMigrateCollector={autoIngest.migrateCollector}
            onRollbackCollector={autoIngest.rollbackCollector}
            onRefreshCaptureReliability={autoIngest.refreshCaptureReliability}
            onConfigureCodex={autoIngest.configureCodexTelemetry}
            onRotateOtlpKey={autoIngest.rotateOtlpKey}
            onGrantCodexConsent={autoIngest.grantCodexConsent}
            githubConnectorEnabled={githubConnectorEnabled}
            onToggleGitHubConnector={handleToggleGitHubConnector}
          />
        ) : (
          <RepoEmptyState setRepoState={setRepoState} />
        )}
      </div>
      {isAgentationEnabled && AgentationComponent && normalizedAgentationEndpoint && (
        <AgentationComponent
          endpoint={normalizedAgentationEndpoint}
          webhookUrl={agentationWebhookUrl}
          onSessionCreated={(sessionId) => {
            console.log('Session started:', sessionId);
          }}
        />
      )}
    </div>
  );
}
