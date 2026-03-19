import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RightPanelTabs } from "../RightPanelTabs";

vi.mock("@design-studio/tokens", () => ({
	useTheme: () => ({
		theme: "dark",
		setTheme: vi.fn(),
	}),
}));

vi.mock("../DiffViewer", () => ({
	DiffViewer: ({ diffText }: { diffText: string | null }) => (
		<div data-testid="diff-viewer-content">{diffText ?? "(none)"}</div>
	),
}));

const baseProps = {
	selectedFile: "src/example.ts",
	onFileClick: vi.fn(),
	onCommitClick: vi.fn(),
	selectedCommitId: "aaaa1111",
	hasFiles: true,
	onTestFileClick: vi.fn(),
	selectedCommitSha: "aaaa1111",
	diffText: "@@ -1 +1 @@",
	loadingDiff: false,
	traceRanges: [],
};

describe("RightPanelTabs diff PiP accessibility", () => {
	it("renders diff PiP as an accessible dialog and closes on Escape", async () => {
		render(<RightPanelTabs {...baseProps} />);

		fireEvent.click(screen.getByTitle("Toggle diff panel"));
		fireEvent.click(screen.getByRole("button", { name: "Pop out diff panel" }));

		const dialog = await screen.findByRole("dialog", { name: "example.ts" });
		expect(dialog).toHaveAttribute("aria-modal", "true");

		fireEvent.keyDown(dialog, { key: "Escape" });

		await waitFor(() => {
			expect(
				screen.queryByRole("dialog", { name: "example.ts" }),
			).not.toBeInTheDocument();
		});
	});

	it("keeps keyboard focus trapped inside the dialog on tab navigation", async () => {
		render(<RightPanelTabs {...baseProps} />);

		fireEvent.click(screen.getByTitle("Toggle diff panel"));
		fireEvent.click(screen.getByRole("button", { name: "Pop out diff panel" }));

		const dialog = await screen.findByRole("dialog", { name: "example.ts" });
		const dockButton = await screen.findByRole("button", {
			name: "Close diff dialog and dock panel",
		});

		await waitFor(() => {
			expect(dockButton).toHaveFocus();
		});

		fireEvent.keyDown(dialog, { key: "Tab" });
		expect(dockButton).toHaveFocus();

		fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
		expect(dockButton).toHaveFocus();
	});
});
