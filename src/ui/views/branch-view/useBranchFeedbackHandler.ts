import { useCallback } from "react";
import { submitNarrativeFeedback } from "../../../core/repo/narrativeFeedback";
import { trackNarrativeEvent } from "../../../core/telemetry/narrativeTelemetry";
import type {
	NarrativeCalibrationProfile,
	NarrativeDetailLevel,
	NarrativeFeedbackAction,
	NarrativeFeedbackActorRole,
	StakeholderAudience,
} from "../../../core/types";

export type UseBranchFeedbackHandlerInput = {
	repoId: number | null;
	branchName: string | undefined;
	narrativeConfidence: number;
	effectiveDetailLevel: NarrativeDetailLevel;
	calibrationEnabled: boolean;
	feedbackActorRole: NarrativeFeedbackActorRole;
	audience: StakeholderAudience;
	narrativeViewInstanceIdRef: React.MutableRefObject<string | null>;
	isMountedRef: React.MutableRefObject<boolean>;
	feedbackContextRef: React.MutableRefObject<string>;
	setActionError: (error: string | null) => void;
	setNarrativeCalibration: (
		profile: NarrativeCalibrationProfile | null,
	) => void;
	setFeedbackActorRole: (role: NarrativeFeedbackActorRole) => void;
	setAudience: (audience: StakeholderAudience) => void;
};

export type UseBranchFeedbackHandlerOutput = {
	handleSubmitFeedback: (feedback: NarrativeFeedbackAction) => Promise<void>;
	handleFeedbackRoleChange: (role: NarrativeFeedbackActorRole) => void;
	handleAudienceChange: (audience: StakeholderAudience) => void;
};

export function useBranchFeedbackHandler(
	input: UseBranchFeedbackHandlerInput,
): UseBranchFeedbackHandlerOutput {
	const {
		repoId,
		branchName,
		narrativeConfidence,
		effectiveDetailLevel,
		calibrationEnabled,
		feedbackActorRole,
		audience,
		narrativeViewInstanceIdRef,
		isMountedRef,
		feedbackContextRef,
		setActionError,
		setNarrativeCalibration,
		setFeedbackActorRole,
		setAudience,
	} = input;

	const handleSubmitFeedback = useCallback(
		async (feedback: NarrativeFeedbackAction) => {
			if (!repoId) return;
			if (!branchName) {
				setActionError(
					"Unable to save narrative feedback: missing branch context.",
				);
				return;
			}
			const feedbackContextAtSubmit = feedbackContextRef.current;
			try {
				const result = await submitNarrativeFeedback({
					repoId,
					branchName,
					action: feedback,
				});
				if (!isMountedRef.current) return;
				if (feedbackContextRef.current !== feedbackContextAtSubmit) return;
				if (calibrationEnabled) {
					setNarrativeCalibration(result.profile);
				}
				if (!result.inserted) return;
				trackNarrativeEvent("feedback_submitted", {
					branch: branchName,
					detailLevel: feedback.detailLevel,
					confidence: narrativeConfidence,
					feedbackType: feedback.feedbackType,
					feedbackTargetKind: feedback.targetKind,
					feedbackActorRole: result.verifiedActorRole,
					// Read view instance id lazily from ref at submit time
					viewInstanceId: narrativeViewInstanceIdRef.current ?? undefined,
				});
			} catch (error) {
				if (!isMountedRef.current) return;
				if (feedbackContextRef.current !== feedbackContextAtSubmit) return;
				const message = error instanceof Error ? error.message : String(error);
				setActionError(`Unable to save narrative feedback: ${message}`);
			}
		},
		[
			repoId,
			branchName,
			narrativeConfidence,
			calibrationEnabled,
			setActionError,
			setNarrativeCalibration,
			isMountedRef,
			feedbackContextRef,
			narrativeViewInstanceIdRef,
		],
	);

	const handleFeedbackRoleChange = useCallback(
		(role: NarrativeFeedbackActorRole) => {
			if (role === feedbackActorRole) return;
			setFeedbackActorRole(role);
		},
		[feedbackActorRole, setFeedbackActorRole],
	);

	const handleAudienceChange = useCallback(
		(nextAudience: StakeholderAudience) => {
			if (nextAudience === audience) return;
			setAudience(nextAudience);
			trackNarrativeEvent("audience_switched", {
				branch: branchName,
				detailLevel: effectiveDetailLevel,
				audience: nextAudience,
				confidence: narrativeConfidence,
			});
		},
		[
			audience,
			branchName,
			effectiveDetailLevel,
			narrativeConfidence,
			setAudience,
		],
	);

	return {
		handleSubmitFeedback,
		handleFeedbackRoleChange,
		handleAudienceChange,
	};
}
