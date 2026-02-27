import type { AttributionPrefs, AttributionPrefsUpdate } from '../../../core/attribution-api';
import type {
  CaptureReliabilityStatus,
  CollectorMigrationStatus,
  DiscoveredSources,
  IngestConfig,
  OtlpKeyStatus,
} from '../../../core/tauri/ingestConfig';
import type {
  GitHubContextState,
  SessionExcerpt,
  TestRun,
  TraceCollectorConfig,
  TraceCollectorStatus,
  TraceCommitSummary,
} from '../../../core/types';
import { AgentTraceSummary } from '../AgentTraceSummary';
import { AtlasSearchPanel } from '../AtlasSearchPanel';
import { AttributionSettingsPanel } from '../AttributionSettingsPanel';
import { AutoIngestSetupPanel } from '../AutoIngestSetupPanel';
import { GitHubConnectorPanel } from '../GitHubConnectorPanel';
import { SessionExcerpts } from '../SessionExcerpts';
import { SourceLensView } from '../SourceLensView';
import { StepsSummaryCard } from '../StepsSummaryCard';
import { StoryAnchorsPanel } from '../StoryAnchorsPanel';
import { TelemetrySettingsPanel } from '../TelemetrySettingsPanel';
import { TestResultsPanel } from '../TestResultsPanel';
import { TraceTranscriptPanel } from '../TraceTranscriptPanel';
import { AppearanceCard } from './AppearanceCard';
import type { TabId } from './types';

interface RightPanelTabPanelsProps {
  activeTab: TabId;
  repoId?: number;
  repoRoot?: string;
  selectedCommitSha: string | null;
  traceSummary?: TraceCommitSummary;
  sessionExcerpts?: SessionExcerpt[];
  selectedFile: string | null;
  onFileClick: (path: string) => void;
  onUnlinkSession?: (sessionId: string) => void;
  onCommitClick: (commitSha: string) => void;
  selectedCommitId: string | null;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  changedFiles?: string[];
  hasAttributionContent: boolean;
  onOpenAttribution: () => void;

  hasFiles: boolean;
  traceStatus?: TraceCollectorStatus;
  onExportAgentTrace?: () => void;
  onRunOtlpSmokeTest?: () => void;
  attributionPrefs?: AttributionPrefs | null;

  ingestConfig?: IngestConfig | null;
  otlpKeyStatus?: OtlpKeyStatus | null;
  discoveredSources?: DiscoveredSources | null;
  collectorMigrationStatus?: CollectorMigrationStatus | null;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  onToggleAutoIngest?: (enabled: boolean) => void;
  onUpdateWatchPaths?: (paths: { claude: string[]; cursor: string[]; codexLogs: string[] }) => void;
  onMigrateCollector?: (dryRun?: boolean) => Promise<unknown>;
  onRollbackCollector?: () => Promise<unknown>;
  onRefreshCaptureReliability?: () => Promise<unknown>;
  onConfigureCodex?: () => void;
  onRotateOtlpKey?: () => void;
  onGrantCodexConsent?: () => void;
  onAuthorizeCodexAppServerForLiveTest?: () => Promise<void>;
  onLogoutCodexAppServerAccount?: () => Promise<void>;
  githubConnectorEnabled?: boolean;
  onToggleGitHubConnector?: (enabled: boolean) => void;
  githubConnectorState?: GitHubContextState;
  traceConfig?: TraceCollectorConfig;
  onUpdateCodexOtelPath?: (path: string) => void;
  onToggleCodexOtelReceiver?: (enabled: boolean) => void;
  onOpenCodexOtelDocs?: () => void;
  codexPromptExport?: { enabled: boolean | null; configPath: string | null };
  onUpdateAttributionPrefs?: (update: AttributionPrefsUpdate) => void;
  onPurgeAttributionMetadata?: () => void;
  indexedCommitShas?: string[] | null;
  fireflyEnabled?: boolean;
  onToggleFirefly?: (enabled: boolean) => void;

  testRun?: TestRun;
  onTestFileClick: (path: string) => void;
  loadingTests?: boolean;
  onImportJUnit?: () => void;
}

