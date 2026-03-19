import type { TraceContributorType, TraceRecord } from "../types";

const CONTRIBUTOR_TYPES: TraceContributorType[] = [
	"human",
	"ai",
	"mixed",
	"unknown",
];

export function isContributorType(
	value: string,
): value is TraceContributorType {
	return CONTRIBUTOR_TYPES.includes(value as TraceContributorType);
}

export function normalizeContributorType(
	value: string | undefined,
): TraceContributorType {
	if (!value) return "unknown";
	if (isContributorType(value)) return value;
	return "unknown";
}

function safeString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export function parseTraceRecord(raw: string): TraceRecord | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== "object") return null;
	const rawRecord = parsed as {
		id?: string;
		version?: string;
		timestamp?: string;
		vcs?: { type?: string; revision?: string };
		tool?: { name?: string; version?: string };
		files?: Array<{
			path?: string;
			conversations?: Array<{
				url?: string;
				contributor?: { type?: string; model_id?: string; modelId?: string };
				ranges?: Array<{
					start_line?: number;
					end_line?: number;
					content_hash?: string;
					contributor?: { type?: string; model_id?: string; modelId?: string };
				}>;
				related?: Array<{ type?: string; url?: string }>;
			}>;
		}>;
		metadata?: Record<string, unknown>;
	};

	if (
		!rawRecord.id ||
		!rawRecord.version ||
		!rawRecord.timestamp ||
		!rawRecord.files
	)
		return null;
	if (!rawRecord.vcs || rawRecord.vcs.type !== "git" || !rawRecord.vcs.revision)
		return null;
	if (!Array.isArray(rawRecord.files)) return null;

	const files = rawRecord.files
		.filter((file) => Boolean(file.path))
		.map((file) => ({
			path: file.path ?? "",
			conversations: (file.conversations ?? []).map((conversation) => ({
				url: conversation.url,
				contributor: conversation.contributor
					? {
							type: normalizeContributorType(conversation.contributor.type),
							modelId: safeString(
								conversation.contributor.modelId ??
									conversation.contributor.model_id,
							),
						}
					: undefined,
				ranges: (conversation.ranges ?? []).map((range) => ({
					startLine: range.start_line ?? 0,
					endLine: range.end_line ?? 0,
					contentHash: safeString(range.content_hash),
					contributor: range.contributor
						? {
								type: normalizeContributorType(range.contributor.type),
								modelId: safeString(
									range.contributor.modelId ?? range.contributor.model_id,
								),
							}
						: undefined,
				})),
				related: (conversation.related ?? [])
					.filter(
						(r): r is { type: string; url: string } =>
							typeof r.type === "string" && typeof r.url === "string",
					)
					.map((r) => ({ type: r.type, url: r.url })),
			})),
		}));

	return {
		id: rawRecord.id,
		version: rawRecord.version,
		timestamp: rawRecord.timestamp,
		vcs: { type: "git", revision: rawRecord.vcs.revision },
		tool: rawRecord.tool
			? {
					name: safeString(rawRecord.tool.name),
					version: safeString(rawRecord.tool.version),
				}
			: undefined,
		files,
		metadata: rawRecord.metadata,
	};
}
