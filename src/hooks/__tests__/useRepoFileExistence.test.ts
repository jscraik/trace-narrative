import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoFileExistence } from "../useRepoFileExistence";

const mockFileExists = vi.hoisted(() => vi.fn());

vi.mock("../../core/tauri/narrativeFs", () => ({
	fileExists: mockFileExists,
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

describe("useRepoFileExistence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFileExists.mockResolvedValue(true);
	});

	it("clears cached file existence when repo root changes", async () => {
		mockFileExists.mockImplementation((repoRoot: string) => {
			if (repoRoot === "/repo/1") return Promise.resolve(true);
			return Promise.reject(new Error("unavailable"));
		});

		const { result, rerender } = renderHook(
			({ repoRoot }) => useRepoFileExistence(repoRoot, ["src/file.ts"]),
			{ initialProps: { repoRoot: "/repo/1" } },
		);

		await waitFor(() => {
			expect(result.current["src/file.ts"]).toBe(true);
		});

		rerender({ repoRoot: "/repo/2" });

		await waitFor(() => {
			expect(result.current["src/file.ts"]).toBeUndefined();
		});
	});

	it("ignores stale in-flight checks from a previous repo root", async () => {
		const oldCheck = createDeferred<boolean>();
		mockFileExists.mockImplementation((repoRoot: string) => {
			if (repoRoot === "/repo/1") return oldCheck.promise;
			return Promise.resolve(false);
		});

		const { result, rerender } = renderHook(
			({ repoRoot }) => useRepoFileExistence(repoRoot, ["src/file.ts"]),
			{ initialProps: { repoRoot: "/repo/1" } },
		);

		await waitFor(() => {
			expect(mockFileExists).toHaveBeenCalledWith("/repo/1", "src/file.ts");
		});

		rerender({ repoRoot: "/repo/2" });

		await waitFor(() => {
			expect(mockFileExists).toHaveBeenCalledWith("/repo/2", "src/file.ts");
			expect(result.current["src/file.ts"]).toBe(false);
		});

		await act(async () => {
			oldCheck.resolve(true);
			await oldCheck.promise;
			await Promise.resolve();
		});

		expect(result.current["src/file.ts"]).toBe(false);
	});

	it("does not repeatedly re-check paths that failed existence lookup", async () => {
		mockFileExists.mockImplementation((repoRoot: string, path: string) => {
			if (repoRoot === "/repo/1" && path === "src/missing.ts") {
				return Promise.reject(new Error("missing"));
			}
			return Promise.resolve(true);
		});

		const { result, rerender } = renderHook(
			({ repoRoot, paths }) => useRepoFileExistence(repoRoot, paths),
			{
				initialProps: {
					repoRoot: "/repo/1",
					paths: ["src/missing.ts", "src/existing.ts"],
				},
			},
		);

		await waitFor(() => {
			expect(result.current["src/existing.ts"]).toBe(true);
		});

		const missingCallsAfterFirstPass = mockFileExists.mock.calls.filter(
			([repo, path]) => repo === "/repo/1" && path === "src/missing.ts",
		).length;
		expect(missingCallsAfterFirstPass).toBe(1);

		rerender({
			repoRoot: "/repo/1",
			paths: ["src/missing.ts", "src/existing.ts", "src/new.ts"],
		});

		await waitFor(() => {
			expect(result.current["src/new.ts"]).toBe(true);
		});

		const missingCallsAfterRerender = mockFileExists.mock.calls.filter(
			([repo, path]) => repo === "/repo/1" && path === "src/missing.ts",
		).length;
		expect(missingCallsAfterRerender).toBe(1);
	});

	it("retries transient failures after the retry window", async () => {
		const originalNow = vi.spyOn(Date, "now");
		originalNow.mockReturnValue(1_000);

		let callCount = 0;
		mockFileExists.mockImplementation(
			async (_repoRoot: string, path: string) => {
				if (path === "src/missing.ts") {
					callCount += 1;
					if (callCount === 1) {
						throw new Error("temporary issue");
					}
					return false;
				}
				return true;
			},
		);

		const { rerender } = renderHook(
			({ repoRoot }) => useRepoFileExistence(repoRoot, ["src/missing.ts"]),
			{ initialProps: { repoRoot: "/repo/1" } },
		);

		await waitFor(() => {
			expect(callCount).toBe(1);
		});

		originalNow.mockReturnValue(1_000 + 6_000);
		rerender({ repoRoot: "/repo/1" });

		await waitFor(() => {
			expect(callCount).toBe(2);
		});

		originalNow.mockRestore();
	});
});
