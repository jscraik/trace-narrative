import { render, screen } from "@testing-library/react";
import { describe, it } from "vitest";
import type {
	CaptureReliabilityStatus,
	CodexAppServerStatus,
} from "../../../core/tauri/ingestConfig";
import {
	type TrustState,
	TrustStateCompact,
	TrustStateIndicator,
} from "../TrustStateIndicator";

describe("TrustStateIndicator", () => {
	const mockCaptureReliabilityStatus: CaptureReliabilityStatus = {
		mode: "HYBRID_ACTIVE",
		otelBaselineHealthy: true,
		streamExpected: true,
		streamHealthy: true,
		reasons: [],
		metrics: {
			streamEventsAccepted: 100,
			streamEventsDuplicates: 5,
			streamEventsDropped: 0,
			streamEventsReplaced: 2,
		},
		transitions: [],
		appServer: {
			state: "running",
			initialized: true,
			initializeSent: true,
			authState: "authenticated",
			authMode: "interactive",
			streamHealthy: true,
			streamKillSwitch: false,
			restartBudget: 3,
			restartAttemptsInWindow: 0,
		},
	};

	const mockCodexAppServerStatus: CodexAppServerStatus = {
		state: "running",
		initialized: true,
		initializeSent: true,
		authState: "authenticated",
		authMode: "interactive",
		streamHealthy: true,
		streamKillSwitch: false,
		restartBudget: 3,
		restartAttemptsInWindow: 0,
	};

	describe("state rendering", () => {
		it.each<[TrustState, string]>([
			["none", "No Thread"],
			["hydrating", "Hydrating"],
			["replaying", "Replaying"],
			["live_trusted", "Live Trusted"],
			["trust_paused", "Trust Paused"],
		])("renders correct label for %s state", (state, expectedLabel) => {
			render(
				<TrustStateIndicator
					trustState={state}
					activeThreadId="test-thread-123"
				/>,
			);
			expect(screen.getByText(expectedLabel)).toBeInTheDocument();
		});
	});

	describe("activeThreadId display", () => {
		it("displays truncated thread ID", () => {
			render(
				<TrustStateIndicator
					trustState="live_trusted"
					activeThreadId="thread-abc-123-def-456"
				/>,
			);
			expect(screen.getByText(/thread-a…/)).toBeInTheDocument();
		});

		it("handles null thread ID", () => {
			render(<TrustStateIndicator trustState="none" activeThreadId={null} />);
			expect(screen.getByText("No Thread")).toBeInTheDocument();
		});
	});

	describe("trust_paused recovery affordances", () => {
		it("shows retry button when onRetryHydrate provided", () => {
			const onRetry = vi.fn();
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
					onRetryHydrate={onRetry}
				/>,
			);
			expect(screen.getByText("Retry Hydrate")).toBeInTheDocument();
		});

		it("shows clear stale state button when onClearStaleState provided", () => {
			const onClear = vi.fn();
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
					onClearStaleState={onClear}
				/>,
			);
			expect(screen.getByText("Clear Stale State")).toBeInTheDocument();
		});

		it("shows blocking reasons from captureReliabilityStatus", () => {
			const statusWithReasons: CaptureReliabilityStatus = {
				...mockCaptureReliabilityStatus,
				reasons: ["Stream disconnected", "Auth drift detected"],
			};
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
					captureReliabilityStatus={statusWithReasons}
				/>,
			);
			expect(screen.getByText("Blocking Reasons")).toBeInTheDocument();
			expect(screen.getByText("Stream disconnected")).toBeInTheDocument();
		});

		it("shows blocking reason from codexAppServerStatus lastError", () => {
			const statusWithError: CodexAppServerStatus = {
				...mockCodexAppServerStatus,
				lastError: "Connection refused",
			};
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
					codexAppServerStatus={statusWithError}
				/>,
			);
			expect(screen.getByText("Connection refused")).toBeInTheDocument();
		});

		it("shows auth required message when authState is needs_login", () => {
			const statusNeedsLogin: CodexAppServerStatus = {
				...mockCodexAppServerStatus,
				authState: "needs_login",
			};
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
					codexAppServerStatus={statusNeedsLogin}
				/>,
			);
			expect(screen.getByText("Authentication required")).toBeInTheDocument();
		});

		it("shows crash loop message when state is crash_loop", () => {
			const statusCrashLoop: CodexAppServerStatus = {
				...mockCodexAppServerStatus,
				state: "crash_loop",
			};
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
					codexAppServerStatus={statusCrashLoop}
				/>,
			);
			expect(screen.getByText("App server in crash loop")).toBeInTheDocument();
		});

		it("shows approvals disabled message", () => {
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
				/>,
			);
			expect(
				screen.getByText("Approvals are disabled until trust is restored"),
			).toBeInTheDocument();
		});
	});

	describe("button interactions", () => {
		it("calls onRetryHydrate when retry button clicked", () => {
			const onRetry = vi.fn();
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
					onRetryHydrate={onRetry}
				/>,
			);
			screen.getByText("Retry Hydrate").click();
			expect(onRetry).toHaveBeenCalledTimes(1);
		});

		it("calls onClearStaleState when clear button clicked", () => {
			const onClear = vi.fn();
			render(
				<TrustStateIndicator
					trustState="trust_paused"
					activeThreadId="test-thread"
					onClearStaleState={onClear}
				/>,
			);
			screen.getByText("Clear Stale State").click();
			expect(onClear).toHaveBeenCalledTimes(1);
		});
	});

	describe("TrustStateCompact", () => {
		it.each<[TrustState, string]>([
			["live_trusted", "Live Trusted"],
			["hydrating", "Hydrating"],
			["trust_paused", "Trust Paused"],
		])("renders compact indicator for %s state", (state, expectedLabel) => {
			render(<TrustStateCompact trustState={state} />);
			expect(screen.getByText(expectedLabel)).toBeInTheDocument();
		});
	});
});
