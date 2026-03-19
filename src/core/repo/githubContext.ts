import { redactSecrets } from "../security/redact";
import { listNarrativeFiles, readNarrativeFile } from "../tauri/narrativeFs";
import type { GitHubContextEntry, GitHubContextState } from "../types";

const MAX_TEXT_LENGTH = 2000;

function clampText(text: string | undefined): string | undefined {
	if (!text) return undefined;
	const trimmed = text.trim();
	if (!trimmed) return undefined;
	return trimmed.length > MAX_TEXT_LENGTH
		? `${trimmed.slice(0, MAX_TEXT_LENGTH)}…`
		: trimmed;
}

function sanitizeUntrustedText(text: string | undefined): {
	value?: string;
	redactionHits: number;
} {
	const value = clampText(text);
	if (!value) return { redactionHits: 0 };

	const withoutControls = [...value]
		.map((char) => {
			const code = char.charCodeAt(0);
			return code < 32 || code === 127 ? " " : char;
		})
		.join("");

	const escaped = withoutControls
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	const redacted = redactSecrets(escaped);
	const redactionHits = redacted.hits.reduce(
		(total, hit) => total + hit.count,
		0,
	);
	return { value: redacted.redacted, redactionHits };
}

function toEntry(path: string, raw: unknown): GitHubContextEntry | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const pr = (record.pull_request ?? record.pr) as
		| Record<string, unknown>
		| undefined;

	const titleRaw =
		(typeof pr?.title === "string" && pr.title) ||
		(typeof record.title === "string" && record.title) ||
		"GitHub context";
	const bodyRaw =
		(typeof pr?.body === "string" && pr.body) ||
		(typeof record.body === "string" && record.body) ||
		undefined;
	const reviewSummaryRaw =
		(typeof record.review_summary === "string" && record.review_summary) ||
		(typeof record.reviewSummary === "string" && record.reviewSummary) ||
		undefined;
	const url =
		(typeof pr?.html_url === "string" && pr.html_url) ||
		(typeof record.url === "string" && record.url) ||
		undefined;
	const number =
		(typeof pr?.number === "number" && pr.number) ||
		(typeof record.number === "number" && record.number) ||
		undefined;
	const updatedAtISO =
		(typeof record.updated_at === "string" && record.updated_at) ||
		(typeof record.updatedAtISO === "string" && record.updatedAtISO) ||
		undefined;

	const title = sanitizeUntrustedText(titleRaw);
	const body = sanitizeUntrustedText(bodyRaw);
	const reviewSummary = sanitizeUntrustedText(reviewSummaryRaw);

	if (!title.value) return null;

	return {
		id: path,
		title: title.value,
		body: body.value,
		reviewSummary: reviewSummary.value,
		url,
		number,
		updatedAtISO,
		redactionHits:
			title.redactionHits + body.redactionHits + reviewSummary.redactionHits,
	};
}

export async function loadGitHubContext(
	repoRoot: string,
): Promise<GitHubContextState> {
	try {
		const files = await listNarrativeFiles(repoRoot, "connectors/github");
		const jsonFiles = files
			.filter((file) => file.toLowerCase().endsWith(".json"))
			.sort((a, b) => b.localeCompare(a));
		if (jsonFiles.length === 0) {
			return { status: "empty", entries: [] };
		}

		const entries: GitHubContextEntry[] = [];
		let failedFileCount = 0;
		let firstFailureMessage: string | undefined;
		for (const file of jsonFiles.slice(0, 5)) {
			try {
				const contents = await readNarrativeFile(repoRoot, file);
				const parsed = JSON.parse(contents) as unknown;
				const entry = toEntry(file, parsed);
				if (entry) entries.push(entry);
			} catch (error: unknown) {
				failedFileCount += 1;
				if (!firstFailureMessage) {
					firstFailureMessage =
						error instanceof Error ? error.message : String(error);
				}
			}
		}

		if (entries.length === 0 && failedFileCount > 0) {
			return {
				status: "error",
				entries: [],
				failedFileCount,
				error:
					`Failed to load GitHub connector files (${failedFileCount} errors). ${firstFailureMessage ?? ""}`.trim(),
			};
		}

		if (entries.length === 0) {
			return { status: "empty", entries: [], failedFileCount: 0 };
		}

		const status: GitHubContextState["status"] =
			failedFileCount > 0 ? "partial" : "ready";
		const error =
			failedFileCount > 0
				? `Loaded ${entries.length} entry${entries.length === 1 ? "" : "ies"} with ${failedFileCount} connector file errors. ${firstFailureMessage ?? ""}`.trim()
				: undefined;

		return {
			status,
			entries,
			failedFileCount,
			error,
			lastLoadedAtISO: new Date().toISOString(),
		};
	} catch (error: unknown) {
		console.debug("[githubContext] context load failed:", error);
		return {
			status: "error",
			entries: [],
			failedFileCount: 0,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
