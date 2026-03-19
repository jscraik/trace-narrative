/**
 * AccessibleChartWrapper.tsx
 *
 * Wraps any ECharts canvas with:
 * - `role="img"` + `aria-label` for screen readers
 * - Explicit `minHeight` to prevent layout jump when ECharts mounts at height 0
 * - A visually-hidden <table> always present in the DOM as a data fallback
 *
 * Usage:
 *   <AccessibleChartWrapper
 *     label="Daily commit activity for the last 30 days"
 *     minHeight={96}
 *     tableData={[{ col1: 'Mar 10', col2: 12 }, ...]}
 *   >
 *     <div ref={chartRef} style={{ width: '100%', height: 96 }} aria-hidden="true" />
 *   </AccessibleChartWrapper>
 */

import type { ReactNode } from "react";

export interface AccessibleChartTableRow {
	col1: string;
	col2: string | number;
	col3?: string | number;
}

interface AccessibleChartWrapperProps {
	/** Human-readable description of what the chart shows */
	label: string;
	/** Sets min-height on the container so layout doesn't jump when ECharts mounts */
	minHeight: number;
	/** Data rows rendered as a visually-hidden table for screen readers */
	tableData: AccessibleChartTableRow[];
	/** Column headers (defaults to sensible fallbacks) */
	tableHeaders?: [string, string, string?];
	children: ReactNode;
	className?: string;
}

export function AccessibleChartWrapper({
	label,
	minHeight,
	tableData,
	tableHeaders = ["Label", "Value"],
	children,
	className,
}: AccessibleChartWrapperProps) {
	return (
		<div
			role="img"
			aria-label={label}
			style={{ minHeight }}
			className={className}
		>
			{/* Visually hidden table — always in DOM for assistive tech */}
			<table className="sr-only" aria-label={`${label} — data table`}>
				<thead>
					<tr>
						<th scope="col">{tableHeaders[0]}</th>
						<th scope="col">{tableHeaders[1]}</th>
						{tableHeaders[2] && <th scope="col">{tableHeaders[2]}</th>}
					</tr>
				</thead>
				<tbody>
					{tableData.map((row) => (
						<tr key={`${row.col1}-${row.col2}`}>
							<td>{row.col1}</td>
							<td>{row.col2}</td>
							{row.col3 !== undefined && <td>{row.col3}</td>}
						</tr>
					))}
				</tbody>
			</table>

			{/* Chart canvas — hidden from screen readers; table above is the a11y source */}
			<div aria-hidden="true">{children}</div>
		</div>
	);
}
