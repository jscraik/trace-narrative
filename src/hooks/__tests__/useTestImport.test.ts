import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTestImport } from "../useTestImport";

const mockOpen = vi.hoisted(() => vi.fn());
const mockEnsureNarrativeDirs = vi.hoisted(() => vi.fn());
const mockReadTextFile = vi.hoisted(() => vi.fn());
const mockWriteNarrativeFile = vi.hoisted(() => vi.fn());
const mockSha256Hex = vi.hoisted(() => vi.fn());
const mockIsoStampForFile = vi.hoisted(() => vi.fn());
const mockParseJUnitXml = vi.hoisted(() => vi.fn());
const mockSaveTestRun = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({
	open: mockOpen,
}));

vi.mock("../../core/tauri/narrativeFs", () => ({
	ensureNarrativeDirs: mockEnsureNarrativeDirs,
	readTextFile: mockReadTextFile,
	writeNarrativeFile: mockWriteNarrativeFile,
}));

vi.mock("../../core/security/hash", () => ({
	sha256Hex: mockSha256Hex,
}));

vi.mock("../isoStampForFile", () => ({
	isoStampForFile: mockIsoStampForFile,
}));

vi.mock("../../core/repo/junit", () => ({
	parseJUnitXml: mockParseJUnitXml,
}));

