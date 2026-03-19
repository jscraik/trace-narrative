import { useEffect, useRef, useState } from "react";
import type { TimelineNode } from "../../../core/types";

export type UseBranchCommitPulseInput = {
	timeline: TimelineNode[];
	branchScopeKey: string;
};

export type UseBranchCommitPulseOutput = {
	pulseCommitId: string | null;
};

export function useBranchCommitPulse(
	input: UseBranchCommitPulseInput,
): UseBranchCommitPulseOutput {
	const { timeline, branchScopeKey } = input;

	const pulsedCommits = useRef<Set<string>>(new Set());
	const [pulseCommitId, setPulseCommitId] = useState<string | null>(null);

	// Clear pulse state on branch change
	useEffect(() => {
		void branchScopeKey;
		pulsedCommits.current.clear();
		setPulseCommitId(null);
	}, [branchScopeKey]);

	// Pulse animation for session-linked commits
	useEffect(() => {
		const linkedCommitIds = timeline
			.filter((node) => node.badges?.some((badge) => badge.type === "session"))
			.map((node) => node.id);
		const unpulsedCommitIds = linkedCommitIds.filter(
			(id) => !pulsedCommits.current.has(id),
		);

		if (unpulsedCommitIds.length === 0) return;

		const timers: Array<ReturnType<typeof setTimeout>> = [];
		const pulseGapMs = 1800;
		const pulseDurationMs = 1600;

		unpulsedCommitIds.forEach((id, index) => {
			const startDelayMs = index * pulseGapMs;
			const startPulseTimer = setTimeout(() => {
				pulsedCommits.current.add(id);
				setPulseCommitId(id);

				const clearPulseTimer = setTimeout(() => {
					setPulseCommitId((current) => (current === id ? null : current));
				}, pulseDurationMs);
				timers.push(clearPulseTimer);
			}, startDelayMs);
			timers.push(startPulseTimer);
		});

		return () => {
			timers.forEach(clearTimeout);
		};
	}, [timeline]);

	return {
		pulseCommitId,
	};
}
