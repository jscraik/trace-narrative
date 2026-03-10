import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDashboardStats,
  timeRangeToDateRange,
  type DashboardEmptyReason,
  type DashboardStats,
  type TimeRange,
} from "../../core/attribution-api";
import type {
  DashboardDroppedRequestDiagnostic,
  DashboardFilter,
  DashboardRequestFailureMetadata,
  DashboardState,
  Mode,
  PanelStatusMap,
} from "../../core/types";
import type { CaptureReliabilityStatus } from "../../core/tauri/ingestConfig";
import type { RepoState } from "../../hooks/useRepoLoader";
import { DashboardEmptyState } from "../components/dashboard/DashboardEmptyState";
import { DashboardErrorState } from "../components/dashboard/DashboardErrorState";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardLoadingState } from "../components/dashboard/DashboardLoadingState";
import { MetricsGrid } from "../components/dashboard/MetricsGrid";
import { TopFilesTable } from "../components/dashboard/TopFilesTable";
import { FileCode, Palette, FileText, Box, File } from 'lucide-react';
import { QuickActions } from "../components/dashboard/QuickActions";
import { RecentActivity, type ActivityItem } from "../components/dashboard/RecentActivity";
import { BottomStats } from "../components/dashboard/BottomStats";
import {
  classifyDashboardFailure,
  DASHBOARD_CHORD_TIMEOUT_MS,
  DASHBOARD_DROPPED_REQUEST_LIMIT,
  DASHBOARD_DROPPED_REQUEST_TTL_MS,
  deriveDashboardTrustState,
  hashDashboardRequestKey,
} from "./dashboardState";
import { trackDashboardEvent } from "../../core/telemetry/narrativeTelemetry";

const MOCK_STATS: DashboardStats = {
  repo: {
    id: 1,
    path: "~/dev/trace-narrative",
    name: "trace-narrative",
  },
  timeRange: "30d",
  currentPeriod: {
    period: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
      commits: 47,
    },
    attribution: {
      totalLines: 12450,
      humanLines: 3980,
      aiAgentLines: 5200,
      aiAssistLines: 3270,
      collaborativeLines: 0,
      aiPercentage: 68,
    },
    toolBreakdown: [
      { tool: "claude_code", model: "sonnet-3.7", lineCount: 4500 },
      { tool: "cursor", model: "gpt-4o", lineCount: 2800 },
      { tool: "codex", model: "o1-mini", lineCount: 1170 },
    ],
    trend: [
      { date: "2026-03-01", granularity: "day", aiPercentage: 45, commitCount: 2 },
      { date: "2026-03-02", granularity: "day", aiPercentage: 50, commitCount: 4 },
      { date: "2026-03-03", granularity: "day", aiPercentage: 55, commitCount: 3 },
      { date: "2026-03-04", granularity: "day", aiPercentage: 60, commitCount: 5 },
      { date: "2026-03-05", granularity: "day", aiPercentage: 62, commitCount: 4 },
      { date: "2026-03-06", granularity: "day", aiPercentage: 65, commitCount: 6 },
      { date: "2026-03-07", granularity: "day", aiPercentage: 68, commitCount: 3 },
    ],
  },
  previousPeriod: {
    period: {
      start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      commits: 35,
    },
    attribution: {
      totalLines: 10200,
      humanLines: 3774,
      aiAgentLines: 4000,
      aiAssistLines: 2426,
      collaborativeLines: 0,
      aiPercentage: 63,
    },
    toolBreakdown: [],
    trend: [],
  },
  topFiles: {
    files: [
      { filePath: "src/core/attribution-api.ts", totalLines: 506, aiLines: 410, aiPercentage: 81, commitCount: 12 },
      { filePath: "src/ui/views/DashboardView.tsx", totalLines: 584, aiLines: 210, aiPercentage: 36, commitCount: 8 },
      { filePath: "src-tauri/src/lib.rs", totalLines: 840, aiLines: 520, aiPercentage: 62, commitCount: 15 },
      { filePath: "src/hooks/useAutoIngest.ts", totalLines: 320, aiLines: 280, aiPercentage: 88, commitCount: 5 },
      { filePath: "src/App.tsx", totalLines: 387, aiLines: 120, aiPercentage: 31, commitCount: 10 },
    ],
    total: 5,
    offset: 0,
    limit: 20,
    hasMore: false,
  },
};

