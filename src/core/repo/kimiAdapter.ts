import type { SessionMessage, SessionMessageRole } from "../types";

type KimiParseResult = {
	messages: SessionMessage[];
	modelId?: string;
};

function toRole(value: unknown): SessionMessageRole | null {
	if (typeof value !== "string") return null;
	const normalized = value.toLowerCase();
	if (normalized === "user") return "user";
	if (normalized === "assistant") return "assistant";
	return null;
}

function extractText(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		const parts = value
			.map((item) => {
				if (typeof item === "string") return item;
				if (
					item &&
					typeof item === "object" &&
					"text" in item &&
					typeof item.text === "string"
				) {
					return item.text;
				}
				return null;
			})
			.filter((item): item is string => Boolean(item));
		if (parts.length > 0) return parts.join("");
	}
	if (value && typeof value === "object") {
		const obj = value as { text?: unknown; content?: unknown };
		if (typeof obj.text === "string") return obj.text;
		if (typeof obj.content === "string") return obj.content;
	}
	return null;
}

function extractMessage(record: unknown) {
	if (!record || typeof record !== "object") return null;
	const data = record as Record<string, unknown>;

	const messageRecord =
		data.message && typeof data.message === "object"
			? (data.message as Record<string, unknown>)
			: null;
	const role = toRole(data.role ?? data.type ?? messageRecord?.role);
	if (!role) return null;

	const text =
		extractText(data.content) ??
		extractText(data.text) ??
		extractText(data.message) ??
		extractText(messageRecord?.content);

	if (!text) return null;

	return { role, text };
}

function extractModelId(record: unknown): string | undefined {
	if (!record || typeof record !== "object") return undefined;
	const data = record as Record<string, unknown>;
	if (typeof data.model === "string") return data.model;
	if (typeof data.model_id === "string") return data.model_id;
	if (typeof data.modelId === "string") return data.modelId;
	return undefined;
}

export function parseKimiContextJsonl(raw: string): KimiParseResult {
	const messages: SessionMessage[] = [];
	let modelId: string | undefined;

	const lines = raw.split(/\r?\n/).filter(Boolean);
	lines.forEach((line, index) => {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			return;
		}

		modelId = modelId ?? extractModelId(parsed);
		const message = extractMessage(parsed);
		if (!message) return;

		messages.push({
			id: `kimi:${index}`,
			role: message.role,
			text: message.text,
		});
	});

	return { messages, modelId };
}
