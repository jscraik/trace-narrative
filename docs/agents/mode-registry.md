# Mode Registry

This registry tracks the mapping between `Mode` values and their view family/section as part of the "Updated UI Views" implementation.

| Mode | Family | Section | Description |
| :--- | :--- | :--- | :--- |
| `dashboard` | **Anchor** | Overview | Main analytics dashboard |
| `work-graph` | Cockpit | Overview | Workspace relationship graph |
| `assistant` | Cockpit | Overview | Story Copilot interactive assistant |
| `live` | Cockpit | Monitor | Live trace feed |
| `sessions` | Cockpit | Monitor | Session history and imports |
| `transcripts` | Cockpit | Monitor | Transcript lens and analysis |
| `tools` | Cockpit | Monitor | Tool usage and pulse |
| `costs` | Cockpit | Monitor | Operational costs tracking |
| `timeline` | Cockpit | Monitor | Decision and event timeline |
| `repo` | **Anchor** | Workspace | Individual repository evidence view |
| `repo-pulse` | Cockpit | Workspace | Cross-repository pulse and health |
| `diffs` | Cockpit | Workspace | Diff review and staging |
| `snapshots` | Cockpit | Workspace | Checkpoints and repo snapshots |
| `worktrees` | Cockpit | Workspace | Isolated parallel branch workspaces |
| `attribution` | Cockpit | Workspace | Trace lens and attribution logic |
| `skills` | Cockpit | Ecosystem | Agent skills and capabilities |
| `agents` | Cockpit | Ecosystem | Agent roles and definitions |
| `memory` | Cockpit | Ecosystem | Shared memory and context graph |
| `hooks` | Cockpit | Ecosystem | External hooks and triggers |
| `setup` | Cockpit | Ecosystem | Tooling and environment setup |
| `ports` | Cockpit | Ecosystem | Port and service mapping |
| `hygiene` | Cockpit | Health | Resource cleanup and hygiene |
| `deps` | Cockpit | Health | Dependency watch and security |
| `env` | Cockpit | Health | Environment variable hygiene |
| `status` | Cockpit | Health | Trust center and capture status |
| `docs` | **Anchor** | Configure | Documentation and guides |
| `settings` | Cockpit | Configure | Application settings |

## Contract Status

- [x] Cockpit View definition (dynamic)
- [x] Mode-to-Section mapping
- [ ] Narrative-led auto-switching rules

## Automation Rules

- **Low Confidence Narrative Recall**: Automatically trigger a secondary verification pass if narrative confidence drops below 60%.
- **High Drift Delta Alert**: Flag branches where the `diff` surface area exceeds narrative coverage by more than 40%.
- **Actionable Projection Verification**: Verify that every narrative projection has at least one associated `Task` or `Linear` ticket link.
- **Protocol Enforcer**: Block branch completion if mandatory narrative "Evidence" links for core modules are missing.
