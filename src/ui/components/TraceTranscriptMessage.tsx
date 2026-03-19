import { AnimatePresence, motion } from "framer-motion";
import {
	Bot,
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	Lightbulb,
	Sparkles,
	Terminal,
	User,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import type { SessionMessage, SessionMessageRole } from "../../core/types";

export const ROLE_CONFIG: Record<
	SessionMessageRole,
	{
		label: string;
		badgeClass: string;
		icon: typeof User;
		description: string;
	}
> = {
	user: {
		label: "You",
		badgeClass: "bg-bg-tertiary text-text-secondary border-border-light",
		icon: User,
		description: "User prompt",
	},
	assistant: {
		label: "Assistant",
		badgeClass: "bg-bg-primary text-text-secondary border-border-light",
		icon: Bot,
		description: "Assistant response",
	},
	thinking: {
		label: "Thinking",
		badgeClass:
			"bg-accent-amber-bg text-accent-amber border-accent-amber-light",
		icon: Lightbulb,
		description: "Model reasoning process",
	},
	plan: {
		label: "Plan",
		badgeClass:
			"bg-accent-violet-bg text-accent-violet border-accent-violet-light",
		icon: Sparkles,
		description: "Execution plan",
	},
	tool_call: {
		label: "Tool",
		badgeClass:
			"bg-accent-green-bg text-accent-green border-accent-green-light",
		icon: Wrench,
		description: "Tool invocation",
	},
};

export function messageTitle(message: SessionMessage): string {
	if (message.role === "tool_call" && message.toolName) {
		return message.toolName;
	}
	if (message.role === "thinking") {
		return "Internal reasoning";
	}
	if (message.role === "plan") {
		return "Execution plan";
	}
	return ROLE_CONFIG[message.role].label;
}

export function roleBadge(role: SessionMessageRole) {
	const config = ROLE_CONFIG[role];
	const Icon = config.icon;

	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium ${config.badgeClass}`}
		>
			<Icon className="h-3 w-3" />
			{config.label}
		</span>
	);
}

export function roleSummary(messages: SessionMessage[]) {
	return messages.reduce<Record<SessionMessageRole, number>>(
		(acc, message) => {
			acc[message.role] = (acc[message.role] ?? 0) + 1;
			return acc;
		},
		{
			user: 0,
			assistant: 0,
			thinking: 0,
			plan: 0,
			tool_call: 0,
		},
	);
}

function formatToolInput(message: SessionMessage): string {
	if (message.toolInput !== undefined) {
		if (typeof message.toolInput === "string") {
			return message.toolInput;
		}
		try {
			return JSON.stringify(message.toolInput, null, 2);
		} catch {
			return String(message.toolInput);
		}
	}
	return message.text ?? "";
}

export function ToolCallDetails({ message }: { message: SessionMessage }) {
	const [isExpanded, setIsExpanded] = useState(true);
	const [copied, setCopied] = useState(false);
	const toolInput = formatToolInput(message);
	const hasInput = toolInput && toolInput.length > 0;

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(toolInput);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Ignore copy errors
		}
	};

	return (
		<div className="mt-3 rounded-lg border border-accent-green-light bg-accent-green-bg/50 overflow-hidden">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-accent-green hover:bg-accent-green-bg/70 transition duration-200 ease-out active:duration-75 active:scale-[0.98]"
			>
				<span className="flex items-center gap-2">
					<Terminal className="w-3.5 h-3.5" />
					Tool Input
				</span>
				{isExpanded ? (
					<ChevronUp className="w-3.5 h-3.5" />
				) : (
					<ChevronDown className="w-3.5 h-3.5" />
				)}
			</button>

			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
						className="overflow-hidden"
					>
						<div className="border-t border-accent-green-light">
							<div className="flex items-center justify-between px-3 py-1.5 bg-accent-green-bg/40 border-b border-accent-green-light">
								<span className="text-[0.625rem] uppercase tracking-wide text-accent-green">
									Arguments
								</span>
								<button
									type="button"
									onClick={handleCopy}
									className="inline-flex items-center gap-1 text-[0.625rem] text-accent-green transition-colors hover:text-accent-green/80"
								>
									{copied ? (
										<>
											<Check className="w-3 h-3" /> Copied
										</>
									) : (
										<>
											<Copy className="w-3 h-3" /> Copy
										</>
									)}
								</button>
							</div>
							<div className="p-3">
								{hasInput ? (
									<pre className="font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap break-words text-text-secondary">
										{toolInput}
									</pre>
								) : (
									<span className="text-[0.6875rem] italic text-text-tertiary">
										No input recorded
									</span>
								)}
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export function ThinkingBlock({ message }: { message: SessionMessage }) {
	const [isExpanded, setIsExpanded] = useState(false);
	const text = message.text ?? "";
	const isLong = text.length > 200;
	const displayText = isExpanded || !isLong ? text : `${text.slice(0, 200)}...`;

	return (
		<motion.div
			layout
			className="mt-2 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words"
		>
			<motion.div layout="position">{displayText}</motion.div>
			{isLong && (
				<button
					type="button"
					onClick={() => setIsExpanded(!isExpanded)}
					className="mt-2 text-xs text-text-tertiary hover:text-text-secondary font-medium flex items-center gap-1 transition-colors"
				>
					{isExpanded ? (
						<>
							<ChevronUp className="w-3.5 h-3.5" /> Show less
						</>
					) : (
						<>
							<ChevronDown className="w-3.5 h-3.5" /> Show full reasoning
						</>
					)}
				</button>
			)}
		</motion.div>
	);
}

export function MessageCard({
	message,
	selectedFile,
	onFileClick,
}: {
	message: SessionMessage;
	selectedFile?: string | null;
	onFileClick?: (path: string) => void;
}) {
	const config = ROLE_CONFIG[message.role];

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 10, scale: 0.95 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -10, scale: 0.95 }}
			transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
			className={`rounded-xl border px-4 py-4 transition hover:shadow-sm min-w-0 ${
				message.role === "user"
					? "bg-bg-tertiary border-border-light"
					: message.role === "thinking"
						? "bg-accent-amber-bg/50 border-accent-amber-light"
						: message.role === "plan"
							? "bg-accent-violet-bg/50 border-accent-violet-light"
							: message.role === "tool_call"
								? "bg-accent-green-bg/50 border-accent-green-light"
								: "bg-bg-secondary border-border-light"
			}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between gap-3 min-w-0">
				<div className="flex items-center gap-2 min-w-0">
					{roleBadge(message.role)}
					<span
						className={`text-xs font-semibold truncate ${config.badgeClass.split(" ")[1]}`}
					>
						{messageTitle(message)}
					</span>
				</div>
				<span className="text-[0.625rem] text-text-muted">
					{config.description}
				</span>
			</div>

			{/* Content based on role */}
			{message.role === "thinking" ? (
				<ThinkingBlock message={message} />
			) : message.role === "tool_call" ? (
				<ToolCallDetails message={message} />
			) : (
				<div className="mt-2 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words">
					{message.text || (
						<span className="text-text-muted italic">No message content</span>
					)}
				</div>
			)}

			{/* File pills */}
			{message.files && message.files.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-2">
					{message.files.map((file) => (
						<button
							key={file}
							type="button"
							onClick={() => onFileClick?.(file)}
							aria-pressed={selectedFile === file}
							title={file}
							className={`pill-file max-w-full truncate ${selectedFile === file ? "selected" : ""}`}
						>
							{file}
						</button>
					))}
				</div>
			)}
		</motion.div>
	);
}
