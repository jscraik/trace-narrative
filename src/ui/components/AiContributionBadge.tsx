import { Bot } from "lucide-react";

interface ContributionStats {
	humanLines: number;
	aiAgentLines: number;
	aiAssistLines: number;
	collaborativeLines: number;
	totalLines: number;
	aiPercentage: number;
	primaryTool?: string;
	model?: string;
}

interface AiContributionBadgeProps {
	stats?: ContributionStats;
	showZero?: boolean;
}

export function AiContributionBadge({
	stats,
	showZero = false,
}: AiContributionBadgeProps) {
	if (!stats) return null;

	const percentage = Math.round(stats.aiPercentage);

	// Don't show if 0% and showZero is false
	if (percentage === 0 && !showZero) return null;

	// Determine badge style based on percentage
	const getBadgeStyle = () => {
		if (percentage >= 80) {
			return {
				bg: "bg-accent-green-bg",
				text: "text-accent-green",
				border: "border-accent-green-light",
				icon: "text-accent-green",
			};
		} else if (percentage >= 40) {
			return {
				bg: "bg-accent-amber-bg",
				text: "text-accent-amber",
				border: "border-accent-amber-light",
				icon: "text-accent-amber",
			};
		} else if (percentage > 0) {
			return {
				bg: "bg-bg-tertiary",
				text: "text-text-secondary",
				border: "border-border-light",
				icon: "text-text-tertiary",
			};
		}
		return {
			bg: "bg-bg-primary",
			text: "text-text-secondary",
			border: "border-border-light",
			icon: "text-text-tertiary",
		};
	};

	const style = getBadgeStyle();
	const toolLabel = stats.primaryTool
		? formatToolName(stats.primaryTool)
		: "AI";

	return (
		<div
			className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
        border ${style.bg} ${style.text} ${style.border}
        transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:shadow-sm
      `}
			title={getTooltip(stats)}
		>
			<Bot className={`w-3 h-3 ${style.icon}`} />
			<span>{percentage > 0 ? `${percentage}%` : "0%"}</span>
			<span className="opacity-75 hidden sm:inline">· {toolLabel}</span>
		</div>
	);
}

function formatToolName(tool: string): string {
	const toolNames: Record<string, string> = {
		claude_code: "Claude",
		cursor: "Cursor",
		copilot: "Copilot",
		codex: "Codex",
		gemini: "Gemini",
		continue: "Continue",
	};

	return toolNames[tool] || tool;
}

function getTooltip(stats: ContributionStats): string {
	const parts: string[] = [];

	if (stats.aiAgentLines > 0) {
		parts.push(`${stats.aiAgentLines} lines from AI agent`);
	}
	if (stats.aiAssistLines > 0) {
		parts.push(`${stats.aiAssistLines} lines from AI assist`);
	}
	if (stats.collaborativeLines > 0) {
		parts.push(`${stats.collaborativeLines} lines collaborative`);
	}
	if (stats.humanLines > 0) {
		parts.push(`${stats.humanLines} lines human-written`);
	}

	if (stats.model) {
		parts.push(`Model: ${stats.model}`);
	}

	return parts.join("\n") || "No contribution data";
}
