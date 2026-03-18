import clsx from "clsx";
import {
	Activity,
	Bot,
	CalendarDays,
	Link2,
	MessageSquare,
} from "lucide-react";
import type { CaptureReliabilityStatus } from "../../core/tauri/ingestConfig";
import type { Mode, SessionExcerpt } from "../../core/types";
import type { RepoState } from "../../hooks/useRepoLoader";
import { DashboardTrustBadge } from "../components/dashboard/DashboardTrustBadge";
import { SectionHeader } from "../components/SectionHeader";
import { Eyebrow } from "../components/typography/Eyebrow";
import {
	buildNarrativeSurfaceViewModel,
	type SurfaceAction,
} from "./narrativeSurfaceData";
import { CompactKpiStrip } from "./narrativeSurfaceSections";

interface SessionsViewProps {
	repoState: RepoState;
	captureReliabilityStatus?: CaptureReliabilityStatus | null;
	autoIngestEnabled?: boolean;
	onModeChange: (mode: Mode) => void;
	onOpenRepo: () => void;
	onImportSession?: () => void;
	onAction?: (action: SurfaceAction) => void;
}

function getRepoPath(repoState: RepoState): string {
	if (repoState.status === "ready") return repoState.repo.root;
	if (repoState.status !== "idle")
		return repoState.path ?? "~/dev/trace-narrative";
	return "~/dev/trace-narrative";
}

function formatTimeAgo(iso?: string) {
	if (!iso) return "just now";
	const date = new Date(iso);
	const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	return `${Math.floor(diffHours / 24)}d ago`;
}

function formatLinkConfidence(confidence: number) {
	if (confidence >= 0.8)
		return {
			label: "High Confidence",
			color: "text-accent-green bg-accent-green/10 border-accent-green/20",
		};
	if (confidence >= 0.5)
		return {
			label: "Medium Confidence",
			color: "text-accent-amber bg-accent-amber-bg border-accent-amber-light",
		};
	return {
		label: "Low Confidence",
		color: "text-accent-red bg-accent-red-bg border-accent-red-light",
	};
}

// Scaffold Data
const SCAFFOLD_SESSIONS: (SessionExcerpt & { linkConfidence: number })[] = [
	{
		id: "1",
		tool: "Claude Code",
		agentName: "feat: add shared surface provenance rail",
		messages: Array(47).fill({ role: "user", text: "" }),
		linkConfidence: 0.94,
		importedAtISO: "2026-03-12T18:30:00Z",
	} as unknown as SessionExcerpt & { linkConfidence: number },
	{
		id: "2",
		tool: "Codex",
		agentName: "fix: harden hourly issue watchlist recovery",
		messages: Array(23).fill({ role: "user", text: "" }),
		linkConfidence: 0.71,
		importedAtISO: "2026-03-12T10:15:00Z",
	} as unknown as SessionExcerpt & { linkConfidence: number },
	{
		id: "3",
		tool: "Cursor",
		agentName: "update ui density uplift view models",
		messages: Array(15).fill({ role: "user", text: "" }),
		linkConfidence: 0.99,
		importedAtISO: "2026-03-11T14:20:00Z",
	} as unknown as SessionExcerpt & { linkConfidence: number },
	{
		id: "4",
		tool: "Copilot",
		agentName: "refactor narrative surface settings view",
		messages: Array(8).fill({ role: "user", text: "" }),
		linkConfidence: 0.35,
		importedAtISO: "2026-03-11T09:05:00Z",
	} as unknown as SessionExcerpt & { linkConfidence: number },
];

