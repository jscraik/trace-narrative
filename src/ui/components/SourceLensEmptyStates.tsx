import { HelpCircle } from "lucide-react";

export interface SourceLensEmptyStatesProps {
	loading: boolean;
	error: string | null;
	lineCount: number;
	showHeader?: boolean;
}

export function SourceLensEmptyStates({
	loading,
	error,
	lineCount,
	showHeader = true,
}: SourceLensEmptyStatesProps) {
	if (loading && lineCount === 0) {
		return (
			<div className="card p-5">
				{showHeader ? <div className="section-header">SOURCE LENS</div> : null}
				<div className="mt-4 flex items-center gap-2 text-sm text-text-tertiary">
					<div className="w-4 h-4 border-2 border-border-light border-t-accent-blue rounded-full motion-safe:animate-spin motion-reduce:animate-none" />
					Loading source lens...
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="card p-5">
				{showHeader ? <div className="section-header">SOURCE LENS</div> : null}
				<div className="mt-4 text-sm text-accent-red">{error}</div>
			</div>
		);
	}

	if (lineCount === 0) {
		return (
			<div className="card p-5">
				{showHeader ? <div className="section-header">SOURCE LENS</div> : null}
				<div className="mt-4 flex flex-col items-center text-center py-4">
					<div className="w-12 h-12 rounded-full bg-bg-primary flex items-center justify-center mb-3">
						<HelpCircle className="w-5 h-5 text-text-muted" />
					</div>
					<p className="text-sm text-text-tertiary mb-1">No attribution data</p>
					<p className="text-xs text-text-muted">
						Import a session or attribution note to see line sources
					</p>
					<p className="mt-2 text-[0.6875rem] text-text-muted">
						Attribution is sourced from git notes; no AI detection is performed.
					</p>
				</div>
			</div>
		);
	}

	return null;
}
