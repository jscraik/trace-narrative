import { describe, expect, it } from "vitest";

import type { CaptureReliabilityStatus } from "../../../core/tauri/ingestConfig";
import { describeSurfaceTrust } from "../dashboardState";

function createCaptureReliabilityStatus(
	overrides: Partial<CaptureReliabilityStatus> = {},
): CaptureReliabilityStatus {
	return {
		mode: "HYBRID_ACTIVE",
		otelBaselineHealthy: true,
		streamExpected: true,
		streamHealthy: true,
		reasons: [],
		metrics: {
			streamEventsAccepted: 12,
			streamEventsDuplicates: 0,
			streamEventsDropped: 0,
			streamEventsReplaced: 0,
		},
		transitions: [],
		appServer: {
			state: "running",
			initialized: true,
			initializeSent: true,
			authState: "authenticated",
			authMode: "device_code",
			streamHealthy: true,
			streamKillSwitch: false,
			restartBudget: 3,
			restartAttemptsInWindow: 0,
		},
		...overrides,
	};
}

describe("describeSurfaceTrust", () => {
	it("defaults to healthy trust when no capture status exists", () => {
		const result = describeSurfaceTrust();

		expect(result.trustState).toBe("healthy");
		expect(result.trustLabel).toBe("Capture healthy");
		expect(result.reliabilityMode).toBe("HYBRID_ACTIVE");
	});

	it("treats unknown capture modes as degraded", () => {
		const unknownModeStatus = {
			...createCaptureReliabilityStatus(),
			mode: "NONSENSE_MODE",
		} as unknown as CaptureReliabilityStatus;

		const result = describeSurfaceTrust(unknownModeStatus);

		expect(result.trustState).toBe("degraded");
		expect(result.trustLabel).toBe("Capture degraded");
		expect(result.reliabilityMode).toBe("NONSENSE_MODE");
	});

	it("uses OTEL_ONLY baseline health to determine trust state", () => {
		const healthyOtelOnly = createCaptureReliabilityStatus({
			mode: "OTEL_ONLY",
			otelBaselineHealthy: true,
		});
		const degradedOtelOnly = createCaptureReliabilityStatus({
			mode: "OTEL_ONLY",
			otelBaselineHealthy: false,
		});

		expect(describeSurfaceTrust(healthyOtelOnly).trustState).toBe("healthy");
		expect(describeSurfaceTrust(healthyOtelOnly).trustLabel).toBe(
			"Capture baseline healthy",
		);
		expect(describeSurfaceTrust(degradedOtelOnly).trustState).toBe("degraded");
		expect(describeSurfaceTrust(degradedOtelOnly).trustLabel).toBe(
			"Capture baseline healthy, stream unavailable",
		);
	});
});
