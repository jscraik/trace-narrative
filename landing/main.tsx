import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/styles.css";
import "../src/styles/firefly.css";
import { TraceLanding } from "./TraceLanding";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");
createRoot(rootEl).render(
	<StrictMode>
		<TraceLanding />
	</StrictMode>,
);
