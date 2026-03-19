import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoryAnchorsPanel } from "../StoryAnchorsPanel";

const mockExportSessionLinkNote = vi.hoisted(() => vi.fn());
const mockGetStoryAnchorStatus = vi.hoisted(() => vi.fn());
const mockGetRepoHooksStatus = vi.hoisted(() => vi.fn());
const mockImportSessionLinkNotesBatch = vi.hoisted(() => vi.fn());
const mockInstallRepoHooks = vi.hoisted(() => vi.fn());
const mockMigrateAttributionNotesRef = vi.hoisted(() => vi.fn());
const mockReconcileAfterRewrite = vi.hoisted(() => vi.fn());
const mockUninstallRepoHooks = vi.hoisted(() => vi.fn());

vi.mock("../../../core/story-anchors-api", () => ({
	exportSessionLinkNote: mockExportSessionLinkNote,
	getStoryAnchorStatus: mockGetStoryAnchorStatus,
	getRepoHooksStatus: mockGetRepoHooksStatus,
	importSessionLinkNotesBatch: mockImportSessionLinkNotesBatch,
	installRepoHooks: mockInstallRepoHooks,
	migrateAttributionNotesRef: mockMigrateAttributionNotesRef,
	reconcileAfterRewrite: mockReconcileAfterRewrite,
	uninstallRepoHooks: mockUninstallRepoHooks,
}));

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (error?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("StoryAnchorsPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetRepoHooksStatus.mockResolvedValue({
			installed: false,
			hooksDir: "/repo/.git/hooks",
		});
		mockGetStoryAnchorStatus.mockResolvedValue([
			{
				commitSha: "default",
				hasAttributionNote: false,
				hasSessionsNote: false,
				hasLineageNote: false,
			},
		]);
		mockExportSessionLinkNote.mockResolvedValue({ status: "ok" });
		mockImportSessionLinkNotesBatch.mockResolvedValue({
			imported: 0,
			total: 0,
		});
		mockInstallRepoHooks.mockResolvedValue(undefined);
		mockUninstallRepoHooks.mockResolvedValue(undefined);
		mockMigrateAttributionNotesRef.mockResolvedValue({ migrated: 0, total: 0 });
		mockReconcileAfterRewrite.mockResolvedValue({
			recoveredAttribution: 0,
			recoveredSessions: 0,
			wroteNotes: 0,
		});
	});

	it("ignores stale selected-commit status completion after commit switch", async () => {
		const oldStatusDeferred =
			createDeferred<
				Array<{
					commitSha: string;
					hasAttributionNote: boolean;
					hasSessionsNote: boolean;
					hasLineageNote: boolean;
				}>
			>();

		const oldCommit = "11111111aaaa";
		const newCommit = "22222222bbbb";

		mockGetStoryAnchorStatus.mockImplementation(
			async (_repoId: number, shas: string[]) => {
				if (shas[0] === oldCommit) return oldStatusDeferred.promise;
				return [
					{
						commitSha: newCommit,
						hasAttributionNote: true,
						hasSessionsNote: true,
						hasLineageNote: false,
					},
				];
			},
		);

		const { rerender } = render(
			<StoryAnchorsPanel
				repoId={1}
				repoRoot="/repo"
				selectedCommitSha={oldCommit}
				indexedCommitShas={[]}
			/>,
		);

		await waitFor(() => {
			expect(mockGetStoryAnchorStatus).toHaveBeenCalledWith(1, [oldCommit]);
		});

		rerender(
			<StoryAnchorsPanel
				repoId={1}
				repoRoot="/repo"
				selectedCommitSha={newCommit}
				indexedCommitShas={[]}
			/>,
		);

		await waitFor(() => {
			expect(mockGetStoryAnchorStatus).toHaveBeenCalledWith(1, [newCommit]);
			expect(screen.getByText("Selected commit:")).toBeInTheDocument();
			expect(screen.getByText("22222222")).toBeInTheDocument();
			expect(
				screen.getByText(/Notes:\s+attribution ✓ · sessions\s+✓ · lineage —/),
			).toBeInTheDocument();
		});

		await act(async () => {
			oldStatusDeferred.resolve([
				{
					commitSha: oldCommit,
					hasAttributionNote: false,
					hasSessionsNote: false,
					hasLineageNote: true,
				},
			]);
			await oldStatusDeferred.promise;
			await Promise.resolve();
		});

		expect(screen.getByText("Selected commit:")).toBeInTheDocument();
		expect(screen.getByText("22222222")).toBeInTheDocument();
		expect(
			screen.getByText(/Notes:\s+attribution ✓ · sessions\s+✓ · lineage —/),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/Notes:\s+attribution — · sessions\s+— · lineage ✓/),
		).not.toBeInTheDocument();
	});

	it("ignores stale hooks-status completion from previous repo", async () => {
		const oldHooksDeferred = createDeferred<{
			installed: boolean;
			hooksDir: string;
		}>();

		mockGetRepoHooksStatus.mockImplementation(async (repoId: number) => {
			if (repoId === 1) return oldHooksDeferred.promise;
			return { installed: false, hooksDir: "/repo-2/.git/hooks" };
		});

		const { rerender } = render(
			<StoryAnchorsPanel
				repoId={1}
				repoRoot="/repo-1"
				selectedCommitSha={null}
				indexedCommitShas={[]}
			/>,
		);

		await waitFor(() => {
			expect(mockGetRepoHooksStatus).toHaveBeenCalledWith(1);
		});

		rerender(
			<StoryAnchorsPanel
				repoId={2}
				repoRoot="/repo-2"
				selectedCommitSha={null}
				indexedCommitShas={[]}
			/>,
		);

		await waitFor(() => {
			expect(mockGetRepoHooksStatus).toHaveBeenCalledWith(2);
			expect(screen.getByText(/Hooks: Not installed/)).toBeInTheDocument();
		});

		await act(async () => {
			oldHooksDeferred.resolve({
				installed: true,
				hooksDir: "/repo-1/.git/hooks",
			});
			await oldHooksDeferred.promise;
			await Promise.resolve();
		});

		expect(screen.getByText(/Hooks: Not installed/)).toBeInTheDocument();
	});

	it("does not keep action loading state after repo changes mid-action", async () => {
		const installDeferred = createDeferred<void>();

		mockGetRepoHooksStatus.mockImplementation(async (repoId: number) => {
			if (repoId === 1)
				return { installed: false, hooksDir: "/repo-1/.git/hooks" };
			return { installed: false, hooksDir: "/repo-2/.git/hooks" };
		});
		mockInstallRepoHooks.mockImplementation(async (repoId: number) => {
			if (repoId === 1) return installDeferred.promise;
			return undefined;
		});

		const { rerender } = render(
			<StoryAnchorsPanel
				repoId={1}
				repoRoot="/repo-1"
				selectedCommitSha={null}
				indexedCommitShas={[]}
			/>,
		);

		const installButton = screen.getByRole("button", { name: "Install hooks" });
		fireEvent.click(installButton);

		await waitFor(() => {
			expect(mockInstallRepoHooks).toHaveBeenCalledWith(1);
		});

		rerender(
			<StoryAnchorsPanel
				repoId={2}
				repoRoot="/repo-2"
				selectedCommitSha={null}
				indexedCommitShas={[]}
			/>,
		);

		await waitFor(() => {
			expect(mockGetRepoHooksStatus).toHaveBeenCalledWith(2);
			expect(
				screen.getByRole("button", { name: "Install hooks" }),
			).not.toBeDisabled();
		});

		await act(async () => {
			installDeferred.resolve();
			await installDeferred.promise;
			await Promise.resolve();
		});

		expect(screen.getByText(/Hooks: Not installed/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Install hooks" }),
		).not.toBeDisabled();
	});
});
