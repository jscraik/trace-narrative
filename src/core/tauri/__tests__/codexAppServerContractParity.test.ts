import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../../../');
const ingestConfigPath = path.join(repoRoot, 'src/core/tauri/ingestConfig.ts');
const rustLibPath = path.join(repoRoot, 'src-tauri/src/lib.rs');
const rustRuntimePath = path.join(repoRoot, 'src-tauri/src/codex_app_server.rs');
const autoIngestPath = path.join(repoRoot, 'src/hooks/useAutoIngest.ts');

const codexCommandFilter =
  /^(get_codex_app_server_status|start_codex_app_server|stop_codex_app_server|get_capture_reliability_status|codex_app_server_|ingest_codex_stream_event)/;

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

describe('codex app-server Rust↔TS command and event parity', () => {
  it('keeps TS invoke command names registered in Rust generate_handler', () => {
    const tsSource = fs.readFileSync(ingestConfigPath, 'utf8');
    const rustSource = fs.readFileSync(rustLibPath, 'utf8');

    const tsCommands = extractTsInvokeCommands(tsSource);
    const rustCommands = extractRustRegisteredCommands(rustSource);

    const missing = [...tsCommands].filter((command) => !rustCommands.has(command));
    expect(missing).toEqual([]);
  });

  it('keeps live/session status event names in sync between Rust emitters and TS listeners', () => {
    const rustRuntime = fs.readFileSync(rustRuntimePath, 'utf8');
    const autoIngest = fs.readFileSync(autoIngestPath, 'utf8');

    expect(rustRuntime).toContain('pub const LIVE_SESSION_EVENT: &str = "session:live:event"');
    expect(rustRuntime).toContain('app_handle.emit("codex-app-server-status"');
    expect(autoIngest).toContain("listen<LiveSessionEventPayload>('session:live:event'");
    expect(autoIngest).toContain("listen<CodexAppServerStatus>('codex-app-server-status'");
  });
});
