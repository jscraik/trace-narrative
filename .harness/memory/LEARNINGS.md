---
schema_version: 1
purpose: Per-project agent knowledge base — repo-specific gotchas and hard-won fixes.
scope: This repo only.
update_policy: |
  Append after any bug, tool failure, or extra-effort fix specific to this repo.
  Universal gotchas go in ~/.codex/instructions/Learnings.md instead.
  Do NOT delete entries. Append only.
  Format: **YYYY-MM-DD [Agent]:** <problem> → <fix>
---

# Learnings

Repo-specific agent knowledge base. Append-only.

> **Scope:** This repo only. Universal gotchas → `~/.codex/instructions/Learnings.md`.
> **Format:** `**YYYY-MM-DD [Agent]:** <problem> → <fix>`

- **2026-03-12 [Codex]:** View-family routing does not live at the repo root. `App.tsx` owns shell wiring, but the mode-to-view split is in `src/AppContent.tsx`; read that file first before changing anchor-vs-surface behavior.

- **2026-03-12 [Codex]:** In rollout screenshot capture, the Agentation dev overlay can contaminate UI evidence. Restart Vite with `VITE_AGENTATION_ENDPOINT=` and `VITE_AGENTATION_WEBHOOK_URL=` so Playwright captures the actual shell rather than tooling chrome.

- **2026-03-12 [Codex]:** Adding a provenance block directly into `narrativeSurfaceSections.tsx` triggered component-size lint warnings during `pnpm check`; move new shared-surface sections into a dedicated module (for example `narrativeSurfaceProvenance.tsx`) before final validation.

- **2026-03-12 [Codex]:** `design-system-guidance` flags arbitrary Tailwind pixel widths like `max-w-[1600px]` as raw-px violations; use rem-based arbitrary values (for example `max-w-[100rem]`) before rerunning `pnpm design-guidance:ci`.

- **2026-03-12 [Codex]:** Any dedicated surface that uses `AuthorityCue` must put each cue inside a matching container with `data-authority-tier` and `data-authority-label`; otherwise the `NarrativeSurfaceView` authority parity tests fail even when the UI looks correct.

- **2026-03-12 [Codex]:** TypeScript does not always narrow optional `action` fields inside JSX event callbacks after conditional rendering; use a local guaranteed action or a non-null assertion inside the guarded branch to keep `pnpm typecheck` green.

- **2026-03-12 [Codex]:** In dedicated evidence screens, `repoState.status === "ready"` does not guarantee optional branch arrays like `sessionExcerpts` are defined; normalize them to `[]` once near the top of the component before deriving counts or JSX state.

- **2026-03-12 [Codex]:** Do not key dashboard browser-preview mocks off "not Tauri" alone; that bypasses real fetch/error paths in Vitest and browser shells. Gate mock dashboard stats to the explicit dev mock repo (`/mock/repo`) or another deliberate preview flag so tests and production fetch logic stay truthful.

- **2026-03-12 [Codex]:** In browser-side UI review, persistent `js_repl` Playwright can fail early when the repo `.mise.toml` is untrusted, and the left navigation exposes routes as `role="tab"` rather than generic buttons; fall back to one-shot Node + `@playwright/test` capture scripts and target sidebar tabs by role for reliable screenshot automation.

- **2026-03-12 [Codex]:** In dedicated evidence screens, fallback mock entries can widen inferred array unions and break TypeScript when later grouped or reduced; add an explicit local item type (for example `TranscriptResult[]`) before mixing real session data with fallback placeholders.
