import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BranchViewModel, FileChange, TestRun, TraceRange } from "../../../core/types";

const mockSelectFile = vi.hoisted(() => vi.fn());
const mockFileSelectionState = vi.hoisted(() => ({ selectedFile: "preselected.ts" as string | null }));
const mockTrackNarrativeEvent = vi.hoisted(() => vi.fn());
const mockTrackQualityRenderDecision = vi.hoisted(() => vi.fn());
const mockTrackAskWhySubmitted = vi.hoisted(() => vi.fn());
const mockTrackAskWhyAnswerViewed = vi.hoisted(() => vi.fn());
const mockTrackAskWhyEvidenceOpened = vi.hoisted(() => vi.fn());
const mockTrackAskWhyFallbackUsed = vi.hoisted(() => vi.fn());
const mockTrackAskWhyError = vi.hoisted(() => vi.fn());
const mockSetNarrativeTelemetryRuntimeConfig = vi.hoisted(() => vi.fn());
const mockCreateTelemetryBranchScope = vi.hoisted(() => vi.fn((_repoId?: number | null, branch?: string) => `scope:${branch ?? 'unknown'}`));
const mockGetLatestTestRunForCommit = vi.hoisted(() => vi.fn().mockResolvedValue(null));
let capturedOpenEvidenceHandler: ((link: { id: string; kind: string; label: string; commitSha?: string }) => void) | null = null;
let capturedOpenRawDiffHandler: ((laneContext?: {
  source?: 'recall_lane';
  recallLaneItemId?: string;
  recallLaneConfidenceBand?: 'low' | 'medium' | 'high';
}) => void) | null = null;
let capturedSubmitAskWhyHandler: ((question: string) => void) | null = null;
let capturedOpenAskWhyCitationHandler: ((citation: { id: string; type: string; label: string }) => void) | null = null;
const mockLoadGitHubContext = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: "empty", entries: [] }),
);
const mockGetNarrativeCalibrationProfile = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockEvaluateNarrativeRollout = vi.hoisted(() =>
  vi.fn(() => ({
    status: "healthy",
    rubric: [],
    rules: [],
    averageScore: 1,
    generatedAtISO: "2026-02-18T00:00:00Z",
  })),
);
const mockSubmitNarrativeFeedback = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    inserted: true,
    idempotencyKey: "mock:key",
    verifiedActorRole: "developer",
    profile: {
      repoId: 1,
      rankingBias: 0,
      confidenceOffset: 0,
      confidenceScale: 1,
      sampleCount: 0,
      actorWeightPolicyVersion: "v1",
      branchMissingDecisionCount: 0,
      highlightAdjustments: {},
      updatedAtISO: "2026-02-24T00:00:00.000Z",
    },
  }),
);

vi.mock("../../../core/context/FileSelectionContext", () => ({
  FileSelectionProvider: ({ children }: { children: unknown }) => children,
  useFileSelection: () => ({
    selectedFile: mockFileSelectionState.selectedFile,
    selectFile: mockSelectFile,
  }),
}));

vi.mock("../../../core/telemetry/narrativeTelemetry", () => ({
  trackNarrativeEvent: mockTrackNarrativeEvent,
  trackQualityRenderDecision: mockTrackQualityRenderDecision,
  trackAskWhySubmitted: mockTrackAskWhySubmitted,
  trackAskWhyAnswerViewed: mockTrackAskWhyAnswerViewed,
  trackAskWhyEvidenceOpened: mockTrackAskWhyEvidenceOpened,
  trackAskWhyFallbackUsed: mockTrackAskWhyFallbackUsed,
  trackAskWhyError: mockTrackAskWhyError,
  setNarrativeTelemetryRuntimeConfig: mockSetNarrativeTelemetryRuntimeConfig,
  createTelemetryBranchScope: mockCreateTelemetryBranchScope,
}));

vi.mock("../../../core/repo/testRuns", () => ({
  getLatestTestRunForCommit: mockGetLatestTestRunForCommit,
}));

vi.mock("../../../core/repo/githubContext", () => ({
  loadGitHubContext: mockLoadGitHubContext,
}));

vi.mock("../../../core/repo/narrativeFeedback", () => ({
  getNarrativeCalibrationProfile: mockGetNarrativeCalibrationProfile,
  submitNarrativeFeedback: mockSubmitNarrativeFeedback,
}));

vi.mock("../../../core/narrative/composeBranchNarrative", () => ({
  composeBranchNarrative: vi.fn(() => ({
    schemaVersion: 1,
    generatedAtISO: "2026-02-18T00:00:00Z",
    state: "ready",
    summary: "Summary",
    confidence: 0.92,
    highlights: [],
    evidenceLinks: [],
  })),
}));

