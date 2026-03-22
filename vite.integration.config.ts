import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), react()],
	test: {
		name: "integration",
		environment: "jsdom",
		setupFiles: "./src/setupTests.ts",
		globals: true,
		include: ["src/**/*.integration.test.ts", "src/**/*.integration.test.tsx"],
		exclude: ["node_modules/", "src-tauri/", "e2e/"],
		passWithNoTests: false,
	},
});
