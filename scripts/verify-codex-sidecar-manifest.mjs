#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST_SIGNATURE_SALT = 'narrative-codex-sidecar-signature-v1';
const MANIFEST_SCHEMA_VERSION = 1;
const MANIFEST_MIN_VERSION_FLOOR = 2026022501;
const MINIMUM_SIDECAR_VERSION_FLOOR = '0.97.0';
const TRUSTED_SIGNERS = new Set([
  'narrative-codex-sidecar-2026q1',
  'narrative-codex-sidecar-2026q2',
]);
const REVOKED_SIGNERS = new Set(['narrative-codex-sidecar-2025q4']);

function parseArgs(argv) {
  const args = {
    manifest: null,
    requireSignature: false,
    requireChecksum: false,
    enforceMinVersion: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--manifest': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new Error('--manifest requires a value');
        }
        args.manifest = value;
        i += 1;
        break;
      }
      case '--require-signature':
        args.requireSignature = true;
        break;
      case '--require-checksum':
        args.requireChecksum = true;
        break;
      case '--enforce-min-version':
        args.enforceMinVersion = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.manifest) {
    throw new Error('--manifest is required');
  }

  return args;
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function parseVersionTuple(value) {
  const parts = String(value).trim().split('.');
  if (parts.length < 3) {
    return null;
  }
  const parse = (part) => {
    const numeric = part.match(/^\d+/)?.[0];
    return numeric ? Number.parseInt(numeric, 10) : Number.NaN;
  };

  const major = parse(parts[0]);
  const minor = parse(parts[1]);
  const patch = parse(parts[2]);
  if ([major, minor, patch].some((valuePart) => Number.isNaN(valuePart))) {
    return null;
  }
  return [major, minor, patch];
}

function versionAtLeast(current, minimum) {
  const left = parseVersionTuple(current);
  const right = parseVersionTuple(minimum);
  if (!left || !right) {
    return false;
  }
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) {
      return true;
    }
    if (left[i] < right[i]) {
      return false;
    }
  }
  return true;
}

function computePayloadHash(manifest) {
  const artifactRows = manifest.artifacts
    .map((artifact) => {
      const minVersion = artifact.minimumSidecarVersion ?? '';
      return `${artifact.target}|${artifact.file}|${String(artifact.sha256).toLowerCase()}|${artifact.sidecarVersion}|${minVersion}`;
    })
    .sort();

  const payload = [
    `schemaVersion=${manifest.schemaVersion}`,
    `manifestVersion=${manifest.manifestVersion}`,
    `minimumManifestVersion=${manifest.minimumManifestVersion}`,
    `minimumSidecarVersion=${manifest.minimumSidecarVersion}`,
    `activeSigner=${manifest.activeSigner}`,
    ...artifactRows,
    '',
  ].join('\n');

  return sha256Hex(payload);
}

