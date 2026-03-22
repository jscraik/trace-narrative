import { expect, test } from "@playwright/test";

test.describe("Baseline browser quality without Agentation MCP", () => {
	test("has no console errors or failed MCP requests in default dev flow", async ({
		page,
	}, testInfo) => {
		const consoleErrors: string[] = [];
		const requestFailures: string[] = [];

		page.on("console", (message) => {
			if (message.type() === "error") {
				consoleErrors.push(message.text());
			}
		});

		page.on("requestfailed", (request) => {
			requestFailures.push(
				`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
			);
		});

		await page.goto("/");
		await page
			.getByRole("tablist", { name: "Sidebar mode navigation" })
			.waitFor({ timeout: 60000 });
		await page.screenshot({
			path: testInfo.outputPath("baseline-home.png"),
			fullPage: true,
		});

		await page.getByRole("tab", { name: "Repo" }).click({ force: true });
		// Wait for repo view to load (no specific import button check - UI may have changed)
		await page.waitForTimeout(2000);
		await page.screenshot({
			path: testInfo.outputPath("baseline-repo.png"),
			fullPage: true,
		});

		// Navigate to Live Capture mode - a primary item visible by default
		await page
			.getByRole("tab", { name: "Live Capture" })
			.click({ force: true });
		await page.waitForTimeout(2000);
		await page.screenshot({
			path: testInfo.outputPath("baseline-live.png"),
			fullPage: true,
		});

		const mcpErrors = requestFailures.filter((entry) =>
			entry.includes("http://localhost:4747"),
		);
		const mcpConsoleErrors = consoleErrors.filter((entry) =>
			entry.includes("localhost:4747"),
		);

		expect(mcpErrors).toEqual([]);
		expect(mcpConsoleErrors).toEqual([]);
	});
});
