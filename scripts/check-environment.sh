#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

required_bins=(git bash node pnpm rg fd jq)
missing_bins=()

echo "== Firefly Narrative environment check =="
echo "repo: $ROOT_DIR"

for bin in "${required_bins[@]}"; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    missing_bins+=("$bin")
  fi
done

if [[ ${#missing_bins[@]} -gt 0 ]]; then
  printf "Missing required binaries: %s\n" "${missing_bins[*]}" >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/harness.contract.json" ]]; then
  echo "Missing harness contract: $ROOT_DIR/harness.contract.json" >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/scripts/codex-preflight.sh" ]]; then
  echo "Missing preflight helper: $ROOT_DIR/scripts/codex-preflight.sh" >&2
  exit 1
fi

(
  cd "$ROOT_DIR"
  # shellcheck source=./scripts/codex-preflight.sh
  source scripts/codex-preflight.sh
  preflight_repo
)

(
  cd "$ROOT_DIR"
  pnpm exec harness preflight-gate --contract harness.contract.json
)

echo "✓ Environment check passed"
