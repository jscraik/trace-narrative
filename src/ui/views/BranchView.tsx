import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AttributionPrefs, AttributionPrefsUpdate } from '../../core/attribution-api';
import { FileSelectionProvider, useFileSelection } from '../../core/context/FileSelectionContext';
import { testRuns } from '../../core/demo/nearbyGridDemo';
import { getLatestTestRunForCommit } from '../../core/repo/testRuns';
import type { ActivityEvent } from '../../core/tauri/activity';
import type {
  CaptureReliabilityStatus,
  CollectorMigrationStatus,
  DiscoveredSources,
  IngestConfig,
  OtlpKeyStatus
} from '../../core/tauri/ingestConfig';
import { composeBranchNarrative } from '../../core/narrative/composeBranchNarrative';
import { buildDecisionArchaeology } from '../../core/narrative/decisionArchaeology';
import { evaluateNarrativeRollout } from '../../core/narrative/rolloutGovernance';
import { buildStakeholderProjections } from '../../core/narrative/stakeholderProjections';
import { loadGitHubContext } from '../../core/repo/githubContext';
import {
  getNarrativeCalibrationProfile,
  submitNarrativeFeedback,
} from '../../core/repo/narrativeFeedback';
import {
  trackNarrativeEvent,
  trackQualityRenderDecision,
} from '../../core/telemetry/narrativeTelemetry';
import type {
  BranchViewModel,
  GitHubContextState,
  DashboardFilter,
  StakeholderAudience,
  NarrativeFeedbackActorRole,
  NarrativeFeedbackAction,
  NarrativeCalibrationProfile,
  FileChange,
  NarrativeDetailLevel,
  NarrativeEvidenceLink,
  NarrativeObservabilityMetrics,
  TestRun,
  TraceRange,
} from '../../core/types';
import type { IngestIssue, IngestStatus } from '../../hooks/useAutoIngest';
import { useFirefly } from '../../hooks/useFirefly';
import { useTestImport } from '../../hooks/useTestImport';
import {
  createBranchHeaderRequestIdentityKey,
  deriveBranchHeaderViewModel,
  deriveLegacyBranchHeaderViewModel,
} from '../components/branchHeaderMapper';
import { RightPanelTabs } from '../components/RightPanelTabs';
import { Timeline, type FireflyTrackingSettlePayload } from '../components/Timeline';
import { BranchViewLayout } from './BranchViewLayout';
import { TIMING, createNarrativeViewInstanceId } from './branchView.constants';
import { useBranchSelectionData } from './branch-view/useBranchSelectionData';
import { shouldRouteEvidenceToRawDiff } from './branchViewEvidence';

export interface BranchViewProps {
  model: BranchViewModel;
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

function BranchViewInner(props: BranchViewProps) {
  const {
    model,
    dashboardFilter,
    onClearFilter,
    isExitingFilteredView,
    updateModel,
    loadFilesForNode,
    loadDiffForFile,
    loadTraceRangesForFile,
    onExportAgentTrace,
    onRunOtlpSmokeTest,
    onUpdateCodexOtelPath,
    onToggleCodexOtelReceiver,
    onOpenCodexOtelDocs,
    codexPromptExport,
    attributionPrefs,
    onUpdateAttributionPrefs,
    onPurgeAttributionMetadata,
    onUnlinkSession,
    actionError,
    setActionError,
    onDismissActionError,
    ingestStatus,
    ingestActivityRecent,
    onRequestIngestActivityAll,
    ingestIssues,
    onDismissIngestIssue,
    onToggleAutoIngest,
    ingestToast,
    ingestConfig,
    otlpKeyStatus,
    discoveredSources,
    collectorMigrationStatus,
    captureReliabilityStatus,
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
    branchHeaderParityEnabled = (import.meta.env.VITE_BRANCH_HEADER_PARITY_V1 ?? 'true') !== 'false',
  } = props;
  const { selectedFile, selectFile } = useFileSelection();

  const defaultSelectedId = useMemo(() => {
    const head = model.meta?.headSha;
    if (head && model.timeline.some((n) => n.id === head)) return head;
    return model.timeline[model.timeline.length - 1]?.id ?? null;
  }, [model]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(defaultSelectedId);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStage(1), TIMING.summary));
    timers.push(setTimeout(() => setStage(2), TIMING.header));
    timers.push(setTimeout(() => setStage(3), TIMING.narrative));
    timers.push(setTimeout(() => setStage(4), TIMING.details));
    timers.push(setTimeout(() => setStage(5), TIMING.intents));
    timers.push(setTimeout(() => setStage(6), TIMING.files));
    timers.push(setTimeout(() => setStage(7), TIMING.rightPanel));
    timers.push(setTimeout(() => setStage(8), TIMING.timeline));

