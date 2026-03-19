import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../fixtures/otel/codex-otel-sample.json";
import {
	codexOtelEventsToTraceRecords,
	otelEnvelopeToCodexEvents,
} from "../otelAdapter";

vi.mock("../git", () => ({
	getCommitDetails: vi.fn(),
	getHeadSha: vi.fn(),
}));

vi.mock("../../tauri/gitDiff", () => ({
	getCommitAddedRanges: vi.fn(),
}));

const fixtureRaw = JSON.stringify(fixture);

const commitSha = "abc123";
const filePath = "src/App.tsx";

function buildFixture() {
	return fixtureRaw
		.replace("__COMMIT_SHA__", commitSha)
		.replace("__FILE_PATH__", filePath);
}

describe("otelAdapter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("extracts Codex OTel events from a log envelope", () => {
		const events = otelEnvelopeToCodexEvents(buildFixture());
		expect(events).toHaveLength(1);
		expect(events[0]?.attributes.commit_sha?.[0]).toBe(commitSha);
		expect(events[0]?.attributes.file_paths?.[0]).toBe(filePath);
	});

	it("builds trace records from Codex OTel events", async () => {
		const { getCommitDetails, getHeadSha } = await import("../git");
		const { getCommitAddedRanges } = await import("../../tauri/gitDiff");

		vi.mocked(getHeadSha).mockResolvedValue(commitSha);
		vi.mocked(getCommitDetails).mockResolvedValue({
			fileChanges: [{ path: filePath, additions: 2, deletions: 0 }],
		} as never);

		vi.mocked(getCommitAddedRanges).mockResolvedValue([{ start: 1, end: 2 }]);

		const events = otelEnvelopeToCodexEvents(buildFixture());
		const conversion = await codexOtelEventsToTraceRecords({
			repoRoot: "/repo",
			events,
		});

		expect(conversion.errors).toHaveLength(0);
		expect(conversion.records).toHaveLength(1);
		expect(conversion.records[0]?.vcs.revision).toBe(commitSha);
		expect(conversion.records[0]?.files[0]?.path).toBe(filePath);
	});

	it("reports missing commit SHA", async () => {
		const { getCommitDetails, getHeadSha } = await import("../git");
		const { getCommitAddedRanges } = await import("../../tauri/gitDiff");
		const fallbackSha = "head456";
		const events = [{ timestampISO: new Date().toISOString(), attributes: {} }];

		vi.mocked(getHeadSha).mockResolvedValue(fallbackSha);
		vi.mocked(getCommitDetails).mockResolvedValue({
			fileChanges: [{ path: filePath, additions: 1, deletions: 0 }],
		} as never);
		vi.mocked(getCommitAddedRanges).mockResolvedValue([]);
		const conversion = await codexOtelEventsToTraceRecords({
			repoRoot: "/repo",
			events,
		});

		expect(conversion.records).toHaveLength(1);
		expect(conversion.records[0]?.vcs.revision).toBe(fallbackSha);
		expect(
			conversion.errors.some((error) =>
				/missing commit sha/i.test(error.message),
			),
		).toBe(true);
	});
});
