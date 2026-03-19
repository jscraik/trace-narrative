import { useEffect, useRef } from "react";
import {
	type HeaderQualityReasonCode,
	type NarrativeHeaderKind,
	type NarrativeRepoStatus,
	type NarrativeTransitionType,
	trackNarrativeEvent,
	trackQualityRenderDecision,
} from "../../../core/telemetry/narrativeTelemetry";
import type {
	BranchHeaderViewModel,
	BranchNarrative,
	NarrativeDetailLevel,
	NarrativeKillSwitchRule,
	NarrativeObservabilityMetrics,
	NarrativeRolloutReport,
} from "../../../core/types";
import { createNarrativeViewInstanceId } from "../branchView.constants";

export type UseBranchTelemetryInput = {
	firstWinAttemptId: string;
	requestIdentityKey: string;
	branchName: string | undefined;
	branchScope: string;
	source: "demo" | "git";
	headerViewModel: BranchHeaderViewModel;
	headerReasonCode: HeaderQualityReasonCode;
	headerDerivationDurationMs: number;
	repoId: number | null;
	selectedNodeId: string | null;
	selectedNodeExists: boolean;
	selectedFile: string | null;
	effectiveDetailLevel: NarrativeDetailLevel;
	narrative: BranchNarrative;
	rolloutReport: NarrativeRolloutReport;
	killSwitchActive: boolean;
	criticalRule: NarrativeKillSwitchRule | undefined;
	bumpObservability: (
		kind: keyof Omit<NarrativeObservabilityMetrics, "lastEventAtISO">,
	) => void;
	narrativeViewInstanceIdRef: React.MutableRefObject<string | null>;
};

function deriveHeaderKind(
	viewModel: BranchHeaderViewModel,
): NarrativeHeaderKind {
	if (viewModel.kind === "hidden") return "hidden";
	if (viewModel.kind === "shell") return "shell";
	return "full";
}

function deriveTransition(previousKey: string | null): NarrativeTransitionType {
	return previousKey ? "state_change" : "initial";
}

function deriveRepoStatus(): NarrativeRepoStatus {
	return "ready";
}

export function useBranchTelemetry(input: UseBranchTelemetryInput): void {
	const {
		firstWinAttemptId,
		requestIdentityKey,
		branchName,
		branchScope,
		source,
		headerViewModel,
		headerReasonCode,
		headerDerivationDurationMs,
		repoId,
		selectedNodeId,
		selectedNodeExists,
		selectedFile,
		effectiveDetailLevel,
		narrative,
		rolloutReport,
		killSwitchActive,
		criticalRule,
		bumpObservability,
		narrativeViewInstanceIdRef,
	} = input;

	const rolloutTelemetryKeyRef = useRef<string | null>(null);
	const killSwitchReasonRef = useRef<string | null>(null);
	const headerDecisionTelemetryKeyRef = useRef<string | null>(null);
	const narrativeViewedKeyRef = useRef<string | null>(null);
	const whatReadyKeyRef = useRef<string | null>(null);

	// Header decision telemetry - uses canonical helper with proper event name
	useEffect(() => {
		const telemetryKey = `${requestIdentityKey}:${headerViewModel.kind}:${headerReasonCode}`;
		const previousKey = headerDecisionTelemetryKeyRef.current;
		if (previousKey === telemetryKey) return;

		headerDecisionTelemetryKeyRef.current = telemetryKey;

		trackQualityRenderDecision({
			branch: branchName,
			source,
			headerKind: deriveHeaderKind(headerViewModel),
			repoStatus: deriveRepoStatus(),
			transition: deriveTransition(previousKey),
			reasonCode: headerReasonCode,
			durationMs: headerDerivationDurationMs,
			budgetMs: 1,
		});
	}, [
		branchName,
		headerDerivationDurationMs,
		headerReasonCode,
		headerViewModel,
		requestIdentityKey,
		source,
	]);

	// Narrative viewed telemetry
	useEffect(() => {
		if (!repoId) return;
		const key = `${repoId}:${branchName ?? "unknown"}`;
		if (narrativeViewedKeyRef.current === key) return;
		narrativeViewedKeyRef.current = key;

		const viewInstanceId = createNarrativeViewInstanceId(repoId, branchName);
		narrativeViewInstanceIdRef.current = viewInstanceId;

		trackNarrativeEvent("narrative_viewed", {
			attemptId: firstWinAttemptId,
			branch: branchName,
			branchScope,
			detailLevel: effectiveDetailLevel,
			confidence: narrative.confidence,
			viewInstanceId,
			funnelStep: "what_ready",
			eventOutcome: "success",
			itemId: selectedNodeId ?? undefined,
			funnelSessionId: `${key}:${selectedNodeId ?? "none"}`,
		});
	}, [
		branchName,
		branchScope,
		effectiveDetailLevel,
		firstWinAttemptId,
		narrative.confidence,
		narrativeViewInstanceIdRef,
		repoId,
		selectedNodeId,
	]);

	// Commit-scoped first-win anchor for timing (`what_ready`)
	useEffect(() => {
		if (!repoId) return;
		if (!selectedNodeId) return;
		if (!selectedNodeExists) return;
		const key = `${repoId}:${branchName ?? "unknown"}:${selectedNodeId}`;
		if (whatReadyKeyRef.current === key) return;
		whatReadyKeyRef.current = key;

		trackNarrativeEvent("what_ready", {
			attemptId: firstWinAttemptId,
			branch: branchName,
			branchScope,
			detailLevel: effectiveDetailLevel,
			confidence: narrative.confidence,
			viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
			itemId: selectedNodeId,
			funnelStep: "what_ready",
			eventOutcome: "success",
			funnelSessionId: `${key}:${selectedFile ?? "no-file"}`,
		});
	}, [
		branchName,
		branchScope,
		effectiveDetailLevel,
		firstWinAttemptId,
		narrative.confidence,
		narrativeViewInstanceIdRef,
		repoId,
		selectedFile,
		selectedNodeId,
		selectedNodeExists,
	]);

	// Rollout scored telemetry
	useEffect(() => {
		const key = `${branchName ?? "unknown"}:${rolloutReport.status}:${rolloutReport.averageScore}`;
		if (rolloutTelemetryKeyRef.current === key) return;
		rolloutTelemetryKeyRef.current = key;

		trackNarrativeEvent("rollout_scored", {
			branch: branchName,
			branchScope,
			confidence: narrative.confidence,
			rolloutStatus: rolloutReport.status,
			score: rolloutReport.averageScore,
		});
	}, [
		branchName,
		branchScope,
		narrative.confidence,
		rolloutReport.averageScore,
		rolloutReport.status,
	]);

	// Kill switch triggered telemetry
	useEffect(() => {
		if (!killSwitchActive) {
			killSwitchReasonRef.current = null;
			return;
		}

		const reason = criticalRule?.id ?? "rollback_guard";
		if (killSwitchReasonRef.current === reason) return;
		killSwitchReasonRef.current = reason;
		bumpObservability("killSwitchTriggeredCount");

		trackNarrativeEvent("kill_switch_triggered", {
			branch: branchName,
			branchScope,
			confidence: narrative.confidence,
			rolloutStatus: rolloutReport.status,
			reason,
		});
	}, [
		bumpObservability,
		branchName,
		branchScope,
		criticalRule?.id,
		killSwitchActive,
		narrative.confidence,
		rolloutReport.status,
	]);
}