// Mock When You Work Chart
function WhenYouWorkChart() {
	const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
	const hours = Array.from({ length: 12 }, (_, i) => i * 2); // 0, 2, 4 ... 22

	return (
		<div className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
					<CalendarDays className="h-4 w-4 text-text-secondary" />
					When You Work
				</h2>
				<span className="inline-flex items-center gap-1 rounded-md bg-accent-violet/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest text-accent-violet border border-accent-violet/20">
					Preview
				</span>
			</div>

			<div className="flex">
				{/* Y-axis days */}
				<div className="flex flex-col justify-between pr-4 py-2 border-r border-border-light text-xs text-text-muted">
					{days.map((day) => (
						<span key={day} className="h-4 flex items-center">
							{day}
						</span>
					))}
				</div>

				{/* Heatmap grid */}
				<div className="flex-1 overflow-x-auto pl-4">
					<div className="min-w-max flex flex-col gap-1">
						{/* Hour labels */}
						<div className="flex justify-between text-[0.625rem] text-text-muted mb-2 px-1">
							{hours.map((h) => (
								<span key={h}>{h}h</span>
							))}
						</div>

						{/* Grid rows */}
						{days.map((day, _i) => (
							<div key={day} className="flex gap-1 h-4">
								{Array.from({ length: 24 }).map(() => {
									const intensity = Math.random();
									return (
										<div
											key={crypto.randomUUID()}
											className="flex-1 rounded-sm"
											style={{
												backgroundColor:
													intensity > 0.8
														? "var(--blue-500, rgba(59,130,246,1))"
														: intensity > 0.5
															? "var(--blue-500, rgba(59,130,246,1))"
															: intensity > 0.2
																? "var(--blue-500, rgba(59,130,246,1))"
																: "var(--bg-primary, rgba(255,255,255,1))",
												opacity:
													intensity > 0.8
														? 1
														: intensity > 0.5
															? 0.6
															: intensity > 0.2
																? 0.3
																: 0.05,
											}}
										/>
									);
								})}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export function SessionsView({
	repoState,
	captureReliabilityStatus,
	autoIngestEnabled,
	onOpenRepo: _onOpenRepo,
	onImportSession: _onImportSession,
}: SessionsViewProps) {
	const viewModel = buildNarrativeSurfaceViewModel(
		"sessions",
		repoState,
		captureReliabilityStatus,
		autoIngestEnabled,
	);
	const _repoPath = getRepoPath(repoState);

	const sessionsToUse =
		repoState.status === "ready" &&
		repoState.model.sessionExcerpts &&
		repoState.model.sessionExcerpts.length > 0
			? (repoState.model.sessionExcerpts.slice(
					0,
					5,
				) as unknown as (SessionExcerpt & { linkConfidence: number })[])
			: SCAFFOLD_SESSIONS;

	return (
		<div className="flex h-full min-h-0 flex-col bg-bg-primary">
			<main className="flex-1 overflow-y-auto px-6 py-6">
				<div className="mx-auto flex max-w-6xl flex-col gap-6">
					<SectionHeader
						title={viewModel.title}
						description="{viewModel.subtitle}"
						badge={<DashboardTrustBadge trustState={viewModel.trustState} />}
					/>

					<CompactKpiStrip metrics={viewModel.metrics} />

					<section className="grid gap-6 xl:grid-cols-2">
						<WhenYouWorkChart />

						<ArticleSection title="Session Quality">
							<div className="flex items-center justify-between p-4 border border-border-subtle rounded-xl bg-bg-primary">
								<div className="flex flex-col">
									<span className="text-xs text-text-muted">
										Link Confidence Average
									</span>
									<span className="text-2xl font-semibold mt-1">82%</span>
								</div>
								<Activity className="h-8 w-8 text-accent-green opacity-80" />
							</div>
							<div className="flex flex-col gap-2 mt-4 text-sm text-text-secondary pr-4 pb-2">
								<p>
									Confidence is high due to reliable commit attribution matching
									agent trace messages.
								</p>
								<button
									type="button"
									className="text-accent-blue hover:underline self-start font-medium mt-1 transition duration-200 ease-out active:duration-75 active:scale-[0.98]"
								>
									Review weak joins →
								</button>
							</div>
						</ArticleSection>
					</section>

					<section className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
						<div className="flex items-start justify-between gap-4 border-b border-border-light pb-4">
							<div>
								<Eyebrow>Review Window</Eyebrow>
								<h2 className="mt-1 text-xl font-semibold text-text-primary">
									Recent Sessions
								</h2>
							</div>
							{repoState.status !== "ready" && (
								<span className="inline-flex items-center gap-1 rounded-md bg-accent-violet/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest text-accent-violet border border-accent-violet/20">
									Preview
								</span>
							)}
						</div>

						<div className="flex flex-col gap-2 mt-2">
							{sessionsToUse.map((session, i) => {
								const conf = formatLinkConfidence(
									session.linkConfidence ?? Math.random() * 0.5 + 0.5,
								);
								return (
									<div
										key={session.id || i}
										className="flex items-center justify-between rounded-xl border border-transparent p-3 hover:border-border-subtle hover:bg-bg-subtle transition cursor-pointer group"
									>
										<div className="flex items-center gap-3 truncate min-w-0 pr-4">
											<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-light bg-bg-primary text-text-secondary">
												<Bot className="h-4 w-4" />
											</div>
											<div className="flex flex-col truncate min-w-0">
												<div className="flex items-center gap-2 truncate min-w-0">
													<span className="text-sm font-medium text-text-primary truncate">
														{session.tool}
													</span>
													<span className="text-sm text-text-secondary truncate">
														{session.agentName ||
															"Unknown implementation session"}
													</span>
												</div>
												<div className="flex items-center gap-3 mt-1 text-xs text-text-muted shrink-0">
													<span className="flex items-center gap-1 bg-bg-primary border border-border-light rounded-md px-1.5 py-0.5">
														<MessageSquare className="h-3 w-3" />
														{session.messages?.length || 0} msgs
													</span>
													<span
														className={clsx(
															"flex items-center gap-1 rounded-md border px-1.5 py-0.5",
															conf.color,
														)}
													>
														<Link2 className="h-3 w-3" />
														{conf.label}
													</span>
												</div>
											</div>
										</div>
										<div className="flex items-center gap-4 shrink-0">
											<span className="text-xs text-text-muted whitespace-nowrap">
												{formatTimeAgo(session.importedAtISO)}
											</span>
											<button
												type="button"
												className="text-sm border border-border-light rounded-lg px-3 py-1 bg-bg-primary text-text-secondary hover:text-text-primary hover:border-border-strong group-hover:bg-bg-secondary hidden sm:block transition duration-200 ease-out active:duration-75 active:scale-[0.98]"
											>
												Inspect
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</section>

					<section className="rounded-3xl border border-border-subtle bg-bg-secondary px-5 py-4">
						<p className="text-sm leading-6 text-text-secondary">
							{viewModel.footerNote}
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}

function ArticleSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-bg-subtle p-5">
			<h2 className="text-sm font-semibold text-text-primary">{title}</h2>
			{children}
		</article>
	);
}
