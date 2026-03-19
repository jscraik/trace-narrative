import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BranchHeaderViewModel } from "../../../core/types";
import { BranchHeader } from "../BranchHeader";

describe("BranchHeader", () => {
	it("renders nothing for hidden view model", () => {
		const vm: BranchHeaderViewModel = {
			kind: "hidden",
			reason: "mode_unsupported",
		};
		const { container } = render(<BranchHeader viewModel={vm} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders shell state copy with named region", () => {
		const vm: BranchHeaderViewModel = {
			kind: "shell",
			state: "loading",
			message: "Loading repository context…",
		};

		render(<BranchHeader viewModel={vm} />);
		expect(
			screen.getByRole("region", { name: "Repo evidence context" }),
		).toBeInTheDocument();
		expect(screen.getByText("Loading repo evidence")).toBeInTheDocument();
	});

	it("renders full branch header and supports clearing dashboard filter", () => {
		const onClearFilter = vi.fn();
		const vm: BranchHeaderViewModel = {
			kind: "full",
			title: "feature/branch-header",
			status: "open",
			description: "Recent branch activity and code-change summary.",
			isFilteredView: true,
			metrics: {
				added: { kind: "known", value: 12 },
				removed: { kind: "known", value: 3 },
				files: { kind: "known", value: 2 },
				commits: { kind: "known", value: 1 },
				prompts: { kind: "unavailable", reason: "NO_TRACE_DATA" },
				responses: { kind: "unavailable", reason: "NO_TRACE_DATA" },
			},
		};

		render(<BranchHeader viewModel={vm} onClearFilter={onClearFilter} />);

		expect(
			screen.getByRole("heading", { level: 1, name: "feature/branch-header" }),
		).toBeInTheDocument();
		expect(screen.getByText("Focused evidence slice")).toBeInTheDocument();
		expect(screen.getAllByText("—")).toHaveLength(2);

		fireEvent.click(
			screen.getByRole("button", { name: /Back to narrative brief/i }),
		);
		expect(onClearFilter).toHaveBeenCalledTimes(1);
	});

	it("supports keyboard activation for filtered clear action", async () => {
		const user = userEvent.setup();
		const onClearFilter = vi.fn();

		const vm: BranchHeaderViewModel = {
			kind: "full",
			title: "feature/keyboard",
			status: "open",
			description: "Keyboard accessibility check",
			isFilteredView: true,
			metrics: {
				added: { kind: "known", value: 1 },
				removed: { kind: "known", value: 0 },
				files: { kind: "known", value: 1 },
				commits: { kind: "known", value: 1 },
				prompts: { kind: "unavailable", reason: "NO_TRACE_DATA" },
				responses: { kind: "unavailable", reason: "NO_TRACE_DATA" },
			},
		};

		render(<BranchHeader viewModel={vm} onClearFilter={onClearFilter} />);

		const button = screen.getByRole("button", {
			name: /Back to narrative brief/i,
		});
		await user.tab();
		expect(button).toHaveFocus();

		await user.keyboard("{Enter}");
		expect(onClearFilter).toHaveBeenCalledTimes(1);
	});

	it("hides filtered clear action when callback is unavailable", () => {
		const vm: BranchHeaderViewModel = {
			kind: "full",
			title: "feature/no-callback",
			status: "open",
			description: "No clear callback",
			isFilteredView: true,
			metrics: {
				added: { kind: "known", value: 2 },
				removed: { kind: "known", value: 1 },
				files: { kind: "known", value: 1 },
				commits: { kind: "known", value: 1 },
				prompts: { kind: "unavailable", reason: "NO_TRACE_DATA" },
				responses: { kind: "unavailable", reason: "NO_TRACE_DATA" },
			},
		};

		render(<BranchHeader viewModel={vm} />);
		expect(
			screen.queryByRole("button", { name: /back to narrative brief/i }),
		).not.toBeInTheDocument();
	});
});
