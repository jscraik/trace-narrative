import { beforeEach, describe, expect, it, vi } from "vitest";
import { git } from "../git";
import {
	buildAgentNote,
	readAgentNote,
	syncTraceToGitNotes,
	writeAgentNote,
} from "../gitNotes";

vi.mock("../git", () => ({
	git: vi.fn(),
}));

const mockGit = vi.mocked(git);

describe("gitNotes", () => {
	const repoRoot = "/test/repo";
	const commitSha = "abc123";

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("readAgentNote", () => {
		it("should parse agent note from git notes", async () => {
			const note = {
				sessionId: "sess_123",
				model: "claude-4",
				aiPercentage: 67,
				timestamp: "2024-01-01T00:00:00Z",
			};
			mockGit.mockResolvedValue(JSON.stringify(note));

			const result = await readAgentNote(repoRoot, commitSha);

			expect(result).toEqual(note);
			expect(mockGit).toHaveBeenCalledWith(repoRoot, [
				"notes",
				"--namespace=agent",
				"show",
				commitSha,
			]);
		});

		it("should return null if note does not exist", async () => {
			mockGit.mockRejectedValue(new Error("No note"));

			const result = await readAgentNote(repoRoot, commitSha);

			expect(result).toBeNull();
		});
	});

	describe("writeAgentNote", () => {
		it("should write agent note to git notes", async () => {
			const note = {
				sessionId: "sess_123",
				aiPercentage: 67,
				timestamp: "2024-01-01T00:00:00Z",
			};
			mockGit.mockResolvedValue("");

			await writeAgentNote(repoRoot, commitSha, note);

			expect(mockGit).toHaveBeenCalledWith(repoRoot, [
				"notes",
				"--namespace=agent",
				"add",
				"-f",
				"-m",
				JSON.stringify(note, null, 2),
				commitSha,
			]);
		});
	});

	describe("buildAgentNote", () => {
		it("should build agent note from trace summary", () => {
			const traceSummary = {
				commitSha: "abc123",
				aiLines: 10,
				humanLines: 5,
				mixedLines: 0,
				unknownLines: 0,
				aiPercent: 67,
				modelIds: ["claude-4-opus"],
				toolNames: ["claude-code"],
			};

			const note = buildAgentNote(traceSummary, "sess_456");

			expect(note.model).toBe("claude-4-opus");
			expect(note.tool).toBe("claude-code");
			expect(note.aiPercentage).toBe(67);
			expect(note.sessionId).toBe("sess_456");
			expect(note.timestamp).toBeDefined();
		});
	});

	describe("syncTraceToGitNotes", () => {
		it("should sync trace summary to git notes", async () => {
			const traceSummary = {
				commitSha: "abc123",
				aiLines: 10,
				humanLines: 5,
				mixedLines: 0,
				unknownLines: 0,
				aiPercent: 67,
				modelIds: ["claude-4-opus"],
				toolNames: ["claude-code"],
			};
			mockGit.mockResolvedValue("");

			await syncTraceToGitNotes(repoRoot, commitSha, traceSummary, "sess_789");

			expect(mockGit).toHaveBeenCalledWith(
				repoRoot,
				expect.arrayContaining([
					"notes",
					"--namespace=agent",
					"add",
					"-f",
					"-m",
				]),
			);
		});
	});
});
