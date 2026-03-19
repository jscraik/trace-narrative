import type { TimeRangePreset } from "../../../core/types";

export const TIME_RANGE_PRESETS: Array<{
	value: TimeRangePreset;
	label: string;
}> = [
	{ value: "7d", label: "Last 7 days" },
	{ value: "30d", label: "Last 30 days" },
	{ value: "90d", label: "Last 90 days" },
	{ value: "all", label: "All time" },
];
