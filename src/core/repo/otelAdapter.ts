import { getCommitAddedRanges } from "../tauri/gitDiff";
import type { TraceContributorType, TraceFile, TraceRecord } from "../types";
import { getCommitDetails, getHeadSha } from "./git";

const COMMIT_KEYS = [
	"commit_sha",
	"commitSha",
	"git.commit",
	"git.commit.id",
	"git.commit.sha",
	"git.commit_hash",
	"git.revision",
	"git.rev",
	"git.sha",
	"revision",
	"vcs.commit",
	"vcs.commit.id",
	"vcs.commit.sha",
	"vcs.revision",
];
const MODEL_KEYS = ["model", "model_id", "codex.model", "openai.model"];
const CONVERSATION_KEYS = [
	"conversation_id",
	"codex.conversation_id",
	"conversation.id",
];
const FILE_KEYS = ["file", "file_path", "path", "files", "file_paths"];

export type OTelLogRecord = {
	timeUnixNano?: string;
	attributes?: Array<{ key: string; value: OTelValue }>;
	body?: OTelValue;
};

type OTelValue =
	| { stringValue?: string }
	| { intValue?: string }
	| { boolValue?: boolean }
	| { doubleValue?: number }
	| { arrayValue?: { values?: OTelValue[] } };

type OTelResourceLogs = {
	resource?: { attributes?: Array<{ key: string; value: OTelValue }> };
	scopeLogs?: Array<{ logRecords?: OTelLogRecord[] }>;
};

type OTelLogEnvelope = {
	resourceLogs?: OTelResourceLogs[];
};

export type CodexOtelEvent = {
	timestampISO: string;
	attributes: Record<string, string[]>;
};

export type OtelConversionError = {
	commitSha?: string;
	message: string;
};

function toIso(timeUnixNano?: string): string {
	if (!timeUnixNano) return new Date().toISOString();
	const asNumber = Number(timeUnixNano);
	if (!Number.isFinite(asNumber) || asNumber <= 0)
		return new Date().toISOString();
	return new Date(asNumber / 1_000_000).toISOString();
}

function extractValue(value?: OTelValue): string[] {
	if (!value) return [];
	if ("stringValue" in value && value.stringValue !== undefined)
		return [value.stringValue];
	if ("intValue" in value && value.intValue !== undefined)
		return [String(value.intValue)];
	if ("boolValue" in value && value.boolValue !== undefined)
		return [String(value.boolValue)];
	if ("doubleValue" in value && value.doubleValue !== undefined)
		return [String(value.doubleValue)];
	if ("arrayValue" in value && value.arrayValue?.values) {
		return value.arrayValue.values.flatMap((v) => extractValue(v));
	}
	return [];
}

function attributesToMap(
	attrs: Array<{ key: string; value: OTelValue }> | undefined,
): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	if (!attrs) return out;

	for (const attr of attrs) {
		const values = extractValue(attr.value);
		if (!values.length) continue;
		out[attr.key] = values;
	}

	return out;
}

function mergeAttributes(
	base: Record<string, string[]>,
	overlay: Record<string, string[]>,
): Record<string, string[]> {
	const out = { ...base };
	for (const [key, values] of Object.entries(overlay)) {
		out[key] = [...(out[key] ?? []), ...values];
	}
	return out;
}

function pickFirst(
	attributes: Record<string, string[]>,
	keys: string[],
): string | null {
	for (const key of keys) {
		const values = attributes[key];
		if (values?.length) return values[0] ?? null;
	}
	return null;
}

function pickAll(
	attributes: Record<string, string[]>,
	keys: string[],
): string[] {
	const out: string[] = [];
	for (const key of keys) {
		const values = attributes[key];
		if (values?.length) out.push(...values);
	}
	return out;
}

function parseEnvelope(raw: string): OTelLogEnvelope | null {
	try {
		return JSON.parse(raw) as OTelLogEnvelope;
	} catch {
		return null;
	}
}

export function otelEnvelopeToCodexEvents(raw: string): CodexOtelEvent[] {
	const envelope = parseEnvelope(raw);
	if (!envelope?.resourceLogs) return [];

	const events: CodexOtelEvent[] = [];

	for (const resourceLog of envelope.resourceLogs) {
		const resourceAttrs = attributesToMap(resourceLog.resource?.attributes);
		for (const scopeLog of resourceLog.scopeLogs ?? []) {
			for (const record of scopeLog.logRecords ?? []) {
				const recordAttrs = attributesToMap(record.attributes);
				const merged = mergeAttributes(resourceAttrs, recordAttrs);
				events.push({
					timestampISO: toIso(record.timeUnixNano),
					attributes: merged,
				});
			}
		}
	}

	return events;
}

