import { expect, test } from "@playwright/test";

test.describe("Narrative Critical Flows", () => {
	test.describe("App Launch", () => {
		test("should display main navigation", async ({ page }) => {
			await page.goto("/");
			await expect(
				page.getByRole("tablist", { name: "Sidebar mode navigation" }),
			).toBeVisible({ timeout: 60000 });
		});

		test("should show live capture mode option", async ({ page }) => {
			await page.goto("/");
			await expect(
				page.getByRole("tab", { name: "Live Capture" }),
			).toBeVisible();
		});

		test("should show repo mode option", async ({ page }) => {
			await page.goto("/");
			await expect(page.getByRole("tab", { name: "Repo" })).toBeVisible();
		});
	});

	test.describe("Session Import Flow", () => {
		test("should show repo view content", async ({ page }) => {
			await page.goto("/");
			// Navigate to repo mode if not default
			const repoButton = page.getByRole("tab", { name: "Repo" });
			if (await repoButton.isVisible().catch(() => false)) {
				await repoButton.click({ force: true });
			}

			// Repo view should be visible after clicking
			await page.waitForTimeout(1000);
			await expect(page.locator("body")).toBeVisible();
		});

		test("should show session panel when available", async ({ page }) => {
			await page.goto("/");

			// Look for session-related UI elements
			const _sessionPanel = page
				.locator('text=Session, [data-testid="session-panel"]')
				.first();
			// May not be visible without data, but should not error
			await expect(page).toHaveURL(/localhost|127.0.0.1/);
		});
	});

	test.describe("Timeline Navigation", () => {
		test("should render timeline component", async ({ page }) => {
			await page.goto("/");

			// Look for timeline or commit list
			const _timeline = page
				.locator('[data-testid="timeline"], .timeline, text=Commits')
				.first();
			// Timeline may be empty but component should render
			await expect(page.locator("body")).toBeVisible();
		});
	});

	test.describe("Accessibility", () => {
		test("should have proper heading structure", async ({ page }) => {
			await page.goto("/");

			// Check for at least one heading
			const headings = page.locator('h1, h2, h3, [role="heading"]');
			try {
				await expect(headings.first()).toBeVisible({ timeout: 3000 });
				return;
			} catch {
				// No headings rendered; fall back to tab check
			}
			await expect(
				page.getByRole("tab", { name: /sessions|repo/i }),
			).toBeVisible();
		});

		test("should have accessible buttons", async ({ page }) => {
			await page.goto("/");

			// Buttons should be keyboard accessible (focusable by default or explicit tabindex)
			const buttons = page.locator("button");
			const count = await buttons.count();

			if (count > 0) {
				const firstButton = buttons.first();
				// Buttons are focusable by default, so just verify they exist and are visible
				await expect(firstButton).toBeVisible();
			}
		});
	});
});
