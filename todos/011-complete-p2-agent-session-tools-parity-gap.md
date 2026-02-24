---
status: complete
priority: p2
issue_id: CR-011
tags:
  - code-review
  - architecture
  - agent-native
  - tauri
dependencies: []
---

## Problem Statement
The plan specifies agent session-management tools, but those tools are not present in the codebase. This creates an agent/UI capability parity gap.

## Findings
- The plan defines `agent_list_sessions`, `agent_get_session`, and `agent_link_session_to_commit` under a new `src-tauri/src/agent_tools/session_tools.rs`.
- Those APIs are not implemented in the current `src-tauri/src` tree.
- Without these tools, agents cannot access the same live-session management primitives expected by the plan.

### Evidence
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-universal-agent-tracking-plan.md` (lines ~374, 377, 385, 393, 777, 799)
- File search: no `session_tools.rs` or `agent_tools/` module under `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src`

## Proposed Solutions
### Option 1 (Recommended): Implement session tools exactly as planned
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Restores planned agent-native parity and enables automation workflows.
- **Approach:** Add `agent_tools/session_tools.rs`, wire commands to existing session tables, and expose through Tauri command surface.

### Option 2: Narrow the plan to current capabilities
- **Effort:** Small
- **Risk:** Medium
- **Pros:** Reduces immediate implementation burden.
- **Approach:** Update docs to explicitly defer these tools and define temporary alternatives.

### Option 3: Implement read-only subset first
- **Effort:** Small
- **Risk:** Low
- **Pros:** Delivers immediate parity improvement with lower risk.
- **Approach:** Ship `agent_list_sessions` + `agent_get_session` first, then link/write paths.

## Recommended Action
Implemented the planned session-management tool surface in Rust + TypeScript wrappers and registered commands in the Tauri invoke handler.

## Technical Details
- Affected area: planned agent API surface for session discovery/linking.
- Impact: reduced automation and weaker agent-native feature parity.

## Acceptance Criteria
- [x] `agent_list_sessions` and `agent_get_session` are implemented and tested.
- [x] `agent_link_session_to_commit` is implemented with validation.
- [x] Agent docs reference live, working command names.

## Work Log
- 2026-02-24: Documented agent-session tooling gap between plan and implementation.
- 2026-02-24: Added `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/agent_tools/session_tools.rs` with `agent_list_sessions`, `agent_get_session`, `agent_link_session_to_commit`, and `agent_link_session` commands.
- 2026-02-24: Registered agent tools in `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/lib.rs` and added wrappers in `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/agentSessionTools.ts`.
- 2026-02-24: Added Rust unit tests for listing/getting/linking sessions and validation checks (`cargo test --manifest-path src-tauri/Cargo.toml agent_tools::session_tools::tests::`).
- 2026-02-24: Updated documentation references in `/Users/jamiecraik/dev/firefly-narrative/AGENTS.md` and `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-universal-agent-tracking-plan.md`.

## Resources
- `/Users/jamiecraik/dev/firefly-narrative/docs/plans/2026-02-17-feat-universal-agent-tracking-plan.md`
