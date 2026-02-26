# Contributing to Narrative

Thanks for your interest in contributing. Narrative is a desktop app built with **tauri v2** (Rust backend + React frontend) that helps developers capture the story behind their code.

## Scope

This guide covers how to propose, make, and submit changes safely.

For behavior expectations, see [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
For security reporting, see [`SECURITY.md`](SECURITY.md).
For user support channels, see [`SUPPORT.md`](SUPPORT.md).

## Quick start

### Prerequisites

- Node.js + pnpm
- Rust toolchain (latest stable)
- Git

### Local setup

1. Fork and clone the repo.
2. Install dependencies.
3. Start the app.

```bash
git clone https://github.com/jscraik/firefly-narrative.git
cd firefly-narrative
pnpm install
pnpm tauri dev
```

## Development workflow

### Branching

- Create a focused branch for each change (`feature/...`, `fix/...`, or similar).
- Keep pull requests small and reviewable.

### Required checks

Run these before opening a pull request:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

If your change touches docs, also run:

```bash
pnpm docs:lint
```

If your change touches Rust backend behavior, run:

```bash
cd src-tauri
cargo check
cargo clippy
```

## Pull request process

1. Make your change with clear, focused commits.
2. Update documentation when behavior or commands change.
3. Confirm checks pass locally.
4. Open a PR using the project PR template.
5. Respond to review feedback and keep scope tight.

## What to contribute

### Good first issues

Look for issues labeled [`good first issue`](https://github.com/jscraik/firefly-narrative/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). Maintainers curate these for new contributors.

### Areas we need help

- Parser support for new AI tools (session log parsers)
- UI/UX accessibility and polish
- Documentation and onboarding
- Test coverage and regression prevention
- Bug fixes from the [bug label](https://github.com/jscraik/firefly-narrative/issues?q=is%3Aissue+is%3Aopen+label%3Abug)

### Code style

- Rust: follow `cargo fmt` and `cargo clippy` defaults
- TypeScript/React: Biome handles formatting (`pnpm lint`)
- Commits: use conventional commits (`feat:`, `fix:`, `docs:`, etc.)

## Verification

After opening a PR, ensure CI passes and keep branch history clean.

## Getting help

- Bugs: open the bug report template
- Features: open the feature request template
- Security concerns: use [`SECURITY.md`](SECURITY.md) and avoid public issues
- General support: use [`SUPPORT.md`](SUPPORT.md)

## Recognition

We credit contributors in project history and release notes.

---

Questions? Open a support issue or tag [@jscraik](https://github.com/jscraik).