interface DashboardViewProps {
  repoState: RepoState;
  setRepoState: React.Dispatch<React.SetStateAction<RepoState>>;
  setActionError: (error: string | null) => void;
  onDrillDown: (filter: DashboardFilter) => void;
  onModeChange: (mode: Mode) => void;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
}

function getRepoName(path: string): string {
  return path.split("/").filter(Boolean).pop() || path;
}

export function DashboardView({
  repoState,
  setRepoState: _setRepoState,
  setActionError,
  onDrillDown,
  onModeChange,
  captureReliabilityStatus,
}: DashboardViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filesOffset, setFilesOffset] = useState(0);
  const [dashboardState, setDashboardState] = useState<DashboardState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [emptyReason, setEmptyReason] = useState<DashboardEmptyReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  const sequenceRef = useRef<{ lastKey: string; ts: number }>({ lastKey: "", ts: 0 });
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
    // Phase 3 Spec: Track dashboard route activation
    if (!performance.getEntriesByName("dashboard_route_activation").length) {
      performance.mark("dashboard_route_activation");
    }
    return () => {
      performance.clearMarks("dashboard_route_activation");
      performance.clearMeasures("dashboard_first_data_paint");
      performance.clearMeasures("dashboard_tti");
    };
  }, []);

  useEffect(() => {
    if (dashboardState === "default" && !hasPaintedRef.current) {
      hasPaintedRef.current = true;
      requestAnimationFrame(() => {
        performance.mark("dashboard_data_paint_end");
        try {
          performance.measure("dashboard_first_data_paint", "dashboard_route_activation", "dashboard_data_paint_end");
          performance.measure("dashboard_tti", "dashboard_route_activation", "dashboard_data_paint_end");

          const paintMeasure = performance.getEntriesByName("dashboard_first_data_paint")[0];
          const ttiMeasure = performance.getEntriesByName("dashboard_tti")[0];

          if (paintMeasure && paintMeasure.duration > 1200) {
            console.warn(`[Spec] First data paint exceeded budget: ${Math.round(paintMeasure.duration)}ms > 1200ms`);
          }
          if (ttiMeasure && ttiMeasure.duration > 1500) {
            console.warn(`[Spec] TTI exceeded budget: ${Math.round(ttiMeasure.duration)}ms > 1500ms`);
          }
          } catch (_e) {
            // ignore measurement errors
          }
      });
    }

    if (dashboardState === "default") {
      if (performance.getEntriesByName("dashboard_filter_start").length > 0) {
        requestAnimationFrame(() => {
          performance.mark("dashboard_filter_end");
          try {
            performance.measure("dashboard_interaction_latency", "dashboard_filter_start", "dashboard_filter_end");
            const measure = performance.getEntriesByName("dashboard_interaction_latency").pop();
            if (measure && measure.duration > 250) {
              console.warn(`[Spec] Interaction latency exceeded budget: ${Math.round(measure.duration)}ms > 250ms`);
            }
          } catch (_e) {
            // ignore
          }
          performance.clearMarks("dashboard_filter_start");
          performance.clearMarks("dashboard_filter_end");
        });
      }
    }
  }, [dashboardState]);

  const dashboardTrustState = useMemo(
    () => deriveDashboardTrustState(captureReliabilityStatus),
    [captureReliabilityStatus],
  );
  const activeRepoId = repoState.status === "ready" ? repoState.repo.repoId : null;

  const panelStatusMap = useMemo<PanelStatusMap>(
    () => ({
      metrics:
        dashboardState === "loading"
          ? "loading"
          : dashboardTrustState === "degraded"
            ? "degraded"
            : "ready",
      topFiles:
        dashboardState === "loading"
          ? "loading"
          : emptyReason === "no-attribution"
            ? "empty"
            : dashboardTrustState === "degraded"
              ? "degraded"
              : "ready",
    }),
    [dashboardState, dashboardTrustState, emptyReason],
  );

  const recordDroppedRequest = useCallback(
    (entry: DashboardDroppedRequestDiagnostic) => {
      const now = Date.now();
      const retainedEntries = droppedRequestDiagnosticsRef.current
        .filter((diagnostic) => now - Date.parse(diagnostic.droppedAtIso) <= DASHBOARD_DROPPED_REQUEST_TTL_MS)
        .concat(entry);
      droppedRequestDiagnosticsRef.current = retainedEntries.slice(
        -DASHBOARD_DROPPED_REQUEST_LIMIT,
      );
    },
    [],
  );

  const fetchStats = useCallback(
    async (isLoadMore = false) => {
      if (repoState.status !== "ready") {
        setEmptyReason("no-repo");
        setError(null);
        setCanRetry(true);
        setDashboardState("empty");
        setLoadingMore(false);
        activeRequestRef.current = null;
        return;
      }

      const requestVersion = fetchRequestVersionRef.current + 1;
      fetchRequestVersionRef.current = requestVersion;
      const requestKeyHash = hashDashboardRequestKey({
        repoId: repoState.repo.repoId,
        timeRange:
          typeof timeRange === "string" ? timeRange : `${timeRange.from}:${timeRange.to}`,
        filesOffset,
      });
      const priorFailureAttempt =
        failureMetadataRef.current?.repoId === repoState.repo.repoId &&
          failureMetadataRef.current.requestKeyHash === requestKeyHash
          ? failureMetadataRef.current.attempt
          : 0;
      const requestMeta = {
        version: requestVersion,
        repoId: repoState.repo.repoId,
        requestKeyHash,
        attempt: isLoadMore ? 1 : priorFailureAttempt + 1,
      };
      const isStaleRequest = (reason: DashboardDroppedRequestDiagnostic["reason"]) => {
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
          reason: "abort_unavailable",
          droppedAtIso: new Date().toISOString(),
        });
      }
      activeRequestRef.current = requestMeta;

      if (!isLoadMore) {
        setDashboardState("loading");
      }
      setLoadingMore(true);
      setError(null);
      setCanRetry(true);

      try {
        const data = await getDashboardStats(repoState.repo.repoId, timeRange, filesOffset, 20);
        if (isStaleRequest("superseded")) return;

        if (data.currentPeriod.period.commits === 0) {
          setEmptyReason("no-commits");
          setDashboardState("empty");
        } else if (data.currentPeriod.attribution.aiPercentage === 0) {
          setEmptyReason("no-ai");
          setDashboardState("empty");
        } else if (!data.topFiles.files.length) {
          setEmptyReason("no-attribution");
          setDashboardState("empty");
        } else {
          setEmptyReason(null);
          setDashboardState("default");
        }

        setStats(data);
        setLastUpdated(new Date());
        failureMetadataRef.current = null;
        activeRequestRef.current = null;
        setActionError(null);
      } catch (cause) {
        if (isStaleRequest("superseded")) return;
        const failure = classifyDashboardFailure(cause, captureReliabilityStatus);

        if (failure.state === "permission_denied") {
          trackDashboardEvent({ event: "permission_denied", payload: { repo_id: requestMeta.repoId, message: failure.message } });
        }
        if (!failure.canRetry) {
          trackDashboardEvent({ event: "dashboard_retry_budget_exhausted", payload: { repo_id: requestMeta.repoId } });
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
        if (!isStaleRequest("superseded")) {
          setLoadingMore(false);
        }
      }
    },
    [captureReliabilityStatus, filesOffset, recordDroppedRequest, repoState, setActionError, timeRange],
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
          reason: "mode_exit",
          droppedAtIso: new Date().toISOString(),
        });
      }
      activeRequestRef.current = null;
      failureMetadataRef.current = null;
    };
  }, [recordDroppedRequest]);

  const handleDrillDown = useCallback(
    (filter: DashboardFilter) => {
      trackDashboardEvent({ event: "apply_filter", payload: { filter, repo_id: activeRepoId } });
      const filterWithDate: DashboardFilter = {
        ...filter,
        dateRange: filter.dateRange || timeRangeToDateRange(timeRange),
      };
      onDrillDown(filterWithDate);
    },
    [onDrillDown, timeRange, activeRepoId],
  );

  const handleTimeRangeChange = useCallback((newTimeRange: TimeRange) => {
    performance.mark("dashboard_filter_start");
    setTimeRange(newTimeRange);
    setFilesOffset(0);
  }, []);

  const handleLoadMoreWithState = useCallback(() => {
    setFilesOffset((prev) => prev + 20);
  }, []);

  const handleClearFilter = useCallback(() => {
    trackDashboardEvent({ event: "clear_filter", payload: { repo_id: activeRepoId } });
    setCommandQuery("");
  }, [activeRepoId]);

  const handleOpenRepo = useCallback(() => {
    trackDashboardEvent({ event: "open_repo", payload: { repo_id: activeRepoId } });
    // Stub for now or mode switch to repo config
  }, [activeRepoId]);

  const handleImportSession = useCallback(() => {
    trackDashboardEvent({ event: "import_session", payload: { repo_id: activeRepoId } });
    // Stub
  }, [activeRepoId]);

  const _handleViewActivity = useCallback(() => {
    trackDashboardEvent({ event: "view_activity", payload: { repo_id: activeRepoId } });
    // Stub
  }, [activeRepoId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        commandInputRef.current?.focus();
        return;
      }

      if (event.key === "Escape" && document.activeElement === commandInputRef.current) {
        handleClearFilter();
        commandInputRef.current?.blur();
        return;
      }

      if (isTypingTarget) return;

      const now = Date.now();
      const key = event.key.toLowerCase();
      const prev = sequenceRef.current;
      const withinChordWindow = now - prev.ts < DASHBOARD_CHORD_TIMEOUT_MS;

      if (key === "g") {
        sequenceRef.current = { lastKey: "g", ts: now };
        return;
      }

      if (withinChordWindow && prev.lastKey === "g" && key === "d") {
        onModeChange("dashboard");
        sequenceRef.current = { lastKey: "", ts: 0 };
        return;
      }

      if (withinChordWindow && prev.lastKey === "g" && key === "r") {
        onModeChange("repo");
        sequenceRef.current = { lastKey: "", ts: 0 };
        return;
      }

      if (key === "1") handleTimeRangeChange("7d");
      if (key === "2") handleTimeRangeChange("30d");
      if (key === "3") handleTimeRangeChange("90d");
      if (key === "4") handleTimeRangeChange("all");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClearFilter, handleTimeRangeChange, onModeChange]);

  const visibleFiles = useMemo(() => {
    if (!stats) return [];
    const query = commandQuery.trim().toLowerCase();
    if (!query) return stats.topFiles.files;
    return stats.topFiles.files.filter((file) => file.filePath.toLowerCase().includes(query));
  }, [stats, commandQuery]);

  // Build recent activity items from top files data (must be before early returns)
  const recentActivityItems: ActivityItem[] = useMemo(() => {
    if (!stats) return [];
    return stats.topFiles.files.slice(0, 5).map((file, _i) => {
      const badge = file.aiPercentage > 80 ? 'ai' as const
        : file.aiPercentage > 20 ? 'mixed' as const
          : 'human' as const;

      // Map file extensions to icons
      const ext = file.filePath.split('.').pop()?.toLowerCase() || '';
      let icon = File;
      if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) icon = FileCode;
      if (['css', 'scss', 'html'].includes(ext)) icon = Palette;
      if (['md', 'txt'].includes(ext)) icon = FileText;
      if (['json', 'yaml', 'yml'].includes(ext)) icon = Box;

      const fileName = file.filePath.split('/').pop();
      return {
        id: file.filePath,
        message: `Updated ${fileName}`,
        branch: file.filePath,
        timeAgo: 'Recently',
        badge,
        icon
      };
    });
  }, [stats]);

  // Derive greeting based on time of day (must be before early returns)
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (repoState.status !== "ready") {
    // Phase 3 Preview: Use mock stats if no repo is loaded to demonstrate layout
    if (!stats) setStats(MOCK_STATS);
    if (dashboardState !== "default") setDashboardState("default");
  } else if (
    dashboardState === "error" ||
    dashboardState === "offline" ||
    dashboardState === "permission_denied"
  ) {
    return (
      <DashboardErrorState
        state={dashboardState}
        error={error ?? "Failed to load dashboard"}
        onRetry={() => void fetchStats()}
        onBackToRepo={() => onModeChange("repo")}
        canRetry={canRetry}
      />
    );
  }

  if (dashboardState === "loading") {
    return <DashboardLoadingState />;
  }

  if (dashboardState === "empty" && emptyReason) {
    return (
      <div className="dashboard-container animate-in fade-in slide-in-from-bottom-1 motion-page-enter">
        <DashboardHeader
          repoName={repoState.status === "ready" ? getRepoName(repoState.repo.root) : "trace-narrative"}
          repoPath={repoState.status === "ready" ? repoState.repo.root : "~/dev/trace-narrative"}
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          lastUpdated={lastUpdated}
          trustState={dashboardTrustState}
          onOpenRepo={handleOpenRepo}
          onImportSession={handleImportSession}
        />
        <DashboardEmptyState reason={emptyReason} />
      </div>
    );
  }

  if (!stats) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="dashboard-container h-full min-h-0 flex flex-col animate-in fade-in slide-in-from-bottom-1 motion-page-enter">
      <DashboardHeader
        repoName={stats.repo.name}
        repoPath={stats.repo.path}
        timeRange={stats.timeRange}
        onTimeRangeChange={handleTimeRangeChange}
        lastUpdated={lastUpdated}
        trustState={dashboardTrustState}
        onOpenRepo={handleOpenRepo}
        onImportSession={handleImportSession}
      />

      {/* Scrollable dashboard content */}
      <main className="flex-1 overflow-y-auto px-6 py-6" data-dashboard-content>
        <div className="max-w-6xl">
          {/* v3 Greeting */}
          <h2 className="text-xl font-bold text-text-primary mb-6">
            {greeting}, Jamie
          </h2>

          {/* v3 Metrics Grid (4-column) */}
          <div data-panel-status={panelStatusMap.metrics}>
            <MetricsGrid
              currentPeriod={stats.currentPeriod}
              previousPeriod={stats.previousPeriod}
              toolBreakdown={stats.currentPeriod.toolBreakdown}
            />
          </div>

          {/* v3 Quick Actions (3-column glass panels) */}
          <QuickActions
            repoName={stats.repo.name}
            onAnalyzeBranch={() => handleDrillDown({ type: "ai-only" })}
            onImportSession={handleImportSession}
            onAskAboutCode={() => onModeChange("docs")}
          />


          {/* v3 Recent Activity (timeline-style) */}
          <div className="mb-6">
            <RecentActivity
              items={recentActivityItems}
              onViewAll={() => {
                trackDashboardEvent({ event: 'view_activity', payload: { repo_id: activeRepoId } });
                onModeChange("repo");
              }}
              onItemClick={handleDrillDown}
            />
          </div>

          {/* Top Files Table (collapsible detail) */}
          <div data-panel-status={panelStatusMap.topFiles} className="mb-6">
            <TopFilesTable
              files={visibleFiles}
              hasMore={!commandQuery && stats.topFiles.hasMore}
              isLoading={loadingMore}
              onFileClick={handleDrillDown}
              onLoadMore={handleLoadMoreWithState}
            />
          </div>
        </div>
      </main>

      {/* v3 Bottom Stats Bar */}
      <BottomStats
        repoCount={1}
        sessionCount={stats.currentPeriod.period.commits}
        aiPercentage={Math.round(stats.currentPeriod.attribution.aiPercentage)}
      />
    </div>
  );
}
