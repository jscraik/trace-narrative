import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getDashboardStats,
  type DashboardEmptyReason,
  type DashboardStats,
  type TimeRange,
} from '../../core/attribution-api';
import type {
  DashboardDroppedRequestDiagnostic,
  DashboardRequestFailureMetadata,
  DashboardState,
  DashboardTrustState,
  Mode,
  PanelStatusMap,
} from '../../core/types';
import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import { trackDashboardEvent } from '../../core/telemetry/narrativeTelemetry';
import type { RepoState } from '../../hooks/useRepoLoader';
import {
  classifyDashboardFailure,
  DASHBOARD_CHORD_TIMEOUT_MS,
  DASHBOARD_DROPPED_REQUEST_LIMIT,
  DASHBOARD_DROPPED_REQUEST_TTL_MS,
  deriveDashboardTrustState,
  hashDashboardRequestKey,
  resolveDashboardRuntimeEnvironment,
} from './dashboardState';
import { MOCK_DASHBOARD_STATS } from './dashboardMockStats';

interface UseDashboardViewStateProps {
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  setActionError: (error: string | null) => void;
  onModeChange: (mode: Mode) => void;
}

interface UseDashboardViewStateReturn {
  timeRange: TimeRange;
  stats: DashboardStats | null;
  setStats: Dispatch<SetStateAction<DashboardStats | null>>;
  visibleFiles: DashboardStats['topFiles']['files'];
  hasActiveQuery: boolean;
  dashboardState: DashboardState;
  loadingMore: boolean;
  emptyReason: DashboardEmptyReason | null;
  error: string | null;
  canRetry: boolean;
  lastUpdated?: Date;
  activeRepoId: number | null;
  dashboardTrustState: DashboardTrustState;
  panelStatusMap: PanelStatusMap;
  fetchStats: (isLoadMore?: boolean) => Promise<void>;
  handleTimeRangeChange: (newTimeRange: TimeRange) => void;
  handleLoadMoreWithState: () => void;
  handleOpenRepo: () => void;
  handleImportSession: () => void;
}

