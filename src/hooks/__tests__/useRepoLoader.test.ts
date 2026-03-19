import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttributionPrefs } from "../../core/attribution-api";
import type { BranchViewModel } from "../../core/types";
import { useRepoLoader } from "../useRepoLoader";

const mockOpen = vi.hoisted(() => vi.fn());
const mockDetectCodexOtelPromptExport = vi.hoisted(() => vi.fn());
const mockIndexRepo = vi.hoisted(() => vi.fn());
const mockSetActiveRepoRoot = vi.hoisted(() => vi.fn());
const mockSetOtelReceiverEnabled = vi.hoisted(() => vi.fn());
const mockGetAttributionPrefs = vi.hoisted(() => vi.fn());
const mockSetAttributionPrefs = vi.hoisted(() => vi.fn());
const mockPurgeAttributionPromptMeta = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({
	open: mockOpen,
}));

vi.mock("../../core/repo/codexConfig", () => ({
	detectCodexOtelPromptExport: mockDetectCodexOtelPromptExport,
}));

vi.mock("../../core/repo/indexer", () => ({
	indexRepo: mockIndexRepo,
}));

vi.mock("../../core/tauri/otelReceiver", () => ({
	setActiveRepoRoot: mockSetActiveRepoRoot,
	setOtelReceiverEnabled: mockSetOtelReceiverEnabled,
}));

