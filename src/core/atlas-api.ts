/**
 * Atlas API (v0.1)
 *
 * Thin Tauri invoke wrapper with a structured envelope contract.
 * No new deps; no runtime schema validation beyond envelope shape checks.
 */

import { invoke } from "@tauri-apps/api/core";

export const KNOWN_ATLAS_ERROR_CODES = [
	// Budget / validation
	"BUDGET_QUERY_TOO_LONG",
	"BUDGET_TOO_MANY_TERMS",
	"BUDGET_LIMIT_TOO_HIGH",
	"BUDGET_SESSION_ID_TOO_LONG",
	"BUDGET_MAX_CHUNKS_TOO_HIGH",

	// Domain errors
	"REPO_NOT_FOUND",
	"SESSION_NOT_FOUND",
	"FTS_NOT_AVAILABLE",
	"INVALID_QUERY",

	// Catch-all
	"INTERNAL",

	// Client-side parsing
	"INVALID_RESPONSE",
] as const;

export type AtlasErrorCode =
	| (typeof KNOWN_ATLAS_ERROR_CODES)[number]
	| (string & {});

export type AtlasError = {
	code: AtlasErrorCode;
	message: string;
};

export type AtlasEnvelopeMeta = {
	truncated?: boolean;
};

export type AtlasEnvelopeOk<T> = {
	ok: true;
	value: T;
	meta?: AtlasEnvelopeMeta;
};

export type AtlasEnvelopeErr = {
	ok: false;
	error: AtlasError;
};

export type AtlasEnvelope<T> = AtlasEnvelopeOk<T> | AtlasEnvelopeErr;

export type AtlasBudgets = {
	queryMaxChars: number;
	queryMaxTerms: number;
	limitMax: number;
	snippetMaxChars: number;
	chunkTextMaxChars: number;
	getSessionMaxChunks: number;
	responseMaxChars: number;
};

export type AtlasCapabilities = {
	derivedVersion: string;
	fts5Enabled: boolean;
	ftsTableReady: boolean;
	budgets: AtlasBudgets;
};

export type AtlasIndexState = {
	repoId: number;
	derivedVersion: string;
	lastRebuildAt: string | null;
	lastUpdatedAt: string | null;
	lastError: string | null;
	sessionsIndexed: number;
	chunksIndexed: number;
};

export type AtlasIntrospect = {
	state: AtlasIndexState;
	chunksInTable: number;
	sessionsWithChunks: number;
};

export type AtlasSearchRequest = {
	repoId: number;
	query: string;
	limit?: number;
};

export type AtlasSearchResult = {
	chunkUid: string;
	sessionId: string;
	chunkIndex: number;
	score: number;
	snippet: string;
	sessionImportedAt: string | null;
	sessionTool: string | null;
	sessionModel: string | null;
};

// Back-compat alias for local callers (shape matches Rust fields above)
export type AtlasSearchHit = AtlasSearchResult;

export type AtlasSearchResponse = {
	results: AtlasSearchResult[];
};

export type AtlasGetSessionRequest = {
	repoId: number;
	sessionId: string;
	maxChunks?: number;
};

export type AtlasSessionMeta = {
	id: string;
	tool: string;
	model: string | null;
	importedAt: string | null;
	durationMin: number | null;
	messageCount: number | null;
	purgedAt: string | null;
};

export type AtlasSessionChunk = {
	chunkUid: string;
	chunkIndex: number;
	roleMask: string;
	text: string;
};

export type AtlasGetSessionResponse = {
	session: AtlasSessionMeta;
	chunks: AtlasSessionChunk[];
};

export type AtlasDoctorReport = {
	repoId: number;
	derivedVersion: string;
	ftsTableReady: boolean;
	indexableSessions: number;
	sessionsWithChunks: number;
	chunksIndexed: number;
	missingSessions: number;
	lastRebuildAt: string | null;
	lastUpdatedAt: string | null;
	lastError: string | null;
	status: string;
};

export type AtlasDoctorRebuildSummary = {
	repoId: number;
	sessionsProcessed: number;
	chunksWritten: number;
	truncatedSessions: number;
	deletedChunks: number;
	ftsRebuilt: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function coerceAtlasError(raw: unknown): AtlasError {
	if (!isRecord(raw)) {
		return { code: "INVALID_RESPONSE", message: "Invalid Atlas error shape" };
	}
	const code =
		typeof raw.code === "string"
			? (raw.code as AtlasErrorCode)
			: "INVALID_RESPONSE";
	const message =
		typeof raw.message === "string" ? raw.message : "Unknown Atlas error";
	return { code, message };
}

function parseAtlasEnvelope<T>(raw: unknown): AtlasEnvelope<T> {
	if (!isRecord(raw)) {
		return {
			ok: false,
			error: {
				code: "INVALID_RESPONSE",
				message: "Atlas response was not an object",
			},
		};
	}

	if (raw.ok === true) {
		const meta = isRecord(raw.meta)
			? (raw.meta as AtlasEnvelopeMeta)
			: undefined;
		return { ok: true, value: raw.value as T, meta };
	}

	if (raw.ok === false) {
		return { ok: false, error: coerceAtlasError(raw.error) };
	}

	return {
		ok: false,
		error: {
			code: "INVALID_RESPONSE",
			message: "Atlas response missing ok discriminator",
		},
	};
}

async function invokeAtlas<T>(
	command: string,
	args: Record<string, unknown>,
): Promise<AtlasEnvelope<T>> {
	const raw = await invoke<unknown>(command, args);
	return parseAtlasEnvelope<T>(raw);
}

// Commands -------------------------------------------------------------------

export async function atlasCapabilities(): Promise<
	AtlasEnvelope<AtlasCapabilities>
> {
	return invokeAtlas<AtlasCapabilities>("atlas_capabilities", {});
}

export async function atlasIntrospect(
	repoId: number,
): Promise<AtlasEnvelope<AtlasIntrospect>> {
	return invokeAtlas<AtlasIntrospect>("atlas_introspect", { repoId });
}

export async function atlasSearch(
	request: AtlasSearchRequest,
): Promise<AtlasEnvelope<AtlasSearchResponse>> {
	return invokeAtlas<AtlasSearchResponse>("atlas_search", { request });
}

export async function atlasGetSession(
	request: AtlasGetSessionRequest,
): Promise<AtlasEnvelope<AtlasGetSessionResponse>> {
	return invokeAtlas<AtlasGetSessionResponse>("atlas_get_session", { request });
}

export async function atlasDoctorReport(
	repoId: number,
): Promise<AtlasEnvelope<AtlasDoctorReport>> {
	return invokeAtlas<AtlasDoctorReport>("atlas_doctor_report", { repoId });
}

export async function atlasDoctorRebuildDerived(
	repoId: number,
): Promise<AtlasEnvelope<AtlasDoctorRebuildSummary>> {
	return invokeAtlas<AtlasDoctorRebuildSummary>(
		"atlas_doctor_rebuild_derived",
		{ request: { repoId } },
	);
}
