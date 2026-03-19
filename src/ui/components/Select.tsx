import * as SelectPrimitive from "@radix-ui/react-select";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";

export function Select(props: {
	value: string;
	onValueChange: (value: string) => void;
	"aria-label"?: string;
	items: Array<{ value: string; label: string }>;
	triggerClassName?: string;
}) {
	const { value, onValueChange, items, triggerClassName } = props;

	return (
		<SelectPrimitive.Root value={value} onValueChange={onValueChange}>
			<SelectPrimitive.Trigger
				aria-label={props["aria-label"]}
				className={clsx(
					"inline-flex items-center justify-between gap-2 rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-xs text-text-secondary",
					"min-w-[8.75rem]",
					triggerClassName,
				)}
			>
				<SelectPrimitive.Value />
				<SelectPrimitive.Icon className="text-text-muted">
					<ChevronDown className="h-3.5 w-3.5" />
				</SelectPrimitive.Icon>
			</SelectPrimitive.Trigger>

			<SelectPrimitive.Portal>
				<SelectPrimitive.Content
					className={clsx(
						"z-50 overflow-hidden rounded-lg border border-border-light bg-bg-secondary shadow-lg",
						"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
						"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
					)}
					position="popper"
					sideOffset={6}
				>
					<SelectPrimitive.Viewport className="p-1">
						{items.map((item) => (
							<SelectPrimitive.Item
								key={item.value}
								value={item.value}
								className={clsx(
									"relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-xs text-text-secondary outline-none",
									"data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary",
								)}
							>
								<SelectPrimitive.ItemText>
									{item.label}
								</SelectPrimitive.ItemText>
								<SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center text-accent-blue">
									<Check className="h-3.5 w-3.5" />
								</SelectPrimitive.ItemIndicator>
							</SelectPrimitive.Item>
						))}
					</SelectPrimitive.Viewport>
				</SelectPrimitive.Content>
			</SelectPrimitive.Portal>
		</SelectPrimitive.Root>
	);
}
