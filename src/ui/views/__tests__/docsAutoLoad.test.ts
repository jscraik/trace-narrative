import { describe, expect, it } from "vitest";
import type { BranchViewModel } from "../../../core/types";
import type { RepoState } from "../../../hooks/useRepoLoader";
import {
	applyDocsAutoloadError,
	applyDocsAutoloadSuccess,
	DEV_FALLBACK_REPO_PATH,
} from "../docsAutoLoad";

type ReadyRepoState = Extract<RepoState, { status: "ready" }>;

function createReadyState(repoId: number, path: string): ReadyRepoState {
	const model: BranchViewModel = {
		source: "git",
		title: `repo-${repoId}`,
		status: "open",
		description: "",
		stats: {
			added: 0,
			removed: 0,
			files: 0,
			commits: 0,
			prompts: 0,
			responses: 0,
		},
		intent: [],
		timeline: [],
		meta: {
			repoId,
			repoPath: path,
			branchName: "main",
			headSha: `sha-${repoId}`,
		},
	};

	return {
		status: "ready",
		path,
		model,
		repo: {
			repoId,
			root: path,
			branch: "main",
			headSha: `sha-${repoId}`,
		},
	};
}

describe("docs auto-load state guards", () => {
	it("does not overwrite a newer ready state with stale auto-load success", () => {
		const userState = createReadyState(
			42,
			"/Users/jamiecraik/dev/firefly-narrative",
		);
		const fallbackReady = createReadyState(1, DEV_FALLBACK_REPO_PATH);

		const next = applyDocsAutoloadSuccess(
			userState,
			DEV_FALLBACK_REPO_PATH,
			fallbackReady.model,
			fallbackReady.repo,
		);

		expect(next).toBe(userState);
	});

	it("does not overwrite a newer ready state with stale auto-load error", () => {
		const userState = createReadyState(
			42,
			"/Users/jamiecraik/dev/firefly-narrative",
		);
		const next = applyDocsAutoloadError(userState, new Error("stale failure"));

		expect(next).toBe(userState);
	});
});
