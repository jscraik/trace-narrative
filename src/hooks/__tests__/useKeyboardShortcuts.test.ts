import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	defaultShortcuts,
	useKeyboardShortcuts,
} from "../useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
	const mockHandler = vi.fn();

	const shortcuts = [
		{
			key: "k",
			ctrl: true,
			handler: mockHandler,
			description: "Test shortcut",
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Clean up event listeners — noop handler, cleanup handled by the hook
		window.removeEventListener("keydown", () => {
			/* noop */
		});
	});

	it("should call handler when shortcut is pressed", () => {
		renderHook(() => useKeyboardShortcuts(shortcuts));

		const event = new KeyboardEvent("keydown", {
			key: "k",
			ctrlKey: true,
		});
		window.dispatchEvent(event);

		expect(mockHandler).toHaveBeenCalled();
	});

	it("should not call handler when wrong key is pressed", () => {
		renderHook(() => useKeyboardShortcuts(shortcuts));

		const event = new KeyboardEvent("keydown", {
			key: "j",
			ctrlKey: true,
		});
		window.dispatchEvent(event);

		expect(mockHandler).not.toHaveBeenCalled();
	});

	it("should not call handler when modifier is missing", () => {
		renderHook(() => useKeyboardShortcuts(shortcuts));

		const event = new KeyboardEvent("keydown", {
			key: "k",
		});
		window.dispatchEvent(event);

		expect(mockHandler).not.toHaveBeenCalled();
	});

	it("should have default shortcuts defined", () => {
		expect(defaultShortcuts.length).toBeGreaterThan(0);

		// Check for expected shortcuts
		const openRepo = defaultShortcuts.find((s) =>
			s.description.includes("Open"),
		);
		expect(openRepo).toBeDefined();
		expect(openRepo?.ctrl).toBe(true);
	});
});
