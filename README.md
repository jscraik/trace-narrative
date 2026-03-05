# Narrative

<div align="center">
  <img src="docs/assets/screenshots/landing.png" width="700" alt="Narrative Landing Page - Firefly">
</div>

<div align="center">

[![CI](https://github.com/jscraik/firefly-narrative/actions/workflows/ci.yml/badge.svg)](https://github.com/jscraik/firefly-narrative/actions)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![tauri v2](https://img.shields.io/badge/tauri-v2-orange.svg)](https://tauri.app)

</div>

<p align="center">
  <strong>Version control as a narrative medium.</strong><br>
  Capture the story behind your code - from AI prompts to commits.
</p>

<div align="center">
<h3>Quick Install</h3>

```bash
# macOS (Apple Silicon) - Recommended
open https://github.com/jscraik/firefly-narrative/releases/latest
```

If the DMG download/install fails on macOS, use this fallback:

1. Download the release artifacts manually from the same page and ensure you picked the matching architecture.
2. For a direct install fallback:
   - `Control + click` / right-click the DMG (or app) and choose **Open**.
   - If macOS still blocks it, run:

     ```bash
     xattr -dr com.apple.quarantine '/Applications/Firefly Narrative.app'
     ```

   - If that still fails, install via local build:

     ```bash
     pnpm install
     pnpm tauri:build:full
     ```

</div>

## Supported download paths

- **GitHub Releases (recommended):** `https://github.com/jscraik/firefly-narrative/releases/latest`
- **Local build fallback:** `pnpm tauri:build:full` (works on supported OS with Node + Rust toolchain)

## OS fallback notes

| OS | What to download | Fallback notes |
| --- | --- | --- |
| macOS (Apple Silicon) | `firefly-narrative_*_aarch64-apple-darwin.dmg` | Use **right-click + Open** if Gatekeeper blocks it. If still blocked, remove quarantine: `xattr -dr com.apple.quarantine '/Applications/Firefly Narrative.app'`. |
| macOS (Intel) | `firefly-narrative_*_x86_64-apple-darwin.dmg` | Same fallback commands as above if install is blocked. |
| Windows | `firefly-narrative_*_x64.msi` (or `.exe` if no MSI is present) | If installer is blocked, run PowerShell once with admin: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`. |
| Linux | `firefly-narrative_*_amd64.AppImage`, `.deb`, or `.rpm` | If AppImage won’t run: `chmod +x ./firefly-narrative.AppImage`. |

If your OS/arch package is unavailable or blocked, use a local build fallback:

```bash
pnpm install
pnpm tauri:build:full
```

---

## TL;DR

**The Problem**: When you code with AI (Claude, Codex, Cursor), you lose rich context—intent, dead ends, and reasoning. Git commits only show *what* changed, not *why*.

**The Solution**: Narrative captures the full story: AI sessions → intent → commits → timeline. It links your conversations to your code, preserving the thought process behind every line.

### Why Use Narrative?

|Feature|What It Does|
|---|---|
|**📖 Context-Aware Timeline**|Navigate commits with linked AI conversations, not just diffs.|
|**🤖 AI Integration**|Import sessions from Claude Code, Codex CLI, and Cursor.|
|**🔍 Atlas Search**|Find "that thing we discussed about caching" instantly across all sessions.|
|**💾 Local-First**|All data stays in your `.narrative` folder. No cloud needed.|

---

## Visual Tour

### Dashboard

Get high-level insights into your AI-assisted workflow, tracking session impact and productivity.
<p align="center">
  <img src="docs/assets/screenshots/dashboard.png" width="800" alt="Narrative Dashboard">
</p>

### Repository View

Navigate the commit timeline with rich context. See the "why" behind the code.
<p align="center">
  <img src="docs/assets/screenshots/repo.png" width="800" alt="Repository View">
</p>

### Documentation & Knowledge

Access project documentation and knowledge items directly within the narrative interface.
<p align="center">
  <img src="docs/assets/screenshots/docs.png" width="800" alt="Docs View">
</p>

---

## Quick Start

### Build from Source

**Prerequisites**: Node.js, pnpm, Rust toolchain, git.

```bash
# 1. Clone the repository
git clone https://github.com/jscraik/firefly-narrative.git
cd firefly-narrative

# 2. Install dependencies
pnpm install

# 3. Run the development environment
pnpm tauri dev
```

Then open a git repository and see your commit history come to life with narrative context.

---

## Features

- **Timeline View**: A new way to look at git history, focusing on the story.
- **Session Import**:
  - **Claude Code**: Import `.json` logs.
  - **Codex CLI**: Import session history.
  - **Cursor**: Drag and drop chat exports.
- **Atlas Search**: Full-text search across your entire narrative history.
- **Live Updates**: Watch your repo change in real-time.
- **Auto-Ingest**: Automatically capture sessions from supported tools.

---

## Documentation

- [Documentation Index](docs/README.md) — Full documentation map.
- [Development Setup](docs/agents/development.md) — How to set up your environment.
- [Testing Guide](docs/agents/testing.md) — Running tests and type checks.
- [Repository Structure](docs/agents/repo-structure.md) — Codebase layout overview.
- [Frontend Website Rules](docs/agents/frontend-website-rules.md) — Standalone landing-page workflow, screenshot conventions, and visual review.
- [Landing Page Separation](docs/agents/landing-page-separation.md) — Scope split between standalone landing work and in-app tauri UI changes.

---

## Troubleshooting

### "App opens but is empty"

Click "Open repo" and select a valid git repository. If you have not selected a repo, Narrative waits for your input.

### "Import failed"

Check that your log files are in the supported JSON format. See [Documentation](docs/README.md) for detailed format specifications.

### "Build errors"

Run `pnpm install` again. Ensure your Rust toolchain is up to date (`rustup update`).

### "serve / screenshot workflow errors"

For standalone frontend-only landing-page work, see [Frontend Website Rules](docs/agents/frontend-website-rules.md) for the complete screenshot workflow.

---

## Community & Support

- Support channels and triage: [`SUPPORT.md`](SUPPORT.md)
- Security reporting: [`SECURITY.md`](SECURITY.md)
- Contributor workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Community standards: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md). Narrative uses **tauri v2** (Rust backend + React frontend).

### Ways to Contribute

- **Bug reports** - [Open an issue](https://github.com/jscraik/firefly-narrative/issues/new?template=bug_report.yml)
- **Feature requests** - [Request a feature](https://github.com/jscraik/firefly-narrative/issues/new?template=feature_request.yml)
- **Code** - Look for [good first issues](https://github.com/jscraik/firefly-narrative/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

---

## License

Apache-2.0. See [`LICENSE`](LICENSE).

---

<img
  src="./brand/brand-mark.webp"
  alt="brAInwav"
  height="28"
  align="left"
/>

<br clear="left" />

**brAInwav**  
*from demo to duty*
