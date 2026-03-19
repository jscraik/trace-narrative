import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FireflySignal } from "../FireflySignal";

function mockMatchMedia(prefersReducedMotion: boolean) {
	const listeners = new Set<(event: MediaQueryListEvent) => void>();

	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((query: string) => ({
			matches:
				query === "(prefers-reduced-motion: reduce)"
					? prefersReducedMotion
					: false,
			media: query,
			onchange: null,
			addEventListener: (
				_type: string,
				listener: (event: MediaQueryListEvent) => void,
			) => {
				listeners.add(listener);
			},
			removeEventListener: (
				_type: string,
				listener: (event: MediaQueryListEvent) => void,
			) => {
				listeners.delete(listener);
			},
			dispatchEvent: (event: Event) => {
				listeners.forEach((listener) => {
					listener(event as MediaQueryListEvent);
				});
				return true;
			},
		})),
	);
}

describe("FireflySignal", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders semantic state classes for non-reduced motion", () => {
		mockMatchMedia(false);

		render(
			<FireflySignal
				x={12}
				y={24}
				event={{
					type: "analyzing",
					selectedNodeId: "c1",
					pendingLoaders: ["files", "trace"],
					pendingKey: "files|trace",
				}}
			/>,
		);

		const signal = screen.getByTestId("firefly-signal");
		expect(signal).toHaveAttribute("data-state", "analyzing");
		expect(signal).toHaveAttribute("data-reduced-motion", "false");

		const orb = signal.querySelector(".firefly-orb");
		expect(orb).not.toBeNull();
		expect(orb?.className).toContain("firefly-analyzing");
		expect(orb?.className).toContain("animate-firefly-analyzing");
	});

	it("uses static classes when prefers-reduced-motion is enabled", () => {
		mockMatchMedia(true);

		render(
			<FireflySignal
				x={0}
				y={0}
				event={{
					type: "insight",
					selectedNodeId: "c2",
					selectedCommitSha: "c2",
					insightKey: "c2:c2:1:0:0:0:model:tool",
				}}
			/>,
		);

		const signal = screen.getByTestId("firefly-signal");
		expect(signal).toHaveAttribute("data-state", "insight");
		expect(signal).toHaveAttribute("data-reduced-motion", "true");

		const orb = signal.querySelector(".firefly-orb");
		expect(orb?.className).toContain("firefly-insight-static");
		expect(orb?.className).not.toContain("animate-firefly-insight");
	});

	it("hides the signal when disabled", () => {
		mockMatchMedia(false);

		render(
			<FireflySignal
				x={10}
				y={10}
				event={{ type: "tracking", selectedNodeId: "c3" }}
				disabled
			/>,
		);

		expect(screen.queryByTestId("firefly-signal")).not.toBeInTheDocument();
	});
});
