import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";

import {
	type TimeRange,
	timeRangeToDateRange,
} from "../../core/attribution-api";
import type { CaptureReliabilityStatus } from "../../core/tauri/ingestConfig";
import { trackDashboardEvent } from "../../core/telemetry/narrativeTelemetry";
import type { DashboardFilter, Mode } from "../../core/types";
import type { RepoState } from "../../hooks/useRepoLoader";
import { DashboardEmptyState } from "../components/dashboard/DashboardEmptyState";
import { DashboardErrorState } from "../components/dashboard/DashboardErrorState";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardLoadingState } from "../components/dashboard/DashboardLoadingState";
import { DashboardMainContent } from "./DashboardMainContent";
import { MOCK_DASHBOARD_STATS } from "./dashboardMockStats";
import { useDashboardViewState } from "./useDashboardViewState";

interface DashboardViewProps {
	repoState: RepoState;
	setRepoState: Dispatch<SetStateAction<RepoState>>;
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
	const {
		timeRange,
		stats,
		setStats,
		visibleFiles,
		hasActiveQuery,
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
	} = useDashboardViewState({
		repoState,
		captureReliabilityStatus,
		setActionError,
		onModeChange,
	});

	const handleDrillDown = useCallback(
		(filter: DashboardFilter) => {
			trackDashboardEvent({
				event: "apply_filter",
				payload: { filter, repo_id: activeRepoId },
			});
			const filterWithDate: DashboardFilter = {
				...filter,
				dateRange:
					filter.dateRange || timeRangeToDateRange(timeRange as TimeRange),
			};
			onDrillDown(filterWithDate);
		},
		[activeRepoId, onDrillDown, timeRange],
	);

	if (repoState.status !== "ready") {
		if (!stats) setStats(MOCK_DASHBOARD_STATS);
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
					repoName={
						repoState.status === "ready"
							? getRepoName(repoState.repo.root)
							: "trace-narrative"
					}
					repoPath={
						repoState.status === "ready"
							? repoState.repo.root
							: "~/dev/trace-narrative"
					}
					timeRange={timeRange}
					onTimeRangeChange={handleTimeRangeChange}
					lastUpdated={lastUpdated}
					trustState={dashboardTrustState}
					onOpenRepo={handleOpenRepo}
					onImportSession={handleImportSession}
				/>
				<DashboardEmptyState reason={emptyReason} onOpenRepo={handleOpenRepo} />
			</div>
		);
	}

	if (!stats) {
		return <DashboardLoadingState />;
	}

	return (
		<DashboardMainContent
			stats={stats}
			repoState={repoState}
			timeRange={timeRange}
			lastUpdated={lastUpdated}
			dashboardTrustState={dashboardTrustState}
			panelStatusMap={panelStatusMap}
			activeRepoId={activeRepoId}
			visibleFiles={visibleFiles}
			loadingMore={loadingMore}
			hasActiveQuery={hasActiveQuery}
			onTimeRangeChange={handleTimeRangeChange}
			onImportSession={handleImportSession}
			onModeChange={(mode) => onModeChange(mode)}
			onFileClick={handleDrillDown}
			onLoadMore={handleLoadMoreWithState}
		/>
	);
}
