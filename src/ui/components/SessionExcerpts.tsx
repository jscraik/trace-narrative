import { Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { SessionExcerpt } from "../../core/types";
import { useRepoFileExistence } from "../../hooks/useRepoFileExistence";
import {
	ExpandableHighlight,
	FilePill,
	LinkStatus,
	SessionLinkPipeline,
	ToolPill,
	UnlinkConfirmDialog,
} from "./session-excerpts/SessionExcerptsParts";
import {
	collectFiles,
	isRepoRelativePath,
	selectHighlights,
} from "./session-excerpts/sessionExcerpts.utils";

export interface SessionExcerptsProps {
	excerpts: SessionExcerpt[] | undefined;
	selectedFile?: string | null;
	onFileClick?: (path: string) => void;
	onUnlink?: (sessionId: string) => void;
	onCommitClick?: (commitSha: string) => void;
	selectedCommitId?: string | null;
	selectedSessionId?: string | null;
	onSelectSession?: (sessionId: string) => void;
	repoRoot?: string;
	changedFiles?: string[];
}

export function SessionExcerpts(props: SessionExcerptsProps) {
	const {
		excerpts,
		selectedFile,
		onFileClick,
		onUnlink,
		onCommitClick,
		selectedCommitId,
		selectedSessionId,
		onSelectSession,
		repoRoot,
		changedFiles,
	} = props;

	const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
	const [pendingUnlinkId, setPendingUnlinkId] = useState<string | null>(null);

	const hasExcerpts = Boolean(excerpts && excerpts.length > 0);
	const excerpt = hasExcerpts
		? (excerpts?.find((item) => item.id === selectedSessionId) ??
			excerpts?.[0] ??
			null)
		: null;

	const filesTouched = excerpt ? collectFiles(excerpt.messages) : [];
	const highlights = excerpt ? selectHighlights(excerpt.messages) : [];
	const changedSet = useMemo(() => new Set(changedFiles ?? []), [changedFiles]);
	const visibleFiles = filesTouched.slice(0, 8);
	const existsMap = useRepoFileExistence(
		repoRoot ?? "",
		visibleFiles.filter((path) => isRepoRelativePath(path)),
	);

	if (!hasExcerpts) {
		return <EmptySessionState />;
	}

	if (!excerpt) {
		return null;
	}

	const allExcerpts = excerpts ?? [];
	const linkedCommitSha = excerpt.linkedCommitSha ?? null;

	const handleUnlinkClick = () => {
		setPendingUnlinkId(excerpt.id);
		setUnlinkDialogOpen(true);
	};

	const handleUnlinkConfirm = () => {
		if (pendingUnlinkId && onUnlink) {
			onUnlink(pendingUnlinkId);
		}
		setUnlinkDialogOpen(false);
		setPendingUnlinkId(null);
	};

	const handleUnlinkCancel = () => {
		setUnlinkDialogOpen(false);
		setPendingUnlinkId(null);
	};

	return (
		<>
			<div className="card p-5 overflow-x-hidden max-h-[42vh] overflow-y-auto">
				<div className="flex items-center justify-between">
					<div>
						<div className="section-header">SESSION SUMMARY</div>
						<div className="section-subheader">
							Key moments from the session
						</div>
					</div>
					<div className="flex flex-col items-end gap-1">
						<ToolPill
							tool={excerpt.tool}
							durationMin={excerpt.durationMin}
							agentName={excerpt.agentName}
							redactionCount={excerpt.redactionCount}
						/>
						<LinkStatus
							excerpt={excerpt}
							onUnlink={
								onUnlink && linkedCommitSha ? handleUnlinkClick : undefined
							}
							onClick={
								linkedCommitSha && onCommitClick
									? () => onCommitClick(linkedCommitSha)
									: undefined
							}
							isSelected={selectedCommitId === linkedCommitSha}
						/>
						{excerpt.needsReview ? (
							<span className="rounded bg-accent-amber-bg px-1.5 py-0.5 text-[0.6875rem] text-accent-amber">
								Needs review
							</span>
						) : null}
						<SessionLinkPipeline excerpt={excerpt} />
					</div>
				</div>

				{allExcerpts.length > 1 ? (
					<div className="mt-3 flex flex-wrap gap-2">
						{allExcerpts.map((item) => {
							const isActive = item.id === excerpt.id;
							return (
								<button
									key={item.id}
									type="button"
									onClick={() => onSelectSession?.(item.id)}
									className={[
										"rounded-lg border px-3 py-1.5 text-[0.6875rem] font-medium transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
										isActive
											? "bg-accent-blue-light border-accent-blue text-accent-blue shadow-sm ring-1 ring-accent-blue/20"
											: "bg-bg-secondary border-border-light text-text-secondary hover:bg-bg-hover hover:border-border-medium",
									].join(" ")}
									aria-pressed={isActive}
								>
									{item.tool}
									{item.redactionCount
										? ` · ${item.redactionCount} redactions`
										: ""}
								</button>
							);
						})}
					</div>
				) : null}

				<div className="mt-4 grid gap-4 rounded-lg border border-border-subtle bg-bg-tertiary p-4">
					<SessionStats
						excerpt={excerpt}
						filesTouchedCount={filesTouched.length}
					/>

					<div>
						<div className="text-[0.625rem] uppercase tracking-wider text-text-muted">
							AI-suggested highlights
						</div>
						{highlights.length > 0 ? (
							<ul className="mt-2 list-disc pl-4 space-y-2">
								{highlights.map((highlight) => (
									<ExpandableHighlight
										key={highlight.id}
										id={highlight.id}
										text={highlight.text}
									/>
								))}
							</ul>
						) : (
							<div className="mt-2 text-xs text-text-muted">
								No highlights available.
							</div>
						)}
						<div className="mt-2 text-[0.6875rem] text-text-muted">
							Review these in the Conversation panel before reusing or sharing.
						</div>
					</div>

					{filesTouched.length > 0 ? (
						<div>
							<div className="text-[0.625rem] uppercase tracking-wider text-text-muted">
								Mentioned files
							</div>
							<div className="mt-1 text-[0.6875rem] text-text-muted">
								From imported session logs. Best-effort — may not be changed in
								this commit.
							</div>
							<div className="mt-2 flex flex-wrap gap-2">
								{visibleFiles.map((file) => {
									const isRel = isRepoRelativePath(file);
									const exists = isRel ? existsMap[file] : false;
									const inCommit = changedSet.has(file);
									const variant: "default" | "best-effort" | "not-found" =
										exists === false
											? "not-found"
											: inCommit
												? "default"
												: "best-effort";

									const title = !isRel
										? "Mentioned, but the path is not repo-relative"
										: exists === false
											? "Mentioned, but file was not found in this repo"
											: inCommit
												? "Mentioned and changed in this commit"
												: "Mentioned, but not changed in this commit";

									return (
										<FilePill
											key={file}
											file={file}
											isSelected={selectedFile === file}
											variant={variant}
											title={title}
											onClick={
												isRel && exists !== false
													? () => onFileClick?.(file)
													: undefined
											}
										/>
									);
								})}
								{filesTouched.length > 8 ? (
									<span className="text-[0.6875rem] text-text-muted">
										+{filesTouched.length - 8} more
									</span>
								) : null}
							</div>
						</div>
					) : null}

					<div className="text-[0.6875rem] text-text-muted">
						Full conversation appears below in the Conversation panel.
					</div>
				</div>
			</div>

			<UnlinkConfirmDialog
				isOpen={unlinkDialogOpen}
				onClose={handleUnlinkCancel}
				onConfirm={handleUnlinkConfirm}
			/>
		</>
	);
}

function EmptySessionState() {
	return (
		<div className="card p-5 overflow-x-hidden max-h-[42vh] overflow-y-auto">
			<div className="flex items-center justify-between">
				<div>
					<div className="section-header">SESSION SUMMARY</div>
					<div className="section-subheader">Key moments from the session</div>
				</div>
			</div>
			<div className="mt-6 flex flex-col items-center text-center py-4">
				<div className="w-12 h-12 rounded-full bg-bg-primary flex items-center justify-center mb-3">
					<Upload className="w-5 h-5 text-text-muted" />
				</div>
				<p className="text-sm text-text-tertiary mb-1">
					No sessions imported yet
				</p>
				<p className="text-xs text-text-muted mb-4">
					Import from Claude, Cursor, or Kimi
				</p>
				<button
					type="button"
					className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-accent-foreground text-sm font-medium hover:bg-accent-blue transition-colors shadow-sm"
					onClick={() => {
						window.dispatchEvent(new CustomEvent("narrative:open-import"));
					}}
				>
					<Upload className="w-4 h-4" />
					Import Session
				</button>
			</div>
		</div>
	);
}

function SessionStats({
	excerpt,
	filesTouchedCount,
}: {
	excerpt: SessionExcerpt;
	filesTouchedCount: number;
}) {
	return (
		<div className="flex flex-wrap gap-4 text-xs text-text-secondary">
			<div>
				<div className="text-[0.625rem] uppercase tracking-wider text-text-muted">
					Messages
				</div>
				<div className="font-semibold">{excerpt.messages.length}</div>
			</div>
			<div>
				<div className="text-[0.625rem] uppercase tracking-wider text-text-muted">
					Mentioned files
				</div>
				<div className="font-semibold">{filesTouchedCount}</div>
			</div>
			{typeof excerpt.durationMin === "number" ? (
				<div>
					<div className="text-[0.625rem] uppercase tracking-wider text-text-muted">
						Duration
					</div>
					<div className="font-semibold">{excerpt.durationMin} min</div>
				</div>
			) : null}
		</div>
	);
}
