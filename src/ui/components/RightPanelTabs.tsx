import { useTheme } from '@design-studio/tokens';
import { Activity, MessageSquare, Search, Settings, TestTube } from 'lucide-react';
import { Fragment, type KeyboardEvent, useEffect, useState } from 'react';
import type { AttributionPrefs, AttributionPrefsUpdate } from '../../core/attribution-api';
import type {
  CaptureReliabilityStatus,
  CollectorMigrationStatus,
  DiscoveredSources,
  IngestConfig,
  OtlpKeyStatus,
} from '../../core/tauri/ingestConfig';
import type {
  GitHubContextState,
  SessionExcerpt,
  TestRun,
  TraceCollectorConfig,
  TraceCollectorStatus,
  TraceCommitSummary,
  TraceRange,
} from '../../core/types';
import { AgentTraceSummary } from './AgentTraceSummary';
import { AtlasSearchPanel } from './AtlasSearchPanel';
import { AttributionSettingsPanel } from './AttributionSettingsPanel';
import { AutoIngestSetupPanel } from './AutoIngestSetupPanel';
import { GitHubConnectorPanel } from './GitHubConnectorPanel';
import { SessionExcerpts } from './SessionExcerpts';
import { SourceLensView } from './SourceLensView';
import { StepsSummaryCard } from './StepsSummaryCard';
import { StoryAnchorsPanel } from './StoryAnchorsPanel';
import { TelemetrySettingsPanel } from './TelemetrySettingsPanel';
import { TestResultsPanel } from './TestResultsPanel';
import { Toggle } from './Toggle';
import { TraceTranscriptPanel } from './TraceTranscriptPanel';
import { DiffDock } from './right-panel-tabs/DiffDock';

type TabId = 'session' | 'attribution' | 'atlas' | 'settings' | 'tests';
type TabCategory = 'analyze' | 'tools' | 'config';

interface TabConfig {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: typeof MessageSquare;
  category: TabCategory;
}

const TAB_ACTIVE_STYLES: Record<TabId, string> = {
  session: 'border-accent-violet-light bg-accent-violet-bg text-accent-violet',
  attribution: 'border-accent-green-light bg-accent-green-bg text-accent-green',
  atlas: 'border-accent-blue-light bg-accent-blue-bg text-accent-blue',
  tests: 'border-accent-amber-light bg-accent-amber-bg text-accent-amber',
  settings: 'border-border-light bg-bg-tertiary text-text-secondary',
};

const TABS: TabConfig[] = [
  { id: 'session', label: 'Session', shortLabel: 'Session', icon: MessageSquare, category: 'analyze' },
  { id: 'attribution', label: 'AI Attribution', shortLabel: 'Attribution', icon: Activity, category: 'analyze' },
  { id: 'atlas', label: 'Atlas Search', shortLabel: 'Atlas', icon: Search, category: 'tools' },
  { id: 'tests', label: 'Tests', shortLabel: 'Tests', icon: TestTube, category: 'tools' },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings, category: 'config' },
];

interface RightPanelTabsProps {
  // Session data
  sessionExcerpts?: SessionExcerpt[];
  selectedFile: string | null;
  onFileClick: (path: string) => void;
  onUnlinkSession?: (sessionId: string) => void;
  onCommitClick: (commitSha: string) => void;
  selectedCommitId: string | null;
  repoRoot?: string;
  changedFiles?: string[];

  // Attribution data
  traceSummary?: TraceCommitSummary;
  traceStatus?: TraceCollectorStatus;
  hasFiles: boolean;
  onExportAgentTrace?: () => void;
  onRunOtlpSmokeTest?: () => void;

  // Settings data
  traceConfig?: TraceCollectorConfig;
  onUpdateCodexOtelPath?: (path: string) => void;
  onToggleCodexOtelReceiver?: (enabled: boolean) => void;
  onOpenCodexOtelDocs?: () => void;
  codexPromptExport?: { enabled: boolean | null; configPath: string | null };
  attributionPrefs?: AttributionPrefs | null;
  onUpdateAttributionPrefs?: (update: AttributionPrefsUpdate) => void;
  onPurgeAttributionMetadata?: () => void;
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

