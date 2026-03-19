import { AnimatePresence, motion } from "framer-motion";
import type { FileStats } from "../../../core/attribution-api";
import type { DashboardFilter } from "../../../core/types";

interface TopFilesTableProps {
	files: FileStats[];
	hasMore: boolean;
	isLoading?: boolean;
	onFileClick: (filter: DashboardFilter) => void;
	onLoadMore: () => void;
}

/**
 * TopFilesTable — Displays ranked files by trace evidence coverage.
 *
 * Per dashboard-motion-spec.yml:
 * - Row hover: bg-accent-blue-bg, 150ms ease-out
 * - Row focus: inset highlight using accent-blue
 * - Load more: button opacity transition during loading
 * - Reduced motion: instant hover, no transition
 */
export function TopFilesTable({
	files,
	hasMore,
	isLoading = false,
	onFileClick,
	onLoadMore,
}: TopFilesTableProps) {
	if (files.length === 0) {
		return (
			<div className="text-center py-12 text-text-muted text-sm">
				No attributed files are available for this window.
			</div>
		);
	}

	return (
		<section data-top-files-table>
			<div className="card p-4 animate-fade-in-up delay-100">
				<h2 className="text-lg font-semibold text-text-primary mb-4">
					Evidence-Ranked Files
				</h2>

				<div className="overflow-hidden rounded-lg border border-border-light bg-bg-secondary">
					<table className="w-full border-collapse">
						<thead className="bg-bg-tertiary border-b border-border-light">
							<tr>
								<th
									className="px-4 py-3 text-xs font-semibold text-text-muted uppercase text-left"
									scope="col"
								>
									File
								</th>
								<th
									className="px-4 py-3 text-xs font-semibold text-text-muted uppercase text-right"
									scope="col"
								>
									AI %
								</th>
								<th
									className="px-4 py-3 text-xs font-semibold text-text-muted uppercase text-right"
									scope="col"
								>
									AI Lines
								</th>
								<th
									className="px-4 py-3 text-xs font-semibold text-text-muted uppercase text-right"
									scope="col"
								>
									Commits
								</th>
							</tr>
						</thead>
						<tbody>
							<AnimatePresence>
								{files.map((file, index) => (
									<TableRow
										key={file.filePath}
										file={file}
										index={index}
										onClick={() =>
											onFileClick({
												type: "file",
												value: file.filePath,
												dateRange: undefined,
											})
										}
									/>
								))}
							</AnimatePresence>
						</tbody>
					</table>
				</div>

				{hasMore && (
					<div className="mt-4 text-center">
						<LoadMoreButton onClick={onLoadMore} isLoading={isLoading} />
					</div>
				)}
			</div>
		</section>
	);
}

interface TableRowProps {
	file: FileStats;
	index: number;
	onClick: () => void;
}

/**
 * TableRow — Individual table row with hover/focus states.
 *
 * Motion per dashboard-motion-spec.yml:
 * - Row hover: bg-accent-blue-bg, 150ms ease-out
 * - Row focus: inset highlight using accent-blue, instant
 * - Reduced motion: instant bg change only
 *
 * Keyboard: Enter/Space triggers onClick, Tab navigates between rows
 */
function TableRow({ file, index, onClick }: TableRowProps) {
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onClick();
		}
	};

	return (
		<motion.tr
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.98 }}
			transition={{
				delay: index * 0.03,
				duration: 0.2,
				ease: [0.25, 0.46, 0.45, 0.94],
			}}
			className="border-b border-border-subtle last:border-b-0 hover:bg-accent-blue-bg focus-visible:bg-accent-blue-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-blue cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
			onClick={onClick}
			onKeyDown={handleKeyDown}
			tabIndex={0}
		>
			<td
				className="px-4 py-3 text-sm text-text-secondary font-medium truncate max-w-[12.5rem]"
				title={file.filePath}
			>
				{file.filePath}
			</td>
			<td className="px-4 py-3 text-sm text-text-secondary text-right tabular-nums">
				{file.aiPercentage.toFixed(0)}%
			</td>
			<td className="px-4 py-3 text-sm text-text-secondary text-right tabular-nums">
				{file.aiLines.toLocaleString()}
			</td>
			<td className="px-4 py-3 text-sm text-text-secondary text-right tabular-nums">
				{file.commitCount}
			</td>
		</motion.tr>
	);
}

interface LoadMoreButtonProps {
	onClick: () => void;
	isLoading: boolean;
}

/**
 * LoadMoreButton — Pagination button with loading state.
 *
 * Motion per dashboard-motion-spec.yml:
 * - Button hover: opacity change
 * - Loading state: opacity 0.5 + visual indicator
 */
function LoadMoreButton({ onClick, isLoading }: LoadMoreButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isLoading}
			className={`
        btn-secondary-soft inline-flex items-center gap-2 px-4 py-2 rounded-lg
        text-sm font-medium transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
        ${
					isLoading
						? "text-text-muted cursor-not-allowed opacity-50"
						: "text-text-secondary"
				}
      `}
			aria-label={isLoading ? "Loading more files..." : "Load more files"}
		>
			{isLoading ? (
				<>
					<span
						className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
						aria-hidden="true"
					/>
					<span>Loading...</span>
				</>
			) : (
				<span>Load more...</span>
			)}
		</button>
	);
}
