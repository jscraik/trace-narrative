import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
	BranchNarrative,
	NarrativeRecallLaneItem,
	StakeholderProjections,
} from "../../../core/types";
import { BranchNarrativePanel } from "../BranchNarrativePanel";

const narrative: BranchNarrative = {
	schemaVersion: 1,
	generatedAtISO: "2026-02-18T00:00:00.000Z",
	state: "ready",
	summary: "Summary text",
	confidence: 0.72,
	highlights: [
		{
			id: "h1",
			title: "Highlight",
			whyThisMatters: "Reason",
			confidence: 0.7,
			evidenceLinks: [
				{
					id: "commit:abc123",
					kind: "commit",
					label: "Commit abc123",
					commitSha: "abc123",
				},
			],
		},
	],
	evidenceLinks: [
		{
			id: "commit:abc123",
			kind: "commit",
			label: "Commit abc123",
			commitSha: "abc123",
		},
	],
};

const recallLaneItems: NarrativeRecallLaneItem[] = [
	{
		id: "r1",
		title: "Fix critical validation path",
		whyThisMatters: "Largest signal from latest commit.",
		confidence: 0.88,
		confidenceTier: "high",
		evidenceLinks: [
			{
				id: "commit:abc123",
				kind: "commit",
				label: "Commit abc123",
				commitSha: "abc123",
			},
		],
		source: "highlight",
	},
];

const projections: StakeholderProjections = {
	executive: {
		audience: "executive",
		headline: "Exec headline",
		bullets: ["Exec bullet"],
		risks: [],
		evidenceLinks: narrative.evidenceLinks,
	},
	manager: {
		audience: "manager",
		headline: "Manager headline",
		bullets: ["Manager bullet"],
		risks: [],
		evidenceLinks: narrative.evidenceLinks,
	},
	engineer: {
		audience: "engineer",
		headline: "Engineer headline",
		bullets: ["Engineer bullet"],
		risks: [],
		evidenceLinks: narrative.evidenceLinks,
	},
};