vi.mock("../../core/repo/testRuns", () => ({
	saveTestRun: mockSaveTestRun,
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

describe("useTestImport", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOpen.mockResolvedValue("/tmp/junit.xml");
		mockEnsureNarrativeDirs.mockResolvedValue(undefined);
		mockReadTextFile.mockResolvedValue("<xml/>");
		mockSha256Hex.mockResolvedValue(
			"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		);
		mockIsoStampForFile.mockReturnValue("20260224T000000000Z");
		mockParseJUnitXml.mockReturnValue({
			durationSec: 12,
			passed: 3,
			failed: 0,
			skipped: 1,
			cases: [],
		});
		mockWriteNarrativeFile.mockResolvedValue(undefined);
		mockSaveTestRun.mockResolvedValue({
			id: "run-1",
			importedAtISO: "2026-02-24T00:00:00.000Z",
			sourceBasename: "junit.xml",
			rawRelPath: "tests/imported/file.xml",
			commitSha: "sha-1",
			atISO: "2026-02-24T00:00:00.000Z",
			durationSec: 12,
			passed: 3,
			failed: 0,
			skipped: 1,
			tests: [],
		});
	});

	it("ignores stale import completion after repo switch", async () => {
		const deferredSave = createDeferred<{
			id: string;
			importedAtISO: string;
			sourceBasename: string;
			rawRelPath: string;
			commitSha: string;
			atISO: string;
			durationSec: number;
			passed: number;
			failed: number;
			skipped: number;
			tests: unknown[];
		}>();
		mockSaveTestRun.mockImplementationOnce(async () => deferredSave.promise);

		const setRepoState = vi.fn();
		const setActionError = vi.fn();

		const { result, rerender } = renderHook(
			({ repoId }) =>
				useTestImport({
					repoRoot: "/repo",
					repoId,
					setRepoState,
					setActionError,
				}),
			{ initialProps: { repoId: 1 } },
		);

		const importPromise = result.current.importJUnitForCommit("sha-1");

		await waitFor(() => {
			expect(mockSaveTestRun).toHaveBeenCalledWith(
				expect.objectContaining({ repoId: 1, commitSha: "sha-1" }),
			);
		});

		rerender({ repoId: 2 });

		await act(async () => {
			deferredSave.resolve({
				id: "run-stale",
				importedAtISO: "2026-02-24T00:00:00.000Z",
				sourceBasename: "junit.xml",
				rawRelPath: "tests/imported/file.xml",
				commitSha: "sha-1",
				atISO: "2026-02-24T00:00:00.000Z",
				durationSec: 12,
				passed: 3,
				failed: 0,
				skipped: 1,
				tests: [],
			});
			await importPromise;
		});

		expect(setRepoState).not.toHaveBeenCalled();
	});

	it("ignores stale import errors after repo switch", async () => {
		const deferredSave = createDeferred<never>();
		mockSaveTestRun.mockImplementationOnce(async () => deferredSave.promise);

		const setRepoState = vi.fn();
		const setActionError = vi.fn();

		const { result, rerender } = renderHook(
			({ repoId }) =>
				useTestImport({
					repoRoot: "/repo",
					repoId,
					setRepoState,
					setActionError,
				}),
			{ initialProps: { repoId: 1 } },
		);

		const importPromise = result.current.importJUnitForCommit("sha-1");

		await waitFor(() => {
			expect(mockSaveTestRun).toHaveBeenCalledTimes(1);
		});

		rerender({ repoId: 2 });

		await act(async () => {
			deferredSave.reject(new Error("db write failed"));
			await importPromise;
		});

		expect(setRepoState).not.toHaveBeenCalled();
		expect(setActionError).toHaveBeenCalledWith(null);
		expect(setActionError).not.toHaveBeenCalledWith("db write failed");
	});

	it("ignores stale import completion after repo root switch", async () => {
		const deferredSave = createDeferred<{
			id: string;
			importedAtISO: string;
			sourceBasename: string;
			rawRelPath: string;
			commitSha: string;
			atISO: string;
			durationSec: number;
			passed: number;
			failed: number;
			skipped: number;
			tests: unknown[];
		}>();
		mockSaveTestRun.mockImplementationOnce(async () => deferredSave.promise);

		const setRepoState = vi.fn();
		const setActionError = vi.fn();

		const { result, rerender } = renderHook(
			({ repoRoot }) =>
				useTestImport({
					repoRoot,
					repoId: 1,
					setRepoState,
					setActionError,
				}),
			{ initialProps: { repoRoot: "/repo-a" } },
		);

		const importPromise = result.current.importJUnitForCommit("sha-1");

		await waitFor(() => {
			expect(mockSaveTestRun).toHaveBeenCalledWith(
				expect.objectContaining({ repoId: 1, commitSha: "sha-1" }),
			);
		});

		rerender({ repoRoot: "/repo-b" });

		await act(async () => {
			deferredSave.resolve({
				id: "run-stale",
				importedAtISO: "2026-02-24T00:00:00.000Z",
				sourceBasename: "junit.xml",
				rawRelPath: "tests/imported/file.xml",
				commitSha: "sha-1",
				atISO: "2026-02-24T00:00:00.000Z",
				durationSec: 12,
				passed: 3,
				failed: 0,
				skipped: 1,
				tests: [],
			});
			await importPromise;
		});

		expect(setRepoState).not.toHaveBeenCalled();
		expect(setActionError).toHaveBeenCalledWith(null);
	});

	it("does not update state after unmount", async () => {
		const deferredSave = createDeferred<{
			id: string;
			importedAtISO: string;
			sourceBasename: string;
			rawRelPath: string;
			commitSha: string;
			atISO: string;
			durationSec: number;
			passed: number;
			failed: number;
			skipped: number;
			tests: unknown[];
		}>();
		mockSaveTestRun.mockImplementationOnce(async () => deferredSave.promise);

		const setRepoState = vi.fn();
		const setActionError = vi.fn();

		const { result, unmount } = renderHook(() =>
			useTestImport({
				repoRoot: "/repo",
				repoId: 1,
				setRepoState,
				setActionError,
			}),
		);

		const importPromise = result.current.importJUnitForCommit("sha-1");

		await waitFor(() => {
			expect(mockSaveTestRun).toHaveBeenCalledTimes(1);
		});

		unmount();

		await act(async () => {
			deferredSave.resolve({
				id: "run-new",
				importedAtISO: "2026-02-24T00:00:00.000Z",
				sourceBasename: "junit.xml",
				rawRelPath: "tests/imported/file.xml",
				commitSha: "sha-1",
				atISO: "2026-02-24T00:00:00.000Z",
				durationSec: 12,
				passed: 3,
				failed: 0,
				skipped: 1,
				tests: [],
			});
			await importPromise;
		});

		expect(setRepoState).not.toHaveBeenCalled();
		expect(setActionError).toHaveBeenCalledWith(null);
	});
});
