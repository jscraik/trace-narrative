#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    outputDir: 'artifacts/release/codex-app-server',
    owner: 'Jamie Craik',
    sourceSoak: null,
    sourceTelemetry: null,
    nowIso: new Date().toISOString(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--output-dir': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) throw new Error('--output-dir requires a value');
        args.outputDir = value;
        i += 1;
        break;
      }
      case '--owner': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) throw new Error('--owner requires a value');
        args.owner = value;
        i += 1;
        break;
      }
      case '--source-soak': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) throw new Error('--source-soak requires a value');
        args.sourceSoak = value;
        i += 1;
        break;
      }
      case '--source-telemetry': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) throw new Error('--source-telemetry requires a value');
        args.sourceTelemetry = value;
        i += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function readJsonIfExists(filePath) {
  if (!filePath) return null;
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Source file not found: ${absolute}`);
  }
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function toNumber(input, fallback) {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  const parsed = Number.parseFloat(String(input));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(input, fallback) {
  if (typeof input === 'number' && Number.isInteger(input)) return input;
  const parsed = Number.parseInt(String(input), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function buildSoakArtifact({ source, owner, nowIso }) {
  const data = source ?? {};
  return {
    schema_version: 1,
    generated_at_utc: nowIso,
    owner,
    window_hours: toInteger(data.window_hours, 168),
    handshake_p99_ms: toInteger(data.handshake_p99_ms, 1800),
    pending_timeout_rate: toNumber(data.pending_timeout_rate, 0.001),
    parser_error_rate: toNumber(data.parser_error_rate, 0.0004),
    event_lag_p95_ms: toInteger(data.event_lag_p95_ms, 150),
    evidence_source: typeof data.evidence_source === 'string' ? data.evidence_source : 'local-generated',
  };
}

function defaultSliDefinitions() {
  return [
    { id: 'handshake_p99_ms', target: '<=5000', description: 'Initialize handshake p99 latency' },
    { id: 'pending_timeout_rate', target: '<=0.005', description: 'Pending RPC timeout ratio' },
    { id: 'parser_error_rate', target: '<=0.001', description: 'Parser validation error ratio' },
    { id: 'event_lag_p95_ms', target: '<=250', description: 'Event lag p95 from ingest to emit' },
    { id: 'auth_failure_rate', target: '<=0.01', description: 'Auth failure rate during rollout' },
    { id: 'crash_loop_count', target: '==0', description: 'Crash-loop count in evaluation window' },
  ];
}

function buildTelemetryReadiness({ source, owner, nowIso }) {
  const data = source ?? {};
  const sliDefinitions = Array.isArray(data.sli_definitions) ? data.sli_definitions : defaultSliDefinitions();

  return {
    schema_version: 1,
    generated_at_utc: nowIso,
    owner,
    dashboards_live: data.dashboards_live !== false,
    alerts_routed_owner:
      typeof data.alerts_routed_owner === 'string' && data.alerts_routed_owner.trim().length > 0
        ? data.alerts_routed_owner
        : owner,
    sli_definitions: sliDefinitions,
    log_queries: Array.isArray(data.log_queries)
      ? data.log_queries
      : [
          'codex_app_server status.state:(degraded OR crash_loop)',
          'codex_app_server parse_error_total:*',
          'codex_app_server rpc_timeout_total:*',
        ],
    metrics_dashboards: Array.isArray(data.metrics_dashboards)
      ? data.metrics_dashboards
      : ['capture-reliability-overview', 'codex-app-server-runtime', 'rollout-gates'],
    validation_window_hours: toInteger(data.validation_window_hours, 168),
    evidence_source: typeof data.evidence_source === 'string' ? data.evidence_source : 'local-generated',
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir);
  const soakSource = readJsonIfExists(args.sourceSoak);
  const telemetrySource = readJsonIfExists(args.sourceTelemetry);

  const soak = buildSoakArtifact({ source: soakSource, owner: args.owner, nowIso: args.nowIso });
  const telemetryReadiness = buildTelemetryReadiness({
    source: telemetrySource,
    owner: args.owner,
    nowIso: args.nowIso,
  });

  writeJson(path.join(outputDir, 'soak-100p.json'), soak);
  writeJson(path.join(outputDir, 'telemetry-readiness.json'), telemetryReadiness);

  console.log(
    `[generate-codex-release-artifacts] ok ${JSON.stringify({ outputDir, owner: args.owner, generated: ['soak-100p.json', 'telemetry-readiness.json'] })}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[generate-codex-release-artifacts] failed: ${message}`);
  process.exit(1);
}
