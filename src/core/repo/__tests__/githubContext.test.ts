import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadGitHubContext } from "../githubContext";

const listNarrativeFiles = vi.fn();
const readNarrativeFile = vi.fn();

vi.mock("../../tauri/narrativeFs", () => ({
	listNarrativeFiles: (...args: unknown[]) => listNarrativeFiles(...args),
	readNarrativeFile: (...args: unknown[]) => readNarrativeFile(...args),
}));

describe("loadGitHubContext", () => {
	beforeEach(() => {
		listNarrativeFiles.mockReset();
		readNarrativeFile.mockReset();
	});

	it("returns sanitized entries when connector files exist", async () => {
		listNarrativeFiles.mockResolvedValue(["connectors/github/latest.json"]);
		readNarrativeFile.mockResolvedValue(
			JSON.stringify({
				pull_request: {
					number: 12,
					title: "Feature <script>alert(1)</script>",
					body: "Token: ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					html_url: "https://github.com/org/repo/pull/12",
				},
				review_summary: "Looks good overall",
			}),
		);

		const state = await loadGitHubContext("/tmp/repo");
		expect(state.status).toBe("ready");
		expect(state.entries.length).toBe(1);
		expect(state.entries[0].title).not.toContain("<script>");
		expect(state.entries[0].redactionHits).toBeGreaterThanOrEqual(1);
	});

	it("returns empty when no connector files are found", async () => {
		listNarrativeFiles.mockResolvedValue([]);
		const state = await loadGitHubContext("/tmp/repo");
		expect(state.status).toBe("empty");
	});

	it("returns partial when at least one file loads and others fail", async () => {
		listNarrativeFiles.mockResolvedValue([
			"connectors/github/latest.json",
			"connectors/github/bad.json",
		]);
		readNarrativeFile.mockImplementation(
			async (repoRoot: string, file: string) => {
				void repoRoot;
				if (file.endsWith("latest.json")) {
					return JSON.stringify({ title: "Valid context" });
				}
				throw new Error("Parse failure");
			},
		);

		const state = await loadGitHubContext("/tmp/repo");
		expect(state.status).toBe("partial");
		expect(state.entries.length).toBe(1);
		expect(state.failedFileCount).toBe(1);
		expect(state.error).toContain("1");
	});

	it("returns error when all connector files fail to load", async () => {
		listNarrativeFiles.mockResolvedValue(["connectors/github/bad.json"]);
		readNarrativeFile.mockRejectedValue(new Error("Cannot parse"));

		const state = await loadGitHubContext("/tmp/repo");
		expect(state.status).toBe("error");
		expect(state.entries).toHaveLength(0);
		expect(state.failedFileCount).toBe(1);
		expect(state.error).toContain("Failed to load GitHub connector files");
	});
});
