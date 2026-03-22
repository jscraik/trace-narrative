import { expect, test } from "@playwright/test";

test.describe("Narrative App", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("app loads with correct title", async ({ page }) => {
		await expect(page).toHaveTitle(/Narrative/);
	});

	test("live Capture mode is available", async ({ page }) => {
		// Look for Live Capture button or link - Live Capture is a primary item in the sidebar
		const liveButton = page.locator("text=Live Capture").first();
		await expect(liveButton).toBeVisible();
	});

	test("navigation elements exist", async ({ page }) => {
		// Check for main navigation or header
		const header = page.locator('header, nav, [role="navigation"]').first();
		await expect(header).toBeVisible();
	});

	test("does not call Agentation MCP endpoint unless explicitly enabled", async ({
		page,
	}) => {
		const agentationRequests: string[] = [];

		page.on("request", (request) => {
			if (request.url().startsWith("http://localhost:4747")) {
				agentationRequests.push(request.url());
			}
		});

		await page.goto("/");
		await page.waitForTimeout(500);

		expect(agentationRequests).toEqual([]);
	});
});
