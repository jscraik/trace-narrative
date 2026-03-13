# Development Guide

## Prerequisites

- **Node.js** + **pnpm** (Package manager)
- **Rust toolchain** (via `rustup`)
- **Git** on your PATH (Narrative executes git commands via `tauri-plugin-shell`)
- OS-specific tauri dependencies (see [tauri Framework Docs](https://v2.tauri.app/start/prerequisites/))

## Running Locally

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Start the application (Desktop Mode)**:
   This runs the full tauri application with Rust backend.

   ```bash
   pnpm tauri dev
   ```

   You should see the landing page:

   <img src="../assets/screenshots/landing.png" width="600" alt="Local Development - Landing Page">

3. **Start Web-Only Mode (Frontend Only)**:
   Useful for UI iteration without compiling Rust. In this mode, filesystem and git features use mocks or stay unavailable.

   ```bash
   pnpm dev
   ```

## Building

- **Web Assets Only**:

  ```bash
  pnpm build
  ```

- **Production App (tauri)**:
  This produces the `.app`, `.dmg`, or executable for your OS.

  ```bash
  pnpm tauri:build
  ```

  Use `pnpm tauri:build:full` when you need the full signed/bundled build path.

## Notes

- **Data Storage**: When you open a repository, Narrative creates a `.narrative/` directory in that repo root to store session metadata.
- **Troubleshooting**: If you encounter Rust errors, ensure your toolchain is up to date with `rustup update`.

## External integration preflight

Run this before authenticated external operations (for example 1Password-backed API workflows):

```bash
set -euo pipefail

export HOME="${HOME}"
ENV_FILES=(
  "$HOME/.codex.env"
  "$HOME/dev/config/.env"
  "$HOME/dev/config/codex/.env"
  "$HOME/.env"
  "$HOME/.codex/.env"
)

op account list
op item list --categories=API_CREDENTIAL --format json | jq -r '.[] | "\(.title)\t\(.id)"'

for k in CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN; do
  for f in "${ENV_FILES[@]}"; do
    if [ -f "$f" ]; then
      if awk -v key="$k" 'BEGIN {found=0} /^[[:space:]]*#/ {next} {gsub(/^[[:space:]]*(export[[:space:]]+)?/, "", $0); split($0,a,"="); if (a[1]==key) {found=1; exit}} END {if (found) print FILENAME, "found"; }' "$f"; then
        break
      fi
    fi
  done
done
```

If a key is not found, do not continue API calls until the missing value is loaded.
