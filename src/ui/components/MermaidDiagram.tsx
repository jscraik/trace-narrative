import { renderMermaid } from "beautiful-mermaid";
import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
	chart: string;
}

/**
 * Renders a Mermaid diagram using beautiful-mermaid.
 * Creates beautiful, themeable SVG diagrams.
 */
export function MermaidDiagram({ chart }: MermaidDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const renderDiagram = async () => {
			if (!chart || !containerRef.current) return;

			try {
				const renderedSvg = await renderMermaid(chart);
				// Safely inject SVG into the container using DOM manipulation
				// This is safe because renderMermaid returns trusted SVG content
				containerRef.current.innerHTML = renderedSvg;
				setError("");
			} catch (_err) {
				console.debug("[MermaidDiagram] render failed err=", _err);
				setError("Failed to render diagram");
				if (containerRef.current) {
					containerRef.current.innerHTML = "";
				}
			}
		};

		renderDiagram();
	}, [chart]);

	if (error) {
		return (
			<div className="rounded-lg border border-accent-red-light bg-accent-red-bg p-4 text-sm text-text-secondary">
				<p className="font-medium text-accent-red">Diagram Error</p>
				<p className="mt-1 text-accent-red">{error}</p>
				<pre className="mt-2 rounded bg-bg-tertiary p-2 text-xs overflow-auto">
					{chart}
				</pre>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className="mermaid-diagram my-4 rounded-lg border border-border-light bg-bg-secondary p-4 overflow-auto"
		/>
	);
}
