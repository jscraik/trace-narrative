schema_version: 1

# Instruction Governance

## Contradictions (resolved)
- [RESOLVED] Frontend rules are scoped for landing-page/web-only work only, especially for the planned separation of the landing page from the Tauri app.

## Flag for deletion candidates
- Remove duplicate mentions of default screenshot instructions that imply local Puppeteer paths now replaced by `agent-browser`.
- Collapse repeated command lists between root and category docs (prefer one source per topic).
- Replace generic wording like "Always serve on localhost" with the concrete localhost command only in the relevant task-scoped docs.
- If this separation boundary becomes stable, merge notes from `landing-page-separation.md` into `frontend-website-rules.md` and mark this as finalized.
