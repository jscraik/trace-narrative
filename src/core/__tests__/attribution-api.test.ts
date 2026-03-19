import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	computeTrend,
	formatAiPercentage,
	formatToolName,
	getBadgeStyle,
	getTrendColor,
	type TrendContext,
	timeRangeToDateRange,
} from "../attribution-api";

describe("attribution-api", () => {
	describe("timeRangeToDateRange", () => {
		const mockDate = new Date("2024-01-15T12:00:00Z");

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(mockDate);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should return custom range when object with from/to is passed", () => {
			const customRange = { from: "2024-01-01", to: "2024-01-31" };
			const result = timeRangeToDateRange(customRange);
			expect(result).toEqual({ from: "2024-01-01", to: "2024-01-31" });
		});

		it("should calculate 7d range correctly", () => {
			const result = timeRangeToDateRange("7d");
			expect(result.from).toBe("2024-01-08");
			expect(result.to).toBe("2024-01-15");
		});

		it("should calculate 30d range correctly", () => {
			const result = timeRangeToDateRange("30d");
			expect(result.from).toBe("2023-12-16");
			expect(result.to).toBe("2024-01-15");
		});

		it("should calculate 90d range correctly", () => {
			const result = timeRangeToDateRange("90d");
			expect(result.from).toBe("2023-10-17");
			expect(result.to).toBe("2024-01-15");
		});

		it("should calculate all time range (100 years back)", () => {
			const result = timeRangeToDateRange("all");
			expect(result.from).toBe("1924-01-15");
			expect(result.to).toBe("2024-01-15");
		});
	});

	describe("computeTrend", () => {
		it("should return undefined when previous is undefined", () => {
			expect(computeTrend(50, undefined)).toBeUndefined();
		});

		it("should return neutral for differences less than 0.01", () => {
			expect(computeTrend(50, 50)).toBe("neutral");
			expect(computeTrend(50, 50.005)).toBe("neutral");
		});

		it("should return up when current > previous", () => {
			expect(computeTrend(60, 50)).toBe("up");
		});

		it("should return down when current < previous", () => {
			expect(computeTrend(40, 50)).toBe("down");
		});

		it("should handle negative values correctly", () => {
			expect(computeTrend(-5, -10)).toBe("up");
			expect(computeTrend(-15, -10)).toBe("down");
		});
	});

	describe("getTrendColor", () => {
		it("should return neutral style for neutral direction", () => {
			const context: TrendContext = {
				metric: "ai-percentage",
				direction: "neutral",
				currentValue: 50,
				previousValue: 50,
			};
			const result = getTrendColor(context);
			expect(result.color).toBe("text-text-muted");
			expect(result.label).toBe("No change");
			expect(result.icon).toBe("minus");
		});

		it("should return green/up for ai-percentage going up", () => {
			const context: TrendContext = {
				metric: "ai-percentage",
				direction: "up",
				currentValue: 60,
				previousValue: 50,
			};
			const result = getTrendColor(context);
			expect(result.color).toBe("text-accent-green");
			expect(result.label).toBe("+20.0% from last period");
			expect(result.icon).toBe("trending_up");
		});

		it("should return red/down for commits going up (fewer commits is good)", () => {
			const context: TrendContext = {
				metric: "commits",
				direction: "up",
				currentValue: 60,
				previousValue: 50,
			};
			const result = getTrendColor(context);
			expect(result.color).toBe("text-accent-red");
		});

		it("should return green for commits going down", () => {
			const context: TrendContext = {
				metric: "commits",
				direction: "down",
				currentValue: 40,
				previousValue: 50,
			};
			const result = getTrendColor(context);
			expect(result.color).toBe("text-accent-green");
		});

		it("should return red for human-lines going down", () => {
			const context: TrendContext = {
				metric: "human-lines",
				direction: "down",
				currentValue: 40,
				previousValue: 50,
			};
			const result = getTrendColor(context);
			expect(result.color).toBe("text-accent-red");
		});

		it("should handle ai-lines as context-dependent (neutral/red)", () => {
			const context: TrendContext = {
				metric: "ai-lines",
				direction: "up",
				currentValue: 60,
				previousValue: 50,
			};
			const result = getTrendColor(context);
			expect(result.color).toBe("text-accent-red");
		});

		it("should calculate delta percentage correctly", () => {
			const context: TrendContext = {
				metric: "ai-percentage",
				direction: "up",
				currentValue: 75,
				previousValue: 50,
			};
			const result = getTrendColor(context);
			expect(result.label).toBe("+50.0% from last period");
		});
	});

	describe("formatAiPercentage", () => {
		it("should return 0% for zero", () => {
			expect(formatAiPercentage(0)).toBe("0%");
		});

		it("should return <1% for values less than 1", () => {
			expect(formatAiPercentage(0.5)).toBe("<1%");
			expect(formatAiPercentage(0.9)).toBe("<1%");
		});

		it("should round to nearest integer", () => {
			expect(formatAiPercentage(45.4)).toBe("45%");
			expect(formatAiPercentage(45.6)).toBe("46%");
		});

		it("should handle 100%", () => {
			expect(formatAiPercentage(100)).toBe("100%");
		});
	});

	describe("formatToolName", () => {
		it("should map known tool IDs to display names", () => {
			expect(formatToolName("claude_code")).toBe("Claude");
			expect(formatToolName("cursor")).toBe("Cursor");
			expect(formatToolName("copilot")).toBe("Copilot");
			expect(formatToolName("codex")).toBe("Codex");
			expect(formatToolName("gemini")).toBe("Gemini");
			expect(formatToolName("continue")).toBe("Continue");
		});

		it("should return unknown tools as-is", () => {
			expect(formatToolName("unknown_tool")).toBe("unknown_tool");
			expect(formatToolName("custom")).toBe("custom");
		});

		it("should handle empty string", () => {
			expect(formatToolName("")).toBe("");
		});
	});

	describe("getBadgeStyle", () => {
		it("should return AI badge for >= 80%", () => {
			const style = getBadgeStyle(80);
			expect(style.label).toBe("AI");
			expect(style.bg).toBe("bg-accent-green-bg");
			expect(style.text).toBe("text-accent-green");
		});

		it("should return Mixed badge for 40-79%", () => {
			const style = getBadgeStyle(40);
			expect(style.label).toBe("Mixed");
			expect(style.bg).toBe("bg-accent-amber-bg");

			const style2 = getBadgeStyle(79);
			expect(style2.label).toBe("Mixed");
		});

		it("should return Low AI badge for 1-39%", () => {
			const style = getBadgeStyle(1);
			expect(style.label).toBe("Low AI");
			expect(style.bg).toBe("bg-accent-blue-bg");

			const style2 = getBadgeStyle(39);
			expect(style2.label).toBe("Low AI");
		});

		it("should return Human badge for 0%", () => {
			const style = getBadgeStyle(0);
			expect(style.label).toBe("Human");
			expect(style.bg).toBe("bg-bg-page");
			expect(style.text).toBe("text-text-secondary");
		});
	});
});
