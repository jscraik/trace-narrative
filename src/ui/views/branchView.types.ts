import type { AttributionPrefs, AttributionPrefsUpdate } from '../../core/attribution-api';
import type { ActivityEvent } from '../../core/tauri/activity';
import type {
  CaptureReliabilityStatus,
  CollectorMigrationStatus,
  DiscoveredSources,
  IngestConfig,
  OtlpKeyStatus,
} from '../../core/tauri/ingestConfig';
import type {
  BranchViewModel,
  DashboardFilter,
  FileChange,
  TraceRange,
} from '../../core/types';
import type { IngestIssue, IngestStatus } from '../../hooks/useAutoIngest';
import type { CockpitTableRow } from './cockpitViewData';

export interface BranchViewProps {
  model: BranchViewModel;
  pendingAction?: CockpitTableRow['action'];
  onActionProcessed?: () => void;
  dashboardFilter?: DashboardFilter | null;
  onClearFilter?: () => void;
  isExitingFilteredView?: boolean;
  updateModel: (updater: (prev: BranchViewModel) => BranchViewModel) => void;
  loadFilesForNode: (nodeId: string) => Promise<FileChange[]>;
  loadDiffForFile: (nodeId: string, filePath: string) => Promise<string>;
  loadTraceRangesForFile: (nodeId: string, filePath: string) => Promise<TraceRange[]>;
  onExportAgentTrace: (nodeId: string, files: FileChange[]) => void;
  onRunOtlpSmokeTest: (nodeId: string, files: FileChange[]) => void;
  onUpdateCodexOtelPath?: (path: string) => void;
  onToggleCodexOtelReceiver?: (enabled: boolean) => void;
  onOpenCodexOtelDocs?: () => void;
  codexPromptExport?: { enabled: boolean | null; configPath: string | null };
  attributionPrefs?: AttributionPrefs | null;
  onUpdateAttributionPrefs?: (update: AttributionPrefsUpdate) => void;
  onPurgeAttributionMetadata?: () => void;
  onUnlinkSession?: (sessionId: string) => void;
  actionError?: string | null;
  setActionError: (error: string | null) => void;
  onDismissActionError?: () => void;
  ingestStatus?: IngestStatus;
  ingestActivityRecent?: ActivityEvent[];
  onRequestIngestActivityAll?: () => Promise<ActivityEvent[]>;
  ingestIssues?: IngestIssue[];
  onDismissIngestIssue?: (id: string) => void;
  onToggleAutoIngest?: (enabled: boolean) => void;
  ingestToast?: { id: string; message: string } | null;
  ingestConfig?: IngestConfig | null;
  otlpKeyStatus?: OtlpKeyStatus | null;
  discoveredSources?: DiscoveredSources | null;
  collectorMigrationStatus?: CollectorMigrationStatus | null;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
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
  branchHeaderParityEnabled?: boolean;
}
