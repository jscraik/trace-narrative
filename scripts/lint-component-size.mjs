import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DEFAULT_THRESHOLD = 400;
const threshold = Number.parseInt(process.env.COMPONENT_SIZE_THRESHOLD ?? String(DEFAULT_THRESHOLD), 10);
const strictMode = process.env.COMPONENT_SIZE_STRICT === '1';

const ROOTS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'landing'),
];

function toPosixPath(p) {
  return p.replace(/\\/g, '/');
}

function isReactComponentFile(absPath) {
  const rel = toPosixPath(path.relative(ROOT, absPath));
  if (!rel.endsWith('.tsx')) return false;
  if (rel.includes('/__tests__/')) return false;
  if (rel.endsWith('.test.tsx')) return false;
  if (rel.endsWith('.stories.tsx')) return false;
  if (rel.endsWith('/main.tsx')) return false;
  return true;
}

async function listFilesRecursive(dir) {
  const files = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absPath)));
    } else if (entry.isFile()) {
      files.push(absPath);
    }
  }

  return files;
}

async function main() {
  const candidateFiles = [];
  for (const root of ROOTS) {
    candidateFiles.push(...(await listFilesRecursive(root)));
  }

  const componentFiles = candidateFiles.filter(isReactComponentFile);
  const oversized = [];

  for (const filePath of componentFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/).length;
    if (lines > threshold) {
      oversized.push({
        path: toPosixPath(path.relative(ROOT, filePath)),
        lines,
      });
    }
  }

  oversized.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));

  if (oversized.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `Component size lint passed. ${componentFiles.length} files checked (threshold: ${threshold} lines).`
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `Component size warning: ${oversized.length} file(s) exceed ${threshold} lines (out of ${componentFiles.length}).`
  );
  for (const item of oversized) {
    // eslint-disable-next-line no-console
    console.warn(`  - ${item.path}: ${item.lines} lines`);
  }

  if (strictMode) {
    process.exit(1);
  }
}

await main();
