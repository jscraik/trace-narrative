import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../");
const ingestConfigPath = path.join(repoRoot, "src/core/tauri/ingestConfig.ts");
const rustLibPath = path.join(repoRoot, "src-tauri/src/lib.rs");
const rustRuntimePath = path.join(
	repoRoot,
	"src-tauri/src/codex_app_server.rs",
);
const autoIngestPath = path.join(repoRoot, "src/hooks/useAutoIngest.ts");
const contractPath = path.join(
	repoRoot,
	"src-tauri/contracts/codex-app-server-v1-contract.json",
);

const codexCommandFilter =
	/^(get_codex_app_server_status|start_codex_app_server|stop_codex_app_server|get_capture_reliability_status|codex_app_server_)/;

function extractTsInvokeCommands(source: string): Set<string> {
	const commands = new Set<string>();
	const invokePattern = /invoke(?:<[^>]+>)?\('([^']+)'/g;
	for (const match of source.matchAll(invokePattern)) {
		const command = match[1];
		if (codexCommandFilter.test(command)) {
			commands.add(command);
		}
	}
	return commands;
}

function extractRustRegisteredCommands(source: string): Set<string> {
	const commands = new Set<string>();
	const commandPattern = /codex_app_server::([a-zA-Z0-9_]+)/g;
	for (const match of source.matchAll(commandPattern)) {
		commands.add(match[1]);
	}
	return commands;
}

type ContractParity = {
	requiredRequestMethods: string[];
	allowedNotificationMethods: string[];
	authLoginStartTypes: string[];
};

function extractContract(path: string): ContractParity {
	return JSON.parse(fs.readFileSync(path, "utf8"));
}

describe("codex app-server Rust↔TS command and event parity", () => {
	it("keeps TS invoke command names registered in Rust generate_handler", () => {
		const tsSource = fs.readFileSync(ingestConfigPath, "utf8");
		const rustSource = fs.readFileSync(rustLibPath, "utf8");

		const tsCommands = extractTsInvokeCommands(tsSource);
		const rustCommands = extractRustRegisteredCommands(rustSource);

		const missing = [...tsCommands].filter(
			(command) => !rustCommands.has(command),
		);
		expect(missing).toEqual([]);
	});

	it("keeps live/session status event names in sync between Rust emitters and TS listeners", () => {
		const rustRuntime = fs.readFileSync(rustRuntimePath, "utf8");
		const autoIngest = fs.readFileSync(autoIngestPath, "utf8");

		expect(rustRuntime).toContain('const MAIN_WINDOW_LABEL: &str = "main"');
		expect(rustRuntime).toContain(
			'pub const LIVE_SESSION_EVENT: &str = "session:live:event"',
		);
		expect(rustRuntime).toContain(
			'app_handle.emit_to(MAIN_WINDOW_LABEL, "codex-app-server-status"',
		);
		expect(rustRuntime).toContain(
			"app_handle.emit_to(MAIN_WINDOW_LABEL, LIVE_SESSION_EVENT",
		);
		expect(autoIngest).toContain(
			"listen<LiveSessionEventPayload>('session:live:event'",
		);
		expect(autoIngest).toContain(
			"listen<CodexAppServerStatus>('codex-app-server-status'",
		);
	});

	it("keeps envelope classification and auth/request payload contract parity with TS bridge types", () => {
		const contract = extractContract(contractPath);
		const tsSource = fs.readFileSync(ingestConfigPath, "utf8");
		const rustSource = fs.readFileSync(rustRuntimePath, "utf8");

		for (const method of contract.requiredRequestMethods) {
			expect(rustSource).toContain(`"${method}"`);
		}
		for (const method of contract.allowedNotificationMethods) {
			expect(rustSource).toContain(`"${method}"`);
		}
		for (const authStartType of contract.authLoginStartTypes) {
			if (authStartType === "apiKey") {
				expect(rustSource).toContain('"apiKey"');
			} else {
				expect(rustSource).toContain(`"${authStartType}"`);
			}
		}

		expect(tsSource).toContain("rpcRequestId?: string | number | null;");
		expect(rustSource).toContain("rpc_request_id");
		expect(rustSource).toContain("JSONRPC_METHOD_NOT_FOUND");
		expect(rustSource).toContain("parse_rpc_response_id");
		expect(rustSource).toContain(
			"if let (Some(method), Some(request_id)) = (method, id.as_ref())",
		);
		expect(rustSource).toContain(
			"let Some(id) = id.as_ref().and_then(parse_rpc_response_id)",
		);
		expect(rustSource).toContain(
			"approval request must include requestId/request_id or envelope id",
		);
		expect(rustSource).toContain(
			'"account/login/completed.loginId must be string"',
		);
		expect(tsSource).toContain("codexAppServerLoginStart");
		expect(tsSource).toContain("'apikey'");
		expect(tsSource).toContain("'chatgptAuthTokens'");
	});
});
