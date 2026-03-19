import type { SessionExcerpt } from "../../../core/types";

export function truncateText(text: string, limit = 160) {
	const trimmed = text.trim().replace(/\s+/g, " ");
	if (trimmed.length <= limit) return trimmed;
	return `${trimmed.slice(0, limit).trim()}…`;
}

export function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function collectFiles(messages: SessionExcerpt["messages"]) {
	const files = messages.flatMap((message) => message.files ?? []);
	return Array.from(new Set(files));
}

export function isRepoRelativePath(path: string): boolean {
	if (path.startsWith("/")) return false;
	if (/^[A-Za-z]:[\\/]/.test(path)) return false;
	if (path.includes("..")) return false;
	return true;
}

export function selectHighlights(messages: SessionExcerpt["messages"]) {
	const assistantMessages = messages.filter((message) =>
		["assistant", "thinking", "plan"].includes(message.role),
	);
	const source = assistantMessages.length > 0 ? assistantMessages : messages;

	return source
		.filter((message) => message.text.trim().length > 0)
		.slice(0, 3)
		.map((message) => ({ id: message.id, text: truncateText(message.text) }));
}
