import clsx from "clsx";
import { getToneStyles, type Tone } from "../utils/tone";

interface DetailBadgeProps {
	children: React.ReactNode;
	tone?: Tone;
	className?: string;
	variant?: "outline" | "filled";
}

export function DetailBadge({
	children,
	tone = "neutral",
	className,
	variant = "filled",
}: DetailBadgeProps) {
	const styles = getToneStyles(tone);
	return (
		<span
			className={clsx(
				"inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
				variant === "filled"
					? [styles.bg, styles.text, "border", styles.border]
					: [styles.text, "border", styles.border],
				className,
			)}
		>
			{children}
		</span>
	);
}
