import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ActivityEvent } from "../../../core/tauri/activity";
import { CaptureActivityStrip } from "../CaptureActivityStrip";

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

function makeEvent(
	id: number,
	message: string,
	commitShas: string[] = ["abc123"],
): ActivityEvent {
	return {
		id,
		createdAtIso: new Date().toISOString(),
		sourceTool: "codex",
		action: "auto_import",
		status: "ok",
		sessionId: `session-${id}`,
		commitShas,
		redactionCount: 0,
		needsReview: false,
		message,
	};
}

describe("CaptureActivityStrip", () => {
	it("does not open drawer from lifecycle filters when no loader is provided", async () => {
		render(
			<CaptureActivityStrip
				enabled={true}
				sourcesLabel="Codex"
				issueCount={0}
				lastSeenISO={new Date().toISOString()}
				recent={[makeEvent(1, "recent item")]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Linked" }));

		await act(async () => {
			await Promise.resolve();
		});

		expect(screen.queryByText("Capture activity")).not.toBeInTheDocument();
	});

	it("ignores stale drawer fetch completion when a newer request wins", async () => {
		const first = createDeferred<ActivityEvent[]>();
		const second = createDeferred<ActivityEvent[]>();
		const onRequestAll = vi
			.fn<() => Promise<ActivityEvent[]>>()
			.mockImplementationOnce(async () => first.promise)
			.mockImplementationOnce(async () => second.promise);

		render(
			<CaptureActivityStrip
				enabled={true}
				sourcesLabel="Codex"
				issueCount={0}
				lastSeenISO={new Date().toISOString()}
				recent={[makeEvent(1, "recent item")]}
				onRequestAll={onRequestAll}
			/>,
		);

		fireEvent.click(screen.getByText("View all"));

		await waitFor(() => {
			expect(onRequestAll).toHaveBeenCalledTimes(1);
			expect(screen.getByText("Capture activity")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "Linked" }));

		await waitFor(() => {
			expect(onRequestAll).toHaveBeenCalledTimes(2);
		});

		await act(async () => {
			second.resolve([makeEvent(2, "new result")]);
			await second.promise;
			await Promise.resolve();
		});

		expect(screen.getByText("new result")).toBeInTheDocument();

		await act(async () => {
			first.resolve([makeEvent(3, "stale result")]);
			await first.promise;
			await Promise.resolve();
		});

		expect(screen.getByText("new result")).toBeInTheDocument();
		expect(screen.queryByText("stale result")).not.toBeInTheDocument();
	});

	it("invalidates in-flight drawer request when closed before completion", async () => {
		const first = createDeferred<ActivityEvent[]>();
		const second = createDeferred<ActivityEvent[]>();
		const onRequestAll = vi
			.fn<() => Promise<ActivityEvent[]>>()
			.mockImplementationOnce(async () => first.promise)
			.mockImplementationOnce(async () => second.promise);

		render(
			<CaptureActivityStrip
				enabled={true}
				sourcesLabel="Codex"
				issueCount={0}
				lastSeenISO={new Date().toISOString()}
				recent={[makeEvent(1, "recent item")]}
				onRequestAll={onRequestAll}
			/>,
		);

		fireEvent.click(screen.getByText("View all"));

		await waitFor(() => {
			expect(onRequestAll).toHaveBeenCalledTimes(1);
		});

		fireEvent.click(screen.getByText("Close"));

		await waitFor(() => {
			expect(screen.queryByText("Capture activity")).not.toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("View all"));

		await waitFor(() => {
			expect(onRequestAll).toHaveBeenCalledTimes(2);
		});

		await act(async () => {
			second.resolve([makeEvent(2, "fresh after reopen")]);
			await second.promise;
			await Promise.resolve();
		});

		expect(screen.getByText("fresh after reopen")).toBeInTheDocument();

		await act(async () => {
			first.resolve([makeEvent(3, "stale after close")]);
			await first.promise;
			await Promise.resolve();
		});

		expect(screen.getByText("fresh after reopen")).toBeInTheDocument();
		expect(screen.queryByText("stale after close")).not.toBeInTheDocument();
	});

	it("clears stale drawer items when a refresh request fails", async () => {
		const onRequestAll = vi
			.fn<() => Promise<ActivityEvent[]>>()
			.mockResolvedValueOnce([makeEvent(1, "first load")])
			.mockRejectedValueOnce(new Error("network unavailable"));

		render(
			<CaptureActivityStrip
				enabled={true}
				sourcesLabel="Codex"
				issueCount={0}
				lastSeenISO={new Date().toISOString()}
				recent={[makeEvent(99, "recent item")]}
				onRequestAll={onRequestAll}
			/>,
		);

		fireEvent.click(screen.getByText("View all"));

		await waitFor(() => {
			expect(screen.getByText("first load")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("Close"));

		await waitFor(() => {
			expect(screen.queryByText("Capture activity")).not.toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("View all"));

		await waitFor(() => {
			expect(onRequestAll).toHaveBeenCalledTimes(2);
			expect(
				screen.getByText("No activity for this filter yet."),
			).toBeInTheDocument();
		});

		expect(screen.queryByText("first load")).not.toBeInTheDocument();
	});
});
