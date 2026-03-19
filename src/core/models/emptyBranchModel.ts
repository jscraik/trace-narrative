import type { BranchViewModel } from "../types";

export const EMPTY_BRANCH_MODEL: BranchViewModel = {
	source: "git",
	title: "",
	status: "open",
	description: "",
	stats: {
		added: 0,
		removed: 0,
		files: 0,
		commits: 0,
		prompts: 0,
		responses: 0,
	},
	intent: [],
	timeline: [],
	snapshots: [],
};
