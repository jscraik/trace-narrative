import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFileSelection } from '../../../core/context/FileSelectionContext';
import { testRuns } from '../../../core/demo/nearbyGridDemo';
import { getLatestTestRunForCommit } from '../../../core/repo/testRuns';
import {
  createTelemetryBranchScope,
  setNarrativeTelemetryRuntimeConfig,
  trackNarrativeEvent,
} from '../../../core/telemetry/narrativeTelemetry';
import type {
  NarrativeDetailLevel,
  NarrativeEvidenceLink,
  NarrativeConfidenceTier,
  TestRun,
} from '../../../core/types';
import { useTraceSignal } from '../../../hooks/useTraceSignal';
import { useTestImport } from '../../../hooks/useTestImport';
import {
  createBranchHeaderRequestIdentityKey,
  deriveBranchHeaderViewModel,
  deriveLegacyBranchHeaderViewModel,
} from '../../components/branchHeaderMapper';
import type { RightPanelTabs } from '../../components/RightPanelTabs';
import type { TraceSignalTrackingSettlePayload, Timeline } from '../../components/Timeline';
import type { BranchViewLayout } from '../BranchViewLayout';
import { TIMING } from '../branchView.constants';
import { shouldRouteEvidenceToRawDiff } from '../branchViewEvidence';
import type { BranchViewProps } from '../branchView.types';
import { useBranchAskWhyState } from './useBranchAskWhyState';
import { useBranchCommitPulse } from './useBranchCommitPulse';
import { useBranchFeedbackHandler } from './useBranchFeedbackHandler';
import { useBranchNarrativeState } from './useBranchNarrativeState';
import { useBranchTelemetry } from './useBranchTelemetry';
import { useBranchSelectionData } from './useBranchSelectionData';
import type { CaptureReliabilityStatus } from '../../../core/tauri/ingestConfig';
import type { TrustState } from '../../components/TrustStateIndicator';

/**
 * Derive the trust state from capture reliability status for the TrustStateIndicator.
 * Maps the internal app server state to the UI-facing trust state.
 */
function deriveTrustStateFromCaptureStatus(status: CaptureReliabilityStatus | null | undefined): TrustState {
  if (!status) return 'none';

  // Map FAILURE mode to trust_paused
  if (status.mode === 'FAILURE') return 'trust_paused';

  // Map degraded streaming or unhealthy stream to trust_paused
  if (status.mode === 'DEGRADED_STREAMING' || (status.streamExpected && !status.streamHealthy)) {
    return 'trust_paused';
  }

  // Map hybrid active with healthy stream to live_trusted
  if (status.mode === 'HYBRID_ACTIVE' && status.streamHealthy) {
    return 'live_trusted';
  }

  // Default to hydrating for otel-only mode or when stream is expected but not yet confirmed
  if (status.streamExpected) {
    return 'hydrating';
  }

  return 'none';
}

