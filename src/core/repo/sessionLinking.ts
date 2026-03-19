/**
 * Session-to-Commit Linking API
 *
 * Provides frontend access to Tauri commands for importing sessions
 * and linking them to commits using the confidence scoring algorithm.
 *
 * Per PRD Phase 1 MVP:
 * - FR1: Session Import with Linking
 * - FR2: Timeline Badge Display
 * - FR3: Session Panel Link State
 * - FR4: Unlink Flow
 */

import { invoke } from "@tauri-apps/api/core";
import type { SessionExcerpt } from "../types";

/**
 * Result of linking a session to a commit.
 */
export type SessionLinkResult = {
	commitSha: string;
	confidence: number;
	autoLinked: boolean;
	temporalScore: number;
	fileScore: number;
	needsReview: boolean;
};

/**
 * Link a session to its best matching commit.
 *
 * This command:
 * 1. Computes time window (±4 hours from session)
 * 2. Queries commits in that window
 * 3. Scores by temporal + file overlap (60% + 40%)
 * 4. Auto-links if confidence >= 0.65
 *
 * @param repoId - Repository ID
 * @param session - Session excerpt to link
 * @returns Link result with commit and confidence score
 */
export async function linkSessionToCommit(
	repoId: number,
	session: SessionExcerpt,
): Promise<SessionLinkResult> {
	return await invoke<SessionLinkResult>("link_session_to_commit", {
		repoId,
		sessionData: session,
	});
}

/**
 * Import a session file from disk and link it to a commit.
 *
 * This command:
 * 1. Validates the file path
 * 2. Reads and parses the session JSON
 * 3. Scans for secrets (security check)
 * 4. Links to best matching commit
 *
 * @param repoId - Repository ID
 * @param filePath - Path to session JSON file
 * @returns Link result or error if secrets detected
 */
export async function importAndLinkSessionFile(
	repoId: number,
	filePath: string,
): Promise<SessionLinkResult> {
	return await invoke<SessionLinkResult>("import_and_link_session_file", {
		repoId,
		filePath,
	});
}

/**
 * Get all session links for a repository.
 *
 * @param repoId - Repository ID
 * @returns Array of session links
 */
export async function getSessionLinksForRepo(
	repoId: number,
): Promise<SessionLink[]> {
	return await invoke<SessionLink[]>("get_session_links_for_repo", { repoId });
}

/**
 * Get session links for a specific commit.
 *
 * @param repoId - Repository ID
 * @param commitSha - Commit SHA
 * @returns Array of session links for this commit
 */
export async function getSessionLinksForCommit(
	repoId: number,
	commitSha: string,
): Promise<SessionLink[]> {
	return await invoke<SessionLink[]>("get_session_links_for_commit", {
		repoId,
		commitSha,
	});
}

/**
 * Delete a session link (unlink).
 *
 * @param linkId - Link ID to delete
 */
export async function deleteSessionLink(linkId: number): Promise<void> {
	await invoke("delete_session_link", { linkId });
}

/**
 * Delete a session link by session ID (helper for UI).
 *
 * This finds the link for the given session and deletes it.
 *
 * @param repoId - Repository ID
 * @param sessionId - Session ID to unlink
 */
export async function deleteSessionLinkBySessionId(
	repoId: number,
	sessionId: string,
): Promise<void> {
	const links = await getSessionLinksForRepo(repoId);
	const link = links.find((l) => l.sessionId === sessionId);
	if (link) {
		await deleteSessionLink(link.id);
	}
}

/**
 * Delete a session link by session ID and return the commit SHA (if any).
 *
 * Useful when you need to update derived artifacts (e.g. Story Anchor notes)
 * after unlinking.
 */
export async function deleteSessionLinkBySessionIdWithCommit(
	repoId: number,
	sessionId: string,
): Promise<string | null> {
	const links = await getSessionLinksForRepo(repoId);
	const link = links.find((l) => l.sessionId === sessionId);
	if (!link) return null;
	await deleteSessionLink(link.id);
	return link.commitSha;
}

/**
 * Session link record from database.
 */
export type SessionLink = {
	id: number;
	repoId: number;
	sessionId: string;
	commitSha: string;
	confidence: number;
	autoLinked: boolean;
	needsReview?: boolean;
	createdAt: string;
};