vi.mock("../../../core/narrative/stakeholderProjections", () => ({
  buildStakeholderProjections: vi.fn(() => ({})),
}));

vi.mock("../../../core/narrative/decisionArchaeology", () => ({
  buildDecisionArchaeology: vi.fn(() => []),
}));

vi.mock("../../../core/narrative/rolloutGovernance", () => ({
  evaluateNarrativeRollout: mockEvaluateNarrativeRollout,
}));

vi.mock("../../../hooks/useFirefly", () => ({
  useFirefly: vi.fn(() => ({
    enabled: false,
    toggle: vi.fn(),
    event: { type: "idle", selectedNodeId: null },
  })),
}));

vi.mock("../../../hooks/useTestImport", () => ({
  useTestImport: vi.fn(() => ({
    importJUnitForCommit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../components/BranchNarrativePanel", () => ({
  BranchNarrativePanel: ({
    onSubmitFeedback,
    onOpenEvidence,
    onOpenRawDiff,
    onSubmitAskWhy,
    onOpenAskWhyCitation,
  }: {
    onSubmitFeedback: (feedback: {
      actorRole: "developer" | "reviewer";
      feedbackType: "highlight_key" | "highlight_wrong" | "branch_missing_decision";
      targetKind: "highlight" | "branch";
      targetId?: string;
      detailLevel: "summary" | "evidence" | "diff";
    }) => void;
    onOpenEvidence: (link: {
      id: string;
      kind: "commit" | "session" | "file" | "diff";
      label: string;
      commitSha?: string;
      filePath?: string;
      sessionId?: string;
    }, _laneContext?: {
      source?: 'recall_lane';
      recallLaneItemId?: string;
      recallLaneConfidenceBand?: 'low' | 'medium' | 'high';
    }) => void;
    onOpenRawDiff: (_laneContext?: {
      source?: 'recall_lane';
      recallLaneItemId?: string;
      recallLaneConfidenceBand?: 'low' | 'medium' | 'high';
    }) => void;
    onSubmitAskWhy?: (question: string) => void;
    onOpenAskWhyCitation?: (citation: { id: string; type: string; label: string }) => void;
  }) => {
    capturedOpenEvidenceHandler = onOpenEvidence;
    capturedOpenRawDiffHandler = onOpenRawDiff;
    capturedSubmitAskWhyHandler = onSubmitAskWhy ?? null;
    capturedOpenAskWhyCitationHandler = onOpenAskWhyCitation ?? null;
    return (
      <>
        <button
          type="button"
          onClick={() =>
            onSubmitFeedback({
              actorRole: "developer",
              feedbackType: "highlight_key",
              targetKind: "highlight",
              targetId: "highlight:h1",
              detailLevel: "summary",
            })
          }
        >
          submit-feedback
        </button>
        <button
          type="button"
          onClick={() =>
            onOpenEvidence({
              id: "commit:aaaa1111",
              kind: "commit",
              label: "Commit aaaa1111",
              commitSha: "aaaa1111",
            })
          }
        >
          open-evidence
        </button>
        <button type="button" onClick={onOpenRawDiff}>
          open-raw-diff
        </button>
        <button
          type="button"
          onClick={() => onSubmitAskWhy?.("Why was this branch created?")}
        >
          submit-ask-why
        </button>
        <button
          type="button"
          onClick={() =>
            onOpenAskWhyCitation?.({
              id: "commit:aaaa1111",
              type: "commit",
              label: "Commit aaaa1111",
            })
          }
        >
          open-ask-why-citation
        </button>
      </>
    );
  },
}));

vi.mock("../../components/NarrativeGovernancePanel", () => ({
  NarrativeGovernancePanel: () => null,
}));

vi.mock("../../components/DecisionArchaeologyPanel", () => ({
  DecisionArchaeologyPanel: () => null,
}));

vi.mock("../../components/CaptureActivityStrip", () => ({
  CaptureActivityStrip: () => null,
}));

vi.mock("../../components/NeedsAttentionList", () => ({
  NeedsAttentionList: () => null,
}));

vi.mock("../../components/IntentList", () => ({
  IntentList: () => null,
}));

vi.mock("../../components/Breadcrumb", () => ({
  Breadcrumb: () => null,
}));

vi.mock("../../components/Skeleton", () => ({
  SkeletonFiles: () => null,
}));

vi.mock("../../components/ImportErrorBanner", () => ({
  ImportErrorBanner: () => null,
}));

vi.mock("../../components/IngestToast", () => ({
  IngestToast: () => null,
}));

vi.mock("../../components/FilesChanged", () => ({
  FilesChanged: ({ files }: { files: FileChange[] }) => (
    <div data-testid="files-changed">{files.map((file) => file.path).join(",")}</div>
  ),
}));

vi.mock("../../components/RightPanelTabs", () => ({
  RightPanelTabs: ({
    diffText,
    traceRanges,
    testRun,
    loadingTests,
    loadingDiff,
    githubConnectorState,
  }: {
    diffText: string | null;
    traceRanges: TraceRange[];
    testRun?: TestRun;
    loadingTests?: boolean;
    loadingDiff?: boolean;
    githubConnectorState?: { status?: string; error?: string };
  }) => (
    <>
      <div data-testid="diff-panel">{diffText ?? "(none)"}</div>
      <div data-testid="diff-loading">{loadingDiff ? "loading" : "idle"}</div>
      <div data-testid="trace-panel">{traceRanges.length}</div>
      <div data-testid="test-run-id">{testRun?.id ?? "none"}</div>
      <div data-testid="tests-loading">{loadingTests ? "loading" : "idle"}</div>
      <div data-testid="github-status">{githubConnectorState?.status ?? "none"}</div>
      <div data-testid="github-error">{githubConnectorState?.error ?? ""}</div>
    </>
  ),
}));

vi.mock("../../components/Timeline", () => ({
  Timeline: ({
    nodes,
    selectedId,
    onSelect,
    pulseCommitId,
  }: {
    nodes: Array<{ id: string; label?: string }>;
    selectedId: string | null;
    onSelect: (id: string) => void;
    pulseCommitId?: string | null;
  }) => (
    <div data-testid="timeline-mock">
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onSelect(node.id)}>
          {node.label ?? node.id}
        </button>
      ))}
      <output data-testid="timeline-pulse-id">{pulseCommitId ?? ""}</output>
      <output data-testid="selected-node">{selectedId ?? "none"}</output>
    </div>
  ),
}));

