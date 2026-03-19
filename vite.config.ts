import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [tailwindcss(), react()],
	clearScreen: false,
	test: {
		environment: "jsdom",
		setupFiles: "./src/setupTests.ts",
		globals: true,
		testTimeout: 30000,
		exclude: [
			"node_modules/",
			"src-tauri/",
			"e2e/",
			"tmp/",
			"**/*.integration.test.ts",
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			reportsDirectory: "./coverage",
			thresholds: {
				lines: 55,
				functions: 45,
				branches: 40,
				statements: 55,
			},
			exclude: [
				"node_modules/",
				"src-tauri/",
				"e2e/",
				"**/*.test.ts",
				"**/*.test.tsx",
				"**/__tests__/**",
				"**/demo/**",
				"**/types.ts",
			],
		},
	},
	server: {
		port: 1420,
		strictPort: true,
		host: host || "localhost",
		hmr: {
			protocol: "ws",
			host: host || "localhost",
			port: 1421,
		},
		watch: {
			ignored: ["**/src-tauri/**"],
		},
	},
	envPrefix: ["VITE_", "TAURI_ENV_*"],
	build: {
		target:
			process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
		minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
		sourcemap: !!process.env.TAURI_ENV_DEBUG,
	},
});
