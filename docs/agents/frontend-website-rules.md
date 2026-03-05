---
schema_version: 1
---

# AGENTS.md — Frontend Website Rules

## Table of Contents

- [Scope and when to apply](#scope-and-when-to-apply)
- [Mandatory Workflow Snippet](#mandatory-workflow-snippet)
- [Always Do First](#always-do-first)
- [Reference Images](#reference-images)
- [Local Server](#local-server)
- [Screenshot Workflow](#screenshot-workflow)
- [Output Defaults](#output-defaults)
- [Brand Assets](#brand-assets)
- [Anti-Generic Guardrails](#anti-generic-guardrails)
- [Hard Rules](#hard-rules)
- [Instruction Governance](#instruction-governance)

## Scope and when to apply

- Use these rules when the task is a **standalone frontend webpage**, such as a marketing or landing page, or when the user explicitly requests a web-page build/delta that is not embedded directly in the tauri app UI.
- These rules are especially for the planned landing-page separation from the tauri app.
- For in-app tauri UI work, follow `docs/agents/tauri.md` and the app-level implementation docs unless the task explicitly asks for landing-page matching workflows.

## Mandatory Workflow Snippet

- Explore project first, then invoke skill.
- IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
- Add a Table of Contents for docs.

## Always Do First

- **Invoke the `$ui-ux-creative-coding` & `$interface-craft`** before writing any frontend code, every session, no exceptions.

## Reference Images

- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server

- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:2000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow

- Use `agent-browser` (via CLI/DevTools) for screenshot capture workflows.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:2000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:2000 label` → saves as `screenshot-N-label.png`
- For component screenshots, use a descriptive component label (e.g. `card`, `button`, `input`, `modal`) as the screenshot label.
  - Example: `node screenshot.mjs http://localhost:2000 card` → `screenshot-N-card.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- Ensure screenshot file names match the exact saved output format above before comparison.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults

- Single `index.html` file, all styles inline, unless user says otherwise.
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Brand Assets

- Always check the `brand/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.
- Always use `$design-system` for brand guidelines.

## Anti-Generic Guardrails

- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules

- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color

## Instruction Governance

- **Resolved items:**
  - `serve.mjs` and `screenshot.mjs` are now present in repository root and satisfy the screenshot workflow command requirements.
  - Frontend workflow applies to the separated landing page build context and is not the default mode for in-app tauri UI edits unless explicitly requested.
- **Flag-for-deletion candidates (redundant/unclear):**
  - Reconcile wording for `design-system` references to one canonical path/source.