import { BranchView } from "../BranchView";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createModel(overrides: Partial<BranchViewModel> = {}): BranchViewModel {
  return {
    source: "git",
    title: "feature/race-tests",
    status: "open",
    description: "BranchView transition test model",
    stats: {
      added: 8,
      removed: 2,
      files: 2,
      commits: 2,
      prompts: 0,
      responses: 0,
    },
    intent: [],
    timeline: [
      { id: "aaaa1111", type: "commit", label: "Commit A" },
      { id: "bbbb2222", type: "commit", label: "Commit B" },
    ],
    traceSummaries: {
      byCommit: {},
      byFileByCommit: {},
    },
    meta: {
      repoPath: "/Users/jamiecraik/dev/narrative",
      branchName: "feature/race-tests",
      headSha: "aaaa1111",
      repoId: 1,
    },
    ...overrides,
  };
}

function createTestRun(id: string, commitSha: string): TestRun {
  return {
    id,
    atISO: "2026-02-24T00:00:00.000Z",
    commitSha,
    durationSec: 12,
    passed: 4,
    failed: 0,
    skipped: 0,
    tests: [],
  };
}

function buildProps(overrides: {
  model?: BranchViewModel;
  loadFilesForNode?: (nodeId: string) => Promise<FileChange[]>;
  loadDiffForFile?: (nodeId: string, filePath: string) => Promise<string>;
  loadTraceRangesForFile?: (nodeId: string, filePath: string) => Promise<TraceRange[]>;
  onClearFilter?: () => void;
  dashboardFilter?: { type: "file"; value: string };
  ingestConfig?: unknown;
} = {}) {
  return {
    model: overrides.model ?? createModel(),
    updateModel: vi.fn((updater: (prev: BranchViewModel) => BranchViewModel) => updater(createModel())),
    loadFilesForNode: overrides.loadFilesForNode ?? vi.fn(async () => []),
    loadDiffForFile: overrides.loadDiffForFile ?? vi.fn(async () => ""),
    loadTraceRangesForFile: overrides.loadTraceRangesForFile ?? vi.fn(async () => []),
    onExportAgentTrace: vi.fn(),
    onRunOtlpSmokeTest: vi.fn(),
    actionError: null,
    setActionError: vi.fn(),
    onClearFilter: overrides.onClearFilter,
    dashboardFilter: overrides.dashboardFilter,
    ingestConfig: overrides.ingestConfig as never,
  };
}

