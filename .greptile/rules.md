# Trace Narrative - Code Review Guidelines

## Architecture

- This is a Tauri desktop app with React frontend and Rust backend
- Follow the existing patterns for component organization
- Use Framer Motion for animations (already integrated)
- Use lucide-react for icons (already integrated)
- Use Radix UI primitives for complex UI components

## Code Style

### TypeScript/React

- Use functional components with hooks
- One component per file
- Follow existing naming conventions
- Use Tailwind CSS for styling
- Prefer `clsx` for conditional class names

### Rust

- Follow standard Rust conventions
- Run `cargo fmt` and `cargo clippy` before commits
- Keep unsafe blocks minimal and well-documented

## UI Patterns

- Use native `<details>` elements for collapsible sections (matches existing pattern)
- Match the existing color system: `text-text-primary`, `bg-bg-secondary`, etc.
- Use `text-xs` for labels, `text-sm` for body text

## Key Files

- `src/ui/components/` - React components
- `src/core/` - Business logic
- `src-tauri/src/` - Rust backend
- `harness.contract.json` - Governance policy