export function useDashboardViewState({
  repoState,
  captureReliabilityStatus,
  setActionError,
  onModeChange,
}: UseDashboardViewStateProps): UseDashboardViewStateReturn {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filesOffset, setFilesOffset] = useState(0);
  const [dashboardState, setDashboardState] = useState<DashboardState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [emptyReason, setEmptyReason] = useState<DashboardEmptyReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);
  const sequenceRef = useRef<{ lastKey: string; ts: number }>({ lastKey: '', ts: 0 });
  const fetchRequestVersionRef = useRef(0);
  const activeRequestRef = useRef<{
    version: number;
    repoId: number;
    requestKeyHash: string;
    attempt: number;
  } | null>(null);
  const failureMetadataRef = useRef<DashboardRequestFailureMetadata | null>(null);
  const droppedRequestDiagnosticsRef = useRef<DashboardDroppedRequestDiagnostic[]>([]);
  const hasPaintedRef = useRef(false);

  useEffect(() => {
    if (!performance.getEntriesByName('dashboard_route_activation').length) {
      performance.mark('dashboard_route_activation');
    }

    return () => {
      performance.clearMarks('dashboard_route_activation');
      performance.clearMeasures('dashboard_first_data_paint');
      performance.clearMeasures('dashboard_tti');
    };
  }, []);

  useEffect(() => {
    if (dashboardState === 'default' && !hasPaintedRef.current) {
      hasPaintedRef.current = true;
      requestAnimationFrame(() => {
        performance.mark('dashboard_data_paint_end');
        try {
          performance.measure('dashboard_first_data_paint', 'dashboard_route_activation', 'dashboard_data_paint_end');
          performance.measure('dashboard_tti', 'dashboard_route_activation', 'dashboard_data_paint_end');

          const paintMeasure = performance.getEntriesByName('dashboard_first_data_paint')[0];
          const ttiMeasure = performance.getEntriesByName('dashboard_tti')[0];

          if (paintMeasure && paintMeasure.duration > 1200) {
            console.warn(`[Spec] First data paint exceeded budget: ${Math.round(paintMeasure.duration)}ms > 1200ms`);
          }
          if (ttiMeasure && ttiMeasure.duration > 1500) {
            console.warn(`[Spec] TTI exceeded budget: ${Math.round(ttiMeasure.duration)}ms > 1500ms`);
          }
        } catch (_error) {
          // ignore measurement errors
        }
      });
    }

    if (dashboardState === 'default' && performance.getEntriesByName('dashboard_filter_start').length > 0) {
      requestAnimationFrame(() => {
        performance.mark('dashboard_filter_end');
        try {
          performance.measure('dashboard_interaction_latency', 'dashboard_filter_start', 'dashboard_filter_end');
          const measure = performance.getEntriesByName('dashboard_interaction_latency').pop();
          if (measure && measure.duration > 250) {
            console.warn(`[Spec] Interaction latency exceeded budget: ${Math.round(measure.duration)}ms > 250ms`);
          }
        } catch (_error) {
          // ignore measurement errors
        }
        performance.clearMarks('dashboard_filter_start');
        performance.clearMarks('dashboard_filter_end');
      });
    }
  }, [dashboardState]);

  const dashboardTrustState = useMemo(
    () => deriveDashboardTrustState(captureReliabilityStatus),
    [captureReliabilityStatus],
  );
  const activeRepoId = repoState.status === 'ready' ? repoState.repo.repoId : null;

  const panelStatusMap = useMemo<PanelStatusMap>(
    () => ({
      metrics:
        dashboardState === 'loading'
          ? 'loading'
          : dashboardTrustState === 'degraded'
            ? 'degraded'
            : 'ready',
      topFiles:
        dashboardState === 'loading'
          ? 'loading'
          : emptyReason === 'no-attribution'
            ? 'empty'
            : dashboardTrustState === 'degraded'
              ? 'degraded'
              : 'ready',
    }),
    [dashboardState, dashboardTrustState, emptyReason],
  );

  const recordDroppedRequest = useCallback((entry: DashboardDroppedRequestDiagnostic) => {
    const now = Date.now();
    const retainedEntries = droppedRequestDiagnosticsRef.current
      .filter((diagnostic) => now - Date.parse(diagnostic.droppedAtIso) <= DASHBOARD_DROPPED_REQUEST_TTL_MS)
      .concat(entry);
    droppedRequestDiagnosticsRef.current = retainedEntries.slice(-DASHBOARD_DROPPED_REQUEST_LIMIT);
  }, []);

  const runtimeEnvironment = resolveDashboardRuntimeEnvironment();
  const useBrowserMockData =
    runtimeEnvironment === 'dev'
    && repoState.status === 'ready'
    && repoState.repo.root === '/mock/repo';

  const fetchStats = useCallback(
    async (isLoadMore = false) => {
      if (repoState.status !== 'ready') {
        setEmptyReason('no-repo');
        setError(null);
        setCanRetry(true);
        setDashboardState('empty');
        setLoadingMore(false);
        activeRequestRef.current = null;
        return;
      }

      const requestVersion = fetchRequestVersionRef.current + 1;
      fetchRequestVersionRef.current = requestVersion;

      const requestKeyHash = hashDashboardRequestKey({
        repoId: repoState.repo.repoId,
        timeRange: typeof timeRange === 'string' ? timeRange : `${timeRange.from}:${timeRange.to}`,
        filesOffset,
      });
      const priorFailureAttempt =
        failureMetadataRef.current?.repoId === repoState.repo.repoId
        && failureMetadataRef.current.requestKeyHash === requestKeyHash
          ? failureMetadataRef.current.attempt
          : 0;
      const requestMeta = {
        version: requestVersion,
        repoId: repoState.repo.repoId,
        requestKeyHash,
        attempt: isLoadMore ? 1 : priorFailureAttempt + 1,
      };
      const isStaleRequest = (reason: DashboardDroppedRequestDiagnostic['reason']) => {
        if (fetchRequestVersionRef.current !== requestVersion) {
          recordDroppedRequest({
            repoId: requestMeta.repoId,
            requestKeyHash: requestMeta.requestKeyHash,
            attempt: requestMeta.attempt,
            reason,
            droppedAtIso: new Date().toISOString(),
          });
          return true;
        }
        return false;
      };

      if (activeRequestRef.current && activeRequestRef.current.version !== requestVersion) {
        recordDroppedRequest({
          repoId: activeRequestRef.current.repoId,
          requestKeyHash: activeRequestRef.current.requestKeyHash,
          attempt: activeRequestRef.current.attempt,
          reason: 'abort_unavailable',
          droppedAtIso: new Date().toISOString(),
        });
      }
      activeRequestRef.current = requestMeta;

      if (!isLoadMore) {
        setDashboardState('loading');
      }
      setLoadingMore(true);
      setError(null);
      setCanRetry(true);

      try {
        const data = useBrowserMockData
          ? {
            ...MOCK_DASHBOARD_STATS,
            repo: {
              id: repoState.repo.repoId,
              path: repoState.repo.root,
              name: repoState.repo.root.split('/').filter(Boolean).pop() || MOCK_DASHBOARD_STATS.repo.name,
            },
            timeRange,
          }
          : await getDashboardStats(repoState.repo.repoId, timeRange, filesOffset, 20);
        if (isStaleRequest('superseded')) return;

        if (data.currentPeriod.period.commits === 0) {
          setEmptyReason('no-commits');
          setDashboardState('empty');
        } else if (data.currentPeriod.attribution.aiPercentage === 0) {
          setEmptyReason('no-ai');
          setDashboardState('empty');
        } else if (!data.topFiles.files.length) {
          setEmptyReason('no-attribution');
          setDashboardState('empty');
        } else {
          setEmptyReason(null);
          setDashboardState('default');
        }

        setStats(data);
        setLastUpdated(new Date());
        failureMetadataRef.current = null;
        activeRequestRef.current = null;
        setActionError(null);
      } catch (cause) {
        if (isStaleRequest('superseded')) return;
        const failure = classifyDashboardFailure(cause, captureReliabilityStatus);

        if (failure.state === 'permission_denied') {
          trackDashboardEvent({ event: 'permission_denied', payload: { repo_id: requestMeta.repoId, message: failure.message } });
        }
        if (!failure.canRetry) {
          trackDashboardEvent({ event: 'dashboard_retry_budget_exhausted', payload: { repo_id: requestMeta.repoId } });
        }

        setDashboardState(failure.state);
        setError(failure.message);
        setCanRetry(failure.canRetry);
        setActionError(failure.message);
        failureMetadataRef.current = {
          repoId: requestMeta.repoId,
          requestKeyHash: requestMeta.requestKeyHash,
          failureClass: failure.failureClass,
          authorityOutcome: failure.authorityOutcome,
          attempt: requestMeta.attempt,
          failedAtIso: new Date().toISOString(),
          message: failure.message,
        };
        activeRequestRef.current = null;
      } finally {
        if (!isStaleRequest('superseded')) {
          setLoadingMore(false);
        }
      }
    },
    [captureReliabilityStatus, filesOffset, recordDroppedRequest, repoState, setActionError, timeRange, useBrowserMockData],
  );

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeRepoId === null) {
      failureMetadataRef.current = null;
      return;
    }
    failureMetadataRef.current = null;
  }, [activeRepoId]);

  useEffect(() => {
    return () => {
      if (activeRequestRef.current) {
        recordDroppedRequest({
          repoId: activeRequestRef.current.repoId,
          requestKeyHash: activeRequestRef.current.requestKeyHash,
          attempt: activeRequestRef.current.attempt,
          reason: 'mode_exit',
          droppedAtIso: new Date().toISOString(),
        });
      }
      activeRequestRef.current = null;
      failureMetadataRef.current = null;
    };
  }, [recordDroppedRequest]);

  const handleTimeRangeChange = useCallback((newTimeRange: TimeRange) => {
    performance.mark('dashboard_filter_start');
    setTimeRange(newTimeRange);
    setFilesOffset(0);
  }, []);

  const handleLoadMoreWithState = useCallback(() => {
    setFilesOffset((prev) => prev + 20);
  }, []);

  const handleClearFilter = useCallback(() => {
    trackDashboardEvent({ event: 'clear_filter', payload: { repo_id: activeRepoId } });
    setCommandQuery('');
  }, [activeRepoId]);

  const handleOpenRepo = useCallback(() => {
    trackDashboardEvent({ event: 'open_repo', payload: { repo_id: activeRepoId } });
  }, [activeRepoId]);

  const handleImportSession = useCallback(() => {
    trackDashboardEvent({ event: 'import_session', payload: { repo_id: activeRepoId } });
  }, [activeRepoId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        !!target
        && (
          target.tagName === 'INPUT'
          || target.tagName === 'TEXTAREA'
          || target.tagName === 'SELECT'
          || target.isContentEditable
        );

      if (event.key === '/' && !isTypingTarget) {
        event.preventDefault();
        commandInputRef.current?.focus();
        return;
      }

      if (event.key === 'Escape' && document.activeElement === commandInputRef.current) {
        handleClearFilter();
        commandInputRef.current?.blur();
        return;
      }

      if (isTypingTarget) return;

      const now = Date.now();
      const key = event.key.toLowerCase();
      const previous = sequenceRef.current;
      const withinChordWindow = now - previous.ts < DASHBOARD_CHORD_TIMEOUT_MS;

      if (key === 'g') {
        sequenceRef.current = { lastKey: 'g', ts: now };
        return;
      }

      if (withinChordWindow && previous.lastKey === 'g' && key === 'd') {
        onModeChange('dashboard');
        sequenceRef.current = { lastKey: '', ts: 0 };
        return;
      }

      if (withinChordWindow && previous.lastKey === 'g' && key === 'r') {
        onModeChange('repo');
        sequenceRef.current = { lastKey: '', ts: 0 };
        return;
      }

      if (key === '1') handleTimeRangeChange('7d');
      if (key === '2') handleTimeRangeChange('30d');
      if (key === '3') handleTimeRangeChange('90d');
      if (key === '4') handleTimeRangeChange('all');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClearFilter, handleTimeRangeChange, onModeChange]);

  const visibleFiles = useMemo(() => {
    if (!stats) return [];
    const query = commandQuery.trim().toLowerCase();
    if (!query) return stats.topFiles.files;
    return stats.topFiles.files.filter((file) => file.filePath.toLowerCase().includes(query));
  }, [stats, commandQuery]);

  return {
    timeRange,
    stats,
    setStats,
    visibleFiles,
    hasActiveQuery: commandQuery.trim().length > 0,
    dashboardState,
    loadingMore,
    emptyReason,
    error,
    canRetry,
    lastUpdated,
    activeRepoId,
    dashboardTrustState,
    panelStatusMap,
    fetchStats,
    handleTimeRangeChange,
    handleLoadMoreWithState,
    handleOpenRepo,
    handleImportSession,
  };
}
