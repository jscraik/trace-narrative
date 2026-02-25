import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { stdio: 'inherit', ...options });
}

function read(cmd, args, options = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options }).trim();
}

const repoRoot = process.cwd();
const tauriDir = path.join(repoRoot, 'src-tauri');
const outDir = path.join(tauriDir, 'bin');
const sidecarManifestPath = path.join(tauriDir, 'bin', 'codex-app-server-manifest.json');
const sidecarVerifyScriptPath = path.join(repoRoot, 'scripts', 'verify-codex-sidecar-manifest.mjs');

// Determine host triple (used by Tauri bundle.externalBin naming convention).
const rustcInfo = read('rustc', ['-vV']);
const hostLine = rustcInfo.split('\n').find((l) => l.startsWith('host: '));
if (!hostLine) {
  throw new Error('Failed to determine rustc host triple (rustc -vV).');
}
const host = hostLine.replace('host: ', '').trim();

const ext = process.platform === 'win32' ? '.exe' : '';

// Build the hook CLI.
run('cargo', ['build', '--bin', 'narrative-cli', '--release'], { cwd: tauriDir });

const builtPath = path.join(tauriDir, 'target', 'release', `narrative-cli${ext}`);
if (!fs.existsSync(builtPath)) {
  throw new Error(`Expected narrative-cli at ${builtPath} but it does not exist.`);
}

fs.mkdirSync(outDir, { recursive: true });
const destPath = path.join(outDir, `narrative-cli-${host}${ext}`);
fs.copyFileSync(builtPath, destPath);
fs.chmodSync(destPath, 0o755);

console.log(`[prepare-narrative-cli] Wrote ${destPath}`);

run('node', [
  sidecarVerifyScriptPath,
  '--manifest',
  sidecarManifestPath,
  '--require-signature',
  '--require-checksum',
  '--enforce-min-version',
]);
console.log('[prepare-narrative-cli] Verified codex sidecar manifest integrity');
