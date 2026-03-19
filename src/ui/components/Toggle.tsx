import type { HTMLAttributes } from "react";

interface ToggleProps
	extends Omit<HTMLAttributes<HTMLButtonElement>, "onChange"> {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
}

export function Toggle({
	checked,
	onCheckedChange,
	disabled,
	className,
	...props
}: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => !disabled && onCheckedChange(!checked)}
			disabled={disabled}
			className={`
        relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary
        ${checked ? "bg-accent-violet" : "bg-border-medium"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className ?? ""}
      `}
			{...props}
		>
			<span
				className={`
          inline-block h-3.5 w-3.5 transform rounded-full bg-bg-primary transition-transform shadow-sm
          ${checked ? "translate-x-5" : "translate-x-1"}
        `}
			/>
		</button>
	);
}
