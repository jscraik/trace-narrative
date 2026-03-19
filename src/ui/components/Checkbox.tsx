import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import clsx from "clsx";
import { Check } from "lucide-react";

export function Checkbox(props: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
	"aria-label"?: string;
}) {
	const { checked, onCheckedChange, disabled, className } = props;

	return (
		<CheckboxPrimitive.Root
			checked={checked}
			onCheckedChange={(next) => onCheckedChange(next === true)}
			disabled={disabled}
			className={clsx(
				"h-4 w-4 shrink-0 rounded border border-border-light bg-bg-secondary",
				"data-[state=checked]:bg-accent-blue data-[state=checked]:border-accent-blue",
				"disabled:opacity-50 disabled:cursor-not-allowed",
				className,
			)}
			aria-label={props["aria-label"]}
		>
			<CheckboxPrimitive.Indicator className="flex items-center justify-center text-text-inverted">
				<Check className="h-3 w-3" />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}
