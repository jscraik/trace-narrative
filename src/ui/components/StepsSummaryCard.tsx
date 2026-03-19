import { useEffect, useMemo, useState } from "react";
import {
	type CommitCaptureBundle,
	getCommitCaptureBundle,
} from "../../core/tauri/activity";
import type { TraceCommitSummary } from "../../core/types";

function confidenceLabel(confidence: number) {
	if (confidence >= 0.8) return "High";
	if (confidence >= 0.6) return "Medium";
	return "Low";
}

function formatTools(tools: string[]) {
	if (!tools || tools.length === 0) return "—";
	return tools.slice(0, 5).join(", ");
}

function formatFiles(files: string[]) {
	if (!files || files.length === 0) return "—";
	const top = files.slice(0, 3);
	const more = files.length - top.length;
	return more > 0 ? `${top.join(", ")} +${more}` : top.join(", ");
}

export function StepsSummaryCard(props: {
	repoId: number;
	repoRoot: string;
	commitSha: string;
	traceSummary?: TraceCommitSummary;
}) {
	const { repoId, repoRoot, commitSha, traceSummary } = props;
	const [expanded, setExpanded] = useState(false);
	const [bundle, setBundle] = useState<CommitCaptureBundle | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setLoading(true);
			try {
				const b = await getCommitCaptureBundle(repoId, repoRoot, commitSha);
				if (cancelled) return;
				setBundle(b);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		load();
		return () => {
			cancelled = true;
		};
	}, [repoId, repoRoot, commitSha]);

	const linkedCount = bundle?.linkedSessions?.length ?? 0;

	const confidence = useMemo(() => {
		if (!bundle?.linkedSessions?.length) return null;
		const max = Math.max(
			...bundle.linkedSessions.map((s) => s.linkConfidence ?? 0),
		);
		const needsReview = bundle.linkedSessions.some((s) => s.needsReview);
		return { label: confidenceLabel(max), needsReview };
	}, [bundle]);

	const tools = useMemo(() => {
		const fromBundle = bundle?.toolsUsedTop ?? [];
		const fromTrace = traceSummary?.toolNames ?? [];
		const set = new Set([...fromBundle, ...fromTrace]);
		return Array.from(set).filter(Boolean).slice(0, 5);
	}, [bundle, traceSummary]);

	const filesTouched = useMemo(() => {
		const fromGit = bundle?.gitFilesChangedTop ?? [];
		const fromSessions = (bundle?.linkedSessions ?? []).flatMap(
			(s) => s.filesTouched ?? [],
		);
		const set = new Set([...fromGit, ...fromSessions]);
		return Array.from(set).filter(Boolean);
	}, [bundle]);

	const tracePresent = Boolean(traceSummary);

	return (
		<div className="card p-5 animate-fade-in-up delay-200 hover:shadow-lg transition-shadow duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]">
			<div className="section-header">STEPS</div>
			<div className="section-subheader">
				What the assistant did for this commit.
			</div>

			{loading ? (
				<div className="mt-3 text-xs text-text-tertiary">Loading…</div>
			) : (
				<div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
					<div className="text-text-tertiary">Linked sessions</div>
					<div className="text-text-primary font-medium">{linkedCount}</div>

					<div className="text-text-tertiary">Tools</div>
					<div className="text-text-primary font-medium">
						{formatTools(tools)}
					</div>

					<div className="text-text-tertiary">Files touched</div>
					<div className="text-text-primary font-medium">
						{formatFiles(filesTouched)}
					</div>

					<div className="text-text-tertiary">Trace</div>
					<div className="text-text-primary font-medium">
						{tracePresent ? "Present" : "None"}
					</div>

					<div className="text-text-tertiary">Link confidence</div>
					<div className="text-text-primary font-medium">
						{confidence
							? `${confidence.label}${confidence.needsReview ? " · Needs review" : ""}`
							: "—"}
					</div>
				</div>
			)}

			<div className="mt-4">
				<button
					type="button"
					className="text-xs px-3 py-1.5 rounded-md bg-bg-hover text-text-secondary hover:bg-border-light"
					onClick={() => setExpanded((v) => !v)}
					disabled={loading}
				>
					{expanded ? "Hide details" : "Show details"}
				</button>
			</div>

			{expanded ? (
				<div className="mt-4">
					<div className="text-xs font-semibold text-text-secondary">
						Timeline
					</div>
					{(bundle?.linkedSessions?.length ?? 0) === 0 ? (
						<div className="mt-2 text-sm text-text-tertiary">
							No linked sessions yet.
						</div>
					) : (
						<div className="mt-3 flex flex-col gap-3">
							{bundle?.linkedSessions.map((s) => (
								<div key={s.sessionId} className="card p-3">
									<div className="text-xs font-medium text-text-secondary">
										{s.tool}
										{s.model ? ` · ${s.model}` : ""}
										{s.needsReview ? " · Needs review" : ""}
									</div>
									<div className="mt-2 flex flex-col gap-1">
										{(s.messages ?? []).slice(0, 12).map((m, _idx) => (
											<div
												key={`${s.sessionId}-${m.role}-${m.text.slice(0, 10)}`}
												className="text-[0.6875rem] text-text-tertiary"
											>
												<span className="font-medium text-text-muted">
													{m.role}
												</span>
												{m.toolName ? (
													<span className="text-text-muted">
														{" "}
														· {m.toolName}
													</span>
												) : null}
												<span className="text-text-tertiary"> · {m.text}</span>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}
