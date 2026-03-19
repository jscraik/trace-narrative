import { describe, expect, it } from "vitest";
import { parseJUnitXml } from "../junit";

describe("parseJUnitXml", () => {
	it("parses passed/failed/skipped counts", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="suite">
  <testcase name="a" time="0.1" />
  <testcase name="b" time="0.2"><failure>boom</failure></testcase>
  <testcase name="c" time="0.0"><skipped /></testcase>
</testsuite>`;

		const parsed = parseJUnitXml(xml);
		expect(parsed.passed).toBe(1);
		expect(parsed.failed).toBe(1);
		expect(parsed.skipped).toBe(1);
		expect(parsed.durationSec).toBeCloseTo(0.3, 5);
		expect(parsed.cases).toHaveLength(3);
	});

	it("rejects DOCTYPE", () => {
		const xml = `<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<testsuite><testcase name="a"/></testsuite>`;
		expect(() => parseJUnitXml(xml)).toThrow(/DOCTYPE\/ENTITY/i);
	});
});
