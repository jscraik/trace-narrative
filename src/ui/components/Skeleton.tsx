interface SkeletonProps {
	className?: string;
	count?: number;
}

const SKELETON_KEYS = Array.from({ length: 50 }, (_, idx) => `s-${idx}`);

export function SkeletonLine({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse bg-bg-primary rounded ${className}`}
			aria-hidden="true"
		/>
	);
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
	return (
		<div className="space-y-2" aria-hidden="true">
			{SKELETON_KEYS.slice(0, lines).map((key, i) => (
				<SkeletonLine
					key={key}
					className={`h-4 ${i === lines - 1 ? "w-4/5" : "w-full"}`}
				/>
			))}
		</div>
	);
}

export function SkeletonCard({
	header = true,
	lines = 4,
}: {
	header?: boolean;
	lines?: number;
}) {
	return (
		<div className="card p-5 space-y-4" aria-hidden="true">
			{header && (
				<div className="flex items-center gap-3">
					<SkeletonLine className="h-5 w-5 rounded-full" />
					<SkeletonLine className="h-4 w-32" />
				</div>
			)}
			<SkeletonText lines={lines} />
		</div>
	);
}

export function SkeletonTimeline({ count = 5 }: SkeletonProps) {
	return (
		<div className="flex items-center gap-6 px-4" aria-hidden="true">
			{SKELETON_KEYS.slice(0, count).map((key) => (
				<div key={key} className="flex flex-col items-center gap-2">
					<SkeletonLine className="h-3 w-24" />
					<SkeletonLine className="h-3 w-3 rounded-full" />
					<SkeletonLine className="h-4 w-16" />
				</div>
			))}
		</div>
	);
}

export function SkeletonFiles({ count = 5 }: SkeletonProps) {
	return (
		<div className="space-y-1" aria-hidden="true">
			{SKELETON_KEYS.slice(0, count).map((key) => (
				<div key={key} className="flex items-center justify-between px-4 py-3">
					<SkeletonLine className="h-4 w-48" />
					<div className="flex items-center gap-2">
						<SkeletonLine className="h-3 w-8" />
						<SkeletonLine className="h-3 w-8" />
					</div>
				</div>
			))}
		</div>
	);
}

export function SkeletonIntent({ count = 3 }: SkeletonProps) {
	return (
		<div className="space-y-3" aria-hidden="true">
			{SKELETON_KEYS.slice(0, count).map((key) => (
				<div key={key} className="flex items-start gap-3">
					<SkeletonLine className="h-5 w-5" />
					<div className="flex-1 space-y-2">
						<SkeletonLine className="h-4 w-full" />
						<SkeletonLine className="h-4 w-4/5" />
					</div>
				</div>
			))}
		</div>
	);
}
