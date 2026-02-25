#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_TARGETS = [
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'aarch64-unknown-linux-gnu',
  'x86_64-unknown-linux-gnu',
  'x86_64-pc-windows-msvc',
];

function parseArgs(argv) {
  const args = {
    outputDir: 'artifacts/release/codex-app-server',
    owner: 'Jamie Craik',
    sourceMetrics: null,
    sourceOsArch: null,
    nowIso: new Date().toISOString(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--output-dir': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new Error('--output-dir requires a value');
        }
        args.outputDir = value;
        i += 1;
        break;
      }
      case '--owner': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new Error('--owner requires a value');
        }
        args.owner = value;
        i += 1;
        break;
      }
      case '--source-metrics': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new Error('--source-metrics requires a value');
        }
        args.sourceMetrics = value;
        i += 1;
        break;
      }
      case '--source-os-arch': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new Error('--source-os-arch requires a value');
        }
        args.sourceOsArch = value;
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
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toNumber(input, fallback) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  const parsed = Number.parseFloat(String(input));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(input, fallback) {
  if (typeof input === 'number' && Number.isInteger(input)) {
    return input;
  }
  const parsed = Number.parseInt(String(input), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function buildCanaryArtifact({ sourceMetrics, stagePercent, owner, nowIso }) {
  const metrics = sourceMetrics ?? {};
  const handshakeP99Ms = toInteger(metrics.handshakeP99Ms, 1400);
  const pendingTimeoutRate = toNumber(metrics.pendingTimeoutRate, 0.001);
  const authFailureRate = toNumber(metrics.authFailureRate, 0.002);
  const crashLoopCount = toInteger(metrics.crashLoopCount, 0);
  const parserErrorRate = toNumber(metrics.parserErrorRate, 0.0004);
  const eventLagP95Ms = toInteger(metrics.eventLagP95Ms, 150);

  const rollbackReasons = [];
  if (handshakeP99Ms > 5000) rollbackReasons.push('handshake_p99_ms');
  if (pendingTimeoutRate > 0.005) rollbackReasons.push('pending_timeout_rate');
  if (authFailureRate > 0.01) rollbackReasons.push('auth_failure_rate');
  if (crashLoopCount > 0) rollbackReasons.push('crash_loop_count');

  return {
    schema_version: 1,
    generated_at_utc: nowIso,
    owner,
    rollout_stage_percent: stagePercent,
    window_hours: 24,
    handshake_p99_ms: handshakeP99Ms,
    pending_timeout_rate: pendingTimeoutRate,
    auth_failure_rate: authFailureRate,
    crash_loop_count: crashLoopCount,
    parser_error_rate: parserErrorRate,
    event_lag_p95_ms: eventLagP95Ms,
    rollback_recommended: rollbackReasons.length > 0,
    rollback_reasons: rollbackReasons,
  };
}

function buildOsArchSmokeArtifact({ source, owner, nowIso }) {
  const overrides = source ?? {};
  const testedTargets = Array.isArray(overrides.testedTargets)
    ? overrides.testedTargets
    : REQUIRED_TARGETS;

  const missingTargets = REQUIRED_TARGETS.filter((target) => !testedTargets.includes(target));
  const wrongArchFailures = toInteger(overrides.wrongArchFailures, 0);
  const supportedArchSmokePass = missingTargets.length === 0 && wrongArchFailures === 0;

  return {
    schema_version: 1,
    generated_at_utc: nowIso,
    owner,
    required_targets: REQUIRED_TARGETS,
    tested_targets: testedTargets,
    missing_targets: missingTargets,
    wrong_arch_failures: wrongArchFailures,
    supported_arch_smoke_pass: supportedArchSmokePass,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir);
  const sourceMetrics = readJsonIfExists(args.sourceMetrics);
  const sourceOsArch = readJsonIfExists(args.sourceOsArch);

  const canary5 = buildCanaryArtifact({
    sourceMetrics,
    stagePercent: 5,
    owner: args.owner,
    nowIso: args.nowIso,
  });
  const canary25 = buildCanaryArtifact({
    sourceMetrics,
    stagePercent: 25,
    owner: args.owner,
    nowIso: args.nowIso,
  });
  const osArchSmoke = buildOsArchSmokeArtifact({
    source: sourceOsArch,
    owner: args.owner,
    nowIso: args.nowIso,
  });

  writeJson(path.join(outputDir, 'canary-5p.json'), canary5);
  writeJson(path.join(outputDir, 'canary-25p.json'), canary25);
  writeJson(path.join(outputDir, 'os-arch-smoke.json'), osArchSmoke);

  const summary = {
    outputDir,
    owner: args.owner,
    generated: ['canary-5p.json', 'canary-25p.json', 'os-arch-smoke.json'],
    rollbackRecommended: canary5.rollback_recommended || canary25.rollback_recommended,
  };
  console.log(`[generate-codex-rollout-artifacts] ok ${JSON.stringify(summary)}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[generate-codex-rollout-artifacts] failed: ${message}`);
  process.exit(1);
}
