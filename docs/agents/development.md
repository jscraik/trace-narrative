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
