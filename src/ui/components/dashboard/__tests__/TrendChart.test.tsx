import { render, screen } from "@testing-library/react";
import * as echarts from "echarts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureTrend2k, fixtureTrend20k } from "../__fixtures__/trendFixtures";
import { TrendChart } from "../TrendChart";

let mockTheme: "dark" | "light" = "dark";
const mockSetOption = vi.fn();

vi.mock("@design-studio/tokens", () => ({
	useTheme: () => ({
		theme: mockTheme,
		setTheme: vi.fn(),
	}),
}));

vi.mock("echarts", async () => {
	const actual = await vi.importActual<typeof import("echarts")>("echarts");
	return {
		...actual,
		init: vi.fn(() => ({
			setOption: mockSetOption,
			resize: vi.fn(),
			dispose: vi.fn(),
			getOption: vi.fn().mockReturnValue(undefined),
		})),
	};
});

// Mock ResizeObserver
class MockResizeObserver {
	observe() {
		/* no-op mock */
	}
	unobserve() {
		/* no-op mock */
	}
	disconnect() {
		/* no-op mock */
	}
}
window.ResizeObserver = MockResizeObserver;

// Mock matchMedia to not exist by default (simulates happy-dom)
const originalMatchMedia = window.matchMedia;
const originalGetComputedStyle = window.getComputedStyle;

function createThemeVariables(theme: "dark" | "light") {
	return theme === "dark"
		? {
				"--border-light": "rgb(40, 48, 70)",
				"--border-subtle": "rgb(30, 36, 56)",
				"--text-primary": "rgb(244, 247, 255)",
				"--text-muted": "rgb(153, 161, 185)",
				"--accent-violet": "rgb(139, 92, 246)",
				"--accent-green": "rgb(16, 185, 129)",
			}
		: {
				"--border-light": "rgb(206, 213, 232)",
				"--border-subtle": "rgb(225, 229, 242)",
				"--text-primary": "rgb(20, 24, 38)",
				"--text-muted": "rgb(94, 102, 122)",
				"--accent-violet": "rgb(124, 58, 237)",
				"--accent-green": "rgb(5, 150, 105)",
			};
}

describe("TrendChart", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockTheme = "dark";
		// Restore to original or undefined per test env
		window.matchMedia = originalMatchMedia;
		window.getComputedStyle = vi.fn((() => ({
			getPropertyValue: (variableName: string) =>
				createThemeVariables(mockTheme)[
					variableName as keyof ReturnType<typeof createThemeVariables>
				] ?? "",
		})) as unknown as typeof window.getComputedStyle);
	});

	afterEach(() => {
		window.getComputedStyle = originalGetComputedStyle;
	});

	it("uses SVG renderer for low density data (2k points)", () => {
		render(<TrendChart trend={fixtureTrend2k} />);
		expect(echarts.init).toHaveBeenCalledWith(
			expect.anything(),
			undefined,
			expect.objectContaining({ renderer: "svg" }),
		);
	});

	it("switches to canvas renderer for medium density data (>2k points)", () => {
		render(<TrendChart trend={fixtureTrend20k} />);
		expect(echarts.init).toHaveBeenCalledWith(
			expect.anything(),
			undefined,
			expect.objectContaining({ renderer: "canvas" }),
		);
	}, 30000);

	it("renders strategy info label", () => {
		render(<TrendChart trend={fixtureTrend2k} />);
		expect(screen.getByText(/Activity Trend/i)).toBeInTheDocument();
	});

	it("shows accessible table when trend data is empty", () => {
		render(<TrendChart trend={[]} />);
		// With empty data, strategy is SVG, but chart will still render
		expect(screen.getByText(/Activity Trend/i)).toBeInTheDocument();
	});

	it("recomputes chart colors when the theme changes", () => {
		const { rerender } = render(<TrendChart trend={fixtureTrend2k} />);

		expect(mockSetOption).toHaveBeenLastCalledWith(
			expect.objectContaining({
				legend: expect.objectContaining({
					textStyle: expect.objectContaining({ color: "rgb(153, 161, 185)" }),
				}),
			}),
		);

		mockTheme = "light";
		rerender(<TrendChart trend={fixtureTrend2k} />);

		expect(mockSetOption).toHaveBeenLastCalledWith(
			expect.objectContaining({
				legend: expect.objectContaining({
					textStyle: expect.objectContaining({ color: "rgb(94, 102, 122)" }),
				}),
				tooltip: expect.objectContaining({
					textStyle: expect.objectContaining({ color: "rgb(20, 24, 38)" }),
				}),
			}),
		);
	});
});
