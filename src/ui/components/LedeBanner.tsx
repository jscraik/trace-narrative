import { ChevronDown, ChevronRight, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type {
	SurfaceAuthorityCue,
	SurfaceMode,
} from "../views/narrativeSurfaceData";
import { AuthorityCue } from "../views/narrativeSurfaceSections";

interface LedeBannerProps extends SurfaceAuthorityCue {
	mode: SurfaceMode;
	heroTitle: string;
	heroBody: string;
	onJump: () => void;
}

export function LedeBanner({
	mode,
	authorityTier,
	authorityLabel,
	heroTitle,
	heroBody,
	onJump,
}: LedeBannerProps) {
	const storageKey = `lede-collapsed-${mode}`;
	const [collapsed, setCollapsed] = useState<boolean>(() => {
		try {
			const stored = localStorage.getItem(storageKey);
			// Default to collapsed (true) if nothing stored yet.
			return stored === null ? true : stored === "true";
		} catch {
			return true;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(storageKey, String(collapsed));
		} catch {
			// ignore
		}
	}, [collapsed, storageKey]);

	if (collapsed) {
		return (
			<div className="flex h-10 items-center gap-3 rounded-2xl border border-border-subtle bg-bg-secondary px-4">
				<Sparkles
					className="h-3.5 w-3.5 shrink-0 text-accent-violet"
					aria-hidden="true"
				/>
				<span className="text-xs font-medium text-text-muted">
					Shared narrative surface
				</span>
				<span
					className="rounded-full border border-border-light bg-bg-primary px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-widest text-text-muted"
					data-authority-tier={authorityTier}
				>
					{authorityLabel}
				</span>
				<span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
					{heroTitle}
				</span>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						onClick={onJump}
						className="inline-flex items-center gap-1.5 rounded-xl border border-border-light bg-bg-primary px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
					>
						<Search className="h-3 w-3" />
						Jump
					</button>
					<button
						type="button"
						onClick={() => setCollapsed(false)}
						aria-expanded={false}
						aria-controls="lede-body"
						className="inline-flex items-center gap-1 rounded-xl border border-border-light bg-bg-primary px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-border-light hover:text-text-primary"
					>
						<ChevronDown className="h-3 w-3" />
						Expand
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			id="lede-body"
			className="glass-panel rounded-3xl px-5 py-5"
			data-authority-tier={authorityTier}
			data-authority-label={authorityLabel}
		>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="max-w-3xl space-y-3">
					<div className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-primary px-3 py-1 text-xs font-medium text-text-secondary">
						<Sparkles className="h-3.5 w-3.5 text-accent-violet" />
						Shared narrative surface
					</div>
					<AuthorityCue
						authorityTier={authorityTier}
						authorityLabel={authorityLabel}
					/>
					<div>
						<h2 className="text-xl font-semibold text-text-primary">
							{heroTitle}
						</h2>
						<p className="mt-2 text-sm leading-6 text-text-secondary">
							{heroBody}
						</p>
					</div>
				</div>

				<div className="flex shrink-0 flex-col items-end gap-2">
					<button
						type="button"
						onClick={() => setCollapsed(true)}
						aria-expanded={true}
						aria-controls="lede-body"
						className="inline-flex items-center gap-1.5 rounded-xl border border-border-light bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-light hover:text-text-primary"
					>
						<ChevronRight className="h-3.5 w-3.5" />
						Collapse
					</button>
					<button
						type="button"
						onClick={onJump}
						className="inline-flex items-center gap-2 rounded-2xl border border-border-light bg-bg-primary px-4 py-3 text-sm font-medium text-text-secondary transition hover:border-accent-violet-light hover:text-text-primary"
					>
						<Search className="h-4 w-4" />
						Jump into repo evidence
					</button>
				</div>
			</div>
		</div>
	);
}
