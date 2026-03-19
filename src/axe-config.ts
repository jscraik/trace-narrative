import React from "react";
import ReactDOM from "react-dom";

// Only run axe in development
if (process.env.NODE_ENV !== "production") {
	import("@axe-core/react")
		.then((axe) => {
			axe.default(React, ReactDOM, 1000);
		})
		.catch(() => {
			// axe-core not available in test environment
		});
}
