import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";

/**
 * Reusable confirmation dialog for destructive actions.
 *
 * Used for:
 * - Unlinking sessions from commits
 * - Future destructive actions (delete, reset, etc.)
 *
 * Accessibility:
 * - Focus trap (tab stays within dialog)
 * - Escape to cancel
 * - ARIA attributes for screen readers
 *
 * Evidence: UX Spec 2026-01-29 Section 8, Dialog component specification
 */

export interface DialogProps {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "default" | "destructive";
	open: boolean;
	onConfirm: () => void;
	onClose: () => void;
}

export function Dialog({
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	variant = "default",
	open,
	onConfirm,
	onClose,
}: DialogProps) {
	const isDestructive = variant === "destructive";

	return (
		<DialogPrimitive.Root
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && open) onClose();
			}}
		>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay
					className={clsx(
						"fixed inset-0 z-50",
						"bg-[var(--overlay)]",
						"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					)}
				/>
				<DialogPrimitive.Content
					className={clsx(
						"fixed left-1/2 top-1/2 z-50 w-[25rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
						"rounded-xl border border-border-light bg-bg-secondary p-5 shadow-xl",
						"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
						"data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
					)}
				>
					<DialogPrimitive.Title className="text-lg font-semibold text-text-primary">
						{title}
					</DialogPrimitive.Title>
					<DialogPrimitive.Description className="mt-3 text-sm text-text-secondary">
						{message}
					</DialogPrimitive.Description>

					<div className="mt-5 flex justify-end gap-3">
						<DialogPrimitive.Close asChild>
							<button
								type="button"
								className={clsx(
									"rounded-md px-3 py-1.5 text-sm transition duration-200 ease-out active:duration-75 active:scale-[0.98]",
									"bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border-light",
								)}
							>
								{cancelLabel}
							</button>
						</DialogPrimitive.Close>
						<DialogPrimitive.Close asChild>
							<button
								type="button"
								className={clsx(
									"rounded-md px-3 py-1.5 text-sm transition duration-200 ease-out active:duration-75 active:scale-[0.98]",
									isDestructive
										? "bg-accent-red-bg text-accent-red hover:bg-accent-red-light border border-accent-red-light"
										: "bg-surface-strong text-text-inverted hover:bg-surface-strong-hover",
								)}
								onClick={onConfirm}
							>
								{confirmLabel}
							</button>
						</DialogPrimitive.Close>
					</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
