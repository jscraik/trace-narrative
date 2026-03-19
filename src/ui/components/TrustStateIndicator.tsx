/**
 * TrustStateIndicator - Renders the four runtime trust states
 *
 * Phase 4: Trust-state UX and narrative host integration
 *
 * Trust states:
 * - none: No active thread selected
 * - hydrating: Loading baseline snapshot before live events
 * - replaying: Replaying historical events deterministically
 * - live_trusted: Live events are being merged with trusted baseline
 * - trust_paused: Trust paused due to divergence, auth drift, or error
 *
 * Recovery affordances for trust_paused:
 * - Retry hydrate from fresh snapshot
 * - Clear stale state (requires privileged authorization)
 * - View blocking reason detail
 */

import type {
	CaptureReliabilityStatus,
	CodexAppServerStatus,
} from "../../core/tauri/ingestConfig";

export type TrustState =
	| "none"
	| "hydrating"
	| "replaying"
	| "live_trusted"
	| "trust_paused";

export type TrustStateIndicatorProps = {
	trustState: TrustState;
	activeThreadId: string | null;
	captureReliabilityStatus?: CaptureReliabilityStatus | null;
	codexAppServerStatus?: CodexAppServerStatus | null;
	onRetryHydrate?: () => void;
	onClearStaleState?: () => void;
	className?: string;
};

function stateStyle(state: TrustState): {
	bg: string;
	text: string;
	border: string;
	icon: string;
} {
	switch (state) {
		case "live_trusted":
			return {
				bg: "bg-accent-green-bg",
				text: "text-accent-green",
				border: "border-accent-green-light",
				icon: "✓",
			};
		case "hydrating":
			return {
				bg: "bg-accent-blue-bg",
				text: "text-accent-blue",
				border: "border-accent-blue-light",
				icon: "◐",
			};
		case "replaying":
			return {
				bg: "bg-accent-purple-bg",
				text: "text-accent-purple",
				border: "border-accent-purple-light",
				icon: "↻",
			};
		case "trust_paused":
			return {
				bg: "bg-accent-red-bg",
				text: "text-accent-red",
				border: "border-accent-red-light",
				icon: "!",
			};
		default:
			return {
				bg: "bg-bg-secondary",
				text: "text-text-muted",
				border: "border-border-subtle",
				icon: "○",
			};
	}
}

function stateLabel(state: TrustState): string {
	switch (state) {
		case "live_trusted":
			return "Live Trusted";
		case "hydrating":
			return "Hydrating";
		case "replaying":
			return "Replaying";
		case "trust_paused":
			return "Trust Paused";
		default:
			return "No Thread";
	}
}

function stateDescription(state: TrustState): string {
	switch (state) {
		case "live_trusted":
			return "Live events are being merged with a trusted baseline.";
		case "hydrating":
			return "Loading baseline snapshot before accepting live events.";
		case "replaying":
			return "Replaying historical events deterministically.";
		case "trust_paused":
			return "Trust paused due to divergence, auth drift, or error.";
		default:
			return "No thread is currently selected.";
	}
}

export function TrustStateIndicator(props: TrustStateIndicatorProps) {
	const {
		trustState,
		activeThreadId,
		captureReliabilityStatus,
		codexAppServerStatus,
		onRetryHydrate,
		onClearStaleState,
		className = "",
	} = props;

	const styles = stateStyle(trustState);
	const label = stateLabel(trustState);
	const description = stateDescription(trustState);

	// Extract blocking reasons for trust_paused state
	const blockingReasons: string[] = [];
	if (trustState === "trust_paused") {
		if (captureReliabilityStatus?.reasons.length) {
			blockingReasons.push(...captureReliabilityStatus.reasons);
		}
		if (codexAppServerStatus?.lastError) {
			blockingReasons.push(codexAppServerStatus.lastError);
		}
		if (codexAppServerStatus?.authState === "needs_login") {
			blockingReasons.push("Authentication required");
		}
		if (codexAppServerStatus?.state === "crash_loop") {
			blockingReasons.push("App server in crash loop");
		}
	}

	// Determine actionability
	const canRetry =
		trustState === "trust_paused" && activeThreadId !== null && onRetryHydrate;
	const canClearStale =
		trustState === "trust_paused" &&
		activeThreadId !== null &&
		onClearStaleState;

	return (
		<output
			className={`block rounded-lg border px-3 py-2 ${styles.bg} ${styles.border} ${className}`}
			aria-live="polite"
			aria-label={`Trust state: ${label}`}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<span className={`text-sm ${styles.text}`} aria-hidden="true">
						{styles.icon}
					</span>
					<span
						className={`text-xs font-semibold uppercase tracking-wide ${styles.text}`}
					>
						{label}
					</span>
				</div>
				{activeThreadId && (
					<span
						className="text-[0.625rem] font-mono text-text-muted"
						title={activeThreadId}
					>
						{activeThreadId.slice(0, 8)}…
					</span>
				)}
			</div>

			<p className="mt-1 text-[0.6875rem] leading-relaxed text-text-secondary">
				{description}
			</p>

			{trustState === "trust_paused" && blockingReasons.length > 0 && (
				<div className="mt-2 space-y-1">
					<div className="text-[0.625rem] font-semibold uppercase tracking-wide text-text-muted">
						Blocking Reasons
					</div>
					<ul className="list-disc space-y-0.5 pl-3 text-[0.6875rem] text-text-tertiary">
						{blockingReasons.slice(0, 3).map((reason, _index) => (
							<li key={`br-${reason.slice(0, 20)}`}>{reason}</li>
						))}
					</ul>
				</div>
			)}

			{trustState === "trust_paused" && (canRetry || canClearStale) && (
				<div className="mt-3 flex flex-wrap items-center gap-2">
					{canRetry && (
						<button
							type="button"
							onClick={onRetryHydrate}
							className="rounded-md border border-accent-amber-light bg-bg-primary px-2.5 py-1 text-[0.6875rem] font-medium text-accent-amber transition-colors hover:bg-bg-secondary"
						>
							Retry Hydrate
						</button>
					)}
					{canClearStale && (
						<button
							type="button"
							onClick={onClearStaleState}
							className="rounded-md border border-accent-red-light bg-bg-primary px-2.5 py-1 text-[0.6875rem] font-medium text-accent-red transition-colors hover:bg-bg-secondary"
						>
							Clear Stale State
						</button>
					)}
				</div>
			)}

			{trustState === "trust_paused" && (
				<p className="mt-2 text-[0.625rem] text-text-muted">
					Approvals are disabled until trust is restored
				</p>
			)}
		</output>
	);
}

/**
 * TrustStateCompact - Minimal inline indicator for header/toolbar use
 */
export function TrustStateCompact(props: {
	trustState: TrustState;
	className?: string;
}) {
	const { trustState, className = "" } = props;
	const styles = stateStyle(trustState);

	return (
		<output
			className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${styles.bg} ${styles.text} ${className}`}
			aria-label={`Trust: ${stateLabel(trustState)}`}
		>
			<span aria-hidden="true">{styles.icon}</span>
			{stateLabel(trustState)}
		</output>
	);
}
