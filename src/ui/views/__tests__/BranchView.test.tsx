import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BranchViewModel, FileChange, TraceRange } from "../../../core/types";

const mockSelectFile = vi.hoisted(() => vi.fn());
const mockTrackNarrativeEvent = vi.hoisted(() => vi.fn());
const mockTrackQualityRenderDecision = vi.hoisted(() => vi.fn());
const mockGetNarrativeCalibrationProfile = vi.hoisted(() => vi.fn().mockResolvedValue(null));
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
    selectedFile: "preselected.ts",
    selectFile: mockSelectFile,
  }),
}));

vi.mock("../../../core/telemetry/narrativeTelemetry", () => ({
  trackNarrativeEvent: mockTrackNarrativeEvent,
  trackQualityRenderDecision: mockTrackQualityRenderDecision,
}));

vi.mock("../../../core/repo/testRuns", () => ({
  getLatestTestRunForCommit: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../core/repo/githubContext", () => ({
  loadGitHubContext: vi.fn().mockResolvedValue({ status: "empty", entries: [] }),
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
  evaluateNarrativeRollout: vi.fn(() => ({
    status: "healthy",
    rubric: [],
    rules: [],
    averageScore: 1,
    generatedAtISO: "2026-02-18T00:00:00Z",
  })),
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
  }: {
    onSubmitFeedback: (feedback: {
      actorRole: "developer" | "reviewer";
      feedbackType: "highlight_key" | "highlight_wrong" | "branch_missing_decision";
      targetKind: "highlight" | "branch";
      targetId?: string;
      detailLevel: "summary" | "evidence" | "diff";
    }) => void;
  }) => (
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
  ),
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
  RightPanelTabs: ({ diffText, traceRanges }: { diffText: string | null; traceRanges: TraceRange[] }) => (
    <>
      <div data-testid="diff-panel">{diffText ?? "(none)"}</div>
      <div data-testid="trace-panel">{traceRanges.length}</div>
    </>
  ),
}));

vi.mock("../../components/Timeline", () => ({
  Timeline: ({
    nodes,
    selectedId,
    onSelect,
  }: {
    nodes: Array<{ id: string; label?: string }>;
    selectedId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <div data-testid="timeline-mock">
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onSelect(node.id)}>
          {node.label ?? node.id}
        </button>
      ))}
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

function buildProps(overrides: {
  model?: BranchViewModel;
  loadFilesForNode?: (nodeId: string) => Promise<FileChange[]>;
  loadDiffForFile?: (nodeId: string, filePath: string) => Promise<string>;
  loadTraceRangesForFile?: (nodeId: string, filePath: string) => Promise<TraceRange[]>;
  onClearFilter?: () => void;
  dashboardFilter?: { type: "file"; value: string };
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
  };
}

describe("BranchView transition and integration coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
