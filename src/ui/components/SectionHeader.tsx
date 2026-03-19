import clsx from "clsx";
import type React from "react";

export interface SectionHeaderProps {
	title: React.ReactNode;
	description?: React.ReactNode;
	badge?: React.ReactNode;
	action?: React.ReactNode;
	className?: string;
}

export function SectionHeader({
	title,
	description,
	badge,
	action,
	className,
}: SectionHeaderProps) {
	return (
		<header
			className={clsx(
				"mb-8 flex flex-col gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-end sm:justify-between",
				className,
			)}
		>
			<div className="flex flex-col gap-2 min-w-0">
				<div className="flex items-center gap-3 min-w-0">
					<h1 className="truncate text-2xl font-semibold tracking-tight text-text-primary">
						{title}
					</h1>
					{badge && <div className="shrink-0">{badge}</div>}
				</div>
				{description && (
					<p className="max-w-xl text-sm leading-6 text-text-secondary">
						{description}
					</p>
				)}
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</header>
	);
}
