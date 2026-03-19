import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopNav } from "../TopNav";

describe("TopNav", () => {
	it("renders a calmer shell header with current section and contextual quick routes", () => {
		render(
			<TopNav
				mode="dashboard"
				onModeChange={vi.fn()}
				onOpenRepo={vi.fn()}
				repoPath="/Users/jamiecraik/dev/trace-narrative"
			/>,
		);

		expect(screen.getByText("Trace Narrative")).toBeInTheDocument();
		expect(screen.getByText("Narrative")).toBeInTheDocument();
		expect(screen.getByText("Narrative Brief")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Repo Evidence" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("/Users/jamiecraik/dev/trace-narrative"),
		).toBeInTheDocument();
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
		expect(screen.queryByText("Codex Copilot")).not.toBeInTheDocument();
	});

	it("routes through contextual quick actions instead of tab keyboard handling", () => {
		const onModeChange = vi.fn();
		render(
			<TopNav mode="live" onModeChange={onModeChange} onOpenRepo={vi.fn()} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Repo Evidence" }));
		expect(onModeChange).toHaveBeenCalledWith("repo");
		fireEvent.click(screen.getByRole("button", { name: "Narrative Brief" }));
		expect(onModeChange).toHaveBeenCalledWith("dashboard");
	});

	it("uses a single back-to-brief shortcut on the secondary docs lane", () => {
		const onModeChange = vi.fn();
		render(
			<TopNav mode="docs" onModeChange={onModeChange} onOpenRepo={vi.fn()} />,
		);

		expect(screen.getByText("Configure")).toBeInTheDocument();
		expect(screen.getByText("Docs")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Back to Brief" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Repo Evidence" }),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Back to Brief" }));
		expect(onModeChange).toHaveBeenCalledWith("dashboard");
	});

	it("keeps assistant compatibility paths folded into the Narrative Brief label", () => {
		render(
			<TopNav mode="assistant" onModeChange={vi.fn()} onOpenRepo={vi.fn()} />,
		);

		expect(screen.getAllByText("Narrative Brief")).toHaveLength(2);
		expect(screen.getByText("Narrative")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Codex-guided asks now live inside stronger evidence views.",
			),
		).toBeInTheDocument();
		expect(screen.queryByText("Codex Copilot")).not.toBeInTheDocument();
	});
});
