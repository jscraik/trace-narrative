import { readNarrativeFile, writeNarrativeFile } from "../tauri/narrativeFs";

export type TraceCollectorConfig = {
	codexOtelLogPath: string;
	codexOtelReceiverEnabled: boolean;
};

const TRACE_CONFIG_PATH = "meta/trace-config.json";
const DEFAULT_CODEX_OTEL_LOG_PATH = "/tmp/codex-otel.json";
const DEFAULT_CODEX_OTEL_RECEIVER_ENABLED = false;

export function defaultTraceConfig(): TraceCollectorConfig {
	return {
		codexOtelLogPath: DEFAULT_CODEX_OTEL_LOG_PATH,
		codexOtelReceiverEnabled: DEFAULT_CODEX_OTEL_RECEIVER_ENABLED,
	};
}

export async function loadTraceConfig(
	repoRoot: string,
): Promise<TraceCollectorConfig> {
	try {
		const raw = await readNarrativeFile(repoRoot, TRACE_CONFIG_PATH);
		const parsed = JSON.parse(raw) as Partial<TraceCollectorConfig>;
		const path =
			typeof parsed.codexOtelLogPath === "string"
				? parsed.codexOtelLogPath
				: DEFAULT_CODEX_OTEL_LOG_PATH;
		const enabled =
			typeof parsed.codexOtelReceiverEnabled === "boolean"
				? parsed.codexOtelReceiverEnabled
				: DEFAULT_CODEX_OTEL_RECEIVER_ENABLED;
		return { codexOtelLogPath: path, codexOtelReceiverEnabled: enabled };
	} catch {
		return defaultTraceConfig();
	}
}

export async function saveTraceConfig(
	repoRoot: string,
	config: TraceCollectorConfig,
): Promise<void> {
	await writeNarrativeFile(
		repoRoot,
		TRACE_CONFIG_PATH,
		JSON.stringify(config, null, 2),
	);
}
