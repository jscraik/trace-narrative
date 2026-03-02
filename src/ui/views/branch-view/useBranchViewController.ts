import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFileSelection } from '../../../core/context/FileSelectionContext';
import { testRuns } from '../../../core/demo/nearbyGridDemo';
import { buildRecallLane } from '../../../core/narrative/recallLane';
import { composeBranchNarrative } from '../../../core/narrative/composeBranchNarrative';
import { buildDecisionArchaeology } from '../../../core/narrative/decisionArchaeology';
import { evaluateNarrativeRollout } from '../../../core/narrative/rolloutGovernance';
import { buildStakeholderProjections } from '../../../core/narrative/stakeholderProjections';
import { loadGitHubContext } from '../../../core/repo/githubContext';
import { getNarrativeCalibrationProfile, submitNarrativeFeedback } from '../../../core/repo/narrativeFeedback';
import { getLatestTestRunForCommit } from '../../../core/repo/testRuns';
import { composeAskWhyAnswer } from '../../../core/narrative/causalRecall';
import {
  trackAskWhyAnswerViewed,
  trackAskWhyError,
  trackAskWhyEvidenceOpened,
  trackAskWhyFallbackUsed,
  trackAskWhySubmitted,
  trackNarrativeEvent,
  trackQualityRenderDecision,
} from '../../../core/telemetry/narrativeTelemetry';
import type {
  AskWhyCitation,
  AskWhyState,
  GitHubContextState,
  NarrativeCalibrationProfile,
  NarrativeDetailLevel,
  NarrativeEvidenceLink,
  NarrativeFeedbackAction,
  NarrativeFeedbackActorRole,
  NarrativeConfidenceTier,
  NarrativeObservabilityMetrics,
  StakeholderAudience,
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
import { TIMING, createNarrativeViewInstanceId } from '../branchView.constants';
import { shouldRouteEvidenceToRawDiff } from '../branchViewEvidence';
import type { BranchViewProps } from '../branchView.types';
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

  const pulsedCommits = useRef<Set<string>>(new Set());
  const [pulseCommitId, setPulseCommitId] = useState<string | null>(null);
  const [trackingSettledNodeId, setTrackingSettledNodeId] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<NarrativeDetailLevel>('summary');
  const [feedbackActorRole, setFeedbackActorRole] = useState<NarrativeFeedbackActorRole>('developer');
  const [narrativeCalibration, setNarrativeCalibration] = useState<NarrativeCalibrationProfile | null>(null);
  const [audience, setAudience] = useState<StakeholderAudience>('manager');
  const [githubContext, setGithubContext] = useState<GitHubContextState>({
    status: githubConnectorEnabled ? 'loading' : 'disabled',
    entries: [],
  });
  const [observability, setObservability] = useState<NarrativeObservabilityMetrics>({
    layerSwitchedCount: 0,
    evidenceOpenedCount: 0,
    fallbackUsedCount: 0,
    killSwitchTriggeredCount: 0,
  });
  const [askWhyState, setAskWhyState] = useState<AskWhyState>({ kind: 'idle' });

  const rolloutTelemetryKeyRef = useRef<string | null>(null);
  const askWhyRequestVersionRef = useRef(0);
  const killSwitchReasonRef = useRef<string | null>(null);
  const headerDecisionTelemetryKeyRef = useRef<string | null>(null);
  const headerDerivationDurationMsRef = useRef(0);
  const narrativeViewedKeyRef = useRef<string | null>(null);
  const narrativeViewInstanceIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const activeBranchScopeRef = useRef<string | null>(null);
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
  const recallLaneItems = useMemo(() => {
    return buildRecallLane(narrative, {
      maxItems: 3,
      confidenceFloor: 0,
    });
  }, [narrative]);
  const projections = useMemo(
    () =>
      buildStakeholderProjections({
        narrative,
        model,
        githubEntry: githubContext.entries[0],
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
  activeBranchScopeRef.current = branchScopeKey;

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
    void refreshRepoTestRun();
  }, [refreshRepoTestRun]);

  const testRun = model.source === 'demo' ? demoTestRun : repoTestRun ?? undefined;

  useEffect(() => {
    setSelectedNodeId((prev) => {
      if (prev && model.timeline.some((node) => node.id === prev)) return prev;
      return defaultSelectedId;
    });
  }, [defaultSelectedId, model.timeline]);

  useEffect(() => {
    const root = model.meta?.repoPath;
    if (!root) {
      setGithubContext({ status: 'empty', entries: [] });
      return;
    }
    if (!githubConnectorEnabled) {
      setGithubContext({ status: 'disabled', entries: [] });
      return;
    }

    let cancelled = false;
    setGithubContext((prev) => ({ ...prev, status: 'loading', error: undefined }));
    loadGitHubContext(root)
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
      detailLevel: level,
      confidence: narrative.confidence,
    });
  }, [bumpObservability, detailLevel, killSwitchActive, model.meta?.branchName, narrative.confidence]);

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
      detailLevel: 'diff',
      confidence: narrative.confidence,
      source: laneContext?.source === 'recall_lane' ? 'recall_lane' : model.source,
      recallLaneItemId: laneContext?.recallLaneItemId,
      recallLaneConfidenceBand: laneContext?.recallLaneConfidenceBand,
      viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
    });
  }, [
    bumpObservability,
    files,
    model.meta?.branchName,
    model.source,
    narrative.confidence,
    selectFile,
    selectedFile,
    branchScopeKey,
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
      if (shouldRouteEvidenceToRawDiff(link)) {
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
    ]
  );

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

  // Ask-Why handlers with stale-guard protection
  const handleSubmitAskWhy = useCallback(async (question: string) => {
    if (!question.trim()) return;

    const requestVersion = ++askWhyRequestVersionRef.current;
    const branchScopeAtRequest = branchScopeKey;

    setAskWhyState({ kind: 'loading', queryId: `pending-${requestVersion}` });

    const input = {
      question,
      branchId: model.meta?.branchName ?? 'unknown',
      repoId: model.meta?.repoId,
    };

    try {
      const result = await composeAskWhyAnswer(input, narrative);

      // Stale-guard: drop response if branch changed or newer request in flight
      if (!isMountedRef.current) return;
      if (activeBranchScopeRef.current !== branchScopeAtRequest) return;
      if (askWhyRequestVersionRef.current !== requestVersion) return;

      if (result.kind === 'error') {
        setAskWhyState({ kind: 'error', queryId: result.queryId, errorType: result.errorType, message: result.message });
        trackAskWhyError({ queryId: result.queryId, errorType: result.errorType });
        return;
      }

      setAskWhyState({ kind: 'ready', answer: result.answer });

      trackAskWhySubmitted({
        queryId: result.answer.queryId,
        branchId: input.branchId,
        questionHash: result.answer.questionHash,
      });
      trackAskWhyAnswerViewed({
        queryId: result.answer.queryId,
        confidence: result.answer.confidenceBand,
        citationCount: result.answer.citations.length,
        fallbackUsed: result.answer.fallbackUsed,
      });
      if (result.answer.fallbackUsed && result.answer.fallbackReasonCode) {
        trackAskWhyFallbackUsed({
          queryId: result.answer.queryId,
          reasonCode: result.answer.fallbackReasonCode,
        });
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      if (activeBranchScopeRef.current !== branchScopeAtRequest) return;
      if (askWhyRequestVersionRef.current !== requestVersion) return;

      const errorMessage = error instanceof Error ? error.message : String(error);
      setAskWhyState({
        kind: 'error',
        queryId: `error-${requestVersion}`,
        errorType: 'internal',
        message: errorMessage,
      });
    }
  }, [branchScopeKey, model.meta?.branchName, model.meta?.repoId, narrative]);

  const handleOpenAskWhyCitation = useCallback((citation: AskWhyCitation) => {
    if (activeBranchScopeRef.current !== branchScopeKey) return;

    const link: NarrativeEvidenceLink = {
      id: citation.id,
      kind: citation.type,
      label: citation.label,
      commitSha: citation.commitSha,
      filePath: citation.filePath,
      sessionId: citation.sessionId,
    };

    if (askWhyState.kind === 'ready') {
      trackAskWhyEvidenceOpened({
        queryId: askWhyState.answer.queryId,
        citationType: citation.type,
        citationId: citation.id,
      });
    }

    handleOpenEvidence(link);
  }, [askWhyState, branchScopeKey, handleOpenEvidence]);

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
