import { formatToolName } from "../../core/attribution-api";
import { AuthorBadge, getLineColor, type SourceLine } from "./AuthorBadge";

export interface SourceLensLineTableProps {
	lines: SourceLine[];
	showLineOverlays?: boolean;
}

function getLineAriaLabel(line: SourceLine): string {
	let authorLabel = "Unknown source";
	if (line.authorType === "human") authorLabel = "Human-authored";
	if (line.authorType === "ai_agent") authorLabel = "AI-generated";
	if (line.authorType === "ai_tab") authorLabel = "AI assist";
	if (line.authorType === "mixed") {
		authorLabel = `Mixed edits (${line.aiPercentage ?? 50}% AI)`;
	}

	const details: string[] = [`Line ${line.lineNumber}`, authorLabel];
	if (line.tool) details.push(`Tool ${formatToolName(line.tool)}`);
	if (line.model) details.push(`Model ${line.model}`);
	if (line.traceAvailable === false) details.push("Trace unavailable");

	return details.join(" · ");
}

export function SourceLensLineTable({
	lines,
	showLineOverlays = true,
}: SourceLensLineTableProps) {
	return (
		<div className="max-h-[25rem] overflow-auto font-mono text-xs">
			<table
				className="w-full table-fixed border-separate border-spacing-0"
				aria-label="Line attribution"
			>
				<thead className="sticky top-0 bg-bg-secondary z-10">
					<tr className="border-b border-border-light text-[0.6875rem] text-text-tertiary">
						<th scope="col" className="w-10 text-right font-medium px-4 py-2">
							Line
						</th>
						<th scope="col" className="w-24 text-left font-medium px-0 py-2">
							Source
						</th>
						<th scope="col" className="text-left font-medium px-4 py-2">
							Code
						</th>
					</tr>
				</thead>
				<tbody>
					{lines.map((line) => (
						<tr
							key={line.lineNumber}
							tabIndex={0}
							aria-label={getLineAriaLabel(line)}
							className={`border-b border-border-subtle last:border-0 transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-blue ${showLineOverlays ? getLineColor(line.authorType) : ""}`}
						>
							<td className="w-10 text-right text-text-muted select-none align-top px-4 py-1.5">
								{line.lineNumber}
							</td>
							<td className="w-24 align-top px-0 py-1.5">
								<div className="pt-0.5">
									<AuthorBadge line={line} />
								</div>
							</td>
							<td className="align-top px-4 py-1.5 text-text-secondary whitespace-pre-wrap break-words">
								{line.content || " "}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
