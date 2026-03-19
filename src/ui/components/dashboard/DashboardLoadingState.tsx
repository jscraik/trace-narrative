/**
 * DashboardLoadingState
 *
 * Skeleton loading state for the dashboard.
 * Matches the final layout 1:1 to prevent layout shift (no jank!).
 * Uses shimmer animation with staggered delays for a polished feel.
 */

export function DashboardLoadingState() {
	return (
		<div className="dashboard-container">
			{/* Header Skeleton */}
			<div className="h-16 bg-bg-secondary border-b border-border-light px-6 mb-6 skeleton-shimmer" />

			{/* Metrics Grid Skeleton - 4 cards with stagger */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
				<div
					className="h-32 bg-bg-tertiary rounded-lg skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "0ms" }}
				/>
				<div
					className="h-32 bg-bg-tertiary rounded-lg skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "100ms" }}
				/>
				<div
					className="h-32 bg-bg-tertiary rounded-lg skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "200ms" }}
				/>
				<div
					className="h-32 bg-bg-tertiary rounded-lg skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "300ms" }}
				/>
			</div>

			{/* Table Header Skeleton */}
			<div className="h-8 w-48 bg-bg-tertiary rounded mb-4 skeleton-shimmer" />

			{/* Table Rows Skeleton with stagger */}
			<div className="space-y-3">
				<div
					className="h-12 bg-bg-tertiary rounded skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "0ms" }}
				/>
				<div
					className="h-12 bg-bg-tertiary rounded skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "75ms" }}
				/>
				<div
					className="h-12 bg-bg-tertiary rounded skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "150ms" }}
				/>
				<div
					className="h-12 bg-bg-tertiary rounded skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "225ms" }}
				/>
				<div
					className="h-12 bg-bg-tertiary rounded skeleton-shimmer"
					aria-hidden="true"
					style={{ animationDelay: "300ms" }}
				/>
			</div>
		</div>
	);
}

/**
 * Add this CSS for shimmer animation:
 *
 * .animate-pulse {
 *   animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
 * }
 *
 * @keyframes pulse {
 *   0%, 100% {
 *     opacity: 1;
 *   }
 *   50% {
 *     opacity: 0.5;
 *   }
 * }
 *
 * For reduced motion:
 *
 * @media (prefers-reduced-motion: reduce) {
 *   .animate-pulse {
 *     animation: none;
 *   }
 * }
 */