  // Test data
  testRun?: TestRun;
  onTestFileClick: (path: string) => void;
  loadingTests?: boolean;
  onImportJUnit?: () => void;

  // Diff data
  selectedCommitSha: string | null;
  repoId?: number;
  indexedCommitShas?: string[] | null;
  diffText: string | null;
  loadingDiff: boolean;
  traceRanges: TraceRange[];

  // Firefly settings
  fireflyEnabled?: boolean;
  onToggleFirefly?: (enabled: boolean) => void;
}

interface AppearanceCardProps {
  fireflyEnabled?: boolean;
  onToggleFirefly?: (enabled: boolean) => void;
}

function AppearanceCard({ fireflyEnabled, onToggleFirefly }: AppearanceCardProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="card p-4">
      <div className="section-header">Appearance</div>
      <div className="section-subheader mt-0.5">visual preferences</div>

      <div className="mt-4 flex flex-col gap-4">
        {/* Theme Toggle (Dev Only) */}
        {import.meta.env.DEV && (
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-text-secondary">Dev Theme Override</span>
              <span className="text-[10px] text-text-tertiary">Force dark/light mode for testing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              <Toggle
                checked={theme === 'dark'}
                onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')}
                aria-label="Toggle dark mode"
              />
            </div>
          </div>
        )}

        {/* Firefly Toggle */}
        {onToggleFirefly && (
          <div className={`flex items-center justify-between ${import.meta.env.DEV ? 'border-t border-border-subtle/50 pt-3' : ''}`}>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-text-secondary">Firefly Signal</span>
              <span className="text-[10px] text-text-tertiary">Ambient status indicator</span>
            </div>
            <Toggle
              checked={fireflyEnabled ?? true}
              onCheckedChange={onToggleFirefly}
              aria-label="Toggle firefly signal"
            />
          </div>
        )}

        {/* Color Semantics */}
        <div className={`border-t border-border-subtle/50 pt-3 ${onToggleFirefly || import.meta.env.DEV ? '' : 'mt-0'}`}>
          <div className="text-xs font-medium text-text-secondary mb-2">Color Semantics</div>
          <div className="flex flex-wrap gap-2 text-[11px] font-medium">
            <span className="rounded-full border border-accent-green-light bg-accent-green-bg px-2 py-0.5 text-accent-green">AI</span>
            <span className="rounded-full border border-accent-violet-light bg-accent-violet-bg px-2 py-0.5 text-accent-violet">Human</span>
            <span className="rounded-full border border-accent-amber-light bg-accent-amber-bg px-2 py-0.5 text-accent-amber">Mixed</span>
            <span className="rounded-full border border-border-subtle bg-bg-tertiary px-2 py-0.5 text-text-tertiary">Unknown</span>
            <span className="rounded-full border border-accent-red-light bg-accent-red-bg px-2 py-0.5 text-accent-red">Failed tests</span>
          </div>
          <div className="mt-2 text-[11px] text-text-tertiary">
            Session link lifecycle: <span className="text-text-secondary">Imported</span> →{' '}
            <span className="text-accent-amber">Matching</span> →{' '}
            <span className="text-accent-green">Linked</span>{' '}
            <span className="text-text-muted">(or Needs review)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RightPanelTabBarProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  hasSessionContent: boolean;
  hasAttributionContent: boolean;
  hasAtlasContent: boolean;
  hasTestContent: boolean;
}