vi.mock("../../core/attribution-api", () => ({
	getAttributionPrefs: mockGetAttributionPrefs,
	setAttributionPrefs: mockSetAttributionPrefs,
	purgeAttributionPromptMeta: mockPurgeAttributionPromptMeta,
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

function createModel(repoId: number): BranchViewModel {
	return {
		source: "git",
		title: `repo-${repoId}`,
		status: "open",
		description: `Repo ${repoId}`,
		stats: {
			added: 0,
			removed: 0,
			files: 1,
			commits: 1,
			prompts: 0,
			responses: 0,
		},
		intent: [],
		timeline: [
			{ id: `sha-${repoId}`, type: "commit", label: `Commit ${repoId}` },
		],
		meta: {
			repoId,
			repoPath: `/repo/${repoId}`,
			branchName: "main",
			headSha: `sha-${repoId}`,
		},
	};
}

function createReadyState(repoId: number) {
	return {
		status: "ready" as const,
		path: `/repo/${repoId}`,
		model: createModel(repoId),
		repo: {
			repoId,
			root: `/repo/${repoId}`,
			branch: "main",
			headSha: `sha-${repoId}`,
		},
	};
}

function createPrefs(repoId: number): AttributionPrefs {
	return {
		repoId,
		cachePromptMetadata: true,
		storePromptText: false,
		showLineOverlays: true,
		retentionDays: 30,
		lastPurgedAt: null,
	};
}

function createIndexResult(repoId: number, rootPath: string) {
	return {
		model: createModel(repoId),
		repo: {
			repoId,
			root: rootPath,
			branch: "main",
			headSha: `sha-${repoId}`,
		},
	};
}

describe("useRepoLoader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOpen.mockResolvedValue(null);
		mockIndexRepo.mockResolvedValue(createIndexResult(1, "/repo/1"));
		mockSetActiveRepoRoot.mockResolvedValue(undefined);
		mockSetOtelReceiverEnabled.mockResolvedValue(undefined);
		mockGetAttributionPrefs.mockResolvedValue(createPrefs(1));
		mockSetAttributionPrefs.mockResolvedValue(createPrefs(1));
		mockPurgeAttributionPromptMeta.mockResolvedValue({ removed: 0 });
		mockDetectCodexOtelPromptExport.mockResolvedValue({
			enabled: null,
			configPath: null,
		});
	});

	it("ignores stale attribution preference responses when repo changes", async () => {
		const deferredByRepo: Record<number, Deferred<AttributionPrefs>> = {
			1: createDeferred<AttributionPrefs>(),
			2: createDeferred<AttributionPrefs>(),
		};

		mockGetAttributionPrefs.mockImplementation(
			(repoId: number) => deferredByRepo[repoId].promise,
		);

		const { result } = renderHook(() => useRepoLoader());

		act(() => {
			result.current.setRepoState(createReadyState(1));
		});

		await waitFor(() => {
			expect(mockGetAttributionPrefs).toHaveBeenCalledWith(1);
		});

		act(() => {
			result.current.setRepoState(createReadyState(2));
		});

		await waitFor(() => {
			expect(mockGetAttributionPrefs).toHaveBeenCalledWith(2);
		});

		await act(async () => {
			deferredByRepo[2].resolve(createPrefs(2));
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(result.current.attributionPrefs?.repoId).toBe(2);
		});

		await act(async () => {
			deferredByRepo[1].resolve(createPrefs(1));
			await Promise.resolve();
		});

		expect(result.current.attributionPrefs?.repoId).toBe(2);
	});

	it("reports dialog errors when repository picker fails to open", async () => {
		mockOpen.mockRejectedValueOnce(new Error("dialog unavailable"));

		const { result } = renderHook(() => useRepoLoader());

		await act(async () => {
			await result.current.openRepo();
		});

		expect(result.current.actionError).toBe("dialog unavailable");
		expect(result.current.repoState.status).toBe("idle");
		expect(mockIndexRepo).not.toHaveBeenCalled();
	});

	it("clears prefs and ignores late attribution responses after leaving ready state", async () => {
		const deferred = createDeferred<AttributionPrefs>();
		mockGetAttributionPrefs.mockImplementation(async () => deferred.promise);

		const { result } = renderHook(() => useRepoLoader());

		act(() => {
			result.current.setRepoState(createReadyState(1));
		});

		await waitFor(() => {
			expect(mockGetAttributionPrefs).toHaveBeenCalledWith(1);
		});

		act(() => {
			result.current.setRepoState({ status: "idle" });
		});

		expect(result.current.attributionPrefs).toBeNull();

		await act(async () => {
			deferred.resolve(createPrefs(1));
			await Promise.resolve();
		});

		expect(result.current.attributionPrefs).toBeNull();
	});

	it("ignores stale openRepo success completion when a newer repo load finishes first", async () => {
		const deferredByPath: Record<
			string,
			Deferred<ReturnType<typeof createIndexResult>>
		> = {
			"/repo/1": createDeferred<ReturnType<typeof createIndexResult>>(),
			"/repo/2": createDeferred<ReturnType<typeof createIndexResult>>(),
		};

		mockOpen.mockResolvedValueOnce("/repo/1").mockResolvedValueOnce("/repo/2");
		mockIndexRepo.mockImplementation(
			async (selectedPath: string) => deferredByPath[selectedPath].promise,
		);
		mockGetAttributionPrefs
			.mockResolvedValueOnce(createPrefs(2))
			.mockResolvedValue(createPrefs(1));

		const { result } = renderHook(() => useRepoLoader());

		let openFirst: Promise<void> | undefined;
		let openSecond: Promise<void> | undefined;
		await act(async () => {
			openFirst = result.current.openRepo();
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockIndexRepo).toHaveBeenCalledWith(
				"/repo/1",
				60,
				expect.any(Function),
			);
		});

		await act(async () => {
			openSecond = result.current.openRepo();
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockIndexRepo).toHaveBeenCalledWith(
				"/repo/2",
				60,
				expect.any(Function),
			);
		});

		await act(async () => {
			deferredByPath["/repo/2"].resolve(createIndexResult(2, "/repo/2"));
			await openSecond;
		});

		await waitFor(() => {
			expect(result.current.repoState.status).toBe("ready");
			if (result.current.repoState.status === "ready") {
				expect(result.current.repoState.path).toBe("/repo/2");
				expect(result.current.repoState.repo.repoId).toBe(2);
			}
		});

		await act(async () => {
			deferredByPath["/repo/1"].resolve(createIndexResult(1, "/repo/1"));
			await openFirst;
		});

		expect(result.current.repoState.status).toBe("ready");
		if (result.current.repoState.status === "ready") {
			expect(result.current.repoState.path).toBe("/repo/2");
			expect(result.current.repoState.repo.repoId).toBe(2);
		}
	});

	it("ignores stale openRepo failure from an older request after a newer success", async () => {
		const deferredByPath: Record<
			string,
			Deferred<ReturnType<typeof createIndexResult>>
		> = {
			"/repo/1": createDeferred<ReturnType<typeof createIndexResult>>(),
			"/repo/2": createDeferred<ReturnType<typeof createIndexResult>>(),
		};

		mockOpen.mockResolvedValueOnce("/repo/1").mockResolvedValueOnce("/repo/2");
		mockIndexRepo.mockImplementation(
			async (selectedPath: string) => deferredByPath[selectedPath].promise,
		);
		mockGetAttributionPrefs.mockResolvedValue(createPrefs(2));

		const { result } = renderHook(() => useRepoLoader());

		let openFirst: Promise<void> | undefined;
		let openSecond: Promise<void> | undefined;
		await act(async () => {
			openFirst = result.current.openRepo();
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockIndexRepo).toHaveBeenCalledWith(
				"/repo/1",
				60,
				expect.any(Function),
			);
		});

		await act(async () => {
			openSecond = result.current.openRepo();
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockIndexRepo).toHaveBeenCalledWith(
				"/repo/2",
				60,
				expect.any(Function),
			);
		});

		await act(async () => {
			deferredByPath["/repo/2"].resolve(createIndexResult(2, "/repo/2"));
			await openSecond;
		});

		await waitFor(() => {
			expect(result.current.repoState.status).toBe("ready");
			if (result.current.repoState.status === "ready") {
				expect(result.current.repoState.path).toBe("/repo/2");
			}
		});

		await act(async () => {
			deferredByPath["/repo/1"].reject(new Error("stale index failure"));
			await openFirst;
		});

		expect(result.current.repoState.status).toBe("ready");
		if (result.current.repoState.status === "ready") {
			expect(result.current.repoState.path).toBe("/repo/2");
			expect(result.current.repoState.repo.repoId).toBe(2);
		}
		expect(result.current.actionError).toBeNull();
	});

	it("continues repo activation steps after indexing completes", async () => {
		const indexResult = createIndexResult(1, "/repo/1");
		mockOpen.mockResolvedValue("/repo/1");
		mockIndexRepo.mockResolvedValue(indexResult);

		const { result } = renderHook(() => useRepoLoader());

		await act(async () => {
			await result.current.openRepo();
		});

		expect(result.current.repoState).toMatchObject({
			status: "ready",
			path: "/repo/1",
			model: indexResult.model,
			repo: indexResult.repo,
		});
		expect(mockSetActiveRepoRoot).toHaveBeenCalledWith("/repo/1");
		expect(mockSetOtelReceiverEnabled).toHaveBeenCalledWith(false);
		expect(mockDetectCodexOtelPromptExport).toHaveBeenCalled();
		expect(mockGetAttributionPrefs).toHaveBeenCalledWith(1);
	});

	it("ignores openRepo completion after repo state is reset while indexing", async () => {
		const deferredIndex =
			createDeferred<ReturnType<typeof createIndexResult>>();
		mockOpen.mockResolvedValue("/repo/1");
		mockIndexRepo.mockImplementation(async () => deferredIndex.promise);

		const { result } = renderHook(() => useRepoLoader());

		let openRequest: Promise<void> | undefined;
		await act(async () => {
			openRequest = result.current.openRepo();
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockIndexRepo).toHaveBeenCalledWith(
				"/repo/1",
				60,
				expect.any(Function),
			);
			expect(result.current.repoState.status).toBe("loading");
		});

		act(() => {
			result.current.setRepoState({ status: "idle" });
		});

		await act(async () => {
			deferredIndex.resolve(createIndexResult(1, "/repo/1"));
			await openRequest;
		});

		expect(result.current.repoState.status).toBe("idle");
		expect(mockDetectCodexOtelPromptExport).not.toHaveBeenCalled();
	});

	it("ignores stale preference update result after repo switch", async () => {
		const deferredUpdate = createDeferred<AttributionPrefs>();
		mockGetAttributionPrefs.mockImplementation(async (repoId: number) =>
			createPrefs(repoId),
		);
		mockSetAttributionPrefs.mockImplementation(async (repoId: number) => {
			if (repoId === 1) return deferredUpdate.promise;
			return createPrefs(repoId);
		});

		const { result } = renderHook(() => useRepoLoader());

		act(() => {
			result.current.setRepoState(createReadyState(1));
		});

		await waitFor(() => {
			expect(result.current.attributionPrefs?.repoId).toBe(1);
		});

		let updateRequest: Promise<void> | undefined;
		await act(async () => {
			updateRequest = result.current.updateAttributionPrefs({
				showLineOverlays: false,
			});
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockSetAttributionPrefs).toHaveBeenCalledWith(1, {
				showLineOverlays: false,
			});
		});

		act(() => {
			result.current.setRepoState(createReadyState(2));
		});

		await waitFor(() => {
			expect(result.current.attributionPrefs?.repoId).toBe(2);
		});

		await act(async () => {
			deferredUpdate.resolve(createPrefs(1));
			await updateRequest;
		});

		expect(result.current.attributionPrefs?.repoId).toBe(2);
	});

	it("ignores stale preference update result when a newer update finishes first", async () => {
		const firstUpdate = createDeferred<AttributionPrefs>();
		mockGetAttributionPrefs.mockImplementation(async () => createPrefs(1));
		mockSetAttributionPrefs
			.mockImplementationOnce(async () => firstUpdate.promise)
			.mockImplementationOnce(async () => ({
				...createPrefs(1),
				showLineOverlays: true,
			}));

		const { result } = renderHook(() => useRepoLoader());

		act(() => {
			result.current.setRepoState(createReadyState(1));
		});

		await waitFor(() => {
			expect(result.current.attributionPrefs?.repoId).toBe(1);
		});

		let firstRequest: Promise<void> | undefined;
		let secondRequest: Promise<void> | undefined;
		await act(async () => {
			firstRequest = result.current.updateAttributionPrefs({
				showLineOverlays: false,
			});
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockSetAttributionPrefs).toHaveBeenNthCalledWith(1, 1, {
				showLineOverlays: false,
			});
		});

		await act(async () => {
			secondRequest = result.current.updateAttributionPrefs({
				showLineOverlays: true,
			});
			await secondRequest;
		});

		expect(result.current.attributionPrefs?.showLineOverlays).toBe(true);

		await act(async () => {
			firstUpdate.resolve({
				...createPrefs(1),
				showLineOverlays: false,
			});
			await firstRequest;
		});

		expect(result.current.attributionPrefs?.showLineOverlays).toBe(true);
	});

	it("ignores stale purge refresh result after repo switch", async () => {
		const deferredPurge = createDeferred<{ removed: number }>();
		mockGetAttributionPrefs.mockImplementation(async (repoId: number) =>
			createPrefs(repoId),
		);
		mockPurgeAttributionPromptMeta.mockImplementation(
			async (repoId: number) => {
				if (repoId === 1) return deferredPurge.promise;
				return { removed: 0 };
			},
		);

		const { result } = renderHook(() => useRepoLoader());

		act(() => {
			result.current.setRepoState(createReadyState(1));
		});

		await waitFor(() => {
			expect(result.current.attributionPrefs?.repoId).toBe(1);
		});

		let purgeRequest: Promise<void> | undefined;
		await act(async () => {
			purgeRequest = result.current.purgeAttributionMetadata();
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockPurgeAttributionPromptMeta).toHaveBeenCalledWith(1);
		});

		act(() => {
			result.current.setRepoState(createReadyState(2));
		});

		await waitFor(() => {
			expect(result.current.attributionPrefs?.repoId).toBe(2);
		});

		await act(async () => {
			deferredPurge.resolve({ removed: 1 });
			await purgeRequest;
		});

		expect(result.current.attributionPrefs?.repoId).toBe(2);
	});

	it("does not finalize repo activation side effects after hook unmount", async () => {
		const indexDeferred =
			createDeferred<ReturnType<typeof createIndexResult>>();

		mockOpen.mockResolvedValue("/repo/1");
		mockIndexRepo.mockImplementation(async () => indexDeferred.promise);

		const { result, unmount } = renderHook(() => useRepoLoader());

		let openRequest: Promise<void> | undefined;
		await act(async () => {
			openRequest = result.current.openRepo();
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockIndexRepo).toHaveBeenCalledWith(
				"/repo/1",
				60,
				expect.any(Function),
			);
		});

		unmount();

		await act(async () => {
			indexDeferred.resolve(createIndexResult(1, "/repo/1"));
			await openRequest;
			await Promise.resolve();
		});

		expect(mockSetActiveRepoRoot).not.toHaveBeenCalled();
		expect(mockSetOtelReceiverEnabled).not.toHaveBeenCalled();
		expect(mockDetectCodexOtelPromptExport).not.toHaveBeenCalled();
	});
});
