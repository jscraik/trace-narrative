import { useEffect, useState } from "react";
import type { IngestToast as IngestToastType } from "../../hooks/useAutoIngest";

export interface IngestToastProps {
	toast: IngestToastType | null;
}

export function IngestToast(props: IngestToastProps) {
	const { toast } = props;
	const [isExiting, setIsExiting] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);

	useEffect(() => {
		if (toast) {
			setIsExiting(false);
			setShouldRender(true);
		} else {
			setIsExiting(true);
		}
	}, [toast]);

	const handleTransitionEnd = () => {
		if (isExiting) {
			setShouldRender(false);
		}
	};

	if (!shouldRender && !toast) return null;

	return (
		<output
			aria-live="polite"
			aria-atomic="true"
			onTransitionEnd={handleTransitionEnd}
			className={[
				"fixed top-4 right-4 z-50 rounded-lg border border-border-light bg-bg-secondary px-4 py-2 shadow-sm text-xs text-text-secondary",
				"transition duration-200 ease-out",
				isExiting
					? "opacity-0 translate-x-4"
					: "opacity-100 translate-x-0 animate-in slide-in-from-right fade-in",
			].join(" ")}
		>
			{toast?.message}
		</output>
	);
}
