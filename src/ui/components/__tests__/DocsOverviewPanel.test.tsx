import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocsOverviewPanel } from "../DocsOverviewPanel";

const mockEnsureNarrativeDirs = vi.hoisted(() => vi.fn());
const mockListNarrativeFiles = vi.hoisted(() => vi.fn());
const mockReadNarrativeFile = vi.hoisted(() => vi.fn());
const mockWriteNarrativeFile = vi.hoisted(() => vi.fn());

vi.mock("framer-motion", () => ({
	motion: {
		div: ({
			children,
			animate: _animate,
			initial: _initial,
			transition: _transition,
			whileHover: _whileHover,
			...props
		}: {
			children?: ReactNode;
			animate?: unknown;
			initial?: unknown;
			transition?: unknown;
			whileHover?: unknown;
		}) => <div {...props}>{children}</div>,
	},
}));

vi.mock("lucide-react", () => {
	const Icon = () => <span aria-hidden="true" />;
	return {
		BookOpen: Icon,
		ChevronRight: Icon,
		FileText: Icon,
		X: Icon,
	};
});

vi.mock("react-markdown", () => ({
	default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("rehype-raw", () => ({
	default: () => null,
}));

vi.mock("../MermaidDiagram", () => ({
	MermaidDiagram: ({ chart }: { chart: string }) => <pre>{chart}</pre>,
}));

vi.mock("../RepositoryPlaceholderCard", () => ({
	RepositoryPlaceholderCard: () => <div>Repo Placeholder</div>,
}));

vi.mock("../../../core/tauri/narrativeFs", () => ({
	ensureNarrativeDirs: mockEnsureNarrativeDirs,
	listNarrativeFiles: mockListNarrativeFiles,
	readNarrativeFile: mockReadNarrativeFile,
	writeNarrativeFile: mockWriteNarrativeFile,
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

describe("DocsOverviewPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnsureNarrativeDirs.mockResolvedValue(undefined);
		mockWriteNarrativeFile.mockResolvedValue(undefined);
	});

	it("ignores stale document-load completion after rapid doc selection changes", async () => {
		const staleLoadDeferred = createDeferred<string>();
		let initialReadCount = 0;

		mockListNarrativeFiles.mockResolvedValue(["a.md", "b.md"]);
		mockReadNarrativeFile.mockImplementation(
			async (_root: string, path: string) => {
				if (initialReadCount < 2) {
					initialReadCount += 1;
					return path === "a.md" ? "# A Doc" : "# B Doc";
				}
				if (path === "a.md") return staleLoadDeferred.promise;
				if (path === "b.md") return "# B Doc\n\nfresh-b-content";
				return "";
			},
		);

		render(<DocsOverviewPanel repoRoot="/repo" />);

		await waitFor(() => {
			expect(screen.getByText("A Doc")).toBeInTheDocument();
			expect(screen.getByText("B Doc")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("A Doc"));

		await waitFor(() => {
			expect(screen.getByText("a.md")).toBeInTheDocument();
		});

		fireEvent.click(screen.getAllByRole("button")[0]);

		await waitFor(() => {
			expect(screen.getByText("B Doc")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("B Doc"));

		await waitFor(() => {
			expect(screen.getByText(/fresh-b-content/)).toBeInTheDocument();
		});

		await act(async () => {
			staleLoadDeferred.resolve("# A Doc\n\nstale-a-content");
			await staleLoadDeferred.promise;
			await Promise.resolve();
		});

		expect(screen.getByText(/fresh-b-content/)).toBeInTheDocument();
		expect(screen.queryByText(/stale-a-content/)).not.toBeInTheDocument();
	});

	it("ignores stale docs list completion from previous repo root", async () => {
		const oldListDeferred = createDeferred<string[]>();

		mockListNarrativeFiles.mockImplementation(async (root: string) => {
			if (root === "/old") return oldListDeferred.promise;
			if (root === "/new") return ["new.md"];
			return [];
		});

		mockReadNarrativeFile.mockImplementation(
			async (_root: string, path: string) => {
				if (path === "new.md") return "# New Doc";
				if (path === "old.md") return "# Old Doc";
				return "";
			},
		);

		const { rerender } = render(<DocsOverviewPanel repoRoot="/old" />);

		await waitFor(() => {
			expect(mockListNarrativeFiles).toHaveBeenCalledWith("/old", "");
		});

		rerender(<DocsOverviewPanel repoRoot="/new" />);

		await waitFor(() => {
			expect(screen.getByText("New Doc")).toBeInTheDocument();
		});

		await act(async () => {
			oldListDeferred.resolve(["old.md"]);
			await oldListDeferred.promise;
			await Promise.resolve();
		});

		expect(screen.getByText("New Doc")).toBeInTheDocument();
		expect(screen.queryByText("Old Doc")).not.toBeInTheDocument();
	});

	it("clears previous docs immediately on repo root switch", async () => {
		const oldListDeferred = createDeferred<string[]>();

		mockListNarrativeFiles.mockImplementation(async (root: string) => {
			if (root === "/old") return oldListDeferred.promise;
			return ["new.md"];
		});
		mockReadNarrativeFile.mockImplementation(
			async (_root: string, path: string) => {
				if (path === "old.md") return "# Old Doc";
				if (path === "new.md") return "# New Doc";
				return "";
			},
		);

		const { rerender } = render(<DocsOverviewPanel repoRoot="/old" />);

		oldListDeferred.resolve(["old.md"]);
		await waitFor(() => {
			expect(screen.getByText("Old Doc")).toBeInTheDocument();
			expect(screen.getByText(/Old Doc/)).toBeInTheDocument();
		});

		rerender(<DocsOverviewPanel repoRoot="/new" />);

		await waitFor(() => {
			expect(screen.queryByText("Old Doc")).not.toBeInTheDocument();
			expect(screen.getByText("New Doc")).toBeInTheDocument();
		});

		await act(async () => {
			await Promise.resolve();
		});

		expect(screen.queryByText("Old Doc")).not.toBeInTheDocument();
	});

	it("clears selected document when repo root changes", async () => {
		mockListNarrativeFiles.mockImplementation(async (root: string) => {
			if (root === "/old") return ["a.md"];
			if (root === "/new") return ["new.md"];
			return [];
		});

		mockReadNarrativeFile.mockImplementation(
			async (_root: string, path: string) => {
				if (path === "a.md") return "# A Doc\n\nOld content";
				if (path === "new.md") return "# New Doc";
				return "";
			},
		);

		const { rerender } = render(<DocsOverviewPanel repoRoot="/old" />);

		await waitFor(() => {
			expect(screen.getByText("A Doc")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("A Doc"));

		await waitFor(() => {
			expect(screen.getByText(/Old content/)).toBeInTheDocument();
		});

		rerender(<DocsOverviewPanel repoRoot="/new" />);

		await waitFor(() => {
			expect(screen.getByText("New Doc")).toBeInTheDocument();
		});

		expect(screen.queryByText(/Old content/)).not.toBeInTheDocument();
		expect(screen.queryByText("a.md")).not.toBeInTheDocument();
	});

	it("writes starter doc with real newlines (not escaped literal sequences)", async () => {
		mockListNarrativeFiles.mockResolvedValue([]);
		mockReadNarrativeFile.mockResolvedValue("");

		render(<DocsOverviewPanel repoRoot="/repo" />);

		await waitFor(() => {
			expect(screen.getByText("No Narrative docs found")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "Create starter doc" }));

		await waitFor(() => {
			expect(mockWriteNarrativeFile).toHaveBeenCalledWith(
				"/repo",
				"docs/overview.md",
				expect.any(String),
			);
		});

		const lastCall =
			mockWriteNarrativeFile.mock.calls[
				mockWriteNarrativeFile.mock.calls.length - 1
			];
		const writtenContent = lastCall?.[2] as string;
		expect(writtenContent).toContain("\n## System overview\n");
		expect(writtenContent).toContain("\n```mermaid\n");
		expect(writtenContent).not.toContain("\\n");
	});

	it("does not update state or warn after unmount while doc content load is pending", async () => {
		const pendingDoc = createDeferred<string>();
		mockListNarrativeFiles.mockResolvedValue(["a.md"]);
		let readCalls = 0;
		mockReadNarrativeFile.mockImplementation(async () => {
			readCalls += 1;
			if (readCalls === 1) return "# A Doc";
			return pendingDoc.promise;
		});

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			/* suppress console output in test */
		});

		const { unmount } = render(<DocsOverviewPanel repoRoot="/repo" />);

		await waitFor(() => {
			expect(screen.getByText("A Doc")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("A Doc"));

		await waitFor(() => {
			expect(mockReadNarrativeFile).toHaveBeenCalledWith("/repo", "a.md");
		});

		unmount();

		await act(async () => {
			pendingDoc.resolve("# A Doc\n\nstale content");
			await pendingDoc.promise;
			await Promise.resolve();
		});

		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
