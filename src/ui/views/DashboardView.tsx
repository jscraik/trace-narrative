import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDashboardStats,
  timeRangeToDateRange,
  type DashboardEmptyReason,
  type DashboardStats,
  type TimeRange,
} from '../../core/attribution-api';
import type { DashboardFilter } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import type { Mode } from '../components/TopNav';
import { DashboardEmptyState } from '../components/dashboard/DashboardEmptyState';
import { DashboardErrorState } from '../components/dashboard/DashboardErrorState';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardLoadingState } from '../components/dashboard/DashboardLoadingState';
import { MetricsGrid } from '../components/dashboard/MetricsGrid';
import { TopFilesTable } from '../components/dashboard/TopFilesTable';

interface DashboardViewProps {
  repoState: RepoState;
  setRepoState: React.Dispatch<React.SetStateAction<RepoState>>;
  setActionError: (error: string | null) => void;
  onDrillDown: (filter: DashboardFilter) => void;
  onModeChange: (mode: Mode) => void;
}

export function DashboardView({
  repoState,
  setRepoState: _setRepoState,
  setActionError,
  onDrillDown,
  onModeChange,
}: DashboardViewProps) {
  // Helper to get repo name from path
  const getRepoName = (path: string): string => {
    return path.split('/').filter(Boolean).pop() || path;
  };
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filesOffset, setFilesOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [emptyReason, setEmptyReason] = useState<DashboardEmptyReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);
  const sequenceRef = useRef<{ lastKey: string; ts: number }>({ lastKey: '', ts: 0 });
  const fetchRequestVersionRef = useRef(0);

  // Fetch stats on repo/timeRange change
  const fetchStats = useCallback(async (isLoadMore = false) => {
    const requestVersion = fetchRequestVersionRef.current + 1;
    fetchRequestVersionRef.current = requestVersion;
    const isStaleRequest = () => fetchRequestVersionRef.current !== requestVersion;

    if (repoState.status !== 'ready') {
      setEmptyReason('no-repo');
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    // Only set main loading state for initial load
    if (!isLoadMore) {
      setLoading(true);
    }
    setLoadingMore(true);
    setError(null);

    try {
      const data = await getDashboardStats(
        repoState.repo.repoId,
        timeRange,
        filesOffset,
        20
      );
      if (isStaleRequest()) return;

      // Determine empty state
      if (data.currentPeriod.period.commits === 0) {
        setEmptyReason('no-commits');
      } else if (data.currentPeriod.attribution.aiPercentage === 0) {
        setEmptyReason('no-ai');
      } else if (!data.topFiles.files.length) {
        setEmptyReason('no-attribution');
      } else {
        setEmptyReason(null);
      }

      setStats(data);
      setLastUpdated(new Date());
    } catch (e) {
      if (isStaleRequest()) return;
      const errorMessage = e instanceof Error ? e.message : 'Failed to load dashboard';
      setError(errorMessage);
      setActionError(errorMessage);
    } finally {
      if (!isStaleRequest()) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [repoState, timeRange, filesOffset, setActionError]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Drill-down navigation - switch to repo mode with filter
  const handleDrillDown = useCallback(
    (filter: DashboardFilter) => {
      // Add dateRange to filter if not provided
      const filterWithDate: DashboardFilter = {
        ...filter,
        dateRange: filter.dateRange || timeRangeToDateRange(timeRange),
      };
      onDrillDown(filterWithDate);
    },
    [onDrillDown, timeRange]
  );

  // Handle time range change
  const handleTimeRangeChange = useCallback((newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
    setFilesOffset(0); // Reset pagination on time range change
  }, []);

  // Handle load more with loading state
  const handleLoadMoreWithState = useCallback(async () => {
    setFilesOffset((prev) => prev + 20);
    // fetchStats will be called by the useEffect when filesOffset changes
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      if (event.key === '/' && !isTypingTarget) {
        event.preventDefault();
        commandInputRef.current?.focus();
        return;
      }

      if (event.key === 'Escape' && document.activeElement === commandInputRef.current) {
        setCommandQuery('');
        commandInputRef.current?.blur();
        return;
      }

      if (isTypingTarget) return;

      const now = Date.now();
      const key = event.key.toLowerCase();
      const prev = sequenceRef.current;
      const withinChordWindow = now - prev.ts < 800;

      if (key === 'g') {
        sequenceRef.current = { lastKey: 'g', ts: now };
        return;
      }

      if (withinChordWindow && prev.lastKey === 'g' && key === 'd') {
        onModeChange('dashboard');
        sequenceRef.current = { lastKey: '', ts: 0 };
        return;
      }

      if (withinChordWindow && prev.lastKey === 'g' && key === 'r') {
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
  }, [handleTimeRangeChange, onModeChange]);

  const visibleFiles = useMemo(() => {
    if (!stats) return [];
    const query = commandQuery.trim().toLowerCase();
    if (!query) return stats.topFiles.files;
    return stats.topFiles.files.filter((file) => file.filePath.toLowerCase().includes(query));
  }, [stats, commandQuery]);

  if (repoState.status !== 'ready') {
    return <DashboardEmptyState reason="no-repo" />;
  }

  if (error) {
    return <DashboardErrorState error={error} onRetry={fetchStats} />;
  }

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (emptyReason) {
    return (
      <div className="dashboard-container animate-in fade-in slide-in-from-bottom-1 motion-page-enter">
        <DashboardHeader
          repoName={getRepoName(repoState.repo.root)}
          repoPath={repoState.repo.root}
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          lastUpdated={lastUpdated}
        />
        <DashboardEmptyState reason={emptyReason} />
      </div>
    );
  }

  if (!stats) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="dashboard-container h-full min-h-0 overflow-y-auto animate-in fade-in slide-in-from-bottom-1 motion-page-enter">
      <DashboardHeader
        repoName={stats.repo.name}
        repoPath={stats.repo.path}
        timeRange={stats.timeRange}
        onTimeRangeChange={handleTimeRangeChange}
        lastUpdated={lastUpdated}
      />

      <main className="bg-bg-tertiary px-6 py-6" data-dashboard-content>
        <section className="card mb-5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
              <span className="btn-tertiary-soft rounded-md px-2 py-1 font-medium text-text-secondary">
                / focus
              </span>
              <span className="btn-tertiary-soft rounded-md px-2 py-1 font-medium text-text-secondary">
                g then r repo
              </span>
              <span className="btn-tertiary-soft rounded-md px-2 py-1 font-medium text-text-secondary">
                1-4 range
              </span>
            </div>
            <input
              ref={commandInputRef}
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              placeholder="Quick filter files (e.g. src/ui)"
              className="w-full rounded-lg border border-border-light bg-bg-tertiary px-3 py-2 text-sm text-text-secondary outline-none ring-0 transition-colors placeholder:text-text-muted focus:border-accent-blue lg:max-w-xs"
              aria-label="Quick file filter"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => handleDrillDown({ type: 'ai-only' })} className="btn-secondary-soft rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105">
              AI only
            </button>
            <button type="button" onClick={() => handleDrillDown({ type: 'tool', value: 'codex' })} className="btn-secondary-soft rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105">
              Codex
            </button>
            <button type="button" onClick={() => handleDrillDown({ type: 'tool', value: 'claude-code' })} className="btn-secondary-soft rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105">
              Claude
            </button>
            {commandQuery && (
              <button type="button" onClick={() => setCommandQuery('')} className="btn-tertiary-soft rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105">
                Clear filter
              </button>
            )}
          </div>
        </section>

        {/* Metrics Grid */}
        <MetricsGrid
          currentPeriod={stats.currentPeriod}
          previousPeriod={stats.previousPeriod}
          toolBreakdown={stats.currentPeriod.toolBreakdown}
        />

        {/* Top Files Table */}
        <TopFilesTable
          files={visibleFiles}
          hasMore={!commandQuery && stats.topFiles.hasMore}
          isLoading={loadingMore}
          onFileClick={handleDrillDown}
          onLoadMore={handleLoadMoreWithState}
        />
      </main>
    </div>
  );
}
