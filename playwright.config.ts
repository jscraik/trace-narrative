import { defineConfig, devices } from "@playwright/test";

const testArtifactsDir = process.env.TEST_ARTIFACTS_DIR ?? "artifacts/test";
const artifactReporters = [
	["list"],
	[
		"html",
		{ outputFolder: `${testArtifactsDir}/playwright-report`, open: "never" },
	],
	["junit", { outputFile: `${testArtifactsDir}/junit-playwright.xml` }],
	["json", { outputFile: `${testArtifactsDir}/playwright-results.json` }],
] as const;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.TEST_ARTIFACTS === "1" ? artifactReporters : "html",
	use: {
		trace: "on-first-retry",
		baseURL: "http://localhost:1420",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "pnpm dev",
		url: "http://localhost:1420",
		reuseExistingServer: !process.env.CI,
	},
});
