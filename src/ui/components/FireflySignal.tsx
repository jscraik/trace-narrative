import { useEffect, useMemo, useState } from "react";
import type { FireflyEvent } from "../../hooks/useFirefly";

export interface FireflySignalProps {
	/** X position relative to container */
	x: number;
	/** Y position relative to container */
	y: number;
	/** Current event state */
	event?: FireflyEvent;
	/** Whether the firefly is disabled (hidden) */
	disabled?: boolean;
	/** Custom burst animation (transient) */
	burstType?: "success" | "error" | null;
}

/**
 * Firefly Signal Component
 *
 * An ambient UI instrument that provides persistent, non-intrusive feedback
 * about system state. Renders as a glowing orb with semantic state classes.
 *
 * @example
 * <FireflySignal x={100} y={20} event={{ type: 'idle', selectedNodeId: null }} />
 */
export function FireflySignal({
	x,
	y,
	event = { type: "idle", selectedNodeId: null },
	disabled = false,
	burstType = null,
}: FireflySignalProps) {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function"
		)
			return;

		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setPrefersReducedMotion(query.matches);

		update();
		query.addEventListener("change", update);

		return () => {
			query.removeEventListener("change", update);
		};
	}, []);

	const motionClass = useMemo(() => {
		if (prefersReducedMotion) {
			return `firefly-${event.type}-static`;
		}
		return `animate-firefly-${event.type}`;
	}, [event.type, prefersReducedMotion]);

	if (disabled) return null;

	return (
		<div
			className="firefly"
			style={{
				transform: `translate(${x}px, ${y}px)`,
			}}
			aria-hidden="true"
			data-testid="firefly-signal"
			data-state={event.type}
			data-reduced-motion={prefersReducedMotion ? "true" : "false"}
		>
			<div className="firefly-wings">
				<div className="firefly-wing left" />
				<div className="firefly-wing right" />
			</div>
			<div
				className={[
					"firefly-orb",
					`firefly-${event.type}`,
					motionClass,
					burstType ? `firefly-burst-${burstType}` : "",
				]
					.filter(Boolean)
					.join(" ")}
			/>
		</div>
	);
}
