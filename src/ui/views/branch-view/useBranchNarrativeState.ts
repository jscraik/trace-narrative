import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { composeBranchNarrative } from "../../../core/narrative/composeBranchNarrative";
import { buildDecisionArchaeology } from "../../../core/narrative/decisionArchaeology";
import { buildRecallLane } from "../../../core/narrative/recallLane";
import { evaluateNarrativeRollout } from "../../../core/narrative/rolloutGovernance";
import { buildStakeholderProjections } from "../../../core/narrative/stakeholderProjections";
import { loadGitHubContext } from "../../../core/repo/githubContext";
import { getNarrativeCalibrationProfile } from "../../../core/repo/narrativeFeedback";
import type {
	BranchNarrative,
	BranchViewModel,
	DecisionArchaeologyEntry,
	GitHubContextState,
	NarrativeCalibrationProfile,
	NarrativeDetailLevel,
	NarrativeFeedbackActorRole,
	NarrativeKillSwitchRule,
	NarrativeObservabilityMetrics,
	NarrativeRecallLaneItem,
	NarrativeRolloutReport,
	StakeholderAudience,
	StakeholderProjections,
} from "../../../core/types";

export type UseBranchNarrativeStateInput = {
	model: BranchViewModel;
	calibrationEnabled: boolean;
	githubConnectorEnabled: boolean;
	branchScopeKey: string;
};

export type UseBranchNarrativeStateOutput = {
	// State
	detailLevel: NarrativeDetailLevel;
	audience: StakeholderAudience;
	feedbackActorRole: NarrativeFeedbackActorRole;
	narrativeCalibration: NarrativeCalibrationProfile | null;
	githubContext: GitHubContextState;
	observability: NarrativeObservabilityMetrics;

	// Derived
	narrative: BranchNarrative;
	recallLaneItems: NarrativeRecallLaneItem[];
	projections: StakeholderProjections;
	archaeologyEntries: DecisionArchaeologyEntry[];
	rolloutReport: NarrativeRolloutReport;
	effectiveDetailLevel: NarrativeDetailLevel;
	killSwitchActive: boolean;
	criticalRule: NarrativeKillSwitchRule | undefined;

	// Actions
	setDetailLevel: (level: NarrativeDetailLevel) => void;
	setAudience: (audience: StakeholderAudience) => void;
	setFeedbackActorRole: (role: NarrativeFeedbackActorRole) => void;
	setNarrativeCalibration: (
		profile: NarrativeCalibrationProfile | null,
	) => void;
	bumpObservability: (
		kind: keyof Omit<NarrativeObservabilityMetrics, "lastEventAtISO">,
	) => void;
};

