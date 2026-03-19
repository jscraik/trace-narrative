import type { ToolSanitizerHit } from "../core/security/toolSanitizer";
import { sanitizeToolText } from "../core/security/toolSanitizer";

/**
 * Merge sanitizer hits from incoming into target array.
 * Combines counts for entries with the same type.
 */
export function mergeSanitizerHits(
	target: ToolSanitizerHit[],
	incoming: ToolSanitizerHit[],
): void {
	for (const hit of incoming) {
		const existing = target.find((item) => item.type === hit.type);
		if (existing) {
			existing.count += hit.count;
		} else {
			target.push({ ...hit });
		}
	}
}

/**
 * Type guard for session message records.
 */
function isSessionMessageRecord(
	value: unknown,
): value is { role: "user" | "assistant"; text: string; files?: string[] } {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	const role = record.role;
	if (role !== "user" && role !== "assistant") return false;
	if (typeof record.text !== "string") return false;
	if (record.files && !Array.isArray(record.files)) return false;
	return true;
}

/**
 * Sanitize tool-related text in session message payloads.
 * Returns the sanitized payload along with any sanitizer hits found.
 */
export function sanitizePayloadMessages(payload: unknown): {
	payload: unknown;
	hits: ToolSanitizerHit[];
} {
	if (!payload || typeof payload !== "object") return { payload, hits: [] };
	const record = payload as Record<string, unknown>;
	if (!Array.isArray(record.messages)) return { payload, hits: [] };

	const sanitizedMessages: Array<{
		role: "user" | "assistant";
		text: string;
		files?: string[];
	}> = [];
	const hits: ToolSanitizerHit[] = [];

	for (const entry of record.messages) {
		if (!isSessionMessageRecord(entry)) continue;
		const sanitized = sanitizeToolText(entry.text);
		mergeSanitizerHits(hits, sanitized.hits);
		sanitizedMessages.push({ ...entry, text: sanitized.sanitized });
	}

	if (sanitizedMessages.length === 0) return { payload, hits };

	return {
		payload: { ...record, messages: sanitizedMessages },
		hits,
	};
}

// Re-export isSessionMessageRecord for use in other modules
export { isSessionMessageRecord };
