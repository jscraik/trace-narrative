import type { RepoIndex } from "../../core/repo/indexer";
import type { BranchViewModel } from "../../core/types";
import type { RepoState } from "../../hooks/useRepoLoader";

export const DEV_FALLBACK_REPO_PATH = "/Users/jamiecraik/dev/narrative";

export function applyDocsAutoloadSuccess(
	prev: RepoState,
	defaultPath: string,
	model: BranchViewModel,
	repo: RepoIndex,
): RepoState {
	if (prev.status !== "loading" || prev.path !== defaultPath) return prev;
	return { status: "ready", path: defaultPath, model, repo };
}

export function applyDocsAutoloadError(
	prev: RepoState,
	error: unknown,
): RepoState {
	if (prev.status !== "loading" || prev.path !== DEV_FALLBACK_REPO_PATH)
		return prev;
	return { status: "error", message: String(error) };
}
