#!/usr/bin/env node
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { URL } from "node:url";

const PORT = 2000;
const ROOT = process.cwd();
const DIST_ROOT = resolve(ROOT, "dist");
const BLOCKED_SOURCE_EXTS = new Set([".ts", ".tsx", ".jsx", ".mjs"]);
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ts": "application/javascript; charset=utf-8",
  ".tsx": "application/javascript; charset=utf-8",
  ".jsx": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function getMimeType(filename) {
  return MIME_TYPES[extname(filename)] || "application/octet-stream";
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveStaticTarget(relativePath) {
  const normalized = sanitizePath(relativePath);
  const extension = extname(normalized);
  const requestRoot = normalized.startsWith("src/")
    ? "src-asset"
    : "root";

  const candidateRoots = [DIST_ROOT, ROOT];

  if (
    BLOCKED_SOURCE_EXTS.has(extension) &&
    (requestRoot === "src-asset" || relativePath.includes("src/"))
  ) {
    return {
      path: null,
      reason: "blocked-source-path",
      missing: true,
    };
  }

  for (const root of candidateRoots) {
    const candidatePath = resolve(root, normalized);
    if (!(await pathExists(candidatePath))) {
      continue;
    }

    const fileStats = await stat(candidatePath);
    if (fileStats.isDirectory()) {
      const indexPath = join(candidatePath, "index.html");
      if (await pathExists(indexPath)) {
        return { path: indexPath, reason: "directory-index", missing: false };
      }
      continue;
    }

    return { path: candidatePath, reason: "static-file", missing: false };
  }

  const spaFallback = [join(DIST_ROOT, "index.html"), join(ROOT, "index.html")];
  for (const path of spaFallback) {
    if (await pathExists(path)) {
      return { path, reason: "spa-fallback", missing: false };
    }
  }

  return {
    path: null,
    reason: "not-found",
    missing: true,
  };
}

function sanitizePath(rawPath = "/") {
  const decoded = decodeURIComponent(rawPath);
  const normalized = normalize(decoded).replace(/^\/+/, "");
  if (normalized.startsWith("..") || normalized.includes(`..${sep}`)) {
    return "index.html";
  }
  return normalized || "index.html";
}

const server = createServer(async (request, response) => {
  const parsed = new URL(request.url || "/", `http://localhost:${PORT}`);
  const requestPath = parsed.pathname || "/";

  if (!requestPath.startsWith("/")) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }

  const resolved = await resolveStaticTarget(requestPath);
  if (resolved.missing || !resolved.path) {
    response.statusCode = 404;
    if (requestPath === "/") {
      response.end("Not Found");
    } else if (resolved.reason === "blocked-source-path") {
      response.end("Blocked source file request. Start the app via Vite or serve from dist.");
    } else {
      response.end("Not Found");
    }
    return;
  }

  response.writeHead(200, {
    "Content-Type": getMimeType(resolved.path),
    "Cache-Control": "no-store",
  });
  createReadStream(resolved.path).pipe(response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    process.stdout.write(`Port ${PORT} is already in use. Reuse the existing serve.mjs process or stop it first.\n`);
    process.exit(0);
  }
  throw error;
});

server.listen(PORT, () => {
  process.stdout.write(`Serving ${ROOT} at http://localhost:${PORT}\n`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
