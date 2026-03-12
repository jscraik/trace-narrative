import type { Dispatch, SetStateAction } from 'react';

import { EMPTY_BRANCH_MODEL } from './core/models/emptyBranchModel';
import type { DashboardFilter, Mode } from './core/types';
import type { useAutoIngest } from './hooks/useAutoIngest';
import type { UseCommitDataReturn } from './hooks/useCommitData';
import type { RepoState, UseRepoLoaderReturn } from './hooks/useRepoLoader';
import type { UseSessionImportReturn } from './hooks/useSessionImport';
import type { UseTraceCollectorReturn } from './hooks/useTraceCollector';
import { RepoEmptyState } from './ui/components/RepoEmptyState';
import { BranchView } from './ui/views/BranchView';
import { DashboardView } from './ui/views/DashboardView';
import { DocsView } from './ui/views/DocsView';
import { NarrativeSurfaceView } from './ui/views/NarrativeSurfaceView';

type AppContentProps = {
  mode: Mode;
  repoState: RepoState;
  setRepoState: Dispatch<SetStateAction<RepoState>>;
  indexingProgress: UseRepoLoaderReturn['indexingProgress'];
  codexPromptExport: UseRepoLoaderReturn['codexPromptExport'];
  attributionPrefs: UseRepoLoaderReturn['attributionPrefs'];
  actionError: UseRepoLoaderReturn['actionError'];
  setActionError: UseRepoLoaderReturn['setActionError'];
  openRepo: UseRepoLoaderReturn['openRepo'];
  updateAttributionPrefs: UseRepoLoaderReturn['updateAttributionPrefs'];
  purgeAttributionMetadata: UseRepoLoaderReturn['purgeAttributionMetadata'];
  commitData: UseCommitDataReturn;
  traceCollectorHandlers: UseTraceCollectorReturn;
  sessionImportHandlers: UseSessionImportReturn;
  autoIngest: ReturnType<typeof useAutoIngest>;
  updateCodexOtelReceiverEnabled: (enabled: boolean) => Promise<void>;
  dashboardFilter: DashboardFilter | null;
  onClearFilter: () => void;
  isExitingFilteredView: boolean;
  onDrillDown: (filter: DashboardFilter) => void;
  onModeChange: (mode: Mode) => void;
  githubConnectorEnabled: boolean;
  onToggleGitHubConnector: (enabled: boolean) => void;
  surfaceAction: import('./ui/views/narrativeSurfaceData').SurfaceAction | undefined;
  setSurfaceAction: Dispatch<
    SetStateAction<import('./ui/views/narrativeSurfaceData').SurfaceAction | undefined>
  >;
};

export function AppContent({
  mode,
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
  commitData,
  traceCollectorHandlers,
  sessionImportHandlers,
  autoIngest,
  updateCodexOtelReceiverEnabled,
  dashboardFilter,
  onClearFilter,
  isExitingFilteredView,
  onDrillDown,
  onModeChange,
  githubConnectorEnabled,
  onToggleGitHubConnector,
  surfaceAction,
  setSurfaceAction,
}: AppContentProps) {
  if (mode === 'dashboard' || mode === 'assistant') {
    return (
      <DashboardView
        repoState={repoState}
        setRepoState={setRepoState}
        setActionError={setActionError}
        onDrillDown={onDrillDown}
        onModeChange={onModeChange}
        captureReliabilityStatus={autoIngest.captureReliabilityStatus}
      />
    );
  }

  if (mode === 'docs') {
    return (
      <DocsView
        repoState={repoState}
        setRepoState={setRepoState}
        onClose={() => onModeChange('repo')}
      />
    );
  }

  if (mode === 'repo') {
    if (repoState.status === 'loading') {
      return (
        <div className="p-8 text-sm text-text-tertiary">
          <div className="text-sm font-medium text-text-secondary">Indexing repo…</div>
          <div className="mt-2 text-xs text-text-tertiary">
            {indexingProgress?.message ?? 'Preparing index…'}
          </div>
          <div className="mt-3 h-2 w-64 max-w-full overflow-hidden rounded-full bg-border-light">
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
            Ensure the selected folder is a git repository and that{' '}
            <span className="font-mono">git</span> is available on your PATH.
          </div>
        </div>
      );
    }

    if (repoState.status === 'ready') {
      return (
        <BranchView
          model={commitData.model ?? EMPTY_BRANCH_MODEL}
          onModeChange={onModeChange}
          updateModel={(updater) => {
            setRepoState((prev) => {
              if (prev.status !== 'ready') return prev;
              return { ...prev, model: updater(prev.model) };
            });
          }}
          dashboardFilter={dashboardFilter}
          onClearFilter={onClearFilter}
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
          onToggleGitHubConnector={onToggleGitHubConnector}
          pendingAction={surfaceAction}
          onActionProcessed={() => setSurfaceAction(undefined)}
        />
      );
    }

    return <RepoEmptyState setRepoState={setRepoState} />;
  }

  return (
    <NarrativeSurfaceView
      mode={mode}
      repoState={repoState}
      captureReliabilityStatus={autoIngest.captureReliabilityStatus}
      autoIngestEnabled={autoIngest.ingestStatus.enabled}
      onModeChange={onModeChange}
      onOpenRepo={openRepo}
      onImportSession={sessionImportHandlers.importSession}
      onAction={(action) => {
        if (action.type === 'navigate') {
          onModeChange(action.mode);
          return;
        }

        setSurfaceAction(action);
        onModeChange('repo');
      }}
    />
  );
}
