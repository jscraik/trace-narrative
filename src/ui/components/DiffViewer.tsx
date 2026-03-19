import type { TraceContributorType, TraceRange } from "../../core/types";

function lineClass(line: string) {
	if (line.startsWith("@@")) return "diff-line-hunk";
	if (line.startsWith("+") && !line.startsWith("+++")) return "diff-line-add";
	if (line.startsWith("-") && !line.startsWith("---")) return "diff-line-del";
	return "";
}

type TraceLineInfo = { type: TraceContributorType };

function buildTraceLineLookup(ranges: TraceRange[]) {
	const lookup = new Map<number, TraceLineInfo>();

	for (const range of ranges) {
		const type = range.contributor?.type ?? "unknown";
		for (let line = range.startLine; line <= range.endLine; line += 1) {
			if (!lookup.has(line)) lookup.set(line, { type });
		}
	}

	return lookup;
}

function traceClass(type: TraceContributorType) {
	if (type === "ai") return "diff-line-trace-ai";
	if (type === "human") return "diff-line-trace-human";
	if (type === "mixed") return "diff-line-trace-mixed";
	return "diff-line-trace-unknown";
}

function parseNewFileLineNumber(hunkLine: string) {
	const match = /^@@\\s+-(\\d+),(\\d+)\\s+\\+(\\d+),(\\d+)\\s+@@/.exec(
		hunkLine,
	);
	if (!match) return null;
	return Number(match[3]);
}

export interface DiffViewerProps {
	/** Raw diff text to render. */
	diffText: string | null;
	/** Loading state for skeleton UI. */
	loading?: boolean;
	/** Trace ranges for attribution overlays. */
	traceRanges?: TraceRange[];
}

export function DiffViewer(props: DiffViewerProps) {
	const { diffText, loading, traceRanges } = props;
	const traceLookup = traceRanges ? buildTraceLineLookup(traceRanges) : null;

	return (
		<div className="min-h-full bg-bg-secondary px-4 py-3">
			{loading ? (
				<div className="space-y-2">
					<div
						className="h-4 bg-bg-primary rounded skeleton-shimmer w-1/4"
						style={{ animationDelay: "0ms" }}
					/>
					<div
						className="h-4 bg-bg-primary rounded skeleton-shimmer w-full"
						style={{ animationDelay: "80ms" }}
					/>
					<div
						className="h-4 bg-bg-primary rounded skeleton-shimmer w-5/6"
						style={{ animationDelay: "160ms" }}
					/>
					<div
						className="h-4 bg-bg-primary rounded skeleton-shimmer w-3/4"
						style={{ animationDelay: "240ms" }}
					/>
					<div
						className="h-4 bg-bg-primary rounded skeleton-shimmer w-full"
						style={{ animationDelay: "320ms" }}
					/>
					<div
						className="h-4 bg-bg-primary rounded skeleton-shimmer w-2/3"
						style={{ animationDelay: "400ms" }}
					/>
				</div>
			) : !diffText ? (
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="w-12 h-12 rounded-full bg-bg-primary flex items-center justify-center mb-3">
						<svg
							className="w-5 h-5 text-text-muted"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</div>
					<p className="text-sm text-text-secondary font-medium">
						No diff to display
					</p>
					<p className="mt-1 max-w-[15rem] text-xs text-text-muted">
						Select a file from the commit to view its changes. Demo data may not
						include diffs for all files.
					</p>
				</div>
			) : (
				<pre className="font-mono text-[0.75rem] leading-loose text-text-secondary">
					{(() => {
						let currentLineNumber = 0;
						let inHunk = false;

						return diffText.split(/\r?\n/).map((line) => {
							if (line.startsWith("@@")) {
								const nextLine = parseNewFileLineNumber(line);
								if (nextLine !== null) {
									currentLineNumber = nextLine;
									inHunk = true;
								}
								return (
									<div
										key={`hunk-${line}`}
										className={`${lineClass(line)} px-2 -mx-2`}
									>
										{line || " "}
									</div>
								);
							}

							let traceStyle = "";
							if (inHunk && traceLookup && !line.startsWith("-")) {
								const traceInfo = traceLookup.get(currentLineNumber);
								if (traceInfo) traceStyle = traceClass(traceInfo.type);
							}

							const classes = [lineClass(line), traceStyle, "px-2", "-mx-2"]
								.filter(Boolean)
								.join(" ");
							const lineKey = inHunk
								? `line-${currentLineNumber}-${line}`
								: `meta-${line}`;

							if (inHunk) {
								if (line.startsWith("+") && !line.startsWith("+++")) {
									currentLineNumber += 1;
								} else if (!line.startsWith("-") || line.startsWith("---")) {
									currentLineNumber += 1;
								}
							}

							return (
								<div key={lineKey} className={classes}>
									{line || " "}
								</div>
							);
						});
					})()}
				</pre>
			)}
		</div>
	);
}
