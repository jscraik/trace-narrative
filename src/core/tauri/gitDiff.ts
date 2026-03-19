import { invoke } from "@tauri-apps/api/core";

export type AddedRange = { start: number; end: number };

export async function getCommitAddedRanges(
	repoRoot: string,
	commitSha: string,
	filePath: string,
): Promise<AddedRange[]> {
	return invoke("get_commit_added_ranges", { repoRoot, commitSha, filePath });
}