describe("BranchNarrativePanel", () => {
	it("renders summary view and allows switching detail levels", () => {
		const onDetailLevelChange = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				recallLaneItems={recallLaneItems}
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={onDetailLevelChange}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		expect(screen.getByText("Summary text")).toBeInTheDocument();
		expect(screen.getByText("Recall lane")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Evidence" }),
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
		expect(onDetailLevelChange).toHaveBeenCalledWith("evidence");
	});

	it("calls evidence callback in evidence view", () => {
		const onOpenEvidence = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="evidence"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={onOpenEvidence}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Commit abc123/i }));
		expect(onOpenEvidence).toHaveBeenCalledTimes(1);
	});

	it("opens recall lane evidence with lane telemetry context", () => {
		const onOpenEvidence = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				recallLaneItems={recallLaneItems}
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={onOpenEvidence}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open evidence" }));
		expect(onOpenEvidence).toHaveBeenCalledWith(
			recallLaneItems[0].evidenceLinks[0],
			expect.objectContaining({
				source: "recall_lane",
				recallLaneItemId: "r1",
				recallLaneConfidenceBand: "high",
			}),
		);
	});

	it("falls back to raw diff from recall lane when no evidence link exists", () => {
		const onOpenRawDiff = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				recallLaneItems={[
					{
						id: "r-no-evidence",
						title: "Inspect fallback state",
						whyThisMatters: "No direct evidence available.",
						confidence: 0.2,
						confidenceTier: "low",
						evidenceLinks: [],
						source: "fallback",
					},
				]}
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={onOpenRawDiff}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open raw diff" }));
		expect(onOpenRawDiff).toHaveBeenCalledWith(
			expect.objectContaining({
				source: "recall_lane",
				recallLaneItemId: "r-no-evidence",
				recallLaneConfidenceBand: "low",
			}),
		);
	});

	it("submits highlight and branch feedback actions", () => {
		const onSubmitFeedback = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="reviewer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={onSubmitFeedback}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "This is key" }));
		expect(onSubmitFeedback).toHaveBeenCalledWith(
			expect.objectContaining({
				actorRole: "reviewer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
			}),
		);

		fireEvent.click(screen.getByRole("button", { name: "Wrong" }));
		expect(onSubmitFeedback).toHaveBeenCalledWith(
			expect.objectContaining({
				actorRole: "reviewer",
				feedbackType: "highlight_wrong",
				targetKind: "highlight",
			}),
		);

		fireEvent.click(screen.getByRole("button", { name: "Missing decision" }));
		expect(onSubmitFeedback).toHaveBeenCalledWith(
			expect.objectContaining({
				actorRole: "reviewer",
				feedbackType: "branch_missing_decision",
				targetKind: "branch",
			}),
		);
	});

	it("forces raw-diff fallback while kill switch is active", () => {
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				killSwitchActive={true}
				killSwitchReason="failed narrative synthesis"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		expect(
			screen.getByText(
				"Kill switch active. Narrative layers are read-only until quality recovers.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Open raw diff context" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Open evidence/i }),
		).not.toBeInTheDocument();
	});

	// ============================================================================
	// Ask-Why Answer Card Tests
	// ============================================================================

	it("renders ask-why input in idle state", () => {
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		expect(screen.getByText("Ask Why")).toBeInTheDocument();
		expect(
			screen.getByPlaceholderText("Why was this branch created?"),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
	});

	it("submits ask-why question on form submit", () => {
		const onSubmitAskWhy = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={onSubmitAskWhy}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		const input = screen.getByPlaceholderText("Why was this branch created?");
		fireEvent.change(input, {
			target: { value: "Why did we add this feature?" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Ask" }));

		expect(onSubmitAskWhy).toHaveBeenCalledWith("Why did we add this feature?");
	});

	it("does not submit empty question", () => {
		const onSubmitAskWhy = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={onSubmitAskWhy}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Ask" }));
		expect(onSubmitAskWhy).not.toHaveBeenCalled();
	});

	it("shows loading state while analyzing", () => {
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "loading", queryId: "abc12345" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		expect(screen.getByText("Analyzing branch context...")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Asking..." })).toBeDisabled();
	});

	it("renders answer with citations in ready state", () => {
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{
					kind: "ready",
					answer: {
						queryId: "abc12345",
						questionHash: "deadbeef",
						answerParagraph:
							"This branch was created to implement user authentication.",
						confidenceBand: "high",
						confidence: 0.88,
						citations: [
							{
								id: "commit:abc123",
								type: "commit",
								label: "Commit abc123",
								commitSha: "abc123",
							},
						],
						sentenceCitationMap: [
							{ sentenceIndex: 0, citationIds: ["commit:abc123"] },
						],
						fallbackUsed: false,
						generatedAtISO: "2026-03-02T00:00:00.000Z",
					},
				}}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		expect(
			screen.getByText(
				"This branch was created to implement user authentication.",
			),
		).toBeInTheDocument();
		expect(screen.getByText(/high 88%/i)).toBeInTheDocument();
		expect(screen.getByText("Citations:")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Commit abc123/i }),
		).toBeInTheDocument();
	});

	it("calls onOpenAskWhyCitation when citation clicked", () => {
		const onOpenAskWhyCitation = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{
					kind: "ready",
					answer: {
						queryId: "abc12345",
						questionHash: "deadbeef",
						answerParagraph: "Answer text.",
						confidenceBand: "high",
						confidence: 0.88,
						citations: [
							{
								id: "commit:abc123",
								type: "commit",
								label: "Commit abc123",
								commitSha: "abc123",
							},
						],
						sentenceCitationMap: [
							{ sentenceIndex: 0, citationIds: ["commit:abc123"] },
						],
						fallbackUsed: false,
						generatedAtISO: "2026-03-02T00:00:00.000Z",
					},
				}}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={onOpenAskWhyCitation}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Commit abc123/i }));
		expect(onOpenAskWhyCitation).toHaveBeenCalledWith({
			id: "commit:abc123",
			type: "commit",
			label: "Commit abc123",
			commitSha: "abc123",
		});
	});

	it("shows low-confidence fallback with raw diff CTA", () => {
		const onOpenRawDiff = vi.fn();
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={onOpenRawDiff}
				askWhyState={{
					kind: "ready",
					answer: {
						queryId: "abc12345",
						questionHash: "deadbeef",
						answerParagraph: "Uncertain answer.",
						confidenceBand: "low",
						confidence: 0.35,
						citations: [],
						sentenceCitationMap: [
							{ sentenceIndex: 0, citationIds: [], uncertain: true },
						],
						fallbackUsed: true,
						fallbackReasonCode: "low_confidence_override",
						generatedAtISO: "2026-03-02T00:00:00.000Z",
					},
				}}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		expect(
			screen.getByText(/Low confidence in this answer/),
		).toBeInTheDocument();
		fireEvent.click(screen.getByText("Open raw diff"));
		expect(onOpenRawDiff).toHaveBeenCalled();
	});

	it("shows error state with message", () => {
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{
					kind: "error",
					queryId: "abc12345",
					errorType: "no_evidence",
					message: "No narrative summary available.",
				}}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		// When message is provided, it's shown directly (not error type)
		expect(
			screen.getByText("No narrative summary available."),
		).toBeInTheDocument();
	});

	it("shows error type when no message provided", () => {
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{
					kind: "error",
					queryId: "abc12345",
					errorType: "no_evidence",
				}}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		// When no message, error type is shown
		expect(screen.getByText("Error: no_evidence")).toBeInTheDocument();
	});

	it("hides ask-why card in diff view when kill switch active", () => {
		render(
			<BranchNarrativePanel
				narrative={narrative}
				projections={projections}
				audience="manager"
				detailLevel="summary"
				feedbackActorRole="developer"
				killSwitchActive={true}
				onAudienceChange={vi.fn()}
				onFeedbackActorRoleChange={vi.fn()}
				onDetailLevelChange={vi.fn()}
				onSubmitFeedback={vi.fn()}
				onOpenEvidence={vi.fn()}
				onOpenRawDiff={vi.fn()}
				askWhyState={{ kind: "idle" }}
				onSubmitAskWhy={vi.fn()}
				onOpenAskWhyCitation={vi.fn()}
			/>,
		);

		// Kill switch forces effectiveDetailLevel to 'diff', so ask-why card is not rendered
		// The diff view shows instead
		expect(screen.getByText("Open raw diff context")).toBeInTheDocument();
		expect(
			screen.queryByPlaceholderText("Why was this branch created?"),
		).not.toBeInTheDocument();
	});
});
