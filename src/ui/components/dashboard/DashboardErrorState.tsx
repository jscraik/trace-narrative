import { AlertCircle, RefreshCw } from "lucide-react";
import type { DashboardState } from "../../../core/types";

interface DashboardErrorStateProps {
	error: string;
	onRetry: () => void;
	state?: Extract<DashboardState, "error" | "offline" | "permission_denied">;
	onBackToRepo?: () => void;
	canRetry?: boolean;
}

const COPY: Record<
	Extract<DashboardState, "error" | "offline" | "permission_denied">,
	{
		title: string;
		description: string;
		actionLabel: string;
	}
> = {
	error: {
		title: "Failed to load dashboard",
		description: "The dashboard request did not complete successfully.",
		actionLabel: "Try again",
	},
	offline: {
		title: "Dashboard is offline",
		description:
			"Narrative could not confirm a healthy capture source for dashboard data.",
		actionLabel: "Retry load",
	},
	permission_denied: {
		title: "Dashboard permission denied",
		description:
			"This dashboard request was denied by the current authority boundary.",
		actionLabel: "Back to repo",
	},
};

export function DashboardErrorState({
	error,
	onRetry,
	state = "error",
	onBackToRepo,
	canRetry = true,
}: DashboardErrorStateProps) {
	const copy = COPY[state];
	const isPermissionDenied = state === "permission_denied";

	return (
		<div className="dashboard-error-state flex flex-col items-center justify-center min-h-[31.25rem] px-6 py-12">
			{/* Error Icon */}
			<div
				className="mb-6 flex h-16 w-16 animate-shake-once items-center justify-center rounded-full bg-accent-red-bg"
				aria-hidden="true"
			>
				<AlertCircle className="h-8 w-8 text-accent-red" />
			</div>

			{/* Error Message */}
			<div className="max-w-md text-center">
				<h2 className="mb-2 text-xl font-semibold text-text-primary">
					{copy.title}
				</h2>
				<p className="mb-2 text-sm text-text-secondary">{copy.description}</p>
				<p className="mb-6 text-sm text-text-tertiary">{error}</p>

				{/* Retry Button */}
				<div className="flex items-center justify-center gap-3">
					{isPermissionDenied ? (
						<button
							type="button"
							onClick={onBackToRepo}
							className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-text-secondary transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:bg-bg-hover hover:text-text-primary hover:scale-105"
						>
							<span>{copy.actionLabel}</span>
						</button>
					) : (
						<button
							type="button"
							onClick={onRetry}
							disabled={!canRetry}
							className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-text-secondary transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:bg-bg-hover hover:text-text-primary hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
						>
							<RefreshCw className="w-4 h-4" />
							<span>{copy.actionLabel}</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
