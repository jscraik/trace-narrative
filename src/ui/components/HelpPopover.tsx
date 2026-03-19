import { HelpCircle } from "lucide-react";
import { useState } from "react";

interface HelpPopoverProps {
	content: string | React.ReactNode;
	label?: string;
}

export function HelpPopover({ content, label }: HelpPopoverProps) {
	const [open, setOpen] = useState(false);

	return (
		<div className="relative inline-flex">
			<button
				type="button"
				className={`inline-flex items-center text-text-tertiary transition-colors hover:text-text-secondary ${open ? "text-accent-blue" : ""}`}
				aria-label={label ?? "Show help"}
				aria-expanded={open}
				onClick={(e) => {
					e.stopPropagation();
					setOpen(!open);
				}}
			>
				<HelpCircle className="h-3.5 w-3.5" />
			</button>

			{open && (
				<>
					<button
						type="button"
						className="fixed inset-0 z-40 bg-transparent"
						onClick={() => setOpen(false)}
						onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
						aria-label="Close help"
					/>
					<div className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-border-light bg-bg-secondary p-3 shadow-lg animate-in fade-in zoom-in-95 duration-100 origin-top text-left">
						<div className="text-xs text-text-secondary leading-relaxed">
							{content}
						</div>
					</div>
				</>
			)}
		</div>
	);
}
