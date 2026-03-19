import { homeDir, join } from "@tauri-apps/api/path";
import { readTextFile } from "../tauri/narrativeFs";

export type CodexOtelPromptExportStatus = {
	enabled: boolean | null;
	configPath: string | null;
};

function parseOtelLogUserPrompt(contents: string): boolean | null {
	let inOtelTable = false;

	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.split("#")[0]?.trim() ?? "";
		if (!line) continue;

		if (line.startsWith("[") && line.endsWith("]")) {
			const table = line.slice(1, -1).trim();
			inOtelTable = table === "otel";
			continue;
		}

		if (!inOtelTable) continue;

		const match = line.match(/^log_user_prompt\s*=\s*(true|false)\b/i);
		if (match) {
			return match[1]?.toLowerCase() === "true";
		}
	}

	return null;
}

export async function detectCodexOtelPromptExport(): Promise<CodexOtelPromptExportStatus> {
	const home = await homeDir();
	const configPath = home ? await join(home, ".codex", "config.toml") : null;
	if (!configPath) {
		return { enabled: null, configPath: null };
	}

	try {
		const contents = await readTextFile(configPath);
		const enabled = parseOtelLogUserPrompt(contents);
		return { enabled, configPath };
	} catch {
		return { enabled: null, configPath };
	}
}
