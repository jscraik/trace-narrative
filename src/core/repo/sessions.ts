import { invoke } from "@tauri-apps/api/core";
import { listNarrativeFiles, readNarrativeFile } from "../tauri/narrativeFs";
import type {
	SessionExcerpt,
	SessionMessage,
	SessionMessageRole,
} from "../types";

type SessionPayload = {
	id?: string;
	tool?: string;
	agentName?: string;
	durationMin?: number;
	importedAtISO?: string;
	redactionCount?: number;
	needsReview?: boolean;
	messages?: Array<{
		id?: string;
		role: SessionMessageRole;
		text: string;
		files?: string[];
		toolName?: string;
		toolInput?: unknown;
	}>;
	linkedCommitSha?: string;
	linkConfidence?: number;
	autoLinked?: boolean;
};

/**
 * Extract file paths from message text.
 * Matches patterns like:
 * - src/App.tsx
 * - src/core/repo/indexer.ts
 * - ./components/Header.tsx
 * - ../utils/helpers.ts
 */
function extractFilesFromText(text: string): string[] {
	// Pattern matches: path/to/file.ext with common source code extensions
	// Also handles relative paths like ./file.ts or ../file.ts
	const pattern =
		/\b(?:[\w./-]+\/)?[\w-]+\.(tsx?|jsx?|rs|go|py|java|cpp|c|cs|swift|kt|rb|php|sh|sql|md|css|scss|less|json|yaml|yml|toml)\b/g;

	const matches = text.match(pattern) || [];
	// Deduplicate and return
	return Array.from(new Set(matches));
}

function normalizeTool(tool?: string): SessionExcerpt["tool"] {
	if (!tool) return "unknown";
	const normalized = tool.replace(/_/g, "-").toLowerCase();
	const allowed: SessionExcerpt["tool"][] = [
		"claude-code",
		"codex",
		"kimi",
		"cursor",
		"gemini",
		"copilot",
		"continue",
		"unknown",
	];
	return allowed.includes(normalized as SessionExcerpt["tool"])
		? (normalized as SessionExcerpt["tool"])
		: "unknown";
}

function normalizeExcerpt(id: string, raw: SessionPayload): SessionExcerpt {
	const sessionId = raw.id ?? id;
	const tool = normalizeTool(raw.tool);
	const durationMin =
		typeof raw.durationMin === "number" ? raw.durationMin : undefined;
	const importedAtISO =
		typeof raw.importedAtISO === "string" ? raw.importedAtISO : undefined;
	const redactionCount =
		typeof raw.redactionCount === "number" ? raw.redactionCount : undefined;
	const needsReview =
		typeof raw.needsReview === "boolean" ? raw.needsReview : undefined;

	const messages: SessionMessage[] = (raw.messages ?? []).map((m, idx) => {
		// Use explicitly provided files, or extract from text
		const files =
			m.files && m.files.length > 0 ? m.files : extractFilesFromText(m.text);

		return {
			id: m.id ?? `${sessionId}:m${idx}`,
			role: m.role,
			text: m.text,
			files: files.length > 0 ? files : undefined,
			toolName: m.toolName,
			toolInput: m.toolInput,
		};
	});

	return {
		id: sessionId,
		tool,
		agentName: raw.agentName,
		durationMin,
		messages,
		importedAtISO,
		linkedCommitSha: raw.linkedCommitSha,
		linkConfidence: raw.linkConfidence,
		autoLinked: raw.autoLinked,
		needsReview,
		redactionCount,
	};
}

async function loadSessionExcerptsFromDisk(
	repoRoot: string,
	limit: number,
): Promise<SessionExcerpt[]> {
	try {
		const all = await listNarrativeFiles(repoRoot, "sessions");
		const jsonFiles = all.filter((p) => p.toLowerCase().endsWith(".json"));

		// newest first (we write files with ISO prefix)
		jsonFiles.sort((a, b) => b.localeCompare(a));

		const excerpts: SessionExcerpt[] = [];

		for (const rel of jsonFiles.slice(0, limit)) {
			const txt = await readNarrativeFile(repoRoot, rel);
			const parsed = JSON.parse(txt) as unknown;
			const parsedRecord =
				parsed && typeof parsed === "object"
					? (parsed as Record<string, unknown>)
					: null;

			// Accept either a direct SessionPayload or a wrapper with { payload }
			const payloadCandidate = parsedRecord?.payload ?? parsed;
			if (!payloadCandidate || typeof payloadCandidate !== "object") continue;

			const payload = payloadCandidate as SessionPayload;

			if (!Array.isArray(payload.messages)) continue;
			excerpts.push(normalizeExcerpt(rel, payload));
		}

		return excerpts;
	} catch (_err) {
		console.debug("[sessions] loadFromDisk failed (non-fatal) err=", _err);
		return [];
	}
}

async function loadSessionExcerptsFromDb(
	repoId: number,
	limit: number,
): Promise<SessionExcerpt[]> {
	try {
		const sessions = await invoke<SessionPayload[]>("get_recent_sessions", {
			repoId,
			limit,
		});
		return sessions.map((payload, idx) =>
			normalizeExcerpt(payload.id ?? `session-${idx}`, payload),
		);
	} catch (_err) {
		console.debug("[sessions] loadFromDb failed (non-fatal):", _err);
		return [];
	}
}

export async function loadSessionExcerpts(
	repoRoot: string,
	repoId: number | null,
	limit = 1,
): Promise<SessionExcerpt[]> {
	if (repoId) {
		const dbSessions = await loadSessionExcerptsFromDb(repoId, limit);
		if (dbSessions.length > 0) {
			return dbSessions;
		}
	}

	return loadSessionExcerptsFromDisk(repoRoot, limit);
}
