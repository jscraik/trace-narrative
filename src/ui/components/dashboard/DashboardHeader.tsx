import { Calendar, ChevronDown } from "lucide-react";
import type {
	DashboardTrustState,
	TimeRange,
	TimeRangePreset,
} from "../../../core/types";
import { DashboardTrustBadge } from "./DashboardTrustBadge";
import { TIME_RANGE_PRESETS } from "./timeRangeUtils";

interface DashboardHeaderProps {
	repoName: string | null;
	repoPath?: string;
	timeRange: TimeRange;
	onTimeRangeChange: (timeRange: TimeRange) => void;
	lastUpdated?: Date;
	trustState?: DashboardTrustState;
	onOpenRepo?: () => void;
	onImportSession?: () => void;
}

export function DashboardHeader({
	repoName,
	repoPath: _repoPath,
	timeRange,
	onTimeRangeChange,
	lastUpdated,
	trustState = "healthy",
	onOpenRepo: _onOpenRepo,
	onImportSession: _onImportSession,
}: DashboardHeaderProps) {
	return (
		<header
			data-dashboard-header
			className="sticky top-0 z-10 h-14 bg-bg-subtle  border-b border-border-subtle px-6"
		>
			<div className="flex items-center justify-between h-full">
				{/* Left: Repo info */}
				<div className="flex items-center gap-3">
					<h1 className="text-lg font-semibold text-text-primary">
						{repoName || "Dashboard"}
					</h1>
					<DashboardTrustBadge trustState={trustState} />
				</div>

				{/* Right: Time range picker + last updated */}
				<div className="flex items-center gap-4">
					{/* Time Range Picker */}
					<div className="flex items-center gap-2">
						<Calendar className="w-4 h-4 text-text-tertiary" />
						<div className="relative">
							<select
								aria-label="Time range"
								value={typeof timeRange === "string" ? timeRange : "30d"}
								onChange={(e) => {
									const value = e.target.value as TimeRangePreset;
									onTimeRangeChange(value);
								}}
								className="appearance-none bg-bg-primary hover:bg-bg-hover text-text-secondary text-sm font-medium rounded-md pl-3 pr-8 py-1.5 transition-colors cursor-pointer border border-border-light"
							>
								{TIME_RANGE_PRESETS.map((preset) => (
									<option key={preset.value} value={preset.value}>
										{preset.label}
									</option>
								))}
							</select>
							<ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary pointer-events-none" />
						</div>
					</div>

					<div className="h-4 w-px bg-border-subtle" />

					{/* Sync status / Last Updated */}
					<div className="flex items-center gap-2">
						{lastUpdated && (
							<span className="text-[0.625rem] uppercase tracking-wider font-bold text-text-muted opacity-80">
								Synced{" "}
								{lastUpdated.toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						)}
						<div className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_8px_var(--accent-green)]" />
					</div>
				</div>
			</div>
		</header>
	);
}
