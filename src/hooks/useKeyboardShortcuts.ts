import { useCallback, useEffect } from "react";

export type KeyboardShortcut = {
	key: string;
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
	handler: () => void;
	description: string;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			for (const shortcut of shortcuts) {
				const matchesKey =
					event.key.toLowerCase() === shortcut.key.toLowerCase();
				const matchesCtrl =
					!!shortcut.ctrl === (event.ctrlKey || event.metaKey);
				const matchesAlt = !!shortcut.alt === event.altKey;
				const matchesShift = !!shortcut.shift === event.shiftKey;

				if (matchesKey && matchesCtrl && matchesAlt && matchesShift) {
					event.preventDefault();
					shortcut.handler();
					break;
				}
			}
		},
		[shortcuts],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);
}

// Common keyboard shortcuts for the app
export const defaultShortcuts: KeyboardShortcut[] = [
	{
		key: "o",
		ctrl: true,
		handler: () => {
			// Open repo - will be connected to actual handler
			document.dispatchEvent(new CustomEvent("keyboard:open-repo"));
		},
		description: "Open repository",
	},
	{
		key: "i",
		ctrl: true,
		handler: () => {
			// Import session
			document.dispatchEvent(new CustomEvent("keyboard:import-session"));
		},
		description: "Import session",
	},
	{
		key: "r",
		ctrl: true,
		handler: () => {
			// Refresh/reindex
			document.dispatchEvent(new CustomEvent("keyboard:refresh"));
		},
		description: "Refresh repository",
	},
	{
		key: "Escape",
		handler: () => {
			// Close modals/panels
			document.dispatchEvent(new CustomEvent("keyboard:escape"));
		},
		description: "Close modal or panel",
	},
];
