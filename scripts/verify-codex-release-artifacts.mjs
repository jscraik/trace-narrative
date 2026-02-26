#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    artifactsDir: 'artifacts/release/codex-app-server',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--artifacts-dir': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new Error('--artifacts-dir requires a value');
        }
        args.artifactsDir = value;
        i += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateSoak(soak, errors) {
  assert(
    Number.isFinite(soak.window_hours) && soak.window_hours >= 168,
    'soak-100p.window_hours must be >= 168',
    errors,
  );
  assert(
    Number.isFinite(soak.handshake_p99_ms) && soak.handshake_p99_ms <= 5000,
    'soak-100p.handshake_p99_ms exceeds 5000',
    errors,
  );
  assert(
    Number.isFinite(soak.pending_timeout_rate) && soak.pending_timeout_rate <= 0.005,
    'soak-100p.pending_timeout_rate exceeds 0.005',
    errors,
  );
  assert(
    Number.isFinite(soak.parser_error_rate) && soak.parser_error_rate <= 0.001,
    'soak-100p.parser_error_rate exceeds 0.001',
    errors,
  );
  assert(
    Number.isFinite(soak.event_lag_p95_ms) && soak.event_lag_p95_ms <= 250,
    'soak-100p.event_lag_p95_ms exceeds 250',
    errors,
  );
  assert(typeof soak.owner === 'string' && soak.owner.trim().length > 0, 'soak-100p.owner is required', errors);
}

function validateTelemetry(telemetry, errors) {
  assert(telemetry.dashboards_live === true, 'telemetry-readiness.dashboards_live must be true', errors);
  assert(
    typeof telemetry.alerts_routed_owner === 'string' && telemetry.alerts_routed_owner.trim().length > 0,
    'telemetry-readiness.alerts_routed_owner is required',
    errors,
  );
  assert(
    Array.isArray(telemetry.sli_definitions) && telemetry.sli_definitions.length >= 6,
    'telemetry-readiness.sli_definitions must include at least 6 entries',
    errors,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactsDir = path.resolve(args.artifactsDir);

  const soakPath = path.join(artifactsDir, 'soak-100p.json');
  const telemetryPath = path.join(artifactsDir, 'telemetry-readiness.json');

  const soak = readJson(soakPath);
  const telemetry = readJson(telemetryPath);

  const errors = [];
  validateSoak(soak, errors);
  validateTelemetry(telemetry, errors);

  if (errors.length > 0) {
    console.error('[verify-codex-release-artifacts] failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[verify-codex-release-artifacts] ok ${JSON.stringify({ artifactsDir, status: 'pass' })}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify-codex-release-artifacts] failed: ${message}`);
  process.exit(1);
}
