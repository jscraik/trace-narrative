import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AttributionNoteSummary,
	AttributionPrefs,
	ContributionStats,
} from "../../core/attribution-api";
import { useSourceLensData } from "../useSourceLensData";

const mockInvoke = vi.hoisted(() => vi.fn());
const mockExportAttributionNote = vi.hoisted(() => vi.fn());
const mockGetCommitContributionStats = vi.hoisted(() => vi.fn());
const mockGetAttributionNoteSummary = vi.hoisted(() => vi.fn());
const mockGetAttributionPrefs = vi.hoisted(() => vi.fn());
const mockImportAttributionNote = vi.hoisted(() => vi.fn());
const mockSetAttributionPrefs = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
	invoke: mockInvoke,
}));

vi.mock("../../core/attribution-api", () => ({
	exportAttributionNote: mockExportAttributionNote,
	getCommitContributionStats: mockGetCommitContributionStats,
	getAttributionNoteSummary: mockGetAttributionNoteSummary,
	getAttributionPrefs: mockGetAttributionPrefs,
	importAttributionNote: mockImportAttributionNote,
	setAttributionPrefs: mockSetAttributionPrefs,
}));

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

function createStats(totalLines: number): ContributionStats {
	return {
		humanLines: totalLines / 2,
		aiAgentLines: totalLines / 2,
		aiAssistLines: 0,
		collaborativeLines: 0,
		totalLines,
		aiPercentage: 50,
		toolBreakdown: [],
	};
}

function createSummary(commitSha: string): AttributionNoteSummary {
	return {
		commitSha,
		hasNote: true,
		metadataAvailable: false,
		metadataCached: false,
	};
}

function createPrefs(repoId: number): AttributionPrefs {
	return {
		repoId,
		cachePromptMetadata: false,
		storePromptText: false,
		showLineOverlays: true,
		retentionDays: 30,
		lastPurgedAt: null,
	};
}