    return () => timers.forEach(clearTimeout);
  }, []);

  // Track which commits have already pulsed (once per app session)
  const pulsedCommits = useRef<Set<string>>(new Set());
  const [pulseCommitId, setPulseCommitId] = useState<string | null>(null);
  const [trackingSettledNodeId, setTrackingSettledNodeId] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<NarrativeDetailLevel>('summary');
  const [feedbackActorRole, setFeedbackActorRole] = useState<NarrativeFeedbackActorRole>('developer');
  const [narrativeCalibration, setNarrativeCalibration] = useState<NarrativeCalibrationProfile | null>(null);
  const [audience, setAudience] = useState<StakeholderAudience>('manager');
  const [githubContext, setGithubContext] = useState<GitHubContextState>({
    status: githubConnectorEnabled ? 'loading' : 'disabled',
    entries: []
  });
  const [observability, setObservability] = useState<NarrativeObservabilityMetrics>({
    layerSwitchedCount: 0,
    evidenceOpenedCount: 0,
    fallbackUsedCount: 0,
    killSwitchTriggeredCount: 0,
  });
  const rolloutTelemetryKeyRef = useRef<string | null>(null);
  const killSwitchReasonRef = useRef<string | null>(null);
  const headerDecisionTelemetryKeyRef = useRef<string | null>(null);
  const headerDerivationDurationMsRef = useRef(0);
  const narrativeViewedKeyRef = useRef<string | null>(null);
  const narrativeViewInstanceIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const feedbackContextRef = useRef<string>('');

  const requestIdentityKey = useMemo(
    () =>
      createBranchHeaderRequestIdentityKey({
        repoKey: model.meta?.repoPath,
        mode: model.source === 'git' ? 'repo' : 'demo',
        filter: dashboardFilter,
      }),
    [dashboardFilter, model.meta?.repoPath, model.source]
  );
  const requestContextKey = useMemo(
    () => `${requestIdentityKey}|node:${selectedNodeId ?? 'none'}|file:${selectedFile ?? 'none'}`,
    [requestIdentityKey, selectedFile, selectedNodeId]
  );

  const feedbackContextKey = `${model.meta?.repoId ?? 'none'}:${model.meta?.branchName ?? 'unknown'}`;

  useEffect(() => {
    feedbackContextRef.current = feedbackContextKey;
  }, [feedbackContextKey]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const headerViewModel = useMemo(() => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const result = !branchHeaderParityEnabled
      ? deriveLegacyBranchHeaderViewModel(model, dashboardFilter)
      : deriveBranchHeaderViewModel({
        mode: model.source === 'git' ? 'repo' : 'demo',
        repoStatus: 'ready',
        model,
        dashboardFilter,
        featureEnabled: true,
      });

    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    headerDerivationDurationMsRef.current = Math.max(0, end - start);

    return result;
  }, [branchHeaderParityEnabled, dashboardFilter, model]);

  const headerReasonCode = useMemo(() => {
    if (headerViewModel.kind === 'hidden') return headerViewModel.reason;
    if (headerViewModel.kind === 'shell') return headerViewModel.state;
    return 'ready';
  }, [headerViewModel]);

  useEffect(() => {
    const telemetryKey = `${requestIdentityKey}:${headerViewModel.kind}:${headerReasonCode}`;
    const previousKey = headerDecisionTelemetryKeyRef.current;
    if (previousKey === telemetryKey) return;

    const transition = previousKey ? 'state_change' : 'initial';
    headerDecisionTelemetryKeyRef.current = telemetryKey;

    trackQualityRenderDecision({
      branch: model.meta?.branchName,
      source: model.source,
      headerKind: headerViewModel.kind,
      repoStatus: 'ready',
      transition,
      reasonCode: headerReasonCode,
      durationMs: headerDerivationDurationMsRef.current,
      budgetMs: 1,
    });
  }, [headerReasonCode, headerViewModel.kind, model.meta?.branchName, model.source, requestIdentityKey]);

  const calibrationEnabled = (import.meta.env.VITE_NARRATIVE_CALIBRATION_V1 ?? 'true') !== 'false';

  const narrative = useMemo(
    () => composeBranchNarrative(model, { calibration: calibrationEnabled ? narrativeCalibration : null }),
    [model, narrativeCalibration]
  );
  const projections = useMemo(
    () =>
      buildStakeholderProjections({
        narrative,
        model,
        githubEntry: githubContext.entries[0]
      }),
    [githubContext.entries, model, narrative]
  );
  const archaeologyEntries = useMemo(
    () => buildDecisionArchaeology({ narrative, githubEntry: githubContext.entries[0] }),
    [githubContext.entries, narrative]
  );
  const rolloutReport = useMemo(
    () =>
      evaluateNarrativeRollout({
        narrative,
        projections,
        githubContextState: githubContext,
        observability,
      }),
    [githubContext, narrative, observability, projections]
  );
  const criticalRule = rolloutReport.rules.find((rule) => rule.triggered && rule.severity === 'critical');
  const killSwitchActive = rolloutReport.status === 'rollback';
  const effectiveDetailLevel: NarrativeDetailLevel = killSwitchActive ? 'diff' : detailLevel;
  const branchScopeKey = `${model.meta?.repoPath ?? ''}:${model.meta?.branchName ?? ''}`;

  const selectedNode = useMemo(
    () => model.timeline.find((node) => node.id === selectedNodeId) ?? null,
    [model.timeline, selectedNodeId]
  );

  const selectedCommitSha = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'commit') return null;
    return selectedNode.id;
  }, [selectedNode]);

  const {
    files,
    diffText,
    loadingFiles,
    loadingDiff,
    traceRanges,
    loadingTrace,
    traceRequestedForSelection,
    setFiles,
  } = useBranchSelectionData({
    requestContextKey,
    selectedNodeId,
    selectedFile,
    selectedCommitSha,
    loadFilesForNode,
    loadDiffForFile,
    loadTraceRangesForFile,
    selectFile,
    setActionError,
  });

  const reportFireflyError = useCallback((message: string) => {
    setActionError(message);
  }, [setActionError]);

  const firefly = useFirefly({
    selectedNodeId,
    selectedCommitSha,
    hasSelectedFile: Boolean(selectedFile),
    trackingSettled: selectedNodeId !== null && trackingSettledNodeId === selectedNodeId,
    loadingFiles,
    loadingDiff,
    loadingTrace,
    traceRequestedForSelection,
    traceSummary: selectedCommitSha ? model.traceSummaries?.byCommit[selectedCommitSha] : undefined,
    onPersistenceError: reportFireflyError,
  });

  // Demo: test run lookup is driven by node.testRunId.
  const demoTestRun = useMemo((): TestRun | undefined => {
    if (model.source !== 'demo') return undefined;
    const node = model.timeline.find((n) => n.id === selectedNodeId);
    const id = node?.testRunId;
    if (!id) return undefined;
    return testRuns[id];
  }, [model, selectedNodeId]);

  // Repo: load latest test run from DB for the selected commit.
  const [repoTestRun, setRepoTestRun] = useState<TestRun | null>(null);
  const [loadingTests, setLoadingTests] = useState(false);
  const testRunRequestVersionRef = useRef(0);

  const repoRoot = model.meta?.repoPath ?? '';
  const repoId = model.meta?.repoId ?? null;

  useEffect(() => {
    if (!calibrationEnabled || !repoId) {
      setNarrativeCalibration(null);
      return;
    }

    let cancelled = false;
    const calibrationContextAtLoad = feedbackContextKey;
    setNarrativeCalibration(null);
    getNarrativeCalibrationProfile(repoId)
      .then((profile) => {
        if (cancelled) return;
        if (feedbackContextRef.current !== calibrationContextAtLoad) return;
        setNarrativeCalibration(profile);
      })
      .catch(() => {
        if (cancelled) return;
        if (feedbackContextRef.current !== calibrationContextAtLoad) return;
        setNarrativeCalibration(null);
      });

    return () => {
      cancelled = true;
    };
  }, [feedbackContextKey, repoId]);

  const refreshRepoTestRun = useCallback(async () => {
    const requestVersion = testRunRequestVersionRef.current + 1;
    testRunRequestVersionRef.current = requestVersion;

    if (model.source !== 'git') {
      setLoadingTests(false);
      return;
    }
    if (!repoId || !selectedCommitSha) {
      setRepoTestRun(null);
      setLoadingTests(false);
      return;
    }
    setLoadingTests(true);
    try {
      const run = await getLatestTestRunForCommit(repoId, selectedCommitSha);
      if (testRunRequestVersionRef.current !== requestVersion) return;
      setRepoTestRun(run);
    } catch {
      if (testRunRequestVersionRef.current !== requestVersion) return;
      setRepoTestRun(null);
    } finally {
      if (testRunRequestVersionRef.current === requestVersion) {
        setLoadingTests(false);
      }
    }
  }, [model.source, repoId, selectedCommitSha]);

  useEffect(() => {
    refreshRepoTestRun();
  }, [refreshRepoTestRun]);

  const testRun = model.source === 'demo' ? demoTestRun : repoTestRun ?? undefined;

  // Preserve selection across model updates when possible.
  useEffect(() => {
    setSelectedNodeId((prev) => {
      if (prev && model.timeline.some((node) => node.id === prev)) return prev;
      return defaultSelectedId;
    });
  }, [defaultSelectedId, model.timeline]);

  useEffect(() => {
    const repoRoot = model.meta?.repoPath;
    if (!repoRoot) {
      setGithubContext({ status: 'empty', entries: [] });
      return;
    }
    if (!githubConnectorEnabled) {
      setGithubContext({ status: 'disabled', entries: [] });
      return;
    }

    let cancelled = false;
    setGithubContext((prev) => ({ ...prev, status: 'loading', error: undefined }));
    loadGitHubContext(repoRoot)
      .then((state) => {
        if (cancelled) return;
        setGithubContext(state);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setGithubContext({
          status: 'error',
          entries: [],
          error: message,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [githubConnectorEnabled, model.meta?.repoPath]);

  useEffect(() => {
    void branchScopeKey;
    setFeedbackActorRole('developer');
    setObservability({
      layerSwitchedCount: 0,
      evidenceOpenedCount: 0,
      fallbackUsedCount: 0,
      killSwitchTriggeredCount: 0,
    });
  }, [branchScopeKey]);

  useEffect(() => {
    void branchScopeKey;
    pulsedCommits.current.clear();
    setPulseCommitId(null);
  }, [branchScopeKey]);

  useEffect(() => {
    if (!repoId) return;
    const key = `${repoId}:${model.meta?.branchName ?? 'unknown'}`;
    if (narrativeViewedKeyRef.current === key) return;
    narrativeViewedKeyRef.current = key;
    const viewInstanceId = createNarrativeViewInstanceId(repoId, model.meta?.branchName);
    narrativeViewInstanceIdRef.current = viewInstanceId;

    trackNarrativeEvent('narrative_viewed', {
      branch: model.meta?.branchName,
      detailLevel: effectiveDetailLevel,
      confidence: narrative.confidence,
      viewInstanceId,
    });
  }, [effectiveDetailLevel, model.meta?.branchName, narrative.confidence, repoId]);

  const bumpObservability = useCallback((kind: keyof Omit<NarrativeObservabilityMetrics, 'lastEventAtISO'>) => {
    setObservability((prev) => ({
      ...prev,
      [kind]: prev[kind] + 1,
      lastEventAtISO: new Date().toISOString(),
    }));
  }, []);

  useEffect(() => {
    const key = `${model.meta?.branchName ?? 'unknown'}:${rolloutReport.status}:${rolloutReport.averageScore}`;
    if (rolloutTelemetryKeyRef.current === key) return;
    rolloutTelemetryKeyRef.current = key;

    trackNarrativeEvent('rollout_scored', {
      branch: model.meta?.branchName,
      confidence: narrative.confidence,
      rolloutStatus: rolloutReport.status,
      score: rolloutReport.averageScore,
    });
  }, [model.meta?.branchName, narrative.confidence, rolloutReport.averageScore, rolloutReport.status]);

  useEffect(() => {
    if (!killSwitchActive) {
      killSwitchReasonRef.current = null;
      return;
    }

    const reason = criticalRule?.id ?? 'rollback_guard';
    if (killSwitchReasonRef.current === reason) return;
    killSwitchReasonRef.current = reason;
    bumpObservability('killSwitchTriggeredCount');

    trackNarrativeEvent('kill_switch_triggered', {
      branch: model.meta?.branchName,
      confidence: narrative.confidence,
      rolloutStatus: rolloutReport.status,
      reason,
    });
  }, [
    bumpObservability,
    criticalRule?.id,
    killSwitchActive,
    model.meta?.branchName,
    narrative.confidence,
    rolloutReport.status,
  ]);

  useEffect(() => {
    if (!selectedNodeId) {
      setFiles([]);
      selectFile(null);
      setLoadingFiles(false);
      return;
    }
    const guard = createRequestGuard();

    setLoadingFiles(true);
    setError(null);

    loadFilesForNode(selectedNodeId)
      .then((f) => {
        if (!guard.isActive()) return;

        setFiles(f);
        if (!selectedFile && f[0]?.path) {
          selectFile(f[0].path);
        }
      })
      .catch((e: unknown) => {
        if (!guard.isActive()) return;

        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setActionError(`Unable to load files for selected node: ${message}`);
        setFiles([]);
        selectFile(null);
      })
      .finally(() => {
        if (!guard.isActive()) return;
        setLoadingFiles(false);
      });

    return guard.cancel;
  }, [createRequestGuard, selectedNodeId, loadFilesForNode, selectFile, selectedFile, setActionError]);

  useEffect(() => {
    if (!selectedNodeId || !selectedFile) {
      setLoadingDiff(false);
      setDiffText(null);
      return;
    }
    const guard = createRequestGuard();

    setLoadingDiff(true);
    setError(null);

    loadDiffForFile(selectedNodeId, selectedFile)
      .then((d) => {
        if (!guard.isActive()) return;
        setDiffText(d || '(no diff)');
      })
      .catch((e: unknown) => {
        if (!guard.isActive()) return;

        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setActionError(`Unable to load diff for selected file: ${message}`);
        setDiffText(null);
      })
      .finally(() => {
        if (!guard.isActive()) return;
        setLoadingDiff(false);
      });

    return guard.cancel;
  }, [createRequestGuard, selectedNodeId, selectedFile, loadDiffForFile, setActionError]);

  useEffect(() => {
    if (!selectedNodeId || !selectedFile || !selectedCommitSha) {
      setTraceRequestedForSelection(false);
      setTraceRanges([]);
      setLoadingTrace(false);
      return;
    }
    const guard = createRequestGuard();

    setTraceRequestedForSelection(true);
    setLoadingTrace(true);
    loadTraceRangesForFile(selectedNodeId, selectedFile)
      .then((ranges) => {
        if (!guard.isActive()) return;
        setTraceRanges(ranges);
      })
      .catch((e: unknown) => {
        if (!guard.isActive()) return;

        const message = e instanceof Error ? e.message : String(e);
        setActionError(`Unable to load trace ranges for selected file: ${message}`);
        setTraceRanges([]);
      })
      .finally(() => {
        if (!guard.isActive()) return;
        setLoadingTrace(false);
      });

    return guard.cancel;
  }, [createRequestGuard, selectedCommitSha, selectedNodeId, selectedFile, loadTraceRangesForFile, setActionError]);

  // Pulse commit badges when a new session-linked commit is first observed.
  useEffect(() => {
    const linkedCommitIds = model.timeline
      .filter((node) => node.badges?.some((badge) => badge.type === 'session'))
      .map((node) => node.id);
    const unpulsedCommitIds = linkedCommitIds.filter((id) => !pulsedCommits.current.has(id));

    if (unpulsedCommitIds.length === 0) return;

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const pulseGapMs = 1800;
    const pulseDurationMs = 1600;

    unpulsedCommitIds.forEach((id, index) => {
      const startDelayMs = index * pulseGapMs;
      const startPulseTimer = setTimeout(() => {
        pulsedCommits.current.add(id);
        setPulseCommitId(id);

        const clearPulseTimer = setTimeout(() => {
          setPulseCommitId((current) => (current === id ? null : current));
        }, pulseDurationMs);
        timers.push(clearPulseTimer);
      }, startDelayMs);
      timers.push(startPulseTimer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [model.timeline]);

  const handleFileClickFromSession = (path: string) => {
    const fileExists = files.some((f) => f.path === path);
    if (fileExists) {
      selectFile(path);
    }
  };

  const handleFileClickFromTest = (path: string) => {
    handleFileClickFromSession(path);
  };

  const handleCommitClickFromSession = (commitSha: string) => {
    setTrackingSettledNodeId(null);
    setSelectedNodeId(commitSha);
  };

  const handleSelectNode = useCallback((nodeId: string) => {
    setTrackingSettledNodeId(null);
    setSelectedNodeId(nodeId);
  }, []);

  const handleDetailLevelChange = useCallback((level: NarrativeDetailLevel) => {
    if (killSwitchActive && level !== 'diff') {
      return;
    }
    if (level === detailLevel) return;
    setDetailLevel(level);
    bumpObservability('layerSwitchedCount');
    trackNarrativeEvent('layer_switched', {
      branch: model.meta?.branchName,
      detailLevel: level,
      confidence: narrative.confidence,
    });
  }, [bumpObservability, detailLevel, killSwitchActive, model.meta?.branchName, narrative.confidence]);

  const handleOpenRawDiff = useCallback(() => {
    setDetailLevel('diff');
    if (!selectedFile && files[0]?.path) {
      selectFile(files[0].path);
    }
    bumpObservability('fallbackUsedCount');
    trackNarrativeEvent('fallback_used', {
      branch: model.meta?.branchName,
      detailLevel: 'diff',
      confidence: narrative.confidence,
      viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
    });
  }, [bumpObservability, files, model.meta?.branchName, narrative.confidence, selectFile, selectedFile]);

  const handleOpenEvidence = useCallback((link: NarrativeEvidenceLink) => {
    if (link.commitSha) {
      setTrackingSettledNodeId(null);
      setSelectedNodeId(link.commitSha);
    }
    if (shouldRouteEvidenceToRawDiff(link)) {
      handleOpenRawDiff();
    }
    if (link.filePath) {
      selectFile(link.filePath);
    }
    bumpObservability('evidenceOpenedCount');
    trackNarrativeEvent('evidence_opened', {
      branch: model.meta?.branchName,
      detailLevel: effectiveDetailLevel,
      evidenceKind: link.kind,
      confidence: narrative.confidence,
    });
  }, [bumpObservability, effectiveDetailLevel, handleOpenRawDiff, model.meta?.branchName, narrative.confidence, selectFile]);

  const handleAudienceChange = useCallback((nextAudience: StakeholderAudience) => {
    if (nextAudience === audience) return;
    setAudience(nextAudience);
    trackNarrativeEvent('audience_switched', {
      branch: model.meta?.branchName,
      detailLevel: effectiveDetailLevel,
      audience: nextAudience,
      confidence: narrative.confidence,
    });
  }, [audience, effectiveDetailLevel, model.meta?.branchName, narrative.confidence]);

  const handleFeedbackRoleChange = useCallback((role: NarrativeFeedbackActorRole) => {
    if (role === feedbackActorRole) return;
    setFeedbackActorRole(role);
  }, [feedbackActorRole]);

  const handleSubmitFeedback = useCallback(async (feedback: NarrativeFeedbackAction) => {
    if (!repoId) return;
    const branchName = model.meta?.branchName;
    if (!branchName) {
      setActionError('Unable to save narrative feedback: missing branch context.');
      return;
    }
    const feedbackContextAtSubmit = feedbackContextRef.current;
    try {
      const result = await submitNarrativeFeedback({
        repoId,
        branchName,
        action: feedback,
      });
      if (!isMountedRef.current) return;
      if (feedbackContextRef.current !== feedbackContextAtSubmit) return;
      if (calibrationEnabled) {
        setNarrativeCalibration(result.profile);
      }
      if (!result.inserted) return;
      trackNarrativeEvent('feedback_submitted', {
        branch: model.meta?.branchName,
        detailLevel: feedback.detailLevel,
        confidence: narrative.confidence,
        feedbackType: feedback.feedbackType,
        feedbackTargetKind: feedback.targetKind,
        feedbackActorRole: result.verifiedActorRole,
        viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      if (feedbackContextRef.current !== feedbackContextAtSubmit) return;
      const message = error instanceof Error ? error.message : String(error);
      setActionError(`Unable to save narrative feedback: ${message}`);
    }
  }, [model.meta?.branchName, narrative.confidence, repoId, setActionError]);

  const handleExportAgentTrace = () => {
    if (!selectedNodeId) return;
    onExportAgentTrace(selectedNodeId, files);
  };

  const handleRunOtlpSmokeTest = () => {
    if (!selectedNodeId) return;
    onRunOtlpSmokeTest(selectedNodeId, files);
  };

  const handleFireflyTrackingSettled = useCallback((payload: FireflyTrackingSettlePayload) => {
    if (!selectedNodeId) return;
    if (payload.selectedNodeId !== selectedNodeId) return;
    setTrackingSettledNodeId(payload.selectedNodeId);
  }, [selectedNodeId]);

  const { importJUnitForCommit } = useTestImport({
    repoRoot,
    repoId: repoId ?? 0,
    setRepoState: updateModel,
    setActionError,
  });

  const handleImportJUnit = async () => {
    if (model.source !== 'git') return;
    if (!repoId) return;
    if (!selectedCommitSha) return;
    await importJUnitForCommit(selectedCommitSha);
    await refreshRepoTestRun();
    firefly.triggerBurst('success');
  };

  const captureActivityProps = ingestStatus ? {
    enabled: ingestStatus.enabled,
    sourcesLabel: (() => {
      const out: string[] = [];
      if (discoveredSources?.claude?.length) out.push('Claude');
      if (discoveredSources?.cursor?.length) out.push('Cursor');
      if (discoveredSources?.codexLogs?.length) out.push('Codex');
      return out.join(', ');
    })(),
    issueCount: ingestStatus.errorCount,
    lastSeenISO: ingestStatus.lastImportAt,
    captureMode: ingestStatus.captureMode,
    captureModeMessage: ingestStatus.captureModeMessage,
    recent: ingestActivityRecent ?? [],
    onToggle: onToggleAutoIngest,
    onRequestAll: onRequestIngestActivityAll,
  } : null;

  const ingestIssuesProps = ingestIssues && onDismissIngestIssue
    ? { issues: ingestIssues, onDismiss: onDismissIngestIssue }
    : null;

  const rightPanelProps: ComponentProps<typeof RightPanelTabs> = {
    // Session
    sessionExcerpts: model.sessionExcerpts,
    selectedFile,
    onFileClick: handleFileClickFromSession,
    onUnlinkSession,
    onCommitClick: handleCommitClickFromSession,
    selectedCommitId: selectedNodeId,
    // Attribution
    traceSummary: selectedNodeId ? model.traceSummaries?.byCommit[selectedNodeId] : undefined,
    traceStatus: model.traceStatus,
    hasFiles: files.length > 0,
    onExportAgentTrace: handleExportAgentTrace,
    onRunOtlpSmokeTest: handleRunOtlpSmokeTest,
    // Settings
    traceConfig: model.traceConfig,
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
    githubConnectorState: githubContext,
    // Tests
    testRun,
    onTestFileClick: handleFileClickFromTest,
    loadingTests,
    onImportJUnit: handleImportJUnit,
    repoRoot,
    changedFiles: files.map((f) => f.path),
    // Diff
    selectedCommitSha,
    repoId: model.meta?.repoId,
    indexedCommitShas: model.timeline.filter((n) => n.type === 'commit').map((n) => n.id),
    diffText,
    loadingDiff: loadingDiff || loadingTrace,
    traceRanges,
    // Firefly
    fireflyEnabled: firefly.enabled,
    onToggleFirefly: firefly.toggle,
  };

  const timelineProps: ComponentProps<typeof Timeline> = {
    nodes: model.timeline,
    selectedId: selectedNodeId,
    onSelect: handleSelectNode,
    pulseCommitId,
    fireflyEvent: firefly.event,
    fireflyDisabled: !firefly.enabled,
    fireflyBurstType: firefly.burstType,
    onFireflyTrackingSettled: handleFireflyTrackingSettled,
  };

  return (
    <BranchViewLayout
      isExitingFilteredView={isExitingFilteredView}
      ingestToast={ingestToast}
      stage={stage}
      model={model}
      headerViewModel={headerViewModel}
      onClearFilter={onClearFilter}
      narrativePanelProps={{
        narrative,
        projections,
        audience,
        detailLevel: effectiveDetailLevel,
        feedbackActorRole,
        killSwitchActive,
        killSwitchReason: criticalRule?.rationale,
        onAudienceChange: handleAudienceChange,
        onFeedbackActorRoleChange: handleFeedbackRoleChange,
        onDetailLevelChange: handleDetailLevelChange,
        onSubmitFeedback: handleSubmitFeedback,
        onOpenEvidence: handleOpenEvidence,
        onOpenRawDiff: handleOpenRawDiff,
      }}
      governanceProps={{ report: rolloutReport, observability }}
      archaeologyProps={{ entries: archaeologyEntries, onOpenEvidence: handleOpenEvidence }}
      captureActivityProps={captureActivityProps}
      ingestIssuesProps={ingestIssuesProps}
      selectedNode={selectedNode}
      loadingFiles={loadingFiles}
      files={files}
      selectedNodeId={selectedNodeId}
      actionError={actionError}
      onDismissActionError={onDismissActionError}
      rightPanelProps={rightPanelProps}
      timelineProps={timelineProps}
    />
  );
}

export function BranchView(props: BranchViewProps) {
  return (
    <FileSelectionProvider>
      <BranchViewInner {...props} />
    </FileSelectionProvider>
  );
}
