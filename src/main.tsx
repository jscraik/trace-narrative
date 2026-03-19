import { THEME_STORAGE_KEY, ThemeProvider } from "@design-studio/tokens";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@design-studio/tokens/tokens.css";
import "@design-studio/ui/styles.css";
import "./styles.css";
import "./styles/trace-signal.css";

// Seed dark as the default before ThemeProvider reads localStorage.
// ThemeProvider's defaultTheme only applies when nothing is stored, but
// existing sessions may have "light" cached. We override to dark-first
// unless the user has explicitly toggled to light inside this session.
try {
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	if (!stored) {
		localStorage.setItem(THEME_STORAGE_KEY, "dark");
	}
} catch {
	// ignore – localStorage unavailable
}

// Apply data-theme immediately (before React hydrates) to prevent FOUC
const _earlyTheme = (() => {
	try {
		return localStorage.getItem(THEME_STORAGE_KEY) ?? "dark";
	} catch {
		return "dark";
	}
})();
document.documentElement.setAttribute("data-theme", _earlyTheme);
document.documentElement.classList.add(_earlyTheme);

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<ThemeProvider defaultTheme="dark">
			<App />
		</ThemeProvider>
	</React.StrictMode>,
);