export function RightPanelTabPanels(props: RightPanelTabPanelsProps) {
  const {
    activeTab,
    repoId,
    repoRoot,
    selectedCommitSha,
    traceSummary,
    sessionExcerpts,
    selectedFile,
    onFileClick,
    onUnlinkSession,
    onCommitClick,
    selectedCommitId,
    selectedSessionId,
    onSelectSession,
    changedFiles,
    hasAttributionContent,
    onOpenAttribution,
    hasFiles,
    traceStatus,
    onExportAgentTrace,
    onRunOtlpSmokeTest,
    attributionPrefs,
    ingestConfig,
    otlpKeyStatus,
    discoveredSources,
    collectorMigrationStatus,
    captureReliabilityStatus,
    onToggleAutoIngest,
    onUpdateWatchPaths,
    onMigrateCollector,
    onRollbackCollector,
    onRefreshCaptureReliability,
    onConfigureCodex,
    onRotateOtlpKey,
    onGrantCodexConsent,
    onAuthorizeCodexAppServerForLiveTest,
    onLogoutCodexAppServerAccount,
    githubConnectorEnabled,
    onToggleGitHubConnector,
    githubConnectorState,
    traceConfig,
    onUpdateCodexOtelPath,
    onToggleCodexOtelReceiver,
    onOpenCodexOtelDocs,
    codexPromptExport,
    onUpdateAttributionPrefs,
    onPurgeAttributionMetadata,
    indexedCommitShas,
    fireflyEnabled,
    onToggleFirefly,
    testRun,
    onTestFileClick,
    loadingTests,
    onImportJUnit,
  } = props;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {activeTab === 'session' ? (
        <div id="panel-session" role="tabpanel" aria-labelledby="tab-session" className="flex flex-col gap-4">
          {repoId && repoRoot && selectedCommitSha ? (
            <StepsSummaryCard
              repoId={repoId}
              repoRoot={repoRoot}
              commitSha={selectedCommitSha}
              traceSummary={traceSummary}
            />
          ) : null}

          <SessionExcerpts
            excerpts={sessionExcerpts}
            selectedFile={selectedFile}
            onFileClick={onFileClick}
            onUnlink={onUnlinkSession}
            onCommitClick={onCommitClick}
            selectedCommitId={selectedCommitId}
            selectedSessionId={selectedSessionId}
            onSelectSession={onSelectSession}
            repoRoot={repoRoot}
            changedFiles={changedFiles}
          />

          {hasAttributionContent ? (
            <div className="card px-4 py-3 flex flex-col gap-2 text-xs text-text-secondary">
              <div className="font-semibold text-text-secondary">Looking for line attribution?</div>
              <div className="text-text-tertiary">
                Source Lens lives in the AI Attribution tab and shows suggested, line-by-line influence.
                {!selectedFile ? ' Select a file in the diff to unlock it.' : ''}
              </div>
              <div>
                <button
                  type="button"
                  onClick={onOpenAttribution}
                  className="btn-secondary-soft inline-flex items-center gap-2 px-3 py-1.5 rounded-md"
                >
                  Open AI Attribution
                </button>
              </div>
            </div>
          ) : null}

          <TraceTranscriptPanel
            excerpt={sessionExcerpts?.find((session) => session.id === selectedSessionId)}
            selectedFile={selectedFile}
            onFileClick={onFileClick}
          />
        </div>
      ) : null}

      {activeTab === 'attribution' ? (
        <div id="panel-attribution" role="tabpanel" aria-labelledby="tab-attribution" className="flex flex-col gap-4">
          <AgentTraceSummary
            summary={traceSummary}
            hasFiles={hasFiles}
            status={traceStatus}
            onExport={onExportAgentTrace}
            onSmokeTest={onRunOtlpSmokeTest}
          />

          <div>
            <div className="section-header">SOURCE LENS</div>
            <div className="section-subheader">Line-by-line attribution for the selected file</div>
            <div className="text-xs text-text-tertiary">
              Use this to verify AI-influenced lines. Suggested only — confirm before citing or sharing.
            </div>
          </div>

          {repoId && selectedCommitSha && selectedFile ? (
            <SourceLensView
              repoId={repoId}
              commitSha={selectedCommitSha}
              filePath={selectedFile}
              prefsOverride={attributionPrefs}
              showHeader={false}
            />
          ) : (
            <div className="card p-5 text-sm text-text-tertiary">
              Select a file in the diff to see Source Lens attribution.
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'atlas' ? (
        <div id="panel-atlas" role="tabpanel" aria-labelledby="tab-atlas" className="flex flex-col gap-4">
          <AtlasSearchPanel repoId={repoId ?? null} />
        </div>
      ) : null}

      {activeTab === 'settings' ? (
        <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" className="flex flex-col gap-4">
          <AppearanceCard fireflyEnabled={fireflyEnabled} onToggleFirefly={onToggleFirefly} />
          <AutoIngestSetupPanel
            config={ingestConfig ?? null}
            sources={discoveredSources ?? null}
            migrationStatus={collectorMigrationStatus ?? null}
            captureReliability={captureReliabilityStatus ?? null}
            onToggleAutoIngest={(enabled) => onToggleAutoIngest?.(enabled)}
            onUpdateWatchPaths={(paths) => onUpdateWatchPaths?.(paths)}
            onMigrateCollector={onMigrateCollector}
            onRollbackCollector={onRollbackCollector}
            onRefreshReliability={onRefreshCaptureReliability}
            onAuthorizeCodexAppServerForLiveTest={onAuthorizeCodexAppServerForLiveTest}
            onLogoutCodexAppServerAccount={onLogoutCodexAppServerAccount}
          />
          <TelemetrySettingsPanel
            traceConfig={traceConfig}
            ingestConfig={ingestConfig ?? null}
            captureReliabilityStatus={captureReliabilityStatus ?? null}
            otlpKeyStatus={otlpKeyStatus ?? null}
            logUserPromptEnabled={codexPromptExport?.enabled ?? null}
            logUserPromptConfigPath={codexPromptExport?.configPath ?? null}
            onUpdateCodexOtelPath={onUpdateCodexOtelPath}
            onToggleCodexOtelReceiver={onToggleCodexOtelReceiver}
            onOpenCodexOtelDocs={onOpenCodexOtelDocs}
            onRotateOtlpKey={() => onRotateOtlpKey?.()}
            onGrantConsent={() => onGrantCodexConsent?.()}
            onConfigureCodex={() => onConfigureCodex?.()}
          />
          <AttributionSettingsPanel
            attributionPrefs={attributionPrefs}
            onUpdateAttributionPrefs={onUpdateAttributionPrefs}
            onPurgeAttributionMetadata={onPurgeAttributionMetadata}
          />
          <GitHubConnectorPanel
            enabled={githubConnectorEnabled ?? false}
            status={githubConnectorState?.status ?? 'disabled'}
            entryCount={githubConnectorState?.entries.length ?? 0}
            failedFileCount={githubConnectorState?.failedFileCount}
            redactionHits={(githubConnectorState?.entries ?? []).reduce((total, entry) => total + entry.redactionHits, 0)}
            lastLoadedAtISO={githubConnectorState?.lastLoadedAtISO}
            error={githubConnectorState?.error}
            onToggle={(enabled) => onToggleGitHubConnector?.(enabled)}
          />
          <StoryAnchorsPanel
            repoId={repoId ?? null}
            repoRoot={repoRoot ?? null}
            selectedCommitSha={selectedCommitSha}
            indexedCommitShas={indexedCommitShas ?? null}
          />
        </div>
      ) : null}

      {activeTab === 'tests' ? (
        <div id="panel-tests" role="tabpanel" aria-labelledby="tab-tests">
          <TestResultsPanel
            testRun={testRun}
            onFileClick={onTestFileClick}
            selectedCommitSha={selectedCommitSha}
            onImportJUnit={onImportJUnit}
            loading={loadingTests}
            repoRoot={repoRoot}
            changedFiles={changedFiles}
          />
        </div>
      ) : null}
    </div>
  );
}
