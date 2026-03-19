import type { TestCase } from "../types";

export type ParsedJUnit = {
	durationSec: number;
	passed: number;
	failed: number;
	skipped: number;
	cases: Omit<TestCase, "id">[];
	mentionedFiles: string[];
};

function textContent(node: Element | null): string | undefined {
	if (!node) return undefined;
	const t = node.textContent ?? "";
	const trimmed = t.trim();
	return trimmed.length ? trimmed : undefined;
}

function getAttr(el: Element, name: string): string | undefined {
	const v = el.getAttribute(name);
	return v === null ? undefined : v;
}

/**
 * Parse a JUnit XML file into test counts + cases for Narrative.
 *
 * Security:
 * - Rejects DOCTYPE/ENTITY to avoid entity-expansion edge cases.
 *
 * Notes:
 * - File paths are best-effort (many JUnit producers don't include them).
 * - Duration is derived from testcase `time` attributes (seconds).
 */
export function parseJUnitXml(xmlText: string): ParsedJUnit {
	const upper = xmlText.toUpperCase();
	if (upper.includes("<!DOCTYPE") || upper.includes("<!ENTITY")) {
		throw new Error(
			"Unsupported JUnit XML (DOCTYPE/ENTITY is not allowed). Please re-export without a DOCTYPE.",
		);
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlText, "application/xml");
	const parseError = doc.querySelector("parsererror");
	if (parseError) {
		throw new Error(
			"Failed to parse JUnit XML. Please confirm the file is valid XML.",
		);
	}

	const cases: Omit<TestCase, "id">[] = [];
	const mentionedFilesSet = new Set<string>();
	let totalDurationSec = 0;
	let passed = 0;
	let failed = 0;
	let skipped = 0;

	for (const tc of Array.from(doc.querySelectorAll("testcase"))) {
		const name =
			getAttr(tc, "name") ?? getAttr(tc, "classname") ?? "(unnamed test)";

		const timeAttr = getAttr(tc, "time");
		const durationSec = timeAttr ? Number.parseFloat(timeAttr) : 0;
		const safeDurationSec = Number.isFinite(durationSec)
			? Math.max(0, durationSec)
			: 0;
		totalDurationSec += safeDurationSec;

		const failure = tc.querySelector("failure");
		const error = tc.querySelector("error");
		const skippedEl = tc.querySelector("skipped");

		const status: TestCase["status"] = skippedEl
			? "skipped"
			: failure || error
				? "failed"
				: "passed";

		if (status === "passed") passed += 1;
		if (status === "failed") failed += 1;
		if (status === "skipped") skipped += 1;

		const errorMessage =
			textContent(failure) ?? textContent(error) ?? undefined;

		// Best-effort file path extraction. Different JUnit producers use different attribute names.
		const filePath =
			getAttr(tc, "file") ??
			getAttr(tc, "filepath") ??
			getAttr(tc, "filename") ??
			undefined;

		if (filePath) mentionedFilesSet.add(filePath);

		cases.push({
			name,
			status,
			durationMs: Math.round(safeDurationSec * 1000),
			errorMessage,
			filePath,
		});
	}

	return {
		durationSec: totalDurationSec,
		passed,
		failed,
		skipped,
		cases,
		mentionedFiles: Array.from(mentionedFilesSet),
	};
}
