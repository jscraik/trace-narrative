import clsx from "clsx";
import {
	Activity,
	BarChart3,
	BookOpen,
	Bot,
	Brain,
	Clock,
	Database,
	DollarSign,
	FileCode,
	FileSearch,
	FolderGit2,
	GitBranch,
	HardDrive,
	History,
	KeyRound,
	Layers3,
	LibraryBig,
	PackageSearch,
	PlugZap,
	Search,
	Settings,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	TerminalSquare,
	Workflow,
	Zap,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { Mode } from "../../core/types";
import { SparklineChart } from "./charts";

interface SidebarProps {
	mode: Mode;
	onModeChange: (mode: Mode) => void;
	onOpenRepo?: () => void;
	onImportSession?: () => void;
}

interface NavEntry {
	id: Mode;
	label: string;
	icon: ComponentType<{ className?: string }>;
	badge?: ReactNode;
	status?: string;
	primary?: boolean;
	showInFullMap?: boolean;
	sparkline?: number[];
}

interface NavSection {
	label: string;
	items: NavEntry[];
}

export function Sidebar({
	mode,
	onModeChange,
	onOpenRepo,
	onImportSession,
}: SidebarProps) {
	const [showFullMap, setShowFullMap] = useState(false);

	const sections = useMemo<NavSection[]>(
		() => [
			{
				label: "Narrative",
				items: [
					{
						id: "dashboard",
						label: "Narrative Brief",
						icon: BarChart3,
						primary: true,
					},
					{ id: "work-graph", label: "Story Map", icon: Activity },
				],
			},
			{
				label: "Evidence",
				items: [
					{
						id: "live",
						label: "Live Capture",
						icon: Zap,
						primary: true,
						sparkline: [2, 4, 3, 8, 5, 9, 12, 10, 8, 4],
					},
					{ id: "timeline", label: "Causal Timeline", icon: History },
					{ id: "sessions", label: "Sessions", icon: Clock, badge: 12 },
					{ id: "transcripts", label: "Transcript Lens", icon: FileSearch },
					{ id: "tools", label: "Tool Pulse", icon: Sparkles },
					{ id: "costs", label: "Cost Watch", icon: DollarSign },
				],
			},
			{
				label: "Workspace",
				items: [
					{
						id: "repo",
						label: "Repo Evidence",
						icon: GitBranch,
						badge: 4,
						primary: true,
					},
					{
						id: "repo-pulse",
						label: "Workspace Pulse",
						icon: FolderGit2,
						primary: true,
						sparkline: [1, 1, 2, 1, 3, 2, 4, 3, 5, 2],
					},
					{ id: "diffs", label: "Diff Review", icon: FileCode },
					{ id: "snapshots", label: "Snapshots", icon: Layers3 },
					{ id: "worktrees", label: "Worktrees", icon: Workflow },
					{ id: "attribution", label: "Attribution Lens", icon: ShieldCheck },
				],
			},
			{
				label: "Integrations",
				items: [
					{ id: "setup", label: "Setup", icon: TerminalSquare, primary: true },
					{ id: "skills", label: "Codex Skills", icon: LibraryBig },
					{ id: "agents", label: "Agent Roles", icon: Bot },
					{ id: "memory", label: "Memory Graph", icon: Brain },
					{ id: "hooks", label: "Hooks", icon: PlugZap },
					{ id: "ports", label: "Ports", icon: HardDrive },
				],
			},
			{
				label: "Health",
				items: [
					{ id: "hygiene", label: "Hygiene", icon: ShieldAlert, primary: true },
					{
						id: "status",
						label: "Trust Center",
						icon: ShieldCheck,
						status: "OK",
						primary: true,
					},
					{ id: "deps", label: "Dependency Watch", icon: PackageSearch },
					{ id: "env", label: "Env Hygiene", icon: KeyRound },
				],
			},
			{
				label: "Configure",
				items: [
					{ id: "settings", label: "Settings", icon: Settings, primary: true },
					{ id: "docs", label: "Docs", icon: BookOpen, showInFullMap: false },
				],
			},
		],
		[],
	);

	const NavItem = ({
		id,
		label,
		icon: Icon,
		badge,
		status,
		sparkline,
	}: NavEntry) => {
		const isActive = mode === id;

		return (
			<button
				type="button"
				role="tab"
				aria-selected={isActive}
				onClick={() => onModeChange(id)}
				className={clsx(
					"w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.98]",
					isActive
						? "nav-item-active shadow-sm"
						: "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
				)}
			>
				<Icon className="w-4 h-4 shrink-0" />
				<span className="flex-1 text-left truncate">{label}</span>
				{sparkline && (
					<div className="w-8 flex items-center opacity-50 shrink-0 mix-blend-plus-lighter pointer-events-none">
						<SparklineChart
							data={sparkline}
							width={32}
							height={14}
							tone="violet"
						/>
					</div>
				)}
				{badge !== undefined && (
					<span
						className={clsx(
							"text-[0.625rem] rounded px-1.5 py-0.5 font-medium shrink-0",
							typeof badge === "number"
								? "text-accent-blue"
								: "bg-bg-tertiary text-text-muted",
						)}
					>
						{badge}
					</span>
				)}
				{status && (
					<span className="text-[0.625rem] rounded bg-accent-green-bg px-1.5 py-0.5 font-medium text-accent-green shrink-0">
						{status}
					</span>
				)}
			</button>
		);
	};

	const SectionLabel = ({ children }: { children: ReactNode }) => (
		<div className="mb-2 px-3 text-[0.625rem] font-bold uppercase tracking-wider text-text-muted opacity-60">
			{children}
		</div>
	);

	return (
		<aside className="w-56 flex-shrink-0 flex flex-col border-r border-border-subtle bg-bg-subtle h-screen sticky top-0 ">
			{/* Brand */}
			<div className="h-14 flex items-center gap-3 px-4 border-b border-border-subtle relative cursor-default">
				<div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-violet-bg/70 border border-border-subtle">
					<Zap className="w-5 h-5 text-accent-violet" />
				</div>
				<span className="font-bold text-sm tracking-tight text-text-primary">
					Trace Narrative
				</span>
			</div>

			{/* Nav */}
			<div
				role="tablist"
				aria-label="Sidebar mode navigation"
				className="flex-1 py-4 px-3 space-y-6 overflow-y-auto scrollbar-thin"
			>
				{sections.map((section) => {
					const visibleItems = section.items.filter(
						(item) =>
							item.id === mode ||
							item.primary ||
							(showFullMap && item.showInFullMap !== false),
					);
					if (visibleItems.length === 0) {
						return null;
					}

					return (
						<div key={section.label}>
							<SectionLabel>{section.label}</SectionLabel>
							<div className="space-y-1">
								{visibleItems.map((item) => (
									<NavItem
										key={item.id}
										id={item.id}
										label={item.label}
										icon={item.icon}
										badge={item.badge}
										status={item.status}
										sparkline={item.sparkline}
									/>
								))}
							</div>
						</div>
					);
				})}

				<div>
					<SectionLabel>View Scope</SectionLabel>
					<button
						type="button"
						onClick={() => setShowFullMap((value) => !value)}
						className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.98]"
					>
						<Layers3 className="w-4 h-4" />
						<span className="flex-1 text-left">
							{showFullMap ? "Show Primary Views" : "Show Full Map"}
						</span>
					</button>
				</div>

				<div>
					<SectionLabel>Actions</SectionLabel>
					<div className="space-y-1">
						<button
							type="button"
							onClick={onOpenRepo}
							className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.98]"
						>
							<GitBranch className="w-4 h-4" />
							<span className="flex-1 text-left">Open Repo</span>
						</button>
						<button
							type="button"
							onClick={onImportSession}
							className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.98]"
						>
							<Database className="w-4 h-4" />
							<span className="flex-1 text-left">Import Session</span>
						</button>
					</div>
				</div>
			</div>

			{/* Footer / Search */}
			<div className="p-3 border-t border-border-subtle">
				<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-primary border border-border-subtle text-text-muted cursor-pointer hover:bg-bg-hover transition-colors">
					<Search className="w-3.5 h-3.5" />
					<span className="text-xs">Quick search...</span>
					<span className="ml-auto rounded border border-border-subtle px-1 text-[0.625rem] opacity-50">
						⌘K
					</span>
				</div>
			</div>
		</aside>
	);
}
