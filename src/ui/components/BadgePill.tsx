import {
	Bot,
	Code2,
	Cpu,
	MessageSquare,
	Sparkles,
	Terminal,
	Wand2,
} from "lucide-react";
import type { SessionBadgeTool, TimelineBadge } from "../../core/types";
import { AiContributionBadge } from "./AiContributionBadge";

export interface BadgePillProps {
	badge: TimelineBadge;
}

/**
 * Get the icon component for a session tool
 */
function getToolIcon(tool: SessionBadgeTool) {
	switch (tool) {
		case "claude-code":
			return <Sparkles className="w-3 h-3" />;
		case "codex":
			return <Terminal className="w-3 h-3" />;
		case "cursor":
			return <Code2 className="w-3 h-3" />;
		case "gemini":
			return <Wand2 className="w-3 h-3" />;
		case "copilot":
			return <Bot className="w-3 h-3" />;
		case "continue":
			return <MessageSquare className="w-3 h-3" />;
		case "kimi":
			return <Cpu className="w-3 h-3" />;
		default:
			return <Bot className="w-3 h-3" />;
	}
}

/**
 * Get CSS classes for tool-specific styling
 */
function getToolClasses(tool: SessionBadgeTool): string {
	const baseClasses =
		"inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium";

	switch (tool) {
		case "claude-code":
			return `${baseClasses} pill-tool-violet`;
		case "codex":
			return `${baseClasses} pill-tool-green`;
		case "cursor":
			return `${baseClasses} pill-tool-blue`;
		case "gemini":
			return `${baseClasses} pill-tool-blue`;
		case "copilot":
			return `${baseClasses} pill-tool-violet`;
		case "continue":
			return `${baseClasses} pill-tool-neutral`;
		case "kimi":
			return `${baseClasses} pill-tool-amber`;
		default:
			return `${baseClasses} pill-tool-neutral`;
	}
}

export function BadgePill({ badge }: BadgePillProps) {
	if (badge.type === "test") {
		if (badge.status === "failed") {
			return (
				<span className="pill-test-failed">
					<span className="text-accent-red">✕</span>
					{badge.label}
				</span>
			);
		}
		if (badge.status === "passed") {
			return (
				<span className="pill-test-passed">
					<span className="text-accent-green">✓</span>
					{badge.label}
				</span>
			);
		}
	}

	if (badge.type === "trace") {
		const title =
			badge.label === "Unknown"
				? "AI attribution unavailable"
				: `AI attribution: ${badge.label}`;
		const className =
			badge.label === "Unknown" ? "pill-trace-unknown" : "pill-trace-ai";
		return (
			<span className={className} title={title}>
				{badge.label}
			</span>
		);
	}

	if (badge.type === "anchor") {
		const meta = badge.anchor;
		const presentCount = meta
			? Number(meta.hasAttributionNote) +
				Number(meta.hasSessionsNote) +
				Number(meta.hasLineageNote)
			: null;
		const title = meta
			? `Story Anchors — Attribution: ${meta.hasAttributionNote ? "✓" : "—"} · Sessions: ${
					meta.hasSessionsNote ? "✓" : "—"
				} · Lineage: ${meta.hasLineageNote ? "✓" : "—"}`
			: "Story Anchors";
		const className =
			badge.status === "passed"
				? "pill-anchor-passed"
				: badge.status === "failed"
					? "pill-anchor-missing"
					: "pill-anchor-partial";

		return (
			<span className={className} title={title}>
				{badge.label}
				{typeof presentCount === "number" ? (
					<span className="ml-1 font-mono text-[0.625rem] opacity-80">
						{presentCount}/3
					</span>
				) : null}
			</span>
		);
	}

	if (badge.type === "contribution" && badge.stats) {
		return (
			<AiContributionBadge
				stats={{
					aiPercentage: badge.stats.aiPercentage,
					primaryTool: badge.stats.tool,
					model: badge.stats.model,
					humanLines: 0,
					aiAgentLines: 0,
					aiAssistLines: 0,
					collaborativeLines: 0,
					totalLines: 0,
				}}
			/>
		);
	}

	if (
		badge.type === "session" &&
		badge.sessionTools &&
		badge.sessionTools.length > 0
	) {
		// Single tool: show tool-specific styling
		if (badge.sessionTools.length === 1) {
			const tool = badge.sessionTools[0];
			return (
				<span
					className={getToolClasses(tool)}
					title={`Session created with ${tool}`}
				>
					{getToolIcon(tool)}
					{badge.label}
				</span>
			);
		}

		// Multiple tools: show generic with mixed indicator
		return (
			<span
				className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium pill-tool-neutral"
				title={`Sessions: ${badge.sessionTools.join(", ")}`}
			>
				<Bot className="w-3 h-3" />
				{badge.label}
			</span>
		);
	}

	return <span className="pill-file">{badge.label}</span>;
}
