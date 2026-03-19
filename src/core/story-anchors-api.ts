import { invoke } from "@tauri-apps/api/core";

export type StoryAnchorCommitStatus = {
	commitSha: string;
	hasAttributionNote: boolean;
	hasSessionsNote: boolean;
	hasLineageNote: boolean;
	attributionRef?: string | null;
	sessionsRef?: string | null;
	lineageRef?: string | null;
	attributionSchemaVersion?: string | null;
	sessionsSchemaVersion?: string | null;
	lineageSchemaVersion?: string | null;
};

export type SessionsNoteBatchSummary = {
	total: number;
	imported: number;
	missing: number;
	failed: number;
};

export type SessionsNoteExportSummary = {
	commitSha: string;
	status: string;
};

export type MigrateAttributionNotesSummary = {
	total: number;
	migrated: number;
	missing: number;
	failed: number;
};

export type ReconcileSummary = {
	total: number;
	recoveredSessions: number;
	recoveredAttribution: number;
	wroteNotes: number;
};

export async function getStoryAnchorStatus(
	repoId: number,
	commitShas: string[],
): Promise<StoryAnchorCommitStatus[]> {
	return invoke("get_story_anchor_status", { repoId, commitShas });
}

export async function importSessionLinkNotesBatch(
	repoId: number,
	commitShas: string[],
): Promise<SessionsNoteBatchSummary> {
	return invoke("import_session_link_notes_batch", { repoId, commitShas });
}

export async function exportSessionLinkNote(
	repoId: number,
	commitSha: string,
): Promise<SessionsNoteExportSummary> {
	return invoke("export_session_link_note", { repoId, commitSha });
}

export async function migrateAttributionNotesRef(
	repoId: number,
	commitShas: string[],
): Promise<MigrateAttributionNotesSummary> {
	return invoke("migrate_attribution_notes_ref", { repoId, commitShas });
}

export async function reconcileAfterRewrite(
	repoId: number,
	commitShas: string[],
	writeRecoveredNotes = false,
): Promise<ReconcileSummary> {
	return invoke("reconcile_after_rewrite", {
		repoId,
		commitShas,
		writeRecoveredNotes,
	});
}

export async function installRepoHooks(repoId: number): Promise<void> {
	return invoke("install_repo_hooks", { repoId });
}

export async function uninstallRepoHooks(repoId: number): Promise<void> {
	return invoke("uninstall_repo_hooks", { repoId });
}

export type RepoHooksStatus = {
	installed: boolean;
	hooksDir: string;
};

export async function getRepoHooksStatus(
	repoId: number,
): Promise<RepoHooksStatus> {
	return invoke("get_repo_hooks_status", { repoId });
}