function toContributorType(modelId: string | null): TraceContributorType {
	if (modelId) return "ai";
	return "unknown";
}

function buildFallbackTraceFiles(
	fileHints: string[],
	modelId: string | null,
): TraceFile[] {
	const fallbackPath = fileHints.find(Boolean) ?? "unknown";
	return [
		{
			path: fallbackPath,
			conversations: [
				{
					url: undefined,
					contributor: {
						type: toContributorType(modelId),
						modelId: modelId ?? undefined,
					},
					ranges: [
						{
							startLine: 1,
							endLine: 1,
							contributor: {
								type: toContributorType(modelId),
								modelId: modelId ?? undefined,
							},
						},
					],
				},
			],
		},
	];
}

async function buildTraceFilesFromCommit(
	repoRoot: string,
	commitSha: string,
	fileHints: string[],
	modelId: string | null,
): Promise<TraceFile[]> {
	const details = await getCommitDetails(repoRoot, commitSha);
	const fileList = details.fileChanges.map((f) => f.path);
	const normalizedHints = fileHints.map((f) => f.trim()).filter(Boolean);
	const filesToUse = normalizedHints.length
		? fileList.filter((path) => normalizedHints.includes(path))
		: fileList;

	const traceFiles: TraceFile[] = [];

	for (const path of filesToUse) {
		const ranges = await getCommitAddedRanges(repoRoot, commitSha, path);
		if (ranges.length === 0) continue;

		traceFiles.push({
			path,
			conversations: [
				{
					url: undefined,
					contributor: {
						type: toContributorType(modelId),
						modelId: modelId ?? undefined,
					},
					ranges: ranges.map((range) => ({
						startLine: range.start,
						endLine: range.end,
						contributor: {
							type: toContributorType(modelId),
							modelId: modelId ?? undefined,
						},
					})),
				},
			],
		});
	}

	return traceFiles;
}

export async function codexOtelEventsToTraceRecords(options: {
	repoRoot: string;
	events: CodexOtelEvent[];
}): Promise<{ records: TraceRecord[]; errors: OtelConversionError[] }> {
	const { repoRoot, events } = options;

	let fallbackCommit: string | null = null;
	try {
		fallbackCommit = await getHeadSha(repoRoot);
	} catch {
		fallbackCommit = null;
	}

	const grouped: Record<string, CodexOtelEvent[]> = {};
	const errors: OtelConversionError[] = [];
	let missingCommitCount = 0;

	for (const event of events) {
		const commitSha = pickFirst(event.attributes, COMMIT_KEYS);
		if (!commitSha) {
			missingCommitCount += 1;
			if (fallbackCommit) {
				grouped[fallbackCommit] = grouped[fallbackCommit]
					? [...grouped[fallbackCommit], event]
					: [event];
			}
			continue;
		}
		grouped[commitSha] = grouped[commitSha]
			? [...grouped[commitSha], event]
			: [event];
	}

	const records: TraceRecord[] = [];

	for (const [commitSha, commitEvents] of Object.entries(grouped)) {
		const modelId = pickFirst(commitEvents[0]?.attributes ?? {}, MODEL_KEYS);
		const conversationId = pickFirst(
			commitEvents[0]?.attributes ?? {},
			CONVERSATION_KEYS,
		);
		const fileHints = pickAll(commitEvents[0]?.attributes ?? {}, FILE_KEYS);

		let traceFiles: TraceFile[] = [];
		try {
			traceFiles = await buildTraceFilesFromCommit(
				repoRoot,
				commitSha,
				fileHints,
				modelId,
			);
		} catch {
			errors.push({
				commitSha,
				message: "Failed to build trace ranges from git diff",
			});
		}

		if (traceFiles.length === 0) {
			errors.push({
				commitSha,
				message: "No diff ranges found for commit; using fallback",
			});
			traceFiles = buildFallbackTraceFiles(fileHints, modelId);
		}

		records.push({
			id: `codex-otel-${commitSha}-${commitEvents[0].timestampISO}`,
			version: "0.1.0",
			timestamp: commitEvents[0].timestampISO,
			vcs: { type: "git", revision: commitSha },
			tool: {
				name: "codex",
				version:
					pickFirst(commitEvents[0].attributes, [
						"app.version",
						"codex.version",
					]) ?? undefined,
			},
			files: traceFiles,
			metadata: {
				"dev.narrative": {
					derived: true,
					source: "codex-otel",
					conversationId,
				},
			},
		});
	}

	if (missingCommitCount > 0) {
		errors.push({
			message: fallbackCommit
				? `${missingCommitCount} event(s) missing commit SHA; attributed to repo HEAD ${fallbackCommit}`
				: `${missingCommitCount} event(s) missing commit SHA in Codex OTel attributes`,
		});
	}

	return { records, errors };
}