export function useBranchViewController(props: BranchViewProps): ComponentProps<typeof BranchViewLayout> {
  const {
    model,
    onModeChange,
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
    if (head && model.timeline.some((node) => node.id === head)) return head;
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

  const [trackingSettledNodeId, setTrackingSettledNodeId] = useState<string | null>(null);

  const headerDerivationDurationMsRef = useRef(0);
  const narrativeViewInstanceIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const activeBranchScopeRef = useRef<string | null>(null);
  const feedbackContextRef = useRef<string>('');
  const firstWinAttemptSequenceRef = useRef(0);
  const firstWinAttemptContextRef = useRef<string>('');
  const firstWinAttemptIdRef = useRef<string>('attempt:0');
  const completedAttemptIdsRef = useRef<Set<string>>(new Set());

  const calibrationEnabled = (import.meta.env.VITE_NARRATIVE_CALIBRATION_V1 ?? 'true') !== 'false';
  const branchScopeKey = `${model.meta?.repoPath ?? ''}:${model.meta?.branchName ?? ''}`;
  const telemetryBranchScope = useMemo(
    () => createTelemetryBranchScope(model.meta?.repoId ?? null, model.meta?.branchName),
    [model.meta?.branchName, model.meta?.repoId]
  );
  activeBranchScopeRef.current = branchScopeKey;

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
  const firstWinAttemptId = useMemo(() => {
    const contextKey = `${telemetryBranchScope}:${selectedNodeId ?? 'none'}`;
    if (firstWinAttemptContextRef.current !== contextKey) {
      firstWinAttemptContextRef.current = contextKey;
      firstWinAttemptSequenceRef.current += 1;
      firstWinAttemptIdRef.current = `${contextKey}:n${firstWinAttemptSequenceRef.current}`;
      if (completedAttemptIdsRef.current.size > 128) {
        completedAttemptIdsRef.current.clear();
      }
    }
    return firstWinAttemptIdRef.current;
  }, [selectedNodeId, telemetryBranchScope]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    const consentGranted = ingestConfig?.consent.codexTelemetryGranted;
    setNarrativeTelemetryRuntimeConfig({
      consentGranted: consentGranted === true,
    });
  }, [ingestConfig?.consent.codexTelemetryGranted]);

  // Narrative state extracted to dedicated hook
  const {
    detailLevel,
    audience,
    feedbackActorRole,
    githubContext,
    observability,
    narrative,
    recallLaneItems,
    projections,
    archaeologyEntries,
    rolloutReport,
    effectiveDetailLevel,
    killSwitchActive,
    criticalRule,
    setDetailLevel,
    setAudience,
    setFeedbackActorRole,
    setNarrativeCalibration,
    bumpObservability,
  } = useBranchNarrativeState({
    model,
    calibrationEnabled,
    githubConnectorEnabled,
    branchScopeKey,
  });

  const repoId = model.meta?.repoId ?? null;
  const feedbackContextKey = `${repoId ?? 'none'}:${model.meta?.branchName ?? 'unknown'}`;

  // Update feedback context ref for stale-guard checks
  useEffect(() => {
    feedbackContextRef.current = feedbackContextKey;
  }, [feedbackContextKey]);

  // Feedback handlers extracted to dedicated hook
  const {
    handleSubmitFeedback,
    handleFeedbackRoleChange,
    handleAudienceChange,
  } = useBranchFeedbackHandler({
    repoId,
    branchName: model.meta?.branchName,
    narrativeConfidence: narrative.confidence,
    effectiveDetailLevel,
    calibrationEnabled,
    feedbackActorRole,
    audience,
    narrativeViewInstanceIdRef,
    isMountedRef,
    feedbackContextRef,
    setActionError,
    setNarrativeCalibration,
    setFeedbackActorRole,
    setAudience,
  });

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

  const reportTraceSignalError = useCallback((message: string) => {
    setActionError(message);
  }, [setActionError]);

  const traceSignal = useTraceSignal({
    selectedNodeId,
    selectedCommitSha,
    hasSelectedFile: Boolean(selectedFile),
    trackingSettled: selectedNodeId !== null && trackingSettledNodeId === selectedNodeId,
    loadingFiles,
    loadingDiff,
    loadingTrace,
    traceRequestedForSelection,
    traceSummary: selectedCommitSha ? model.traceSummaries?.byCommit[selectedCommitSha] : undefined,
    onPersistenceError: reportTraceSignalError,
  });

  const demoTestRun = useMemo((): TestRun | undefined => {
    if (model.source !== 'demo') return undefined;
    const node = model.timeline.find((item) => item.id === selectedNodeId);
    const id = node?.testRunId;
    if (!id) return undefined;
    return testRuns[id];
  }, [model, selectedNodeId]);

  const [repoTestRun, setRepoTestRun] = useState<TestRun | null>(null);
  const [loadingTests, setLoadingTests] = useState(false);
  const testRunRequestVersionRef = useRef(0);

  const repoRoot = model.meta?.repoPath ?? '';

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
    void refreshRepoTestRun();
  }, [refreshRepoTestRun]);

  const testRun = model.source === 'demo' ? demoTestRun : repoTestRun ?? undefined;

  useEffect(() => {
    setSelectedNodeId((prev) => {
      if (prev && model.timeline.some((node) => node.id === prev)) return prev;
      return defaultSelectedId;
    });
  }, [defaultSelectedId, model.timeline]);

  // Commit pulse animation extracted to dedicated hook
  const { pulseCommitId } = useBranchCommitPulse({
    timeline: model.timeline,
    branchScopeKey,
  });

  // Telemetry effects extracted to dedicated hook
  useBranchTelemetry({
    firstWinAttemptId,
    requestIdentityKey,
    branchName: model.meta?.branchName,
    branchScope: telemetryBranchScope,
    source: model.source,
    headerViewModel,
    headerReasonCode,
    headerDerivationDurationMs: headerDerivationDurationMsRef.current,
    repoId,
    selectedNodeId,
    selectedNodeExists: selectedNodeId ? model.timeline.some((node) => node.id === selectedNodeId) : false,
    selectedFile,
    effectiveDetailLevel,
    narrative,
    rolloutReport,
    killSwitchActive,
    criticalRule,
    bumpObservability,
    narrativeViewInstanceIdRef,
  });
  const emitFirstWinCompleted = useCallback((eventOutcome: 'success' | 'fallback' | 'failed' | 'stale_ignored', itemId?: string) => {
    const attemptId = firstWinAttemptId;
    if (completedAttemptIdsRef.current.has(attemptId)) {
      return;
    }
    completedAttemptIdsRef.current.add(attemptId);
    trackNarrativeEvent('first_win_completed', {
      attemptId,
      branch: model.meta?.branchName,
      branchScope: telemetryBranchScope,
      detailLevel: effectiveDetailLevel,
      confidence: narrative.confidence,
      viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
      itemId,
      funnelStep: 'evidence_ready',
      eventOutcome,
      funnelSessionId: `${attemptId}:complete`,
    });
  }, [
    effectiveDetailLevel,
    firstWinAttemptId,
    model.meta?.branchName,
    narrative.confidence,
    telemetryBranchScope,
  ]);

  const handleFileClickFromSession = useCallback((path: string) => {
    const fileExists = files.some((file) => file.path === path);
    if (fileExists) {
      selectFile(path);
    }
  }, [files, selectFile]);

  const handleCommitClickFromSession = useCallback((commitSha: string) => {
    setTrackingSettledNodeId(null);
    setSelectedNodeId(commitSha);
  }, []);

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
      branchScope: telemetryBranchScope,
      detailLevel: level,
      confidence: narrative.confidence,
      eventOutcome: 'success',
    });
  }, [
    bumpObservability,
    detailLevel,
    killSwitchActive,
    model.meta?.branchName,
    narrative.confidence,
    setDetailLevel,
    telemetryBranchScope,
  ]);

  const handleOpenRawDiff = useCallback((laneContext?: {
    source?: 'recall_lane';
    recallLaneItemId?: string;
    recallLaneConfidenceBand?: NarrativeConfidenceTier;
    fallbackItemId?: string;
    targetCommitSha?: string;
  }) => {
    if (activeBranchScopeRef.current !== branchScopeKey) {
      return;
    }

    const targetCommitSha = laneContext?.targetCommitSha;
    const switchedCommit = Boolean(targetCommitSha && targetCommitSha !== selectedNodeId);
    const activeCommitSha = targetCommitSha ?? selectedNodeId ?? undefined;

    setDetailLevel('diff');
    if (switchedCommit && targetCommitSha) {
      setTrackingSettledNodeId(null);
      setSelectedNodeId(targetCommitSha);
      selectFile(null);
    } else if (!selectedFile && files[0]?.path) {
      selectFile(files[0].path);
    }
    bumpObservability('fallbackUsedCount');
    trackNarrativeEvent('fallback_used', {
      attemptId: firstWinAttemptId,
      branch: model.meta?.branchName,
      branchScope: telemetryBranchScope,
      detailLevel: 'diff',
      confidence: narrative.confidence,
      source: laneContext?.source === 'recall_lane' ? 'recall_lane' : model.source,
      recallLaneItemId: laneContext?.recallLaneItemId,
      recallLaneConfidenceBand: laneContext?.recallLaneConfidenceBand,
      viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
      itemId: laneContext?.fallbackItemId ?? laneContext?.recallLaneItemId ?? activeCommitSha,
      funnelStep: 'evidence_ready',
      eventOutcome: 'fallback',
      funnelSessionId: `${telemetryBranchScope}:${activeCommitSha ?? 'none'}:${selectedFile ?? 'no-file'}`,
    });
    emitFirstWinCompleted(
      'fallback',
      laneContext?.fallbackItemId ?? laneContext?.recallLaneItemId ?? activeCommitSha
    );
  }, [
    bumpObservability,
    emitFirstWinCompleted,
    files,
    firstWinAttemptId,
    model.meta?.branchName,
    model.source,
    narrative.confidence,
    selectFile,
    selectedFile,
    selectedNodeId,
    branchScopeKey,
    setDetailLevel,
    telemetryBranchScope,
  ]);

  const handleOpenEvidence = useCallback(
    (
      link: NarrativeEvidenceLink,
      laneContext?: {
        source?: 'recall_lane';
        recallLaneItemId?: string;
        recallLaneConfidenceBand?: NarrativeConfidenceTier;
      }
    ) => {
      if (activeBranchScopeRef.current !== branchScopeKey) {
        return;
      }

      if (link.commitSha) {
        setTrackingSettledNodeId(null);
        setSelectedNodeId(link.commitSha);
      }
      const routedToRawDiff = shouldRouteEvidenceToRawDiff(link);
      if (routedToRawDiff) {
        handleOpenRawDiff({
          ...laneContext,
          fallbackItemId: link.commitSha ?? link.id,
          targetCommitSha: link.commitSha,
        });
      }
      if (link.filePath) {
        selectFile(link.filePath);
      }
      bumpObservability('evidenceOpenedCount');
      trackNarrativeEvent('evidence_opened', {
        attemptId: firstWinAttemptId,
        branch: model.meta?.branchName,
        detailLevel: effectiveDetailLevel,
        evidenceKind: link.kind,
        confidence: narrative.confidence,
        source: laneContext?.source === 'recall_lane' ? 'recall_lane' : model.source,
        recallLaneItemId: laneContext?.recallLaneItemId,
        recallLaneConfidenceBand: laneContext?.recallLaneConfidenceBand,
        viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
        branchScope: telemetryBranchScope,
        itemId: link.id,
        funnelStep: 'evidence_ready',
        eventOutcome: routedToRawDiff ? 'fallback' : 'success',
        funnelSessionId: `${telemetryBranchScope}:${link.id}:${selectedNodeId ?? 'none'}`,
      });
      if (!routedToRawDiff) {
        emitFirstWinCompleted('success', link.id);
      }
    },
    [
      bumpObservability,
      branchScopeKey,
      effectiveDetailLevel,
      emitFirstWinCompleted,
      firstWinAttemptId,
      handleOpenRawDiff,
      model.meta?.branchName,
      model.source,
      narrative.confidence,
      selectFile,
      selectedNodeId,
      telemetryBranchScope,
    ]
  );

  const handleExportAgentTrace = useCallback(() => {
    if (!selectedNodeId) return;
    onExportAgentTrace(selectedNodeId, files);
  }, [files, onExportAgentTrace, selectedNodeId]);

  const handleRunOtlpSmokeTest = useCallback(() => {
    if (!selectedNodeId) return;
    onRunOtlpSmokeTest(selectedNodeId, files);
  }, [files, onRunOtlpSmokeTest, selectedNodeId]);

  const handleTraceSignalTrackingSettled = useCallback((payload: TraceSignalTrackingSettlePayload) => {
    if (!selectedNodeId) return;
    if (payload.selectedNodeId !== selectedNodeId) return;
    setTrackingSettledNodeId(payload.selectedNodeId);
  }, [selectedNodeId]);

  // Handle deep-linking from shared narrative surfaces
  useEffect(() => {
    if (!props.pendingAction) return;

    if (props.pendingAction.type === 'open_evidence') {
      const { evidenceId } = props.pendingAction;
      const link = narrative.evidenceLinks.find((l) => l.id === evidenceId);

      if (link) {
        handleOpenEvidence(link);
      }
      props.onActionProcessed?.();
      return;
    }

    if (props.pendingAction.type === 'open_raw_diff') {
      const { commitSha } = props.pendingAction;
      handleOpenRawDiff({
        fallbackItemId: commitSha,
        targetCommitSha: commitSha,
      });
      props.onActionProcessed?.();
    }
  }, [props.pendingAction, narrative.evidenceLinks, handleOpenEvidence, handleOpenRawDiff, props.onActionProcessed]);

  // Ask-Why state extracted to dedicated hook
  const { askWhyState, handleSubmitAskWhy, handleOpenAskWhyCitation } = useBranchAskWhyState({
    attemptId: firstWinAttemptId,
    branchScopeKey,
    branchScope: telemetryBranchScope,
    branchName: model.meta?.branchName,
    repoId: model.meta?.repoId ?? null,
    narrative,
    isMountedRef,
    activeBranchScopeRef,
    handleOpenEvidence,
    emitFirstWinCompleted,
  });

  const { importJUnitForCommit } = useTestImport({
    repoRoot,
    repoId: repoId ?? 0,
    setRepoState: updateModel,
    setActionError,
  });

  const handleImportJUnit = useCallback(async () => {
    if (model.source !== 'git') return;
    if (!repoId) return;
    if (!selectedCommitSha) return;
    await importJUnitForCommit(selectedCommitSha);
    await refreshRepoTestRun();
    traceSignal.triggerBurst('success');
  }, [traceSignal, importJUnitForCommit, model.source, refreshRepoTestRun, repoId, selectedCommitSha]);

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
    sessionExcerpts: model.sessionExcerpts,
    selectedFile,
    onFileClick: handleFileClickFromSession,
    onUnlinkSession,
    onCommitClick: handleCommitClickFromSession,
    selectedCommitId: selectedNodeId,
    traceSummary: selectedNodeId ? model.traceSummaries?.byCommit[selectedNodeId] : undefined,
    traceStatus: model.traceStatus,
    hasFiles: files.length > 0,
    onExportAgentTrace: handleExportAgentTrace,
    onRunOtlpSmokeTest: handleRunOtlpSmokeTest,
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
    testRun,
    onTestFileClick: handleFileClickFromSession,
    loadingTests,
    onImportJUnit: handleImportJUnit,
    repoRoot,
    changedFiles: files.map((file) => file.path),
    selectedCommitSha,
    repoId: model.meta?.repoId,
    indexedCommitShas: model.timeline.filter((node) => node.type === 'commit').map((node) => node.id),
    diffText,
    loadingDiff: loadingDiff || loadingTrace,
    traceRanges,
    fireflyEnabled: traceSignal.enabled,
    onToggleFirefly: traceSignal.toggle,
  };

  const timelineProps: ComponentProps<typeof Timeline> = {
    nodes: model.timeline,
    selectedId: selectedNodeId,
    onSelect: handleSelectNode,
    pulseCommitId,
    traceSignalEvent: traceSignal.event,
    traceSignalDisabled: !traceSignal.enabled,
    traceSignalBurstType: traceSignal.burstType,
    onTraceSignalTrackingSettled: handleTraceSignalTrackingSettled,
  };

  return {
    isExitingFilteredView,
    ingestToast,
    stage,
    model,
    headerViewModel,
    onClearFilter,
    narrativePanelProps: {
      narrative,
      projections,
      audience,
      detailLevel: effectiveDetailLevel,
      feedbackActorRole,
      killSwitchActive,
      killSwitchReason: criticalRule?.rationale,
      recallLaneItems,
      askWhyState,
      onAudienceChange: handleAudienceChange,
      onFeedbackActorRoleChange: handleFeedbackRoleChange,
      onDetailLevelChange: handleDetailLevelChange,
      onSubmitFeedback: handleSubmitFeedback,
      onOpenEvidence: handleOpenEvidence,
      onOpenRawDiff: handleOpenRawDiff,
      onSubmitAskWhy: handleSubmitAskWhy,
      onOpenAskWhyCitation: handleOpenAskWhyCitation,
      // Phase 4: Trust-state props for recovery UI
      trustState: captureReliabilityStatus?.appServer
        ? deriveTrustStateFromCaptureStatus(captureReliabilityStatus)
        : 'none',
      activeThreadId: captureReliabilityStatus?.appServer?.lastTransitionAtIso
        ? `snapshot:${captureReliabilityStatus.appServer.lastTransitionAtIso}`
        : null,
      captureReliabilityStatus,
      codexAppServerStatus: captureReliabilityStatus?.appServer ?? null,
      onRetryHydrate: onRefreshCaptureReliability,
      onClearStaleState: onRefreshCaptureReliability,
    },
    governanceProps: { report: rolloutReport, observability },
    archaeologyProps: { entries: archaeologyEntries, onOpenEvidence: handleOpenEvidence },
    captureActivityProps,
    ingestIssuesProps,
    selectedNode,
    loadingFiles,
    files,
    selectedNodeId,
    actionError,
    onDismissActionError,
    rightPanelProps,
    timelineProps,
    captureReliabilityStatus,
    onModeChange,
  };
}