export function useBranchNarrativeState(
	input: UseBranchNarrativeStateInput,
): UseBranchNarrativeStateOutput {
	const { model, calibrationEnabled, githubConnectorEnabled, branchScopeKey } =
		input;

	const [detailLevel, setDetailLevel] =
		useState<NarrativeDetailLevel>("summary");
	const [feedbackActorRole, setFeedbackActorRole] =
		useState<NarrativeFeedbackActorRole>("developer");
	const [narrativeCalibration, setNarrativeCalibration] =
		useState<NarrativeCalibrationProfile | null>(null);
	const [audience, setAudience] = useState<StakeholderAudience>("manager");
	const [githubContext, setGithubContext] = useState<GitHubContextState>({
		status: githubConnectorEnabled ? "loading" : "disabled",
		entries: [],
	});
	const [observability, setObservability] =
		useState<NarrativeObservabilityMetrics>({
			layerSwitchedCount: 0,
			evidenceOpenedCount: 0,
			fallbackUsedCount: 0,
			killSwitchTriggeredCount: 0,
		});

	const feedbackContextRef = useRef<string>("");

	const repoId = model.meta?.repoId ?? null;
	const feedbackContextKey = `${repoId ?? "none"}:${model.meta?.branchName ?? "unknown"}`;

	// Update feedback context ref for stale-guard checks
	useEffect(() => {
		feedbackContextRef.current = feedbackContextKey;
	}, [feedbackContextKey]);

	// Reset state on branch change
	useEffect(() => {
		void branchScopeKey;
		setFeedbackActorRole("developer");
		setObservability({
			layerSwitchedCount: 0,
			evidenceOpenedCount: 0,
			fallbackUsedCount: 0,
			killSwitchTriggeredCount: 0,
		});
	}, [branchScopeKey]);

	// Derived narrative with calibration
	const narrative = useMemo(
		() =>
			composeBranchNarrative(model, {
				calibration: calibrationEnabled ? narrativeCalibration : null,
			}),
		[model, narrativeCalibration, calibrationEnabled],
	);

	// Derived recall lane items
	const recallLaneItems = useMemo(() => {
		return buildRecallLane(narrative, {
			maxItems: 3,
			confidenceFloor: 0,
		});
	}, [narrative]);

	// Derived stakeholder projections
	const projections = useMemo(
		() =>
			buildStakeholderProjections({
				narrative,
				model,
				githubEntry: githubContext.entries[0],
			}),
		[githubContext.entries, model, narrative],
	);

	// Derived decision archaeology
	const archaeologyEntries = useMemo(
		() =>
			buildDecisionArchaeology({
				narrative,
				githubEntry: githubContext.entries[0],
			}),
		[githubContext.entries, narrative],
	);

	// Derived rollout report
	const rolloutReport = useMemo(
		() =>
			evaluateNarrativeRollout({
				narrative,
				projections,
				githubContextState: githubContext,
				observability,
			}),
		[githubContext, narrative, observability, projections],
	);

	// Derived kill switch state
	const criticalRule = rolloutReport.rules.find(
		(rule) => rule.triggered && rule.severity === "critical",
	);
	const killSwitchActive = rolloutReport.status === "rollback";
	const effectiveDetailLevel: NarrativeDetailLevel = killSwitchActive
		? "diff"
		: detailLevel;

	// Load narrative calibration profile
	useEffect(() => {
		if (!calibrationEnabled || !repoId) {
			setNarrativeCalibration(null);
			return;
		}

		let cancelled = false;
		const calibrationContextAtLoad = feedbackContextKey;
		setNarrativeCalibration(null);
		getNarrativeCalibrationProfile(repoId)
			.then((profile) => {
				if (cancelled) return;
				if (feedbackContextRef.current !== calibrationContextAtLoad) return;
				setNarrativeCalibration(profile);
			})
			.catch(() => {
				if (cancelled) return;
				if (feedbackContextRef.current !== calibrationContextAtLoad) return;
				setNarrativeCalibration(null);
			});

		return () => {
			cancelled = true;
		};
	}, [feedbackContextKey, calibrationEnabled, repoId]);

	// Load GitHub context
	useEffect(() => {
		const root = model.meta?.repoPath;
		if (!root) {
			setGithubContext({ status: "empty", entries: [] });
			return;
		}
		if (!githubConnectorEnabled) {
			setGithubContext({ status: "disabled", entries: [] });
			return;
		}

		let cancelled = false;
		setGithubContext((prev) => ({
			...prev,
			status: "loading",
			error: undefined,
		}));
		loadGitHubContext(root)
			.then((state) => {
				if (cancelled) return;
				setGithubContext(state);
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				const message = error instanceof Error ? error.message : String(error);
				setGithubContext({
					status: "error",
					entries: [],
					error: message,
				});
			});
		return () => {
			cancelled = true;
		};
	}, [githubConnectorEnabled, model.meta?.repoPath]);

	// Bump observability metric
	const bumpObservability = useCallback(
		(kind: keyof Omit<NarrativeObservabilityMetrics, "lastEventAtISO">) => {
			setObservability((prev) => ({
				...prev,
				[kind]: prev[kind] + 1,
				lastEventAtISO: new Date().toISOString(),
			}));
		},
		[],
	);

	return {
		// State
		detailLevel,
		audience,
		feedbackActorRole,
		narrativeCalibration,
		githubContext,
		observability,

		// Derived
		narrative,
		recallLaneItems,
		projections,
		archaeologyEntries,
		rolloutReport,
		effectiveDetailLevel,
		killSwitchActive,
		criticalRule,

		// Actions
		setDetailLevel,
		setAudience,
		setFeedbackActorRole,
		setNarrativeCalibration,
		bumpObservability,
	};
}
