import type { DashboardTrustState } from "../../../core/types";

interface DashboardTrustBadgeProps {
	trustState: DashboardTrustState;
	className?: string;
}

export function DashboardTrustBadge({
	trustState,
	className = "",
}: DashboardTrustBadgeProps) {
	if (trustState !== "degraded") return null;

	return (
		<output
			className={`inline-flex items-center gap-1 rounded-full border border-accent-amber-light bg-accent-amber-bg px-2.5 py-1 text-[0.6875rem] font-semibold text-accent-amber ${className}`}
			aria-label="Capture reliability degraded"
		>
			<span
				aria-hidden="true"
				className="h-1.5 w-1.5 rounded-full bg-current"
			/>
			Degraded capture
		</output>
	);
}
