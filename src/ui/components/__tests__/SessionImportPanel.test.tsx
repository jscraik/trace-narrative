import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionImportPanel } from "../SessionImportPanel";

const mockImportSessionFile = vi.hoisted(() => vi.fn());
const mockImportSessionFiles = vi.hoisted(() => vi.fn());
const mockScanForSessionFiles = vi.hoisted(() => vi.fn());

vi.mock("lucide-react", () => {
	const Icon = () => <span aria-hidden="true" />;
	return {
		AlertTriangle: Icon,
		CheckCircle: Icon,
		RefreshCw: Icon,
		Upload: Icon,
		XCircle: Icon,
	};
});

vi.mock("../../../core/attribution-api", async () => {
	const actual = await vi.importActual("../../../core/attribution-api");
	return {
		...actual,
		importSessionFile: mockImportSessionFile,
		importSessionFiles: mockImportSessionFiles,
		scanForSessionFiles: mockScanForSessionFiles,
	};
});

vi.mock("../Checkbox", () => ({
	Checkbox: ({
		checked,
		onCheckedChange,
		ariaLabel,
		"aria-label": ariaLabelFromAriaAttribute,
		className,
	}: {
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		ariaLabel?: string;
		"aria-label"?: string;
		className?: string;
	}) => (
		<input
			type="checkbox"
			aria-label={ariaLabel ?? ariaLabelFromAriaAttribute}
			checked={checked}
			className={className}
			onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
		/>
	),
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

describe("SessionImportPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockScanForSessionFiles.mockResolvedValue([]);
		mockImportSessionFiles.mockResolvedValue({
			total: 0,
			succeeded: [],
			failed: [],
		});
		mockImportSessionFile.mockResolvedValue({
			total: 0,
			succeeded: [],
			failed: [],
		});
	});

	it("ignores stale batch import completion after repo switch", async () => {
		const importDeferred = createDeferred<{
			total: number;
			succeeded: Array<{ path: string; sessionId: string; warnings: string[] }>;
			failed: Array<{ path: string; error: string; retryable: boolean }>;
		}>();

		mockScanForSessionFiles.mockResolvedValue([
			{
				path: "/tmp/session-a.json",
				tool: "codex",
				detectedAt: "2026-02-24T00:00:00.000Z",
			},
		]);
		mockImportSessionFiles.mockImplementationOnce(
			async () => importDeferred.promise,
		);

		const { rerender } = render(<SessionImportPanel repoId={1} />);

		fireEvent.click(screen.getByText("Scan for Sessions"));

		await waitFor(() => {
			expect(screen.getByText("session-a.json")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByLabelText("Select session-a.json"));

		await waitFor(() => {
			expect(screen.getByText("Import 1 Selected")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("Import 1 Selected"));

		await waitFor(() => {
			expect(mockImportSessionFiles).toHaveBeenCalledWith(1, [
				"/tmp/session-a.json",
			]);
		});

		rerender(<SessionImportPanel repoId={2} />);

		await act(async () => {
			importDeferred.resolve({
				total: 1,
				succeeded: [
					{ path: "/tmp/session-a.json", sessionId: "session-a", warnings: [] },
				],
				failed: [],
			});
			await importDeferred.promise;
			await Promise.resolve();
		});

		expect(
			screen.queryByText("Successfully imported 1 session"),
		).not.toBeInTheDocument();
	});

	it("ignores stale scan completion from previous repo context", async () => {
		const staleScan =
			createDeferred<
				Array<{ path: string; tool: string; detectedAt: string }>
			>();

		mockScanForSessionFiles
			.mockImplementationOnce(async () => staleScan.promise)
			.mockImplementationOnce(async () => []);

		const { rerender } = render(<SessionImportPanel repoId={1} />);

		fireEvent.click(screen.getByText("Scan for Sessions"));

		await waitFor(() => {
			expect(mockScanForSessionFiles).toHaveBeenCalledTimes(1);
		});

		rerender(<SessionImportPanel repoId={2} />);

		fireEvent.click(screen.getByText("Scan for Sessions"));

		await waitFor(() => {
			expect(mockScanForSessionFiles).toHaveBeenCalledTimes(2);
			expect(screen.getByText(/No session files found/)).toBeInTheDocument();
		});

		await act(async () => {
			staleScan.resolve([
				{
					path: "/tmp/stale-session.json",
					tool: "codex",
					detectedAt: "2026-02-24T00:00:00.000Z",
				},
			]);
			await staleScan.promise;
			await Promise.resolve();
		});

		expect(screen.queryByText("stale-session.json")).not.toBeInTheDocument();
		expect(screen.getByText(/No session files found/)).toBeInTheDocument();
	});

	it("keeps paths selected after import starts when new paths are added mid-flight", async () => {
		const importDeferred = createDeferred<{
			total: number;
			succeeded: Array<{ path: string; sessionId: string; warnings: string[] }>;
			failed: Array<{ path: string; error: string; retryable: boolean }>;
		}>();

		mockScanForSessionFiles.mockResolvedValue([
			{
				path: "/tmp/session-a.json",
				tool: "codex",
				detectedAt: "2026-02-24T00:00:00.000Z",
			},
			{
				path: "/tmp/session-b.json",
				tool: "codex",
				detectedAt: "2026-02-24T00:00:00.000Z",
			},
		]);
		mockImportSessionFiles.mockImplementationOnce(
			async () => importDeferred.promise,
		);

		render(<SessionImportPanel repoId={1} />);

		fireEvent.click(screen.getByText("Scan for Sessions"));

		await waitFor(() => {
			expect(screen.getByText("session-a.json")).toBeInTheDocument();
			expect(screen.getByText("session-b.json")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByLabelText("Select session-a.json"));
		fireEvent.click(screen.getByText("Import 1 Selected"));

		await waitFor(() => {
			expect(mockImportSessionFiles).toHaveBeenCalledWith(1, [
				"/tmp/session-a.json",
			]);
		});

		fireEvent.click(screen.getByLabelText("Select session-b.json"));

		await act(async () => {
			importDeferred.resolve({
				total: 1,
				succeeded: [
					{ path: "/tmp/session-a.json", sessionId: "session-a", warnings: [] },
				],
				failed: [],
			});
			await importDeferred.promise;
			await Promise.resolve();
		});

		const firstCheckbox = screen.getByLabelText(
			"Select session-a.json",
		) as HTMLInputElement;
		const secondCheckbox = screen.getByLabelText(
			"Select session-b.json",
		) as HTMLInputElement;
		expect(firstCheckbox.checked).toBe(false);
		expect(secondCheckbox.checked).toBe(true);
		expect(
			screen.getByText("Successfully imported 1 session"),
		).toBeInTheDocument();
	});
});
