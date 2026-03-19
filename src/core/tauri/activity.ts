import { invoke } from "@tauri-apps/api/core";

export type ActivityEvent = {
	id: number;
	createdAtIso: string;
	sourceTool: string;
	action: string;
	status: string;
	sessionId?: string | null;
	commitShas?: string[] | null;
	redactionCount?: number | null;
	needsReview?: boolean | null;
	message: string;
};

export type LinkedSessionMessage = {
	role: string;
	text: string;
	toolName?: string | null;
};

export type LinkedSession = {
	sessionId: string;
	tool: string;
	model?: string | null;
	importedAtIso: string;
	durationMin?: number | null;
	messageCount: number;
	filesTouched: string[];
	linkConfidence: number;
	needsReview: boolean;
	autoLinked: boolean;
	messages: LinkedSessionMessage[];
};

export type CommitCaptureBundle = {
	commitSha: string;
	linkedSessions: LinkedSession[];
	gitFilesChangedTop: string[];
	toolsUsedTop: string[];
};

export async function getIngestActivity(repoId: number, limit: number) {
	return invoke<ActivityEvent[]>("get_ingest_activity", { repoId, limit });
}

export async function getCommitCaptureBundle(
	repoId: number,
	repoRoot: string,
	commitSha: string,
) {
	return invoke<CommitCaptureBundle>("get_commit_capture_bundle", {
		repoId,
		repoRoot,
		commitSha,
	});
}