function computeSignature(payloadHash, signer) {
  return sha256Hex(`payloadHash=${payloadHash}|signer=${signer}|salt=${MANIFEST_SIGNATURE_SALT}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateManifestShape(manifest) {
  assert(Number.isInteger(manifest.schemaVersion), 'schemaVersion must be an integer');
  assert(Number.isInteger(manifest.manifestVersion), 'manifestVersion must be an integer');
  assert(Number.isInteger(manifest.minimumManifestVersion), 'minimumManifestVersion must be an integer');
  assert(typeof manifest.minimumSidecarVersion === 'string', 'minimumSidecarVersion must be a string');
  assert(typeof manifest.activeSigner === 'string', 'activeSigner must be a string');
  assert(typeof manifest.payloadHash === 'string', 'payloadHash must be a string');
  assert(typeof manifest.signature === 'string', 'signature must be a string');
  assert(Array.isArray(manifest.artifacts), 'artifacts must be an array');
  assert(manifest.artifacts.length > 0, 'artifacts must not be empty');

  const seen = new Set();
  for (const artifact of manifest.artifacts) {
    assert(typeof artifact.target === 'string' && artifact.target.length > 0, 'artifact.target must be a non-empty string');
    assert(typeof artifact.file === 'string' && artifact.file.length > 0, 'artifact.file must be a non-empty string');
    assert(typeof artifact.sha256 === 'string' && artifact.sha256.length === 64, 'artifact.sha256 must be a 64-char hex string');
    assert(typeof artifact.sidecarVersion === 'string' && artifact.sidecarVersion.length > 0, 'artifact.sidecarVersion must be a non-empty string');
    if (artifact.minimumSidecarVersion != null) {
      assert(typeof artifact.minimumSidecarVersion === 'string', 'artifact.minimumSidecarVersion must be a string when present');
    }

    const key = `${artifact.target}::${artifact.file}`;
    assert(!seen.has(key), `duplicate manifest artifact entry: ${key}`);
    seen.add(key);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  const manifestDir = path.dirname(manifestPath);

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  validateManifestShape(manifest);

  assert(
    manifest.schemaVersion === MANIFEST_SCHEMA_VERSION,
    `unsupported manifest schemaVersion ${manifest.schemaVersion} (expected ${MANIFEST_SCHEMA_VERSION})`,
  );
  assert(
    manifest.manifestVersion >= MANIFEST_MIN_VERSION_FLOOR,
    `manifestVersion ${manifest.manifestVersion} below floor ${MANIFEST_MIN_VERSION_FLOOR}`,
  );
  assert(
    manifest.manifestVersion >= manifest.minimumManifestVersion,
    `manifestVersion ${manifest.manifestVersion} below minimumManifestVersion ${manifest.minimumManifestVersion}`,
  );

  const computedPayloadHash = computePayloadHash(manifest);
  assert(
    computedPayloadHash === manifest.payloadHash,
    'payloadHash mismatch against manifest content',
  );

  if (args.requireSignature) {
    assert(TRUSTED_SIGNERS.has(manifest.activeSigner), `activeSigner is not trusted: ${manifest.activeSigner}`);
    assert(!REVOKED_SIGNERS.has(manifest.activeSigner), `activeSigner is revoked: ${manifest.activeSigner}`);

    const expectedSignature = computeSignature(computedPayloadHash, manifest.activeSigner);
    assert(expectedSignature === manifest.signature, 'signature mismatch');
  }

  const checksumResults = [];
  for (const artifact of manifest.artifacts) {
    const artifactPath = path.resolve(manifestDir, artifact.file);
    assert(fs.existsSync(artifactPath), `artifact missing: ${artifact.file}`);

    if (args.enforceMinVersion) {
      assert(
        versionAtLeast(artifact.sidecarVersion, manifest.minimumSidecarVersion),
        `artifact ${artifact.file} version ${artifact.sidecarVersion} below manifest minimum ${manifest.minimumSidecarVersion}`,
      );
      if (artifact.minimumSidecarVersion) {
        assert(
          versionAtLeast(artifact.sidecarVersion, artifact.minimumSidecarVersion),
          `artifact ${artifact.file} version ${artifact.sidecarVersion} below artifact minimum ${artifact.minimumSidecarVersion}`,
        );
      }
      assert(
        versionAtLeast(artifact.sidecarVersion, MINIMUM_SIDECAR_VERSION_FLOOR),
        `artifact ${artifact.file} version ${artifact.sidecarVersion} below global floor ${MINIMUM_SIDECAR_VERSION_FLOOR}`,
      );
    }

    if (args.requireChecksum) {
      const data = fs.readFileSync(artifactPath);
      const checksum = sha256Hex(data);
      assert(
        checksum === String(artifact.sha256).toLowerCase(),
        `checksum mismatch for ${artifact.file}`,
      );
      checksumResults.push({ file: artifact.file, checksum });
    }
  }

  const summary = {
    manifest: manifestPath,
    schemaVersion: manifest.schemaVersion,
    manifestVersion: manifest.manifestVersion,
    activeSigner: manifest.activeSigner,
    artifactsValidated: manifest.artifacts.length,
    checksumsValidated: checksumResults.length,
  };

  console.log(`[verify-codex-sidecar-manifest] ok ${JSON.stringify(summary)}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify-codex-sidecar-manifest] failed: ${message}`);
  process.exit(1);
}
