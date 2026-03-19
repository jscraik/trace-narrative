import { FileCode } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFileSelection } from "../../core/context/FileSelectionContext";
import type { FileChange, TraceFileSummary } from "../../core/types";

function formatDelta(n: number) {
	const sign = n >= 0 ? "+" : "";
	return `${sign}${n}`;
}

export function FilesChanged({
	files,
	title,
	traceByFile,
}: {
	files: FileChange[];
	title?: string;
	traceByFile?: Record<string, TraceFileSummary>;
}) {
	const { selectedFile, selectFile } = useFileSelection();
	const fileRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	// Scroll selected file into view with reduced-motion support
	useEffect(() => {
		if (selectedFile) {
			const el = fileRefs.current.get(selectedFile);
			if (el) {
				const prefersReducedMotion = window.matchMedia(
					"(prefers-reduced-motion: reduce)",
				).matches;
				el.scrollIntoView({
					behavior: prefersReducedMotion ? "auto" : "smooth",
					block: "nearest",
				});
			}
		}
	}, [selectedFile]);

	return (
		<div className="card p-5 animate-fade-in-up delay-200 hover:shadow-lg transition-shadow duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]">
			<div className="section-header">
				{title ?? "Files in this evidence window"}
			</div>
			<div className="section-subheader">
				Changed files linked to the selected commit, branch, or evidence slice
			</div>
			<div className="mt-4 divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
				{files.length === 0 ? (
					<div className="p-6 flex flex-col items-center text-center">
						<div className="w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center mb-2">
							<FileCode className="w-4 h-4 text-text-muted" />
						</div>
						<p className="text-sm text-text-tertiary">No files changed</p>
						<p className="text-xs text-text-muted mt-0.5">
							Select a commit to inspect file evidence
						</p>
					</div>
				) : (
					files.map((f) => (
						<button
							key={f.path}
							ref={(el) => {
								if (el) fileRefs.current.set(f.path, el);
							}}
							type="button"
							aria-pressed={selectedFile === f.path}
							className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
								selectedFile === f.path
									? "bg-accent-blue-bg border-l-[0.1875rem] border-l-accent-blue -ml-[0.1875rem] pl-[1.125rem] shadow-sm"
									: "hover:bg-bg-tertiary border-l-[0.1875rem] border-l-transparent"
							}`}
							onClick={() => selectFile(f.path)}
						>
							<div
								className={`truncate font-mono text-[0.75rem] ${
									selectedFile === f.path
										? "text-accent-blue"
										: "text-text-secondary"
								}`}
							>
								{f.path}
							</div>
							<div className="flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] tabular-nums">
								{traceByFile?.[f.path]
									? (() => {
											const summary = traceByFile[f.path];
											// Show "Unknown" pill if only unknown lines exist (no AI/human/mixed)
											const isUnknownOnly =
												summary.unknownLines > 0 &&
												summary.aiLines === 0 &&
												summary.humanLines === 0 &&
												summary.mixedLines === 0;

											return isUnknownOnly ? (
												<span className="pill-trace-unknown">Unknown</span>
											) : (
												<span className="pill-trace-ai">
													AI {summary.aiPercent}%
												</span>
											);
										})()
									: null}
								<span className="text-accent-green">
									{formatDelta(f.additions)}
								</span>
								<span className="text-accent-red">{`-${f.deletions}`}</span>
							</div>
						</button>
					))
				)}
			</div>
		</div>
	);
}
