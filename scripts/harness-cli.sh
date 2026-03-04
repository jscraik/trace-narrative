#!/usr/bin/env bash
set -euo pipefail

cli_path="$(node -p "require(\"fs\").realpathSync(require.resolve(\"@brainwav/coding-harness/dist/cli.js\"))")"
exec node "$cli_path" "$@"