describe("useSourceLensData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockInvoke.mockResolvedValue({
			lines: [{ lineNumber: 1, content: "default", authorType: "human" }],
			totalLines: 1,
			hasMore: false,
		});
		mockGetCommitContributionStats.mockResolvedValue(createStats(10));
		mockGetAttributionNoteSummary.mockResolvedValue(createSummary("default"));
		mockGetAttributionPrefs.mockResolvedValue(createPrefs(1));
		mockImportAttributionNote.mockResolvedValue({
			status: "ok",
			importedRanges: 1,
		});
		mockExportAttributionNote.mockResolvedValue({
			status: "ok",
			commitSha: "default",
		});
		mockSetAttributionPrefs.mockResolvedValue(createPrefs(1));
	});

	it("ignores stale source-lens payloads after commit change", async () => {
		const staleLens = createDeferred<{
			lines: Array<{
				lineNumber: number;
				content: string;
				authorType: "human";
			}>;
			totalLines: number;
			hasMore: boolean;
		}>();

		mockInvoke.mockImplementation(
			(_command: string, args: { request: { commitSha: string } }) => {
				if (args.request.commitSha === "old-sha") return staleLens.promise;
				return Promise.resolve({
					lines: [
						{
							lineNumber: 1,
							content: "new-line",
							authorType: "human" as const,
						},
					],
					totalLines: 1,
					hasMore: false,
				});
			},
		);

		const { result, rerender } = renderHook(
			({ commitSha }) =>
				useSourceLensData({
					repoId: 1,
					commitSha,
					filePath: "src/file.ts",
				}),
			{ initialProps: { commitSha: "old-sha" } },
		);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith(
				"get_file_source_lens",
				expect.objectContaining({
					request: expect.objectContaining({ commitSha: "old-sha" }),
				}),
			);
		});

		rerender({ commitSha: "new-sha" });

		await waitFor(() => {
			expect(result.current.lines[0]?.content).toBe("new-line");
		});

		await act(async () => {
			staleLens.resolve({
				lines: [{ lineNumber: 1, content: "old-line", authorType: "human" }],
				totalLines: 1,
				hasMore: false,
			});
			await staleLens.promise;
			await Promise.resolve();
		});

		expect(result.current.lines[0]?.content).toBe("new-line");
	});

	it("ignores stale contribution stats after commit change", async () => {
		const staleStats = createDeferred<ContributionStats>();
		mockGetCommitContributionStats.mockImplementation(
			(repoId: number, commitSha: string) => {
				if (repoId === 1 && commitSha === "old-sha") return staleStats.promise;
				return Promise.resolve(createStats(20));
			},
		);

		const { result, rerender } = renderHook(
			({ commitSha }) =>
				useSourceLensData({
					repoId: 1,
					commitSha,
					filePath: "src/file.ts",
				}),
			{ initialProps: { commitSha: "old-sha" } },
		);

		await waitFor(() => {
			expect(mockGetCommitContributionStats).toHaveBeenCalledWith(1, "old-sha");
		});

		rerender({ commitSha: "new-sha" });

		await waitFor(() => {
			expect(result.current.stats?.totalLines).toBe(20);
		});

		await act(async () => {
			staleStats.resolve(createStats(999));
			await staleStats.promise;
			await Promise.resolve();
		});

		expect(result.current.stats?.totalLines).toBe(20);
	});

	it("ignores stale import completion after commit change", async () => {
		const staleImport = createDeferred<{
			status: "ok";
			importedRanges: number;
		}>();
		mockImportAttributionNote.mockImplementation(
			(_repoId: number, targetCommit: string) => {
				if (targetCommit === "old-sha") return staleImport.promise;
				return Promise.resolve({ status: "ok", importedRanges: 2 });
			},
		);

		mockInvoke.mockImplementation(
			(_command: string, args: { request: { commitSha: string } }) =>
				Promise.resolve({
					lines: [
						{
							lineNumber: 1,
							content: `line-${args.request.commitSha}`,
							authorType: "human" as const,
						},
					],
					totalLines: 1,
					hasMore: false,
				}),
		);

		const { result, rerender } = renderHook(
			({ commitSha }) =>
				useSourceLensData({
					repoId: 1,
					commitSha,
					filePath: "src/file.ts",
				}),
			{ initialProps: { commitSha: "old-sha" } },
		);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith(
				"get_file_source_lens",
				expect.objectContaining({
					request: expect.objectContaining({ commitSha: "old-sha" }),
				}),
			);
		});

		let pendingImport!: Promise<void>;
		await act(async () => {
			pendingImport = result.current.handleImportNote();
			await Promise.resolve();
		});

		rerender({ commitSha: "new-sha" });

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith(
				"get_file_source_lens",
				expect.objectContaining({
					request: expect.objectContaining({ commitSha: "new-sha" }),
				}),
			);
		});

		const oldShaCallsBeforeResolve = mockInvoke.mock.calls.filter(
			(call) =>
				((call[1] as { request?: { commitSha?: string } } | undefined)?.request
					?.commitSha ?? "") === "old-sha",
		).length;

		await act(async () => {
			staleImport.resolve({ status: "ok", importedRanges: 9 });
			await staleImport.promise;
			await pendingImport;
			await Promise.resolve();
		});

		const oldShaCallsAfterResolve = mockInvoke.mock.calls.filter(
			(call) =>
				((call[1] as { request?: { commitSha?: string } } | undefined)?.request
					?.commitSha ?? "") === "old-sha",
		).length;

		expect(oldShaCallsAfterResolve).toBe(oldShaCallsBeforeResolve);
		expect(result.current.syncing).toBe(false);
		expect(result.current.syncStatus).toBeNull();
	});

	it("does not attempt state updates after unmount on pending attribution load", async () => {
		const pending = createDeferred<{
			lines: Array<{
				lineNumber: number;
				content: string;
				authorType: "human";
			}>;
			totalLines: number;
			hasMore: boolean;
		}>();
		mockInvoke.mockImplementation(() => pending.promise);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
			/* suppress console output in test */
		});

		const { unmount } = renderHook(() =>
			useSourceLensData({
				repoId: 1,
				commitSha: "sha-1",
				filePath: "src/file.ts",
			}),
		);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledTimes(1);
		});

		unmount();

		await act(async () => {
			pending.resolve({
				lines: [{ lineNumber: 1, content: "late-line", authorType: "human" }],
				totalLines: 1,
				hasMore: false,
			});
			await pending.promise;
		});

		expect(consoleError).not.toHaveBeenCalledWith(
			expect.stringContaining(
				"Can't perform a React state update on an unmounted component",
			),
		);
		consoleError.mockRestore();
	});

	it("does not attempt state updates after unmount during pending import action", async () => {
		const pendingImport = createDeferred<{
			status: "ok";
			importedRanges: number;
		}>();
		mockImportAttributionNote.mockReturnValue(pendingImport.promise);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
			/* suppress console output in test */
		});

		const { result, unmount } = renderHook(() =>
			useSourceLensData({
				repoId: 1,
				commitSha: "sha-1",
				filePath: "src/file.ts",
			}),
		);

		await act(async () => {
			void result.current.handleImportNote();
			await Promise.resolve();
		});

		unmount();

		await act(async () => {
			pendingImport.resolve({ status: "ok", importedRanges: 3 });
			await pendingImport.promise;
		});

		expect(consoleError).not.toHaveBeenCalledWith(
			expect.stringContaining(
				"Can't perform a React state update on an unmounted component",
			),
		);
		consoleError.mockRestore();
	});

	it("does not attempt state updates after unmount during pending export action", async () => {
		const pendingExport = createDeferred<{ status: "ok"; commitSha: string }>();
		mockExportAttributionNote.mockReturnValue(pendingExport.promise);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
			/* suppress console output in test */
		});

		const { result, unmount } = renderHook(() =>
			useSourceLensData({
				repoId: 1,
				commitSha: "sha-1",
				filePath: "src/file.ts",
			}),
		);

		await act(async () => {
			void result.current.handleExportNote();
			await Promise.resolve();
		});

		unmount();

		await act(async () => {
			pendingExport.resolve({ status: "ok", commitSha: "sha-1" });
			await pendingExport.promise;
		});

		expect(consoleError).not.toHaveBeenCalledWith(
			expect.stringContaining(
				"Can't perform a React state update on an unmounted component",
			),
		);
		consoleError.mockRestore();
	});

	it("does not attempt state updates after unmount during pending enable-metadata action", async () => {
		const pendingSetPrefs = createDeferred<AttributionPrefs>();
		mockSetAttributionPrefs.mockReturnValue(pendingSetPrefs.promise);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
			/* suppress console output in test */
		});

		const { result, unmount } = renderHook(() =>
			useSourceLensData({
				repoId: 1,
				commitSha: "sha-1",
				filePath: "src/file.ts",
			}),
		);

		await act(async () => {
			void result.current.handleEnableMetadata();
			await Promise.resolve();
		});

		unmount();

		await act(async () => {
			pendingSetPrefs.resolve(createPrefs(1));
			await pendingSetPrefs.promise;
		});

		expect(consoleError).not.toHaveBeenCalledWith(
			expect.stringContaining(
				"Can't perform a React state update on an unmounted component",
			),
		);
		consoleError.mockRestore();
	});
});