function RightPanelTabBar({
  activeTab,
  onChangeTab,
  hasSessionContent,
  hasAttributionContent,
  hasAtlasContent,
  hasTestContent,
}: RightPanelTabBarProps) {
  const tabIds = TABS.map((tab) => tab.id);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabIds.indexOf(activeTab);
    if (currentIndex === -1) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % tabIds.length;
        onChangeTab(tabIds[nextIndex]);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault();
        const nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
        onChangeTab(tabIds[nextIndex]);
        break;
      }
      case 'Home':
        event.preventDefault();
        onChangeTab(tabIds[0]);
        break;
      case 'End':
        event.preventDefault();
        onChangeTab(tabIds[tabIds.length - 1]);
        break;
      default:
        break;
    }
  };

  return (
    <div className="card p-2">
      <div className="flex items-center gap-1" role="tablist" aria-label="Right panel tabs" onKeyDown={handleTabKeyDown}>
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const hasContent =
            (tab.id === 'session' && hasSessionContent) ||
            (tab.id === 'attribution' && hasAttributionContent) ||
            (tab.id === 'atlas' && hasAtlasContent) ||
            (tab.id === 'tests' && hasTestContent) ||
            tab.id === 'settings';

          const prevTab = index > 0 ? TABS[index - 1] : null;
          const needsSeparator = prevTab && prevTab.category !== tab.category;

          return (
            <Fragment key={tab.id}>
              {needsSeparator && (
                <div className="w-px h-5 bg-border-light mx-1" aria-hidden="true" />
              )}
              <button
                id={`tab-${tab.id}`}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`
                  min-w-0 flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 border
                  text-[10px] leading-4 font-medium whitespace-nowrap
                  transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105
                  ${isActive
                    ? TAB_ACTIVE_STYLES[tab.id]
                    : 'border-border-subtle bg-bg-primary text-text-secondary hover:bg-bg-secondary hover:border-border-light'
                  }
                  ${!hasContent && tab.id !== 'settings' ? 'opacity-60' : ''}
                `}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                title={tab.label}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{tab.shortLabel}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface SessionTabPanelProps {
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
}

function SessionTabPanel({
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
}: SessionTabPanelProps) {
  return (
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
        excerpt={sessionExcerpts?.find((s) => s.id === selectedSessionId)}
        selectedFile={selectedFile}
        onFileClick={onFileClick}
      />
    </div>
  );
}

interface AttributionTabPanelProps {
  traceSummary?: TraceCommitSummary;
  hasFiles: boolean;
  traceStatus?: TraceCollectorStatus;
  onExportAgentTrace?: () => void;
  onRunOtlpSmokeTest?: () => void;
  repoId?: number;
  selectedCommitSha: string | null;
  selectedFile: string | null;
  attributionPrefs?: AttributionPrefs | null;
}

function AttributionTabPanel({
  traceSummary,
  hasFiles,
  traceStatus,
  onExportAgentTrace,
  onRunOtlpSmokeTest,
  repoId,
  selectedCommitSha,
  selectedFile,
  attributionPrefs,
}: AttributionTabPanelProps) {
  return (
    <div
      id="panel-attribution"
      role="tabpanel"
      aria-labelledby="tab-attribution"
      className="flex flex-col gap-4"
    >
      <AgentTraceSummary
        summary={traceSummary}
        hasFiles={hasFiles}
        status={traceStatus}
        onExport={onExportAgentTrace}
        onSmokeTest={onRunOtlpSmokeTest}
      />

      <div>
        <div className="section-header">SOURCE LENS</div>
        <div className="section-subheader">
          Line-by-line attribution for the selected file
        </div>
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
  );
}

interface SettingsTabPanelProps {
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
  attributionPrefs?: AttributionPrefs | null;
  onUpdateAttributionPrefs?: (update: AttributionPrefsUpdate) => void;
  onPurgeAttributionMetadata?: () => void;
  repoId?: number;
  repoRoot?: string;
  selectedCommitSha: string | null;
  indexedCommitShas?: string[] | null;

  // Firefly settings
  fireflyEnabled?: boolean;
  onToggleFirefly?: (enabled: boolean) => void;
}

function SettingsTabPanel({
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
  githubConnectorEnabled = false,
  onToggleGitHubConnector,
  githubConnectorState,
  traceConfig,
  onUpdateCodexOtelPath,
  onToggleCodexOtelReceiver,
  onOpenCodexOtelDocs,
  codexPromptExport,
  attributionPrefs,
  onUpdateAttributionPrefs,
  onPurgeAttributionMetadata,
  repoId,
  repoRoot,
  selectedCommitSha,
  indexedCommitShas,
  fireflyEnabled,
  onToggleFirefly,
}: SettingsTabPanelProps) {
  return (
    <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" className="flex flex-col gap-4">

      <AppearanceCard
        fireflyEnabled={fireflyEnabled}
        onToggleFirefly={onToggleFirefly}
      />
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
        enabled={githubConnectorEnabled}
        status={githubConnectorState?.status ?? 'disabled'}
        entryCount={githubConnectorState?.entries.length ?? 0}
        failedFileCount={githubConnectorState?.failedFileCount}
        redactionHits={(githubConnectorState?.entries ?? []).reduce(
          (total, entry) => total + entry.redactionHits,
          0
        )}
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
  );
}

interface TestsTabPanelProps {
  testRun?: TestRun;
  onTestFileClick: (path: string) => void;
  selectedCommitSha: string | null;
  onImportJUnit?: () => void;
  loadingTests?: boolean;
  repoRoot?: string;
  changedFiles?: string[];
}

function TestsTabPanel({
  testRun,
  onTestFileClick,
  selectedCommitSha,
  onImportJUnit,
  loadingTests,
  repoRoot,
  changedFiles,
}: TestsTabPanelProps) {
  return (
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
  );
}

export function RightPanelTabs(props: RightPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('session');
  const [diffExpanded, setDiffExpanded] = useState(false);
  const [diffPip, setDiffPip] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const {
    sessionExcerpts,
    selectedFile,
    onFileClick,
    onUnlinkSession,
    onCommitClick,
    selectedCommitId,
    repoRoot,
    changedFiles,
    traceSummary,
    traceStatus,
    hasFiles,
    onExportAgentTrace,
    onRunOtlpSmokeTest,
    traceConfig,
    onUpdateCodexOtelPath,
    onToggleCodexOtelReceiver,
    onOpenCodexOtelDocs,
    codexPromptExport,
    attributionPrefs,
    onUpdateAttributionPrefs,
    onPurgeAttributionMetadata,
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
    testRun,
    onTestFileClick,
    loadingTests,
    onImportJUnit,
    selectedCommitSha,
    repoId,
    indexedCommitShas,
    diffText,
    loadingDiff,
    traceRanges,
    fireflyEnabled,
    onToggleFirefly,
  } = props;

  // Determine which tabs have content
  const hasSessionContent = sessionExcerpts && sessionExcerpts.length > 0;
  const hasAttributionContent = traceSummary || traceStatus;
  // Atlas tab is always enabled; the panel itself shows a repo-required empty state when repoId is null.
  const hasAtlasContent = true;
  const hasTestContent = Boolean(testRun) || Boolean(selectedCommitSha);

  // Use active tab directly - no auto-switch to prevent jarring UX
  // Users can manually switch between tabs
  const effectiveTab = activeTab;

  useEffect(() => {
    if (!sessionExcerpts || sessionExcerpts.length === 0) {
      setSelectedSessionId(null);
      return;
    }

    // Prefer a session that is linked to the currently selected commit (when available).
    // This makes auto-ingested sessions feel "attached" to the repo timeline by default.
    if (selectedCommitId) {
      const linked = sessionExcerpts.find((s) => s.linkedCommitSha === selectedCommitId);
      if (linked && linked.id !== selectedSessionId) {
        setSelectedSessionId(linked.id);
        return;
      }
    }

    if (!selectedSessionId || !sessionExcerpts.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(sessionExcerpts[0]?.id ?? null);
    }
  }, [sessionExcerpts, selectedSessionId, selectedCommitId]);

  return (
    <div className="relative flex flex-col h-full gap-4">
      <RightPanelTabBar
        activeTab={effectiveTab}
        onChangeTab={setActiveTab}
        hasSessionContent={Boolean(hasSessionContent)}
        hasAttributionContent={Boolean(hasAttributionContent)}
        hasAtlasContent={hasAtlasContent}
        hasTestContent={hasTestContent}
      />

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {effectiveTab === 'session' && (
          <SessionTabPanel
            repoId={repoId}
            repoRoot={repoRoot}
            selectedCommitSha={selectedCommitSha}
            traceSummary={traceSummary}
            sessionExcerpts={sessionExcerpts}
            selectedFile={selectedFile}
            onFileClick={onFileClick}
            onUnlinkSession={onUnlinkSession}
            onCommitClick={onCommitClick}
            selectedCommitId={selectedCommitId}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            changedFiles={changedFiles}
            hasAttributionContent={Boolean(hasAttributionContent)}
            onOpenAttribution={() => setActiveTab('attribution')}
          />
        )}

        {effectiveTab === 'attribution' && (
          <AttributionTabPanel
            traceSummary={traceSummary}
            hasFiles={hasFiles}
            traceStatus={traceStatus}
            onExportAgentTrace={onExportAgentTrace}
            onRunOtlpSmokeTest={onRunOtlpSmokeTest}
            repoId={repoId}
            selectedCommitSha={selectedCommitSha}
            selectedFile={selectedFile}
            attributionPrefs={attributionPrefs}
          />
        )}

        {effectiveTab === 'atlas' && (
          <div id="panel-atlas" role="tabpanel" aria-labelledby="tab-atlas" className="flex flex-col gap-4">
            <AtlasSearchPanel repoId={repoId ?? null} />
          </div>
        )}

        {effectiveTab === 'settings' && (
          <SettingsTabPanel
            ingestConfig={ingestConfig}
            otlpKeyStatus={otlpKeyStatus}
            discoveredSources={discoveredSources}
            collectorMigrationStatus={collectorMigrationStatus}
            captureReliabilityStatus={captureReliabilityStatus}
            onToggleAutoIngest={onToggleAutoIngest}
            onUpdateWatchPaths={onUpdateWatchPaths}
            onMigrateCollector={onMigrateCollector}
            onRollbackCollector={onRollbackCollector}
            onRefreshCaptureReliability={onRefreshCaptureReliability}
            onConfigureCodex={onConfigureCodex}
            onRotateOtlpKey={onRotateOtlpKey}
            onGrantCodexConsent={onGrantCodexConsent}
            onAuthorizeCodexAppServerForLiveTest={onAuthorizeCodexAppServerForLiveTest}
            onLogoutCodexAppServerAccount={onLogoutCodexAppServerAccount}
            githubConnectorEnabled={githubConnectorEnabled}
            onToggleGitHubConnector={onToggleGitHubConnector}
            githubConnectorState={githubConnectorState}
            traceConfig={traceConfig}
            onUpdateCodexOtelPath={onUpdateCodexOtelPath}
            onToggleCodexOtelReceiver={onToggleCodexOtelReceiver}
            onOpenCodexOtelDocs={onOpenCodexOtelDocs}
            codexPromptExport={codexPromptExport}
            attributionPrefs={attributionPrefs}
            onUpdateAttributionPrefs={onUpdateAttributionPrefs}
            onPurgeAttributionMetadata={onPurgeAttributionMetadata}
            repoId={repoId}
            repoRoot={repoRoot}
            selectedCommitSha={selectedCommitSha}
            indexedCommitShas={indexedCommitShas}
            fireflyEnabled={fireflyEnabled}
            onToggleFirefly={onToggleFirefly}
          />
        )}

        {effectiveTab === 'tests' && (
          <TestsTabPanel
            testRun={testRun}
            onTestFileClick={onTestFileClick}
            selectedCommitSha={selectedCommitSha}
            onImportJUnit={onImportJUnit}
            loadingTests={loadingTests}
            repoRoot={repoRoot}
            changedFiles={changedFiles}
          />
        )}

      </div>

      <DiffDock
        selectedFile={selectedFile}
        diffExpanded={diffExpanded}
        diffPip={diffPip}
        diffText={diffText}
        loadingDiff={loadingDiff}
        traceRanges={traceRanges}
        onToggleExpanded={() => setDiffExpanded((v) => !v)}
        onTogglePip={() => {
          setDiffPip((v) => !v);
          setDiffExpanded(true);
        }}
        onDock={() => setDiffPip(false)}
      />
    </div>
  );
}
