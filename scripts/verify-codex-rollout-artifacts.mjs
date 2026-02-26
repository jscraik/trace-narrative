#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    artifactsDir: 'artifacts/release/codex-app-server',
    requireOwner: true,
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
      case '--no-owner-check':
        args.requireOwner = false;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

function validateCanary(label, data, errors, { requireOwner }) {
  const prefix = `${label}:`;
  assert(
    Number.isFinite(data.window_hours) && data.window_hours === 24,
    `${prefix} window_hours must be 24`,
    errors,
  );
  assert(
    Number.isFinite(data.handshake_p99_ms) && data.handshake_p99_ms <= 5000,
    `${prefix} handshake_p99_ms exceeds threshold`,
    errors,
  );
  assert(
    Number.isFinite(data.pending_timeout_rate) && data.pending_timeout_rate <= 0.005,
    `${prefix} pending_timeout_rate exceeds threshold`,
    errors,
  );
  assert(
    Number.isFinite(data.auth_failure_rate) && data.auth_failure_rate <= 0.01,
    `${prefix} auth_failure_rate exceeds threshold`,
    errors,
  );
  assert(
    Number.isFinite(data.crash_loop_count) && data.crash_loop_count === 0,
    `${prefix} crash_loop_count must be 0`,
    errors,
  );
  assert(data.rollback_recommended === false, `${prefix} rollback_recommended must be false`, errors);
  if (requireOwner) {
    assert(typeof data.owner === 'string' && data.owner.trim().length > 0, `${prefix} owner is required`, errors);
  }
}

function validateOsArch(data, errors, { requireOwner }) {
  const prefix = 'os-arch-smoke:';
  assert(data.supported_arch_smoke_pass === true, `${prefix} supported_arch_smoke_pass must be true`, errors);
  assert(data.wrong_arch_failures === 0, `${prefix} wrong_arch_failures must be 0`, errors);
  assert(Number.isFinite(data.wrong_arch_failures), `${prefix} wrong_arch_failures must be a finite number`, errors);
  assert(Array.isArray(data.required_targets), `${prefix} required_targets must be an array`, errors);
  assert(Array.isArray(data.tested_targets), `${prefix} tested_targets must be an array`, errors);
  assert(Array.isArray(data.missing_targets), `${prefix} missing_targets must be an array`, errors);
  if (requireOwner) {
    assert(typeof data.owner === 'string' && data.owner.trim().length > 0, `${prefix} owner is required`, errors);
  }
}

function nextStage(canary5, canary25) {
  if (canary5.rollout_stage_percent === 5 && canary25.rollout_stage_percent === 25) {
    return '100%';
  }
  return 'hold';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactsDir = path.resolve(args.artifactsDir);

  const canary5Path = path.join(artifactsDir, 'canary-5p.json');
  const canary25Path = path.join(artifactsDir, 'canary-25p.json');
  const osArchPath = path.join(artifactsDir, 'os-arch-smoke.json');

  const canary5 = readJson(canary5Path);
  const canary25 = readJson(canary25Path);
  const osArch = readJson(osArchPath);

  const errors = [];
  validateCanary('canary-5p', canary5, errors, args);
  validateCanary('canary-25p', canary25, errors, args);
  validateOsArch(osArch, errors, args);

  if (errors.length > 0) {
    console.error('[verify-codex-rollout-artifacts] failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const result = {
    artifactsDir,
    gate: 'pass',
    nextStage: nextStage(canary5, canary25),
  };
  console.log(`[verify-codex-rollout-artifacts] ok ${JSON.stringify(result)}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify-codex-rollout-artifacts] failed: ${message}`);
  process.exit(1);
}
