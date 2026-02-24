---
status: complete
priority: p1
issue_id: CR-010
tags:
  - code-review
  - security
  - architecture
  - mcp
  - tauri
dependencies: []
---

## Problem Statement
The universal agent tracking plan defines critical MCP security controls, but the implementation surface for those controls is still absent. This leaves a documented high-risk area unresolved.

## Findings
- The plan explicitly requires `src-tauri/src/adapters/mcp_client.rs` with OAuth Resource Indicators (RFC 8707) and authenticated MCP server transport.
- The same plan includes unchecked critical checklist items for “MCP Client: Implements RFC 8707” and “MCP Server: Requires authentication for HTTP transport.”
- No corresponding MCP adapter/server files currently exist under `src-tauri/src/`, so these controls cannot be enforced at runtime.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-universal-agent-tracking-plan.md` (lines ~492, 532, 651, 1003-1004)
- File search: no `mcp_client.rs` / `mcp_server.rs` in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src`

## Proposed Solutions
### Option 1 (Recommended): Implement MCP client/server modules with mandatory auth gates
- **Effort:** Large
- **Risk:** Medium
- **Pros:** Closes the highest-risk documented gap with explicit transport/auth enforcement.
- **Approach:** Add `mcp_client.rs` and `mcp_server.rs`; enforce RFC 8707 resource indicators and authenticated HTTP transport before accepting session data.

### Option 2: Feature-gate MCP ingestion until controls exist
- **Effort:** Small
- **Risk:** Low
- **Pros:** Prevents insecure partial rollout.
- **Approach:** Hard-disable MCP ingestion paths via config/feature flag; document temporary limitation.

### Option 3: Stub modules + failing tests first
- **Effort:** Medium
- **Risk:** Low
- **Pros:** Creates a safe RED baseline and prevents silent omission.
- **Approach:** Add modules with TODO guards and tests that fail unless auth/resource-indicator paths are implemented.

## Recommended Action
Implemented MCP auth/security scaffolding via dedicated adapters:
- `src-tauri/src/adapters/mcp_client.rs` for RFC 8707 resource-indicator + scoped-token request construction.
- `src-tauri/src/adapters/mcp_server.rs` for mandatory HTTP auth config validation and authenticated client admission checks.

## Technical Details
- Affected components: planned MCP adapter/server surface for universal tracking.
- Risk category: authn/authz + token misuse prevention.
- Added module wiring: `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/adapters/mod.rs` and `mod adapters;` in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/lib.rs`.
- Updated plan checklist evidence in `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-universal-agent-tracking-plan.md`.

## Acceptance Criteria
- [x] `mcp_client` implements RFC 8707 resource-indicator flow.
- [x] MCP server transport rejects unauthenticated HTTP ingestion.
- [x] Security tests validate rejection paths and token scoping.
- [x] Plan checklist items for MCP security can be marked complete with evidence.

## Work Log
- 2026-02-24: Review identified missing MCP security implementation surface versus plan requirements.
- 2026-02-24: Added `mcp_client` + `mcp_server` adapter modules with auth/resource-indicator validation and constant-time API key comparison.
- 2026-02-24: Added/ran adapter unit tests via `cargo test --manifest-path src-tauri/Cargo.toml adapters::mcp_` (10 passing tests).

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-universal-agent-tracking-plan.md`
