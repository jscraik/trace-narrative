import { invoke } from "@tauri-apps/api/core";

export type AgentSessionSummary = {
	id: string;
	repoId: number;
	tool: string;
	model?: string | null;
	checkpointKind: string;
	importedAt: string;
	durationMin?: number | null;
	messageCount: number;
	files: string[];
	linkedCommitSha?: string | null;
	linkConfidence?: number | null;
	autoLinked?: boolean | null;
};

export type AgentSessionDetail = AgentSessionSummary & {
	rawJson: unknown;
};

export async function agentListSessions(
	repoId: number,
	options?: { tool?: string; limit?: number },
): Promise<AgentSessionSummary[]> {
	return await invoke<AgentSessionSummary[]>("agent_list_sessions", {
		repoId,
		tool: options?.tool ?? null,
		limit: options?.limit ?? null,
	});
}

export async function agentGetSession(
	repoId: number,
	sessionId: string,
): Promise<AgentSessionDetail> {
	return await invoke<AgentSessionDetail>("agent_get_session", {
		repoId,
		sessionId,
	});
}

export async function agentLinkSessionToCommit(
	repoId: number,
	sessionId: string,
	commitSha: string,
	confidence?: number,
): Promise<number> {
	return await invoke<number>("agent_link_session_to_commit", {
		repoId,
		sessionId,
		commitSha,
		confidence: confidence ?? null,
	});
}
