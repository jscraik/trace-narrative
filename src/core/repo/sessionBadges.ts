import type { BranchViewModel, SessionBadgeTool } from "../types";
import { getSessionLinksForCommit } from "./sessionLinking";
import { loadSessionExcerpts } from "./sessions";

/**
 * Tool display names for badges
 */
const TOOL_DISPLAY_NAMES: Record<SessionBadgeTool, string> = {
	"claude-code": "Claude",
	codex: "Codex",
	cursor: "Cursor",
	gemini: "Gemini",
	copilot: "Copilot",
	continue: "Continue",
	kimi: "Kimi",
	unknown: "AI",
};

/**
 * Build a human-readable session badge label from tool counts
 */
function buildSessionBadgeLabel(
	toolCounts: Map<SessionBadgeTool, number>,
): string {
	const entries = Array.from(toolCounts.entries());
	if (entries.length === 0) return "";

	// Single tool: "1 Claude" or "3 Claude"
	if (entries.length === 1) {
		const [tool, count] = entries[0];
		const name = TOOL_DISPLAY_NAMES[tool] ?? "AI";
		return `${count} ${name}`;
	}

	// Multiple tools: "1 Claude + 2 Cursor"
	return entries
		.map(([tool, count]) => {
			const name = TOOL_DISPLAY_NAMES[tool] ?? "AI";
			return `${count} ${name}`;
		})
		.join(" + ");
}

/**
 * Normalize tool string to SessionBadgeTool
 */
function normalizeTool(tool?: string): SessionBadgeTool {
	if (!tool) return "unknown";
	const normalized = tool.replace(/_/g, "-").toLowerCase();

	const allowed: SessionBadgeTool[] = [
		"claude-code",
		"codex",
		"cursor",
		"gemini",
		"copilot",
		"continue",
		"kimi",
		"unknown",
	];

	return allowed.find((t) => t === normalized) ?? "unknown";
}

export async function refreshSessionBadges(
	repoRoot: string,
	repoId: number,
	timeline: Array<{ id: string }>,
	setRepoState: (updater: (prev: BranchViewModel) => BranchViewModel) => void,
	options?: { unlinkMode?: boolean; limit?: number },
) {
	const limit = options?.limit ?? 10;
	const unlinkMode = options?.unlinkMode ?? false;

	const sessionExcerpts = await loadSessionExcerpts(repoRoot, repoId, limit);

	// Create a lookup map for session tools
	const sessionToolMap = new Map<string, SessionBadgeTool>();
	for (const excerpt of sessionExcerpts) {
		sessionToolMap.set(excerpt.id, normalizeTool(excerpt.tool));
	}

	const commitShas = timeline.map((n) => n.id);
	const linksByCommit: Record<
		string,
		import("./sessionLinking").SessionLink[]
	> = {};
	for (const sha of commitShas) {
		const links = await getSessionLinksForCommit(repoId, sha);
		if (links.length > 0) {
			linksByCommit[sha] = links;
		}
	}

	setRepoState((prev) => {
		if (prev.meta?.repoId !== undefined && prev.meta.repoId !== repoId) {
			return prev;
		}

		let timelineChanged = false;
		const existingBadges = prev.timeline.map((node) => {
			const links = linksByCommit[node.id];
			if (!links || links.length === 0) {
				if (unlinkMode) {
					const filteredBadges =
						node.badges?.filter((b) => b.type !== "session") ?? [];
					// Only create new object if badges actually changed
					const hadSessionBadge =
						node.badges?.some((b) => b.type === "session") ?? false;
					if (hadSessionBadge) {
						timelineChanged = true;
						return { ...node, badges: filteredBadges };
					}
				}
				return node;
			}

			// Count tools for this commit
			const toolCounts = new Map<SessionBadgeTool, number>();
			const sessionTools: SessionBadgeTool[] = [];

			for (const link of links) {
				const tool = sessionToolMap.get(link.sessionId) ?? "unknown";
				sessionTools.push(tool);
				toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
			}

			const existing = node.badges?.filter((b) => b.type !== "session") ?? [];
			const newSessionBadge = {
				type: "session" as const,
				label: buildSessionBadgeLabel(toolCounts),
				sessionTools: [...new Set(sessionTools)], // Unique tools only
			};

			// Check if session badge actually changed
			const currentSessionBadge = node.badges?.find(
				(b) => b.type === "session",
			);
			const badgeChanged =
				!currentSessionBadge ||
				currentSessionBadge.label !== newSessionBadge.label ||
				JSON.stringify(currentSessionBadge.sessionTools) !==
					JSON.stringify(newSessionBadge.sessionTools);

			if (badgeChanged) {
				timelineChanged = true;
				return {
					...node,
					badges: [...existing, newSessionBadge],
				};
			}
			return node;
		});

		// Only return new state if something actually changed
		if (!timelineChanged) {
			return prev;
		}

		return {
			...prev,
			sessionExcerpts,
			timeline: existingBadges,
		};
	});
}
