import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: __dirname,
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "../src"),
		},
	},
	build: {
		outDir: path.resolve(__dirname, "../dist-landing"),
		emptyOutDir: true,
	},
});
