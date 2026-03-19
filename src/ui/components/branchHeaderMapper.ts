import type {
	BranchHeaderMetricSet,
	BranchHeaderViewModel,
	BranchViewModel,
	DashboardFilter,
	HeaderMetric,
	HeaderMetricUnavailableReason,
} from "../../core/types";

type BranchMode = "demo" | "repo" | "docs" | "dashboard";
type RepoStatus = "idle" | "loading" | "ready" | "error";

export interface BranchHeaderDeriveInput {
	mode: BranchMode;
	repoStatus: RepoStatus;
	model: BranchViewModel | null;
	dashboardFilter?: DashboardFilter | null;
	featureEnabled?: boolean;
	shellMessage?: string;
}

const GENERIC_REPO_DESCRIPTION =
	"Recent branch activity and code-change summary.";
const GENERIC_DEMO_DESCRIPTION = "Narrative view of this branch activity.";

function known(value: number): HeaderMetric {
	return { kind: "known", value };
}

function unavailable(reason: HeaderMetricUnavailableReason): HeaderMetric {
	return { kind: "unavailable", reason };
}

function isAbsolutePathLike(value: string): boolean {
	return /^(\/|~\/|[A-Za-z]:[\\/])/.test(value.trim());
}

function deriveTraceMetricReason(
	model: BranchViewModel,
): HeaderMetricUnavailableReason | null {
	if (model.source !== "git") return null;

	const state = model.traceStatus?.state;
	if (!state || state === "inactive") return "NO_TRACE_DATA";
	if (state === "error") return "ERROR";
	return null;
}

function deriveTitle(model: BranchViewModel): string {
	const primary = model.title.trim();
	if (primary) return primary;

	const branch = model.meta?.branchName?.trim();
	if (branch) return branch;

	const headSha = model.meta?.headSha?.trim();
	if (headSha) return headSha.slice(0, 7);

	if (model.source === "demo") return "Feature narrative";
	return "Repository overview";
}

function buildIntentSummary(model: BranchViewModel): string | null {
	const entries = model.intent
		.map((item) => item.text.trim())
		.filter(Boolean)
		.slice(0, 2);

	if (entries.length === 0) return null;
	if (entries.length === 1) return entries[0];
	return `${entries[0]} · ${entries[1]}`;
}

function deriveDescription(model: BranchViewModel): string {
	const narrativeSummary = model.narrative?.summary?.trim();
	if (narrativeSummary) return narrativeSummary;

	const rawDescription = model.description.trim();
	const repoPath = model.meta?.repoPath?.trim();
	const pathOnlyDescription =
		rawDescription.length > 0 &&
		(rawDescription === repoPath || isAbsolutePathLike(rawDescription));

	if (rawDescription && !pathOnlyDescription) {
		return rawDescription;
	}

	const intentSummary = buildIntentSummary(model);
	if (intentSummary) return intentSummary;

	return model.source === "git"
		? GENERIC_REPO_DESCRIPTION
		: GENERIC_DEMO_DESCRIPTION;
}

function deriveMetrics(model: BranchViewModel): BranchHeaderMetricSet {
	const reason = deriveTraceMetricReason(model);

	return {
		added: known(model.stats.added),
		removed: known(model.stats.removed),
		files: known(model.stats.files),
		commits: known(model.stats.commits),
		prompts: reason ? unavailable(reason) : known(model.stats.prompts),
		responses: reason ? unavailable(reason) : known(model.stats.responses),
	};
}

export function deriveLegacyBranchHeaderViewModel(
	model: BranchViewModel,
	dashboardFilter?: DashboardFilter | null,
): BranchHeaderViewModel {
	return {
		kind: "full",
		title: model.title,
		status: model.status,
		description: model.description,
		metrics: {
			added: known(model.stats.added),
			removed: known(model.stats.removed),
			files: known(model.stats.files),
			commits: known(model.stats.commits),
			prompts: known(model.stats.prompts),
			responses: known(model.stats.responses),
		},
		isFilteredView: Boolean(dashboardFilter),
	};
}

export function deriveBranchHeaderViewModel(
	input: BranchHeaderDeriveInput,
): BranchHeaderViewModel {
	const {
		mode,
		repoStatus,
		model,
		dashboardFilter,
		featureEnabled = true,
		shellMessage,
	} = input;

	if (!featureEnabled) {
		return { kind: "hidden", reason: "feature_disabled" };
	}

	if (mode !== "repo" && mode !== "demo") {
		return { kind: "hidden", reason: "mode_unsupported" };
	}

	if (mode === "repo" && repoStatus === "idle") {
		return { kind: "hidden", reason: "repo_idle" };
	}

	if (mode === "repo" && repoStatus === "loading") {
		return {
			kind: "shell",
			state: "loading",
			message: shellMessage ?? "Loading repository context…",
		};
	}

	if (mode === "repo" && repoStatus === "error") {
		return {
			kind: "shell",
			state: "error",
			message: shellMessage ?? "Unable to load repository context.",
		};
	}

	if (!model) {
		return { kind: "hidden", reason: "model_missing" };
	}

	return {
		kind: "full",
		title: deriveTitle(model),
		status: model.status,
		description: deriveDescription(model),
		metrics: deriveMetrics(model),
		isFilteredView: Boolean(dashboardFilter),
	};
}

export interface RequestIdentityInput {
	repoKey?: string | null;
	mode: "repo" | "demo";
	filter?: DashboardFilter | null;
}

function stableSerialize(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
	}
	if (value && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, entry]) => entry !== undefined)
			.sort(([a], [b]) => a.localeCompare(b));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

export function normalizeRepoKey(repoKey?: string | null): string {
	if (!repoKey) return "repo:none";
	const normalized = repoKey
		.trim()
		.replace(/\\/g, "/")
		.replace(/\/+$/g, "")
		.toLowerCase();
	return normalized || "repo:none";
}

export function normalizeFilterKey(filter?: DashboardFilter | null): string {
	if (!filter) return "filter:none";
	return `filter:${stableSerialize(filter)}`;
}

export function createBranchHeaderRequestIdentityKey(
	input: RequestIdentityInput,
): string {
	const repoKey = normalizeRepoKey(input.repoKey);
	const mode = input.mode;
	const filterKey = normalizeFilterKey(input.filter);
	return `${repoKey}|mode:${mode}|${filterKey}`;
}