describe("BranchView transition and integration coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileSelectionState.selectedFile = "preselected.ts";
    capturedOpenEvidenceHandler = null;
    capturedOpenRawDiffHandler = null;
    capturedSubmitAskWhyHandler = null;
    capturedOpenAskWhyCitationHandler = null;
    mockGetLatestTestRunForCommit.mockResolvedValue(null);
    mockLoadGitHubContext.mockResolvedValue({ status: "empty", entries: [] });
    mockEvaluateNarrativeRollout.mockReturnValue({
      status: "healthy",
      rubric: [],
      rules: [],
      averageScore: 1,
      generatedAtISO: "2026-02-18T00:00:00Z",
    });
    mockGetNarrativeCalibrationProfile.mockResolvedValue(null);
    mockSubmitNarrativeFeedback.mockResolvedValue({
      inserted: true,
      idempotencyKey: "mock:key",
      verifiedActorRole: "developer",
      profile: {
        repoId: 1,
        rankingBias: 0,
        confidenceOffset: 0,
        confidenceScale: 1,
        sampleCount: 0,
        actorWeightPolicyVersion: "v1",
        branchMissingDecisionCount: 0,
        highlightAdjustments: {},
        updatedAtISO: "2026-02-24T00:00:00.000Z",
      },
    });
  });

  it("ignores stale files loader completion after rapid node change", async () => {
    const deferredByNode: Record<string, Deferred<FileChange[]>> = {
      aaaa1111: createDeferred<FileChange[]>(),
      bbbb2222: createDeferred<FileChange[]>(),
    };

    const loadFilesForNode = vi.fn((nodeId: string) => deferredByNode[nodeId].promise);

    const props = buildProps({ loadFilesForNode });
    render(<BranchView {...props} />);

    await waitFor(() => {
      expect(loadFilesForNode).toHaveBeenCalledWith("aaaa1111");
    });

    fireEvent.click(screen.getByRole("button", { name: "Commit B" }));

    await waitFor(() => {
      expect(loadFilesForNode).toHaveBeenCalledWith("bbbb2222");
    });

    await act(async () => {
      deferredByNode.bbbb2222.resolve([{ path: "src/new-file.ts", additions: 4, deletions: 1 }]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("files-changed")).toHaveTextContent("src/new-file.ts");
    });

    await act(async () => {
      deferredByNode.aaaa1111.resolve([{ path: "src/stale-file.ts", additions: 1, deletions: 0 }]);
      await Promise.resolve();
    });

    expect(screen.getByTestId("files-changed")).toHaveTextContent("src/new-file.ts");
    expect(screen.getByTestId("files-changed")).not.toHaveTextContent("src/stale-file.ts");
  });

  it("keeps latest request result for ABA transitions", async () => {
    const deferredByNode: Record<string, Array<Deferred<FileChange[]>>> = {
      aaaa1111: [],
      bbbb2222: [],
    };

    const loadFilesForNode = vi.fn((nodeId: string) => {
      const deferred = createDeferred<FileChange[]>();
      deferredByNode[nodeId].push(deferred);
      return deferred.promise;
    });

    const props = buildProps({ loadFilesForNode });
    render(<BranchView {...props} />);

    await waitFor(() => {
      expect(loadFilesForNode).toHaveBeenCalledWith("aaaa1111");
    });

    fireEvent.click(screen.getByRole("button", { name: "Commit B" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit A" }));

    await waitFor(() => {
      expect(deferredByNode.aaaa1111).toHaveLength(2);
      expect(deferredByNode.bbbb2222).toHaveLength(1);
    });

    await act(async () => {
      deferredByNode.aaaa1111[1].resolve([{ path: "src/final-a.ts", additions: 8, deletions: 2 }]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("files-changed")).toHaveTextContent("src/final-a.ts");
    });

    await act(async () => {
      deferredByNode.bbbb2222[0].resolve([{ path: "src/stale-b.ts", additions: 1, deletions: 1 }]);
      deferredByNode.aaaa1111[0].resolve([{ path: "src/stale-a.ts", additions: 1, deletions: 1 }]);
      await Promise.resolve();
    });

    expect(screen.getByTestId("files-changed")).toHaveTextContent("src/final-a.ts");
    expect(screen.getByTestId("files-changed")).not.toHaveTextContent("src/stale-b.ts");
    expect(screen.getByTestId("files-changed")).not.toHaveTextContent("src/stale-a.ts");
  });

  it("ignores stale evidence/open-raw-diff callbacks after branch scope changes", async () => {
    const props = buildProps();
    const { rerender } = render(<BranchView {...props} />);

    await waitFor(() => {
      expect(capturedOpenEvidenceHandler).toBeInstanceOf(Function);
      expect(capturedOpenRawDiffHandler).toBeInstanceOf(Function);
    });

    const staleEvidence = capturedOpenEvidenceHandler;
    const staleRawDiff = capturedOpenRawDiffHandler;

    const updatedModel = createModel({
      meta: {
        ...props.model.meta,
        branchName: "feature/recall-lane-switch",
      },
    });
    rerender(<BranchView {...buildProps({ model: updatedModel })} />);

    await waitFor(() => {
      expect(capturedOpenEvidenceHandler).toBeInstanceOf(Function);
      expect(capturedOpenEvidenceHandler).not.toBe(staleEvidence);
    });

    const beforeStaleCalls = mockTrackNarrativeEvent.mock.calls.length;
    await act(async () => {
      staleEvidence?.({
        id: "commit:aaaa1111",
        kind: "commit",
        label: "commit:aaaa1111",
        commitSha: "aaaa1111",
      });
      staleRawDiff?.();
      await Promise.resolve();
    });
    expect(mockTrackNarrativeEvent).toHaveBeenCalledTimes(beforeStaleCalls);

    const preCurrentEvidenceOpenedCalls = mockTrackNarrativeEvent.mock.calls.filter(
      (call) => call[0] === "evidence_opened",
    ).length;
    await act(async () => {
      capturedOpenEvidenceHandler?.({
        id: "commit:bbbb2222",
        kind: "commit",
        label: "commit:bbbb2222",
        commitSha: "bbbb2222",
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockTrackNarrativeEvent.mock.calls.filter((call) => call[0] === "evidence_opened").length).toBe(
        preCurrentEvidenceOpenedCalls + 1,
      );
    });
  });

  it("ignores stale ask-why handlers after branch scope changes", async () => {
    const props = buildProps();
    const { rerender } = render(<BranchView {...props} />);

    await waitFor(() => {
      expect(capturedSubmitAskWhyHandler).toBeInstanceOf(Function);
      expect(capturedOpenAskWhyCitationHandler).toBeInstanceOf(Function);
    });

    const staleSubmitAskWhy = capturedSubmitAskWhyHandler;
    const staleOpenCitation = capturedOpenAskWhyCitationHandler;

    const updatedModel = createModel({
      meta: {
        ...props.model.meta,
        branchName: "feature/ask-why-switch",
      },
    });
    rerender(<BranchView {...buildProps({ model: updatedModel })} />);

    await waitFor(() => {
      expect(capturedSubmitAskWhyHandler).toBeInstanceOf(Function);
      expect(capturedSubmitAskWhyHandler).not.toBe(staleSubmitAskWhy);
    });

    const beforeStaleCalls = mockTrackAskWhySubmitted.mock.calls.length;
    await act(async () => {
      staleSubmitAskWhy?.("Why was this branch created?");
      staleOpenCitation?.({ id: "commit:abc", type: "commit", label: "Commit" });
      await Promise.resolve();
    });
    expect(mockTrackAskWhySubmitted).toHaveBeenCalledTimes(beforeStaleCalls);

    const preCurrentCalls = mockTrackAskWhySubmitted.mock.calls.length;
    await act(async () => {
      capturedSubmitAskWhyHandler?.("Why was this branch created?");
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockTrackAskWhySubmitted).toHaveBeenCalledTimes(preCurrentCalls + 1);
    });
  });

  it("tracks recall-lane fallback context for raw diff opens", async () => {
    const props = buildProps();
    render(<BranchView {...props} />);

    await waitFor(() => {
      expect(capturedOpenRawDiffHandler).toBeInstanceOf(Function);
    });

    const beforeFallbackCalls = mockTrackNarrativeEvent.mock.calls.filter((call) => call[0] === "fallback_used").length;

    act(() => {
      capturedOpenRawDiffHandler?.({
        source: "recall_lane",
        recallLaneItemId: "recall:abc",
        recallLaneConfidenceBand: "high",
      });
    });

    await waitFor(() => {
      expect(mockTrackNarrativeEvent.mock.calls.filter((call) => call[0] === "fallback_used").length).toBe(
        beforeFallbackCalls + 1,
      );
      const fallbackPayload = mockTrackNarrativeEvent.mock.calls
        .filter((call) => call[0] === "fallback_used")
        .at(-1)?.[1] as
        | {
            source?: string;
            recallLaneItemId?: string;
            recallLaneConfidenceBand?: string;
          }
        | undefined;

      expect(fallbackPayload).toMatchObject({
        source: "recall_lane",
        recallLaneItemId: "recall:abc",
        recallLaneConfidenceBand: "high",
      });
    });
  });

  it("resets diff loading state when selected file context is cleared", async () => {
    const deferredDiff = createDeferred<string>();
    const loadDiffForFile = vi.fn(async () => deferredDiff.promise);
    const props = buildProps({ loadDiffForFile });

    const { rerender } = render(<BranchView {...props} />);

    await waitFor(() => {
      expect(loadDiffForFile).toHaveBeenCalledWith("aaaa1111", "preselected.ts");
    });
    expect(screen.getByTestId("diff-loading")).toHaveTextContent("loading");

    mockFileSelectionState.selectedFile = null;
    rerender(<BranchView {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-loading")).toHaveTextContent("idle");
      expect(screen.getByTestId("diff-panel")).toHaveTextContent("(none)");
    });

    await act(async () => {
      deferredDiff.resolve("stale diff content");
      await Promise.resolve();
    });

    expect(screen.getByTestId("diff-loading")).toHaveTextContent("idle");
    expect(screen.getByTestId("diff-panel")).toHaveTextContent("(none)");
  });

  it("clears files when commit selection becomes unavailable", async () => {
    const loadFilesForNode = vi.fn(async () => [{ path: "src/old-file.ts", additions: 2, deletions: 1 }]);
    const props = buildProps({ loadFilesForNode });
    const { rerender } = render(<BranchView {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId("files-changed")).toHaveTextContent("src/old-file.ts");
    });

    const modelWithoutTimeline = createModel({
      timeline: [],
      meta: {
        ...props.model.meta,
        headSha: undefined,
      },
    });
    rerender(<BranchView {...buildProps({ model: modelWithoutTimeline, loadFilesForNode })} />);

    await waitFor(() => {
      expect(screen.getByTestId("files-changed")).toHaveTextContent("");
    });
  });

  it("ignores stale repo test-run completion after rapid commit change", async () => {
    const deferredByCommit: Record<string, Deferred<TestRun | null>> = {
      aaaa1111: createDeferred<TestRun | null>(),
      bbbb2222: createDeferred<TestRun | null>(),
    };

    mockGetLatestTestRunForCommit.mockImplementation(
      async (_repoId: number, commitSha: string): Promise<TestRun | null> => deferredByCommit[commitSha].promise,
    );

    const props = buildProps();
    render(<BranchView {...props} />);

    await waitFor(() => {
      expect(mockGetLatestTestRunForCommit).toHaveBeenCalledWith(1, "aaaa1111");
    });

    fireEvent.click(screen.getByRole("button", { name: "Commit B" }));

    await waitFor(() => {
      expect(mockGetLatestTestRunForCommit).toHaveBeenCalledWith(1, "bbbb2222");
    });

    await act(async () => {
      deferredByCommit.bbbb2222.resolve(createTestRun("run-b", "bbbb2222"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("test-run-id")).toHaveTextContent("run-b");
      expect(screen.getByTestId("tests-loading")).toHaveTextContent("idle");
    });

    await act(async () => {
      deferredByCommit.aaaa1111.resolve(createTestRun("run-a", "aaaa1111"));
      await Promise.resolve();
    });

    expect(screen.getByTestId("test-run-id")).toHaveTextContent("run-b");
    expect(screen.getByTestId("test-run-id")).not.toHaveTextContent("run-a");
  });

  it("sets github context to error when connector context loading fails", async () => {
    mockLoadGitHubContext.mockRejectedValueOnce(new Error("GitHub unavailable"));

    const props = {
      ...buildProps(),
      githubConnectorEnabled: true,
    };
    render(<BranchView {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId("github-status")).toHaveTextContent("error");
      expect(screen.getByTestId("github-error")).toHaveTextContent("GitHub unavailable");
    });
  });

  it("supports keyboard activation for filtered-view clear action", async () => {
    const user = userEvent.setup();
    const onClearFilter = vi.fn();

    const props = buildProps({
      onClearFilter,
      dashboardFilter: { type: "file", value: "src/App.tsx" },
    });

    render(<BranchView {...props} />);

    const backButton = await screen.findByRole("button", { name: /back to dashboard/i });
    expect(screen.getByRole("region", { name: "Branch context" })).toBeInTheDocument();

    await user.tab();
    expect(backButton).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onClearFilter).toHaveBeenCalledTimes(1);
  });

  it("does not throw when an in-flight loader resolves after unmount", async () => {
    const deferred = createDeferred<FileChange[]>();
    const loadFilesForNode = vi.fn(() => deferred.promise);

    const props = buildProps({ loadFilesForNode });
    const { unmount } = render(<BranchView {...props} />);

    await waitFor(() => {
      expect(loadFilesForNode).toHaveBeenCalledWith("aaaa1111");
    });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    unmount();

    await act(async () => {
      deferred.resolve([{ path: "src/late.ts", additions: 1, deletions: 0 }]);
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringMatching(/unmounted component|state update on an unmounted component/i)
    );

    consoleError.mockRestore();
  });

  it("does not emit feedback_submitted telemetry for idempotent duplicate submissions", async () => {
    mockSubmitNarrativeFeedback.mockResolvedValueOnce({
      inserted: false,
      idempotencyKey: "mock:key",
      verifiedActorRole: "developer",
      profile: {
        repoId: 1,
        rankingBias: 0,
        confidenceOffset: 0,
        confidenceScale: 1,
        sampleCount: 0,
        actorWeightPolicyVersion: "v1",
        branchMissingDecisionCount: 0,
        highlightAdjustments: {},
        updatedAtISO: "2026-02-24T00:00:00.000Z",
      },
    });

    const props = buildProps();
    render(<BranchView {...props} />);

    fireEvent.click(await screen.findByRole("button", { name: "submit-feedback" }));

    await waitFor(() => {
      expect(mockSubmitNarrativeFeedback).toHaveBeenCalled();
    });

    const feedbackEvents = mockTrackNarrativeEvent.mock.calls.filter(
      ([eventName]) => eventName === "feedback_submitted",
    );
    expect(feedbackEvents).toHaveLength(0);
  });

  it("emits narrative_viewed with effective detail level and a stable view instance id per scope", async () => {
    mockEvaluateNarrativeRollout.mockReturnValueOnce({
      status: "rollback",
      rubric: [],
      rules: [{ id: "rollback_guard", severity: "critical", triggered: true }],
      averageScore: 0.2,
      generatedAtISO: "2026-02-18T00:00:00Z",
    });

    const props = buildProps();
    const { rerender } = render(<BranchView {...props} />);

    await waitFor(() => {
      const viewedEvents = mockTrackNarrativeEvent.mock.calls.filter(
        ([eventName]) => eventName === "narrative_viewed",
      );
      expect(viewedEvents).toHaveLength(1);
    });

    const firstViewedEvent = mockTrackNarrativeEvent.mock.calls.find(
      ([eventName]) => eventName === "narrative_viewed",
    );
    const firstPayload = firstViewedEvent?.[1] as Record<string, unknown>;
    expect(firstPayload.detailLevel).toBe("diff");
    expect(firstPayload.viewInstanceId).toEqual(expect.any(String));

    rerender(<BranchView {...props} />);
    const viewedAfterSameScope = mockTrackNarrativeEvent.mock.calls.filter(
      ([eventName]) => eventName === "narrative_viewed",
    );
    expect(viewedAfterSameScope).toHaveLength(1);

    const nextModel = createModel({
      meta: {
        ...props.model.meta,
        branchName: "feature/next-scope",
      },
    });
    rerender(<BranchView {...buildProps({ model: nextModel })} />);

    await waitFor(() => {
      const viewedEvents = mockTrackNarrativeEvent.mock.calls.filter(
        ([eventName]) => eventName === "narrative_viewed",
      );
      expect(viewedEvents).toHaveLength(2);
    });

    const viewedEvents = mockTrackNarrativeEvent.mock.calls.filter(
      ([eventName]) => eventName === "narrative_viewed",
    );
    const secondPayload = viewedEvents[1]?.[1] as Record<string, unknown>;
    expect(secondPayload.viewInstanceId).toEqual(expect.any(String));
    expect(secondPayload.viewInstanceId).not.toBe(firstPayload.viewInstanceId);
  });

  it("emits commit-scoped what_ready telemetry for selected commits", async () => {
    const props = buildProps();
    render(<BranchView {...props} />);

    await waitFor(() => {
      const whatReadyEvents = mockTrackNarrativeEvent.mock.calls.filter(([eventName]) => eventName === "what_ready");
      expect(whatReadyEvents).toHaveLength(1);
    });

    const initialPayload = mockTrackNarrativeEvent.mock.calls.find(
      ([eventName]) => eventName === "what_ready",
    )?.[1] as Record<string, unknown>;

    expect(initialPayload.itemId).toBe("aaaa1111");
    expect(initialPayload.eventOutcome).toBe("success");
    expect(initialPayload.funnelStep).toBe("what_ready");
    expect(initialPayload.branchScope).toBe("scope:feature/race-tests");

    fireEvent.click(screen.getByRole("button", { name: "Commit B" }));

    await waitFor(() => {
      const whatReadyEvents = mockTrackNarrativeEvent.mock.calls.filter(([eventName]) => eventName === "what_ready");
      expect(whatReadyEvents).toHaveLength(2);
    });
  });

  it("updates telemetry runtime consent config when ingest consent changes", async () => {
    const granted = buildProps({
      ingestConfig: {
        consent: { codexTelemetryGranted: true },
      },
    });

    const { rerender } = render(<BranchView {...granted} />);

    await waitFor(() => {
      expect(mockSetNarrativeTelemetryRuntimeConfig).toHaveBeenCalledWith({ consentGranted: true });
    });

    const revoked = buildProps({
      ingestConfig: {
        consent: { codexTelemetryGranted: false },
      },
    });

    rerender(<BranchView {...revoked} />);

    await waitFor(() => {
      expect(mockSetNarrativeTelemetryRuntimeConfig).toHaveBeenCalledWith({ consentGranted: false });
    });
  });

  it("ignores feedback submission completion after branch context changes", async () => {
    const deferred = createDeferred<{
      inserted: boolean;
      idempotencyKey: string;
      verifiedActorRole: "developer" | "reviewer";
      profile: {
        repoId: number;
        rankingBias: number;
        confidenceOffset: number;
        confidenceScale: number;
        sampleCount: number;
        actorWeightPolicyVersion: string;
        branchMissingDecisionCount: number;
        highlightAdjustments: Record<string, number>;
        updatedAtISO: string;
      };
    }>();
    mockSubmitNarrativeFeedback.mockImplementationOnce(() => deferred.promise);

    const props = buildProps();
    const { rerender } = render(<BranchView {...props} />);

    fireEvent.click(await screen.findByRole("button", { name: "submit-feedback" }));

    await waitFor(() => {
      expect(mockSubmitNarrativeFeedback).toHaveBeenCalledTimes(1);
    });

    const switchedModel = createModel({
      meta: {
        ...props.model.meta,
        branchName: "feature/after-submit-switch",
      },
    });
    rerender(<BranchView {...buildProps({ model: switchedModel })} />);

    await act(async () => {
      deferred.resolve({
        inserted: true,
        idempotencyKey: "mock:key",
        verifiedActorRole: "developer",
        profile: {
          repoId: 1,
          rankingBias: 0,
          confidenceOffset: 0,
          confidenceScale: 1,
          sampleCount: 0,
          actorWeightPolicyVersion: "v1",
          branchMissingDecisionCount: 0,
          highlightAdjustments: {},
          updatedAtISO: "2026-02-24T00:00:00.000Z",
        },
      });
      await Promise.resolve();
    });

    const feedbackEvents = mockTrackNarrativeEvent.mock.calls.filter(
      ([eventName]) => eventName === "feedback_submitted",
    );
    expect(feedbackEvents).toHaveLength(0);
  });

  it("pulses each newly session-linked commit in order", async () => {
    vi.useFakeTimers();
    let unmount: (() => void) | undefined;
    try {
      const pendingFileLoad = new Promise<FileChange[]>(() => {});
      const pendingDiffLoad = new Promise<string>(() => {});
      const pendingTraceLoad = new Promise<TraceRange[]>(() => {});
      const pendingTestRunLoad = new Promise<TestRun | null>(() => {});
      mockGetLatestTestRunForCommit.mockImplementation(() => pendingTestRunLoad);

      const props = buildProps({
        model: createModel({
          timeline: [
            { id: "aaaa1111", type: "commit", label: "Commit A", badges: [{ type: "session" }] },
            { id: "bbbb2222", type: "commit", label: "Commit B", badges: [{ type: "session" }] },
            { id: "cccc3333", type: "commit", label: "Commit C" },
          ],
        }),
        loadFilesForNode: vi.fn(() => pendingFileLoad),
        loadDiffForFile: vi.fn(() => pendingDiffLoad),
        loadTraceRangesForFile: vi.fn(() => pendingTraceLoad),
      });

      await act(async () => {
        ({ unmount } = render(<BranchView {...props} />));
      });

      expect(screen.getByTestId("timeline-pulse-id")).toHaveTextContent("");

      await act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.getByTestId("timeline-pulse-id")).toHaveTextContent("aaaa1111");

      await act(() => {
        vi.advanceTimersByTime(1700);
      });
      expect(screen.getByTestId("timeline-pulse-id")).toHaveTextContent("bbbb2222");

      await act(() => {
        vi.advanceTimersByTime(1700);
      });
      expect(screen.getByTestId("timeline-pulse-id")).toHaveTextContent("");
    } finally {
      await act(() => {
        vi.runOnlyPendingTimers();
      });
      unmount?.();
      await act(() => {
        vi.runOnlyPendingTimers();
      });
      vi.useRealTimers();
    }
  });
});
