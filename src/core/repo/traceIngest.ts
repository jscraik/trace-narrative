import { redactSecrets } from "../security/redact";
import { readTextFile, writeNarrativeFile } from "../tauri/narrativeFs";
import type { TraceCollectorStatus, TraceRecord } from "../types";
import { getDb } from "./db";
import {
	codexOtelEventsToTraceRecords,
	otelEnvelopeToCodexEvents,
} from "./otelAdapter";
import { normalizeContributorType } from "./traceParser";
import type { CodexOtelIngestResult } from "./traceTypes";

const TRACE_EXTENSION = ".agent-trace.json";
const TRACE_DIR = "trace";

function safeString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function toCollectorError(message: string): TraceCollectorStatus {
	return { state: "error", message };
}

function toCollectorInactive(message?: string): TraceCollectorStatus {
	return { state: "inactive", message };
}

function toCollectorPartial(
	message?: string,
	issues?: string[],
): TraceCollectorStatus {
	return { state: "partial", message, issues };
}

function toCollectorActive(message?: string): TraceCollectorStatus {
	return { state: "active", message, lastSeenAtISO: new Date().toISOString() };
}

function mergeMetadata(
	base: TraceRecord["metadata"] | undefined,
	patch: Record<string, unknown>,
): TraceRecord["metadata"] {
	return { ...(base ?? {}), ...patch };
}

function toMetadataSection(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object") return {};
	return value as Record<string, unknown>;
}

function isCommitFallbackNotice(message: string): boolean {
	return message.includes("commit range");
}

export async function recordExists(
	repoId: number,
	recordId: string,
): Promise<boolean> {
	const db = await getDb();
	const rows = await db.select<Array<{ id: string }>>(
		"SELECT id FROM trace_records WHERE repo_id = $1 AND id = $2",
		[repoId, recordId],
	);
	return Boolean(rows?.[0]?.id);
}

export async function ingestTraceRecord(
	repoId: number,
	record: TraceRecord,
): Promise<void> {
	if (await recordExists(repoId, record.id)) return;
	const db = await getDb();

	await db.execute(
		`INSERT OR IGNORE INTO trace_records
      (id, repo_id, version, timestamp, vcs_type, revision, tool_name, tool_version, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		[
			record.id,
			repoId,
			record.version,
			record.timestamp,
			record.vcs.type,
			record.vcs.revision,
			record.tool?.name ?? null,
			record.tool?.version ?? null,
			record.metadata ? JSON.stringify(record.metadata) : null,
		],
	);

	for (const file of record.files) {
		await db.execute(
			"INSERT INTO trace_files (record_id, path) VALUES ($1, $2)",
			[record.id, file.path],
		);

		const fileRow = await db.select<Array<{ id: number }>>(
			"SELECT id FROM trace_files WHERE record_id = $1 AND path = $2 ORDER BY id DESC LIMIT 1",
			[record.id, file.path],
		);
		const fileId = fileRow?.[0]?.id;
		if (!fileId) continue;

		for (const conversation of file.conversations ?? []) {
			const convContributorType = normalizeContributorType(
				conversation.contributor?.type,
			);
			const convModelId = safeString(conversation.contributor?.modelId);

			await db.execute(
				"INSERT INTO trace_conversations (file_id, url, contributor_type, model_id) VALUES ($1, $2, $3, $4)",
				[
					fileId,
					conversation.url ?? null,
					convContributorType,
					convModelId ?? null,
				],
			);

			const convRow = await db.select<Array<{ id: number }>>(
				"SELECT id FROM trace_conversations WHERE file_id = $1 ORDER BY id DESC LIMIT 1",
				[fileId],
			);
			const conversationId = convRow?.[0]?.id;
			if (!conversationId) continue;

			for (const range of conversation.ranges ?? []) {
				const rangeContributorType = normalizeContributorType(
					range.contributor?.type ?? convContributorType,
				);
				const rangeModelId = safeString(
					range.contributor?.modelId ?? convModelId,
				);

				await db.execute(
					`INSERT INTO trace_ranges
            (conversation_id, start_line, end_line, content_hash, contributor_type, model_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
					[
						conversationId,
						range.startLine,
						range.endLine,
						range.contentHash ?? null,
						rangeContributorType,
						rangeModelId ?? null,
					],
				);
			}
		}
	}
}

export async function ingestCodexOtelLogFile(options: {
	repoRoot: string;
	repoId: number;
	logPath?: string;
}): Promise<CodexOtelIngestResult> {
	const { repoRoot, repoId, logPath } = options;
	const path = logPath ?? "/tmp/codex-otel.json";

	try {
		const raw = await readTextFile(path);
		const redaction = redactSecrets(raw);
		const events = otelEnvelopeToCodexEvents(redaction.redacted);

		if (events.length === 0) {
			return {
				status: toCollectorInactive("No Codex OTel events detected"),
				recordsWritten: 0,
				redactions: redaction.hits,
			};
		}

		const conversion = await codexOtelEventsToTraceRecords({
			repoRoot,
			events,
		});
		if (conversion.records.length === 0) {
			const issues = conversion.errors.map((error) => error.message);
			const status = issues.length
				? toCollectorError("Codex OTel events missing commit/file context")
				: toCollectorInactive("Codex OTel events missing commit/file context");
			return {
				status,
				recordsWritten: 0,
				errors: issues,
				redactions: redaction.hits,
			};
		}

		let written = 0;
		const ingestErrors: string[] = [];

		for (const record of conversion.records) {
			const enriched: TraceRecord = {
				...record,
				metadata: mergeMetadata(record.metadata, {
					"dev.narrative": {
						...toMetadataSection(record.metadata?.["dev.narrative"]),
						redactions: redaction.hits,
					},
				}),
			};
			const fileName = `${record.timestamp.replace(/[:.]/g, "-")}_${record.id}${TRACE_EXTENSION}`;
			const rel = `${TRACE_DIR}/${fileName}`;
			await writeNarrativeFile(
				repoRoot,
				rel,
				JSON.stringify(enriched, null, 2),
			);
			await ingestTraceRecord(repoId, enriched);
			written += 1;
		}

		if (conversion.errors.length > 0) {
			const issues = conversion.errors.map((error) =>
				error.commitSha
					? `${error.commitSha}: ${error.message}`
					: error.message,
			);
			ingestErrors.push(...issues);
		}

		const informational = ingestErrors.filter((issue) =>
			isCommitFallbackNotice(issue),
		);
		const actionable = ingestErrors.filter(
			(issue) => !isCommitFallbackNotice(issue),
		);
		const note = informational[0] ?? null;
		const activeMessage = `Codex OTel imported ${written} record${written === 1 ? "" : "s"}${
			note ? `. ${note}` : ""
		}`;

		const status =
			actionable.length > 0
				? toCollectorPartial(
						`Codex OTel import completed with ${actionable.length} issue${actionable.length === 1 ? "" : "s"}${
							note ? `. ${note}` : ""
						}`,
						actionable,
					)
				: toCollectorActive(activeMessage);

		return {
			status,
			recordsWritten: written,
			errors: actionable,
			redactions: redaction.hits,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("path does not exist")) {
			return {
				status: toCollectorInactive("Codex OTel log not found"),
				recordsWritten: 0,
			};
		}
		return { status: toCollectorError(message), recordsWritten: 0 };
	}
}
