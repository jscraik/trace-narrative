import {
	Bot,
	Code2,
	Cpu,
	Link2,
	MessageSquare,
	Sparkles,
	Terminal,
	Wand2,
} from "lucide-react";
import { forwardRef } from "react";
import type { SessionBadgeTool, TimelineNode } from "../../core/types";
import { BadgePill } from "./BadgePill";

export interface TimelineNodeProps {
	node: TimelineNode;
	selected: boolean;
	pulsing: boolean;
	onSelect: () => void;
}

/**
 * Get the icon component for a session tool (for overlay)
 */
function getToolOverlayIcon(tool: SessionBadgeTool) {
	const className = "w-2.5 h-2.5";
	switch (tool) {
		case "claude-code":
			return <Sparkles className={className} />;
		case "codex":
			return <Terminal className={className} />;
		case "cursor":
			return <Code2 className={className} />;
		case "gemini":
			return <Wand2 className={className} />;
		case "copilot":
			return <Bot className={className} />;
		case "continue":
			return <MessageSquare className={className} />;
		case "kimi":
			return <Cpu className={className} />;
		default:
			return <Link2 className={className} />;
	}
}

export const TimelineNodeComponent = forwardRef<
	HTMLDivElement,
	TimelineNodeProps
>(({ node, selected, pulsing, onSelect }, ref) => {
	// Always show labels now that we have truncation, to ensure Repo view matches Demo view density
	const showLabel = true;
	const sessionBadge = node.badges?.find((b) => b.type === "session");
	const hasSession = !!sessionBadge;
	const primaryTool = sessionBadge?.sessionTools?.[0] ?? null;
	const badges = node.badges ?? [];
	const anchorBadge = badges.find((b) => b.type === "anchor");
	// Only show anchor badge if there is at least one active anchor
	const hasActiveAnchors = anchorBadge?.anchor
		? Number(anchorBadge.anchor.hasAttributionNote) +
				Number(anchorBadge.anchor.hasSessionsNote) +
				Number(anchorBadge.anchor.hasLineageNote) >
			0
		: false;

	const nonAnchorBadges = badges.filter((b) => b.type !== "anchor");
	const visibleBadges = (
		anchorBadge && hasActiveAnchors
			? [...nonAnchorBadges.slice(0, 2), anchorBadge]
			: nonAnchorBadges.slice(0, 3)
	).slice(0, 3);

	return (
		<div
			ref={ref}
			data-node-id={node.id}
			className="relative flex flex-col items-center"
			style={{ minWidth: "6.25rem" }}
		>
			{/* Label above with tooltip for truncated text */}
			{showLabel && node.label ? (
				<div
					className="mb-2 h-4 w-32 px-1 text-center text-[0.6875rem] font-medium leading-tight text-text-secondary"
					title={node.label}
				>
					<span className="block truncate">{node.label}</span>
				</div>
			) : (
				<div className="mb-2 h-4" />
			)}

			{/* Dot with selection glow */}
			<button
				type="button"
				className={`timeline-dot transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${node.status || "ok"} ${selected ? "selected" : ""} ${hasSession ? "has-session" : ""} ${pulsing ? "pulse-once" : ""}`}
				onClick={onSelect}
				title={node.label ?? node.id}
				aria-label={node.label ?? node.id}
				aria-current={selected ? "true" : undefined}
			>
				{/* Session badge overlay on dot */}
				{sessionBadge && (
					<span className="session-badge-overlay">
						{primaryTool ? (
							getToolOverlayIcon(primaryTool)
						) : (
							<Link2 className="w-2.5 h-2.5" />
						)}
					</span>
				)}
			</button>

			{/* Badges below dot */}
			{visibleBadges.length > 0 && (
				<div className="mt-2 flex flex-col items-center gap-1">
					{visibleBadges.map((badge) => (
						<BadgePill
							key={`${badge.type}-${badge.label ?? badge.status ?? "badge"}`}
							badge={badge}
						/>
					))}
				</div>
			)}

			{/* Date below */}
			<div className="mt-2 h-4 text-[0.625rem] text-text-muted">
				{showLabel && node.atISO
					? new Date(node.atISO).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})
					: ""}
			</div>
		</div>
	);
});

TimelineNodeComponent.displayName = "TimelineNodeComponent";
