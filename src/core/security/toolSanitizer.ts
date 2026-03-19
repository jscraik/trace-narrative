export type ToolSanitizerHit = { type: string; count: number };

export type ToolSanitizerResult = {
	sanitized: string;
	hits: ToolSanitizerHit[];
};

const TOOL_PATTERNS: Array<{ type: string; re: RegExp }> = [
	{ type: "TOOL_CALL_BLOCK", re: /<tool_call>[\s\S]*?<\/tool_call>/g },
	{ type: "TOOL_RESULT_BLOCK", re: /<tool_result>[\s\S]*?<\/tool_result>/g },
	{
		type: "TOOL_JSON",
		re: /"(tool_call|tool_result|function_call)"\s*:\s*\{[\s\S]*?\}/g,
	},
];

export function sanitizeToolText(input: string): ToolSanitizerResult {
	let sanitized = input;
	const hits: ToolSanitizerHit[] = [];

	for (const pattern of TOOL_PATTERNS) {
		const matches = sanitized.match(pattern.re);
		if (!matches || matches.length === 0) continue;
		hits.push({ type: pattern.type, count: matches.length });
		sanitized = sanitized.replace(pattern.re, `[REDACTED:${pattern.type}]`);
	}

	return { sanitized, hits };
}
