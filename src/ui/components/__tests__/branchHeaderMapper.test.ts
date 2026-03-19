import { describe, expect, it } from "vitest";
import type { BranchViewModel } from "../../../core/types";
import {
	createBranchHeaderRequestIdentityKey,
	deriveBranchHeaderViewModel,
	normalizeFilterKey,
	normalizeRepoKey,
} from "../branchHeaderMapper";

function createModel(
	overrides: Partial<BranchViewModel> = {},
): BranchViewModel {
	return {
		source: "git",
		title: "feature/branch-header",
		status: "open",
		description: "Improve branch header parity",
		stats: {
			added: 20,
			removed: 4,
			files: 3,
			commits: 2,
			prompts: 5,
			responses: 9,
		},
		intent: [{ id: "i1", text: "Add deterministic header contract" }],
		timeline: [{ id: "abc1234", type: "commit", label: "abc1234" }],
		meta: {
			repoPath: "/Users/jamiecraik/dev/narrative",
			branchName: "feature/branch-header",
			headSha: "abc123456789",
			repoId: 1,
		},
		...overrides,
	};
}

describe("deriveBranchHeaderViewModel", () => {
	it("returns shell in repo loading state", () => {
		const vm = deriveBranchHeaderViewModel({
			mode: "repo",
			repoStatus: "loading",
			model: null,
		});

		expect(vm.kind).toBe("shell");
		if (vm.kind === "shell") {
			expect(vm.state).toBe("loading");
		}
	});

	it("uses deterministic title fallback for git model", () => {
		const vm = deriveBranchHeaderViewModel({
			mode: "repo",
			repoStatus: "ready",
			model: createModel({
				title: "",
				meta: { branchName: "", headSha: "a1b2c3d4e5f6" },
			}),
		});

		expect(vm.kind).toBe("full");
		if (vm.kind === "full") {
			expect(vm.title).toBe("a1b2c3d");
		}
	});

	it("avoids path-only description and falls back to intent summary", () => {
		const vm = deriveBranchHeaderViewModel({
			mode: "repo",
			repoStatus: "ready",
			model: createModel({
				description: "/Users/jamiecraik/dev/narrative",
				meta: { repoPath: "/Users/jamiecraik/dev/narrative" },
			}),
		});

		expect(vm.kind).toBe("full");
		if (vm.kind === "full") {
			expect(vm.description).toContain("deterministic header contract");
			expect(vm.description).not.toBe("/Users/jamiecraik/dev/narrative");
		}
	});

	it("marks AI metrics unavailable when trace state is inactive", () => {
		const vm = deriveBranchHeaderViewModel({
			mode: "repo",
			repoStatus: "ready",
			model: createModel({ traceStatus: { state: "inactive" } }),
		});

		expect(vm.kind).toBe("full");
		if (vm.kind === "full") {
			expect(vm.metrics.prompts).toEqual({
				kind: "unavailable",
				reason: "NO_TRACE_DATA",
			});
			expect(vm.metrics.responses).toEqual({
				kind: "unavailable",
				reason: "NO_TRACE_DATA",
			});
		}
	});
});

describe("request identity normalization", () => {
	it("normalizes repo keys deterministically", () => {
		expect(normalizeRepoKey("/Users/Jamie/Repo/")).toBe("/users/jamie/repo");
		expect(normalizeRepoKey("C:\\Users\\Jamie\\Repo\\")).toBe(
			"c:/users/jamie/repo",
		);
	});

	it("normalizes equivalent filter objects to the same key", () => {
		const keyA = normalizeFilterKey({
			type: "date-range",
			dateRange: { from: "2026-02-01", to: "2026-02-18" },
		});
		const keyB = normalizeFilterKey({
			dateRange: { to: "2026-02-18", from: "2026-02-01" },
			type: "date-range",
		});
		expect(keyA).toBe(keyB);
	});

	it("produces distinct identity keys for distinct logical requests (collision guard)", () => {
		const base = {
			repoKey: "/Users/jamiecraik/dev/narrative",
			mode: "repo" as const,
		};

		const keyA = createBranchHeaderRequestIdentityKey({
			...base,
			filter: { type: "file", value: "src/App.tsx" },
		});

		const keyB = createBranchHeaderRequestIdentityKey({
			...base,
			filter: { type: "file", value: "src/ui/views/BranchView.tsx" },
		});

		expect(keyA).not.toBe(keyB);
	});
});
