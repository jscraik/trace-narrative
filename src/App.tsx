import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { EMPTY_BRANCH_MODEL } from './core/models/emptyBranchModel';
import { setOtelReceiverEnabled } from './core/tauri/otelReceiver';
import { normalizeHttpUrl } from './core/utils/url';
import type {
  DashboardFilter,
  Mode,
  TraceCollectorConfig
} from './core/types';
import { useAutoIngest } from './hooks/useAutoIngest';
import { useCommitData } from './hooks/useCommitData';
import { useRepoLoader } from './hooks/useRepoLoader';
import { useSessionImport } from './hooks/useSessionImport';
import { useTraceCollector } from './hooks/useTraceCollector';
import { useUpdater } from './hooks/useUpdater';
import { RepoEmptyState } from './ui/components/RepoEmptyState';
import { Sidebar } from './ui/components/Sidebar';
import { UpdatePrompt } from './ui/components/UpdatePrompt';
import { BranchView } from './ui/views/BranchView';
import { CockpitView } from './ui/views/CockpitView';
import { DashboardView } from './ui/views/DashboardView';
import {
  DASHBOARD_FOCUS_RESTORE_MS,
} from './ui/views/dashboardState';
import { DocsView } from './ui/views/DocsView';
import { TopNav } from './ui/components/TopNav';

type AgentationComponentType = (typeof import('agentation'))['Agentation'];

export default function App() {
  const [mode, setMode] = useState<Mode>('dashboard');
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter | null>(null);
  const [isExitingFilteredView, setIsExitingFilteredView] = useState(false);
  const clearFilterTimerRef = useRef<number | null>(null);
  const [githubConnectorEnabled, setGithubConnectorEnabled] = useState(false);
  const [AgentationComponent, setAgentationComponent] = useState<AgentationComponentType | null>(null);
  const rawAgentationEndpoint = import.meta.env.VITE_AGENTATION_ENDPOINT as string | undefined;
  const normalizedAgentationEndpoint = normalizeHttpUrl(rawAgentationEndpoint);
  const isAgentationEnabled = Boolean(normalizedAgentationEndpoint);

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

  const modelForHooks = repoState.status === 'ready' ? repoState.model : EMPTY_BRANCH_MODEL;

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
    diffCache: diffCache as unknown as MutableRefObject<{ get(key: string): string | undefined; set(key: string, value: string): void }>,
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
    }, DASHBOARD_FOCUS_RESTORE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (clearFilterTimerRef.current !== null) {
        window.clearTimeout(clearFilterTimerRef.current);
      }
    };
  }, []);

  const renderContent = () => {
    // 1. Dashboard View
    if (mode === 'dashboard') {
      return (
        <DashboardView
          repoState={repoState}
          setRepoState={setRepoState}
          setActionError={setActionError}
          onDrillDown={handleDrillDown}
          onModeChange={setMode}
          captureReliabilityStatus={autoIngest.captureReliabilityStatus}
        />
      );
    }

    // 2. Documentation View
    if (mode === 'docs') {
      return (
        <DocsView
          repoState={repoState}
          setRepoState={setRepoState}
          onClose={() => setMode('repo')}
        />
      );
    }

    // 3. Repository-specific logic
    if (mode === 'repo') {
      if (repoState.status === 'loading') {
        return (
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
        );
      }

      if (repoState.status === 'error') {
        return (
          <div className="p-8">
            <div className="rounded-xl border border-accent-red-light bg-accent-red-bg p-4 text-sm text-text-secondary">
              {repoState.message}
            </div>
            <div className="mt-4 text-sm text-text-tertiary">
              Ensure the selected folder is a git repository and that <span className="font-mono">git</span> is
              available on your PATH.
            </div>
          </div>
        );
      }

      if (repoState.status === 'ready') {
        return (
          <BranchView
            model={commitData.model ?? EMPTY_BRANCH_MODEL}
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
            onAuthorizeCodexAppServerForLiveTest={autoIngest.authorizeCodexAppServerForLiveTest}
            onLogoutCodexAppServerAccount={autoIngest.logoutCodexAppServerAccount}
            githubConnectorEnabled={githubConnectorEnabled}
            onToggleGitHubConnector={handleToggleGitHubConnector}
          />
        );
      }

      return <RepoEmptyState setRepoState={setRepoState} />;
    }

    return (
      <CockpitView
        mode={mode}
        repoState={repoState}
        captureReliabilityStatus={autoIngest.captureReliabilityStatus}
        onModeChange={setMode}
        onOpenRepo={openRepo}
        onImportSession={sessionImportHandlers.importSession}
      />
    );
  };

  const repoRoot = repoState.status === 'ready' ? repoState.path : '';

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden">
      <Sidebar 
        mode={mode} 
        onModeChange={setMode} 
        onOpenRepo={openRepo}
        onImportSession={sessionImportHandlers.importSession}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Update Notification */}
        {updateStatus && (
          <UpdatePrompt
            status={updateStatus}
            onUpdate={downloadAndInstall}
            onClose={dismiss}
            onCheckAgain={checkForUpdates}
          />
        )}

        {/* Header navigation and actions */}
        {(mode === 'repo' || mode === 'docs') && (
          <TopNav
            mode={mode}
            onModeChange={setMode}
            repoPath={repoRoot}
            onOpenRepo={openRepo}
            onImportSession={sessionImportHandlers.importSession}
            onImportKimiSession={sessionImportHandlers.importKimiSession}
            onImportAgentTrace={sessionImportHandlers.importAgentTrace}
            importEnabled={repoState.status === 'ready'}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* `min-h-0` is critical so nested flex children can scroll instead of overflowing */}
          <div className="flex-1 min-h-0 overflow-hidden bg-bg-tertiary">
            {renderContent()}
          </div>
        </main>

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
    </div>
  );
}
