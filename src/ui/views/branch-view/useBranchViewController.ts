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
import { useFirefly } from '../../../hooks/useFirefly';
import { useTestImport } from '../../../hooks/useTestImport';
import {
  createBranchHeaderRequestIdentityKey,
  deriveBranchHeaderViewModel,
  deriveLegacyBranchHeaderViewModel,
} from '../../components/branchHeaderMapper';
import type { RightPanelTabs } from '../../components/RightPanelTabs';
import type { FireflyTrackingSettlePayload, Timeline } from '../../components/Timeline';
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

export function useBranchViewController(props: BranchViewProps): ComponentProps<typeof BranchViewLayout> {
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

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    const consentGranted = ingestConfig?.consent.codexTelemetryGranted;
    setNarrativeTelemetryRuntimeConfig({
      consentGranted: consentGranted === undefined ? true : consentGranted,
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
    requestIdentityKey,
    branchName: model.meta?.branchName,
    branchScope: telemetryBranchScope,
    source: model.source,
    headerViewModel,
    headerReasonCode,
    headerDerivationDurationMs: headerDerivationDurationMsRef.current,
    repoId,
    selectedNodeId,
    selectedFile,
    effectiveDetailLevel,
    narrative,
    rolloutReport,
    killSwitchActive,
    criticalRule,
    bumpObservability,
    narrativeViewInstanceIdRef,
  });

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
  }) => {
    if (activeBranchScopeRef.current !== branchScopeKey) {
      return;
    }

    setDetailLevel('diff');
    if (!selectedFile && files[0]?.path) {
      selectFile(files[0].path);
    }
    bumpObservability('fallbackUsedCount');
    trackNarrativeEvent('fallback_used', {
      branch: model.meta?.branchName,
      branchScope: telemetryBranchScope,
      detailLevel: 'diff',
      confidence: narrative.confidence,
      source: laneContext?.source === 'recall_lane' ? 'recall_lane' : model.source,
      recallLaneItemId: laneContext?.recallLaneItemId,
      recallLaneConfidenceBand: laneContext?.recallLaneConfidenceBand,
      viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
      itemId: laneContext?.recallLaneItemId ?? selectedNodeId ?? undefined,
      funnelStep: 'evidence_requested',
      eventOutcome: 'fallback',
      funnelSessionId: `${telemetryBranchScope}:${selectedNodeId ?? 'none'}:${selectedFile ?? 'no-file'}`,
    });
  }, [
    bumpObservability,
    files,
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
        handleOpenRawDiff(laneContext);
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
        source: laneContext?.source === 'recall_lane' ? 'recall_lane' : model.source,
        recallLaneItemId: laneContext?.recallLaneItemId,
        recallLaneConfidenceBand: laneContext?.recallLaneConfidenceBand,
        viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
        branchScope: telemetryBranchScope,
        itemId: link.id,
        funnelStep: 'evidence_requested',
        eventOutcome: routedToRawDiff ? 'fallback' : 'success',
        funnelSessionId: `${telemetryBranchScope}:${link.id}:${selectedNodeId ?? 'none'}`,
      });
    },
    [
      bumpObservability,
      branchScopeKey,
      effectiveDetailLevel,
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

  const handleFireflyTrackingSettled = useCallback((payload: FireflyTrackingSettlePayload) => {
    if (!selectedNodeId) return;
    if (payload.selectedNodeId !== selectedNodeId) return;
    setTrackingSettledNodeId(payload.selectedNodeId);
  }, [selectedNodeId]);

  // Ask-Why state extracted to dedicated hook
  const { askWhyState, handleSubmitAskWhy, handleOpenAskWhyCitation } = useBranchAskWhyState({
    branchScopeKey,
    branchScope: telemetryBranchScope,
    branchName: model.meta?.branchName,
    repoId: model.meta?.repoId ?? null,
    narrative,
    isMountedRef,
    activeBranchScopeRef,
    handleOpenEvidence,
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
    firefly.triggerBurst('success');
  }, [firefly, importJUnitForCommit, model.source, refreshRepoTestRun, repoId, selectedCommitSha]);

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
  };
}
