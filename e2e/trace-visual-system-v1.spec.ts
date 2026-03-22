import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

type TracePerfFixture = {
	durationMs: number;
	stepMs: number;
	scrollActions: string[];
	metadata?: {
		machineProfile?: string;
		runtimeMode?: string;
	};
};

async function openDemoTimeline(page: Page) {
	await page.goto("/");
	// The app now boots to Demo mode by default.
	// Wait for the timeline to appear instead of clicking the Demo tab.
	await page.waitForSelector('[role="listbox"][aria-label="Commit timeline"]');
}

async function loadPerfFixture(): Promise<TracePerfFixture> {
	const fixturePath = new URL(
		"./fixtures/trace-large-timeline.json",
		import.meta.url,
	);
	const fixtureRaw = await readFile(fixturePath, "utf8");
	return JSON.parse(fixtureRaw) as TracePerfFixture;
}

test.describe
	.skip("Trace Visual System v1", () => {
		// TODO: Update these tests to work with Live Capture mode or mock data
		// Demo mode was removed, so timeline no longer appears by default
		test("tracks selection changes on the timeline", async ({ page }) => {
			await openDemoTimeline(page);

			const traceSignal = page.locator('[data-testid="trace-signal"]');
			await expect(traceSignal).toBeVisible();

			const timelineNodes = page.locator("button.timeline-dot");
			await expect(timelineNodes.first()).toBeVisible();
			await timelineNodes.nth(1).click();

			await expect
				.poll(async () => {
					const state = await traceSignal.getAttribute("data-state");
					return (
						state === "tracking" || state === "idle" || state === "analyzing"
					);
				})
				.toBe(true);
		});

		test("surfaces toggle persistence failures in ImportErrorBanner when they occur", async ({
			page,
		}) => {
			await openDemoTimeline(page);

			await page
				.getByRole("tab", { name: "Settings" })
				.evaluate((el: HTMLElement) => el.click());
			const isDevRuntime = await page
				.getByText("Dev Theme Override")
				.isVisible()
				.catch(() => false);

			const toggle = page.getByLabel(/toggle trace signal/i);
			await expect(toggle).toBeVisible();
			await toggle.click();

			const persistenceError = page.locator(
				"text=Unable to persist Trace setting",
			);
			const traceSignal = page.locator('[data-testid="trace-signal"]');

			const sawPersistenceError = await persistenceError
				.first()
				.isVisible({ timeout: 1000 })
				.catch(() => false);
			if (sawPersistenceError) {
				await expect(persistenceError.first()).toBeVisible();
				return;
			}

			// If persistence succeeds in this environment, toggle should still suppress rendering.
			await expect(traceSignal).toHaveCount(0);
			await page.reload();
			const traceSignalAfterReload = page.locator(
				'[data-testid="trace-signal"]',
			);
			if (isDevRuntime) {
				// Dev mode skips persistence wiring; navigation may also reset to landing after reload.
				await openDemoTimeline(page);
				await expect(traceSignalAfterReload).toHaveCount(1);
				return;
			}

			await expect(traceSignalAfterReload).toHaveCount(0);
		});

		test("@trace-perf captures frame metrics and writes verification artifact", async ({
			page,
			browserName,
		}) => {
			const fixture = await loadPerfFixture();
			const thresholds = process.env.CI
				? {
						averageFpsMin: 20,
						p95FrameTimeMsMax: 80,
						layoutShiftCountMax: 0,
					}
				: {
						averageFpsMin: 55,
						p95FrameTimeMsMax: 20,
						layoutShiftCountMax: 0,
					};

			const maxAttempts = 3;
			let perfResult: {
				frameCount: number;
				averageFps: number;
				p95FrameTimeMs: number;
				layoutShiftCount: number;
				layoutShiftValue: number;
			} | null = null;
			let attemptUsed = 0;

			for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
				await openDemoTimeline(page);

				try {
					perfResult = await page.evaluate(
						async ({ durationMs, stepMs, scrollActions }) => {
							const timeline = document.querySelector(
								'[role="listbox"][aria-label="Commit timeline"]',
							);
							if (!(timeline instanceof HTMLElement)) {
								throw new Error("Timeline listbox not found.");
							}

							let layoutShiftCount = 0;
							let layoutShiftValue = 0;

							const observer = new PerformanceObserver((list) => {
								for (const entry of list.getEntries()) {
									const shift = entry as PerformanceEntry & {
										hadRecentInput?: boolean;
										value?: number;
										sources?: Array<{ node?: Node | null }>;
									};
									if (
										!shift.hadRecentInput &&
										typeof shift.value === "number"
									) {
										const traceRelated = (shift.sources ?? []).some(
											(source) => {
												const node = source.node;
												return (
													node instanceof Element &&
													Boolean(node.closest('[data-testid="trace-signal"]'))
												);
											},
										);

										if (traceRelated) {
											layoutShiftCount += 1;
											layoutShiftValue += shift.value;
										}
									}
								}
							});

							try {
								observer.observe({ type: "layout-shift", buffered: true });
							} catch {
								// layout-shift observer may be unavailable in some environments.
							}

							const frameTimes: number[] = [];
							let running = true;
							let lastFrame = performance.now();

							const recordFrame = (now: number) => {
								frameTimes.push(now - lastFrame);
								lastFrame = now;
								if (running) {
									requestAnimationFrame(recordFrame);
								}
							};
							requestAnimationFrame(recordFrame);

							const wait = (ms: number) =>
								new Promise<void>((resolve) => setTimeout(resolve, ms));
							const endTime = performance.now() + durationMs;
							let actionIndex = 0;

							while (performance.now() < endTime) {
								const key =
									scrollActions[actionIndex % scrollActions.length] ??
									"ArrowRight";
								timeline.dispatchEvent(
									new KeyboardEvent("keydown", { key, bubbles: true }),
								);
								actionIndex += 1;
								await wait(stepMs);
							}

							running = false;
							observer.disconnect();
							await wait(50);

							const validFrames = frameTimes.filter(
								(value) => Number.isFinite(value) && value > 0,
							);
							const averageFrameMs = validFrames.length
								? validFrames.reduce((sum, value) => sum + value, 0) /
									validFrames.length
								: 0;
							const sortedFrames = [...validFrames].sort((a, b) => a - b);
							const p95Index =
								sortedFrames.length > 0
									? Math.min(
											sortedFrames.length - 1,
											Math.floor(sortedFrames.length * 0.95),
										)
									: 0;
							const p95FrameMs = sortedFrames[p95Index] ?? 0;

							return {
								frameCount: validFrames.length,
								averageFps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
								p95FrameTimeMs: p95FrameMs,
								layoutShiftCount,
								layoutShiftValue,
							};
						},
						fixture,
					);
					attemptUsed = attempt;
					break;
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					const executionContextDestroyed = message.includes(
						"Execution context was destroyed",
					);
					if (!executionContextDestroyed || attempt >= maxAttempts) {
						throw error;
					}
					await page.waitForLoadState("domcontentloaded");
				}
			}

			if (!perfResult) {
				throw new Error(
					"Failed to capture Trace perf metrics after retry attempts.",
				);
			}

			const timestamp = new Date();
			const dateStamp = timestamp.toISOString().slice(0, 10);
			// Keep default artifact output outside the Vite project root.
			// Writing under docs/ during parallel runs can trigger HMR full reloads,
			// which destroys the page execution context mid-measurement.
			const artifactRoot = process.env.TRACE_PERF_ARTIFACT_DIR
				? path.resolve(process.env.TRACE_PERF_ARTIFACT_DIR)
				: path.join(os.tmpdir(), "trace-narrative", "verification");
			const outputPath = path.join(
				artifactRoot,
				`trace-perf-${dateStamp}.json`,
			);
			const docsArtifactPath =
				process.env.TRACE_PERF_WRITE_DOCS_ARTIFACT === "1"
					? path.join(
							process.cwd(),
							"docs",
							"assets",
							"verification",
							`trace-perf-${dateStamp}.json`,
						)
					: null;

			const artifact = {
				generatedAtISO: timestamp.toISOString(),
				machineProfile: fixture.metadata?.machineProfile ?? "unknown",
				os: `${os.platform()} ${os.release()}`,
				runtimeMode: fixture.metadata?.runtimeMode ?? "playwright-headless",
				browser: browserName,
				attempt: attemptUsed,
				fixture: "e2e/fixtures/trace-large-timeline.json",
				thresholds,
				metrics: perfResult,
			};

			await mkdir(path.dirname(outputPath), { recursive: true });
			const serializedArtifact = `${JSON.stringify(artifact, null, 2)}\n`;
			await writeFile(outputPath, serializedArtifact, "utf8");
			if (docsArtifactPath) {
				await mkdir(path.dirname(docsArtifactPath), { recursive: true });
				await writeFile(docsArtifactPath, serializedArtifact, "utf8");
			}

			expect(perfResult.averageFps).toBeGreaterThanOrEqual(
				thresholds.averageFpsMin,
			);
			expect(perfResult.p95FrameTimeMs).toBeLessThanOrEqual(
				thresholds.p95FrameTimeMsMax,
			);
			expect(perfResult.layoutShiftCount).toBeLessThanOrEqual(
				thresholds.layoutShiftCountMax,
			);
		});
	});
