---
title: Universal Agent Tracking — Real-time Session Streaming, MCP, and IDE Extensions
type: feat
date: 2026-02-17
status: in_progress
revision: deepened-v2
---

# Universal Agent Tracking Implementation Plan

## Enhancement Summary v2

**Deepened on:** 2026-02-17 (v2 with agent reviews)  
**Sections enhanced:** 8  
**Research sources:** MCP Specification, CodexMonitor, jsonrpsee, VS Code API, Compound Engineering agents

### Agent Review Findings

| Agent | Key Finding | Impact |
|-------|-------------|--------|
| **architecture-strategist** | Adapter pattern needs clearer trait boundaries; avoid `Box<dyn>` in hot paths | Medium |
| **security-sentinel** | Session data may contain secrets; need redaction before git notes | High |
| **performance-oracle** | Live session memory unbounded; needs LRU eviction | High |
| **agent-native-reviewer** | Missing agent tools for session introspection; add `list_sessions`, `get_session` | Medium |

### Critical Issues Discovered

1. **Security:** Session content must be redacted before git notes write — API keys, passwords may be in prompts
2. **Performance:** Live sessions table grows indefinitely; need retention policy + archival
3. **Architecture:** `Box<dyn StreamAdapter>` prevents monomorphization; use enum dispatch for hot paths
4. **Agent-Native:** Plan adds UI features without corresponding agent tools for session management

### Lifecycle + Checklist Semantics (2026-02-24 sync pass)

- `[x]` implemented and validated with code/tests
- `[ ]` either deferred to later phases or pending implementation
- `status: in_progress` indicates this remains the active implementation plan (unlike superseded/solved plans)

---

## Overview

Extend Narrative's existing multi-parser architecture to support **real-time session streaming**, **MCP (Model Context Protocol) integration**, **git notes writeback**, and **VS Code/Cursor extension** for capturing GitHub Copilot and other IDE-based AI interactions.

**Current State:** File-based polling via `ParserRegistry` (Claude, Codex, Cursor, Copilot, Gemini, Continue parsers)  
**Target State:** Hybrid file + real-time streaming with unified session storage and git notes durability

---

## Problem Statement

### Current Limitations

1. **Post-hoc only:** Sessions only appear after files are written (seconds to minutes delay)
2. **No live visibility:** Cannot watch AI work in real-time
3. **Git context loss:** Session data trapped in `.narrative/` — doesn't travel with repo
4. **IDE gap:** No capture of Copilot inline completions or IDE chat
5. **No cross-tool replay:** Cannot compare Claude vs Kimi approaches

### Vision Alignment

From Narrative manifesto:

> "The prompt is the primary unit of work... The encounter with code should be progressive disclosure, not initial overwhelm."

Real-time streaming makes intent visible as it happens. Git notes make the narrative durable. IDE integration captures the full spectrum of AI-assisted development.

---

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Session Sources                              │
├─────────────────────────────────────────────────────────────────────┤
│  File-Based (Existing)       Real-Time (New)                        │
│  ├── Claude Code (.claude/)  ├── Codex App Server (JSON-RPC)       │
│  ├── Codex CLI (OTLP)        ├── Claude Desktop (MCP client)       │
│  ├── Kimi (log files)        ├── MCP Server (agents push)          │
│  └── Cursor (logs)           └── VS Code Extension (Copilot)       │
├─────────────────────────────────────────────────────────────────────┤
│                      Session Router (New)                           │
│  ├── FileWatcher (existing, enhanced)                              │
│  ├── StreamAdapter (Codex JSON-RPC)                                │
│  ├── McpClient (Claude Desktop)                                    │
│  ├── McpServer (external agents)                                   │
│  └── IdeExtensionListener (VS Code)                                │
├─────────────────────────────────────────────────────────────────────┤
│                    Normalized Schema (Existing)                     │
│  ├── ParsedSession (ParserRegistry) ✅                             │
│  ├── LiveSession (streaming events) — new                          │
│  └── UnifiedSession (merge file + live) — new                      │
├─────────────────────────────────────────────────────────────────────┤
│                      Storage & Export                               │
│  ├── SQLite (sessions, links, stats) ✅                            │
│  ├── Git Notes Writer (refs/notes/narrative) — new                 │
│  └── Live UI State (React store) — new                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Approach

### Phase 1: Foundation — Refactor & Git Notes (Week 1-2)

#### 1.1 Refactor OTLP Receiver to Adapter Pattern

**Current:** `otlp_receiver.rs` — monolithic gRPC server  
**Target:** `adapters/codex_otlp.rs` — implements StreamAdapter trait

**Files to modify:**
- `src-tauri/src/otlp_receiver.rs` → extract to `src-tauri/src/adapters/codex_otlp.rs`
- `src-tauri/src/lib.rs` → add `adapters` module

**New structure:**
```rust
// src-tauri/src/adapters/mod.rs

// CRITICAL: Use enum dispatch, not Box<dyn>, for performance
pub enum AdapterType {
    CodexOtl(CodexOtlAdapter),
    CodexAppServer(CodexAppServerAdapter),
    McpClient(McpClientAdapter),
    McpServer(McpServerAdapter),
}

pub trait StreamAdapter: Send + Sync {
    fn start(&self, app_handle: AppHandle) -> Result<AdapterHandle, AdapterError>;
    fn stop(&self, handle: AdapterHandle);
}

pub struct AdapterHandle {
    shutdown: oneshot::Sender<()>,
}
```

**Agent Review: architecture-strategist**

**Issue:** `Box<dyn StreamAdapter>` prevents compiler optimizations (no monomorphization)

**Fix:** Use enum dispatch for hot paths:
```rust
// GOOD: Enum dispatch - compiler can optimize
impl AdapterType {
    pub async fn start(&self, event_tx: mpsc::Sender<AdapterEvent>) -> Result<AdapterHandle, AdapterError> {
        match self {
            Self::CodexOtl(a) => a.start(event_tx).await,
            Self::CodexAppServer(a) => a.start(event_tx).await,
            // ...
        }
    }
}
```

**Research Insights:**

**Best Practices:**
- Use `tokio::sync::mpsc` channels for event streaming between adapter and main thread
- Implement graceful shutdown with `tokio::select!` to handle SIGTERM
- Share event schema between adapters via strongly-typed enums (not `serde_json::Value`)

**Performance Considerations:**
- Buffer events in adapter (100-1000 capacity channel) to handle backpressure
- Use `tokio::task::spawn` for each adapter to isolate failures
- **CRITICAL:** Monitor memory usage — unbounded channels can OOM under high event load

**Implementation Details:**
```rust
// Example: AdapterManager with concurrent adapters
use tokio::sync::{mpsc, RwLock};
use std::collections::HashMap;

pub struct AdapterManager {
    adapters: RwLock<HashMap<String, AdapterType>>,  // Enum, not Box<dyn>
    handles: RwLock<HashMap<String, AdapterHandle>>,
    event_tx: mpsc::Sender<AdapterEvent>,
}

impl AdapterManager {
    pub async fn start_all(&self) -> Result<(), AdapterError> {
        let adapters = self.adapters.read().await;
        for (name, adapter) in adapters.iter() {
            let handle = adapter.start(self.event_tx.clone()).await?;
            self.handles.write().await.insert(name.clone(), handle);
        }
        Ok(())
    }
}
```

**Edge Cases:**
- Adapter crash → auto-restart with exponential backoff (max 5 retries)
- Multiple adapters for same tool → deduplicate by session ID
- Shutdown timeout → force kill after 5s if graceful fails

**Acceptance criteria:**
- [ ] OTLP receiver runs as `CodexOtlAdapter` implementing `StreamAdapter`
- [ ] Uses enum dispatch (not `Box<dyn>`) for performance
- [ ] No functional changes — existing tests pass
- [ ] `AdapterManager` can start/stop adapters dynamically

#### 1.2 Git Notes Writer

**New file:** `src-tauri/src/git_notes.rs`

**Function:** Write unified session summary to `refs/notes/narrative` on session link

**Agent Review: security-sentinel** ⚠️ **CRITICAL**

**Issue:** Session content may contain secrets (API keys, passwords in prompts)

**Fix:** Redact before writing to git notes:
```rust
pub fn redact_for_git_notes(session: &ParsedSession) -> RedactedSession {
    RedactedSession {
        session_id: session.origin.session_id.clone(),
        tool: session.origin.tool.clone(),
        model: session.origin.model.clone(),
        summary: session.summary.clone(),
        // REDACT: Don't include raw message content
        // Messages stay in SQLite only
        message_count: session.trace.messages.len(),
        files: session.files_touched.clone(),
        linked_at: Utc::now(),
    }
}
```

**Git notes should NEVER contain:**
- Raw message content (may have secrets)
- Full prompts (may have API keys, credentials)
- Tool call inputs (may have sensitive data)

**Git notes should ONLY contain:**
- Session metadata (ID, tool, model)
- Summary (derived, not raw)
- File list
- Message counts
- Intent classification

**Format:**
```json
{
  "schema_version": "1.0",
  "session_id": "sha256:claude_code:abc123",
  "tool": "claude_code",
  "model": "claude-4-opus",
  "summary": "Refactored auth middleware",
  "intent": "Simplify JWT validation logic",
  "prompts": 5,
  "responses": 12,
  "files": ["src/auth.ts", "src/middleware/jwt.ts"],
  "linked_at": "2026-02-17T12:00:00Z"
  // NOTE: No "excerpts" or raw messages — security risk
}
```

**Research Insights:**

**Best Practices:**
- Use `git2` crate's `Note` API for writing notes (atomic, conflict-safe)
- Namespace notes: `refs/notes/narrative` (not just `refs/notes/commits`)
- Compress large session data with zstd if >10KB

**Performance Considerations:**
- Notes are local only until `git push` — document this limitation
- Each note adds ~200 bytes overhead to repo (acceptable)
- Consider `git notes prune` for cleanup of orphaned notes

**Implementation Details:**
```rust
use git2::{Repository, Signature, Oid};

pub fn write_session_note(
    repo: &Repository,
    commit_sha: &str,
    note_content: &str,
) -> Result<Oid, git2::Error> {
    let sig = Signature::now("Narrative", "narrative@localhost")?;
    let oid = Oid::from_str(commit_sha)?;
    
    // SECURITY: Content must be pre-redacted
    repo.note(
        &sig,                    // author
        &sig,                    // committer
        Some("refs/notes/narrative"), // notes ref
        oid,                     // target commit
        note_content,            // REDACTED content only
        true,                    // force (update if exists)
    )
}
```

**Edge Cases:**
- No git repo → skip silently, log warning
- Invalid commit SHA → skip, mark as "notes_failed" in session_links
- Concurrent writes → `force=true` handles conflicts (last-write-wins)

**Acceptance criteria:**
- [ ] Every linked session writes to `refs/notes/narrative`
- [ ] Content is REDACTED (no raw messages, no secrets)
- [ ] `git log --notes=narrative` shows readable output
- [ ] Notes survive `git clone` (when pushed)
- [ ] Graceful fallback if repo has no notes support

---

### Phase 2: Real-Time Adapters (Week 3-4)

#### 2.1 Codex App Server Adapter

**New file:** `src-tauri/src/adapters/codex_app_server.rs`

**Protocol:** JSON-RPC 2.0 over stdio (Codex App Server as sidecar)

**Key events to handle:**
- `thread/started`, `thread/completed`
- `turn/started`, `turn/completed`
- `item/started`, `item/*/delta`, `item/completed`
- `item/commandExecution/requestApproval` (approval gating)

**State machine:**
```rust
enum LiveSessionState {
    Idle,
    ThreadActive { thread_id: String },
    TurnActive { thread_id: String, turn_id: String },
    ItemStreaming { thread_id: String, turn_id: String, item_id: String },
    AwaitingApproval { thread_id: String, turn_id: String, item_id: String },
}
```

**Agent Review: performance-oracle** ⚠️ **CRITICAL**

**Issue:** `live_sessions` table grows indefinitely — memory leak

**Fix:** Implement retention + archival:
```rust
// In adapter event loop
const MAX_LIVE_SESSIONS: usize = 100;
const LIVE_SESSION_TTL_MINUTES: i64 = 60;

async fn cleanup_old_sessions(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Archive completed sessions to long-term storage
    sqlx::query(
        "INSERT INTO sessions SELECT * FROM live_sessions 
         WHERE status = 'completed' 
         AND last_activity_at < datetime('now', '-1 hour')"
    ).execute(pool).await?;
    
    // Delete from live_sessions
    sqlx::query(
        "DELETE FROM live_sessions 
         WHERE status = 'completed' 
         AND last_activity_at < datetime('now', '-1 hour')"
    ).execute(pool).await?;
    
    // LRU eviction if still over limit
    sqlx::query(
        "DELETE FROM live_sessions 
         WHERE id IN (
             SELECT id FROM live_sessions 
             ORDER BY last_activity_at ASC 
             LIMIT (SELECT COUNT(*) - $1 FROM live_sessions)
         )"
    ).bind(MAX_LIVE_SESSIONS).execute(pool).await?;
    
    Ok(())
}
```

**Agent Review: agent-native-reviewer** ⚠️ **MISSING**

**Issue:** No agent tools for session introspection

**Fix:** Add agent tools (Phase 1.3):
```rust
// New file: src-tauri/src/agent_tools/session_tools.rs

#[tauri::command]
pub async fn agent_list_sessions(
    state: State<'_, DbState>,
    filter: Option<SessionFilter>,
) -> Result<Vec<SessionSummary>, String> {
    // Agent can query sessions
}

#[tauri::command]
pub async fn agent_get_session(
    state: State<'_, DbState>,
    session_id: String,
) -> Result<SessionDetail, String> {
    // Agent can read session content
}

#[tauri::command]
pub async fn agent_link_session_to_commit(
    state: State<'_, DbState>,
    session_id: String,
    commit_sha: String,
) -> Result<(), String> {
    // Agent can manually link sessions
}
```

**Update system prompt** to include:
```
You can introspect AI coding sessions using these tools:
- list_sessions: Show recent sessions from any tool (Claude, Codex, Kimi, etc.)
- get_session: Read full session content
- link_session_to_commit: Manually link a session to a commit

Sessions capture the "why" behind code changes — the prompts, responses, and tool calls.
```

**Research Insights:**

**Best Practices:**
- Use `jsonrpsee` crate — production-grade async JSON-RPC with stdio transport
- Spawn one App Server per workspace (like CodexMonitor does)
- Handle `initialize` handshake before any other requests (required by protocol)
- Buffer deltas and flush on `item/completed` for smoother UI

**Performance Considerations:**
- App Server startup time: ~500ms — cache binary path, spawn eagerly
- Keep-alive: send periodic `ping` to detect stale connections
- Memory: App Server can use 100MB+ — monitor with `sysinfo` crate

**Implementation Details:**
```rust
// Using jsonrpsee for JSON-RPC over stdio
use jsonrpsee::core::client::ClientT;
use jsonrpsee::core::rpc_params;
use jsonrpsee::server::{Server, ServerHandle};

pub struct CodexAppServerAdapter {
    binary_path: PathBuf,
    workspace_root: PathBuf,
}

impl StreamAdapter for CodexAppServerAdapter {
    async fn start(
        &self,
        event_tx: mpsc::Sender<AdapterEvent>
    ) -> Result<AdapterHandle, AdapterError> {
        // Spawn Codex App Server as child process
        let mut child = tokio::process::Command::new(&self.binary_path)
            .arg("--workspace")
            .arg(&self.workspace_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AdapterError::SpawnFailed(e))?;
        
        // Set up JSON-RPC client over stdio
        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let client = build_stdio_client(stdin, stdout).await?;
        
        // Required handshake
        let init_result: InitializeResult = client
            .request(
                "initialize",
                rpc_params!({"clientInfo": {"name": "narrative", "version": "0.6.0"}})
            )
            .await?;
        
        // Send initialized notification
        client.notification("initialized", rpc_params!({})).await?;
        
        // Start event loop...
    }
}
```

**Edge Cases:**
- App Server crash → restart with exponential backoff (max 5 retries)
- Invalid JSON from App Server → log and skip message, don't crash adapter
- Approval timeout → auto-deny after 60s to prevent hung sessions

**Reference Implementation:**
- [CodexMonitor](https://github.com/Dimillian/CodexMonitor) — Tauri app with Codex App Server integration
- Spawns one App Server per workspace, manages thread lifecycle

**Acceptance criteria:**
- [ ] Spawns Codex App Server binary as sidecar
- [ ] Completes `initialize` handshake
- [ ] Emits Tauri events for UI consumption (`session:live:event`)
- [ ] Handles approval requests — shows modal, awaits user decision
- [ ] Persists completed sessions to SQLite via existing schema
- [ ] Implements LRU cleanup for live_sessions table

#### 2.2 MCP Client (Claude Desktop)

**New file:** `src-tauri/src/adapters/mcp_client.rs`

**Function:** Connect to Claude Desktop's MCP server, receive events

**Agent Review: security-sentinel** ⚠️ **CRITICAL**

**Issue:** MCP OAuth requires Resource Indicators (RFC 8707) to prevent token misuse

**Fix:** Implement properly:
```rust
pub async fn connect_with_resource_indicators(
    &self,
    resource_indicator: &str,  // e.g., "narrative://session-capture"
) -> Result<McpClient, McpError> {
    // Launch Claude Desktop with MCP enabled
    let mut child = tokio::process::Command::new(&self.claude_desktop_path)
        .arg("--mcp")
        .arg("stdio")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;
    
    // Initialize with Resource Indicators (RFC 8707)
    let init_params = json!({
        "clientInfo": {"name": "narrative", "version": "0.6.0"},
        "authorization": {
            "resource_indicator": resource_indicator,
            "scope": "sessions:read sessions:write"
        }
    });
    
    // Server MUST validate resource_indicator matches its expected audience
    // This prevents token theft/replay attacks
    
    Ok(())
}
```

**Security Checklist:**
- [ ] Validate MCP server certificate (if TLS)
- [x] Implement Resource Indicators for OAuth
- [x] Scope tokens narrowly (`sessions:read`, not `*`)
- [ ] Rotate tokens on reconnection

**Research Insights:**

**Best Practices:**
- MCP uses JSON-RPC 2.0 (same as Codex App Server — reuse parsing)
- June 2025 spec requires OAuth Resource Indicators (RFC 8707) for auth
- Claude Desktop exposes MCP on stdio (when launched with `--mcp` flag)

**Events:**
- `conversation/started`
- `message/sent`, `message/received`
- `tool/called`, `tool/result`
- `conversation/completed`

**Acceptance criteria:**
- [ ] Discovers and connects to Claude Desktop MCP
- [x] Implements RFC 8707 Resource Indicators
- [ ] Maps MCP events to unified `LiveSession` format
- [ ] Handles disconnection/reconnection gracefully

#### 2.3 MCP Server Mode

**New file:** `src-tauri/src/adapters/mcp_server.rs`

**Function:** Narrative acts as MCP server — agents push sessions to it

**Agent Review: security-sentinel** ⚠️ **CRITICAL**

**Issue:** MCP server accepting arbitrary agent connections is a security risk

**Fix:** Implement authentication:
```rust
pub struct McpServerConfig {
    pub transport: McpTransport,
    pub auth_required: bool,
    pub allowed_clients: Vec<String>,  // Client ID whitelist
    pub api_key: Option<String>,       // For HTTP transport
}

async fn authenticate_client(
    headers: &HeaderMap,
    config: &McpServerConfig,
) -> Result<ClientIdentity, McpError> {
    if !config.auth_required {
        return Ok(ClientIdentity::anonymous());
    }
    
    // Validate API key from header
    let api_key = headers
        .get("x-api-key")
        .ok_or(McpError::AuthRequired)?;
    
    if !constant_time_eq(api_key.as_bytes(), config.api_key.as_ref()?.as_bytes()) {
        return Err(McpError::InvalidCredentials);
    }
    
    Ok(ClientIdentity::authenticated("trusted-agent"))
}
```

**Security Checklist:**
- [x] Require authentication (API key or mTLS)
- [x] Validate client identity
- [ ] Rate limit connections per client
- [ ] Log all session ingestions
- [ ] Validate session schema before storage

**Research Insights:**

**Best Practices:**
- Support both stdio (local) and HTTP/SSE (remote) transports
- Implement MCP `tools/list` and `tools/call` for session operations
- Version your MCP API — clients can negotiate compatibility

**Transport Decision Matrix:**

| Transport | Use Case | Auth | Risk |
|-----------|----------|------|------|
| **stdio** | Local agents | Implicit (process owned) | Low |
| **HTTP** | Remote agents | API key + TLS required | Medium |
| **SSE** | Streaming events | API key + TLS required | Medium |

**Implementation Details:**
```rust
use jsonrpsee::server::{Server, RpcModule};

pub async fn start_mcp_server(
    config: McpServerConfig,
    event_tx: mpsc::Sender<AdapterEvent>,
) -> Result<ServerHandle, McpError> {
    let mut module = RpcModule::new(event_tx.clone());
    
    // Register MCP methods with auth check
    module.register_method("narrative/session/start", |params, ctx, extensions| {
        // Authenticate
        let auth = extensions.get::<AuthExtension>()
            .ok_or(McpError::AuthRequired)?;
        
        let req: StartSessionRequest = params.parse()?;
        ctx.send(AdapterEvent::SessionStarted(req))?;
        Ok(json!({"session_id": req.session_id}))
    })?;
    
    match config.transport {
        McpTransport::Stdio => start_stdio_server(module).await,
        McpTransport::Http { port } => {
            // Require API key for HTTP
            assert!(config.api_key.is_some(), "HTTP transport requires API key");
            start_http_server(module, port, config).await
        }
    }
}
```

**Acceptance criteria:**
- [ ] Exposes MCP server (stdio or HTTP)
- [x] Requires authentication for HTTP transport
- [ ] Accepts connections from external agents
- [ ] Validates and stores incoming sessions

---

### Phase 3: IDE Extension & Kimi (Week 5-6)

#### 3.1 VS Code/Cursor Extension

**New directory:** `extensions/vscode/`

**Tech:** TypeScript, VS Code Extension API

**Research Insights:**

**Best Practices:**
- Use VS Code's Language Model API (`vscode.lm`) for Copilot access
- Inline completions: listen to `onDidAccept` event on completion items
- Chat capture: intercept `vscode.chat.createChatParticipant` if possible, or use logging

**Copilot API Access:**
```typescript
// Access Copilot models via Language Model API
const models = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4'
});

const copilotModel = models[0];
const response = await copilotModel.sendRequest(
    messages,
    {},
    new vscode.CancellationTokenSource().token
);
```

**Implementation Structure:**
```typescript
// extensions/vscode/src/extension.ts
import * as vscode from 'vscode';
import { CopilotTracker } from './copilotTracker';
import { NarrativeClient } from './narrativeClient';

export function activate(context: vscode.ExtensionContext) {
    const narrative = new NarrativeClient('ws://localhost:8787');
    const tracker = new CopilotTracker(narrative);
    
    // Track inline completions
    vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        new CompletionCaptureProvider(narrative)
    );
    
    // Track chat interactions
    tracker.startChatCapture();
}
```

**Communication Options:**

| Method | Latency | Reliability | Complexity |
|--------|---------|-------------|------------|
| **WebSocket** | <10ms | Medium | Low |
| **HTTP POST** | <50ms | High | Low |
| **Log file** | 1-5s | High | Lowest |

**Recommendation:** WebSocket for real-time, fallback to log file if connection fails.

**Acceptance criteria:**
- [ ] Extension installs in VS Code and Cursor
- [ ] Captures Copilot inline completions with context
- [ ] Captures Copilot chat conversations
- [ ] Sends to Narrative in real-time or near-real-time (<5s)

#### 3.2 Kimi Adapter

**New file:** `src-tauri/src/import/kimi_parser.rs`

**Function:** Parse Kimi CLI log files

**Research Insights:**

**Best Practices:**
- Kimi CLI uses JSONL format (similar to Codex sessions)
- Log location: `~/.kimi/logs/` or `$KIMI_LOG_DIR`
- Watch for `.jsonl` files with `kimi-session-*` prefix

**Implementation Details:**
```rust
pub struct KimiParser;

impl SessionParser for KimiParser {
    fn can_parse(&self, path: &Path) -> bool {
        path.extension().map(|e| e == "jsonl").unwrap_or(false)
            && path.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("kimi-session"))
                .unwrap_or(false)
    }
    
    fn parse(&self, path: &Path) -> ParseResult<ParsedSession> {
        // Parse Kimi JSONL format...
    }
}
```

**Acceptance criteria:**
- [ ] Registers in `ParserRegistry`
- [ ] Parses Kimi log format
- [ ] Extracts messages, files, model info

---

## Phase 1.3: Agent-Native Tools (NEW)

**Agent Review: agent-native-reviewer** — Missing agent tools for session introspection

**New file:** `src-tauri/src/agent_tools/mod.rs`

Add agent-accessible tools for session management:

```rust
use tauri::State;

#[tauri::command]
pub async fn agent_list_sessions(
    state: State<'_, DbState>,
    filter: Option<SessionFilter>,
) -> Result<Vec<SessionSummary>, String> {
    let pool = &state.pool;
    
    let sessions = sqlx::query_as::<_, SessionSummary>(
        "SELECT id, tool, model, started_at, message_count, files_touched 
         FROM sessions 
         WHERE ($1 IS NULL OR tool = $1)
         ORDER BY started_at DESC 
         LIMIT 50"
    )
    .bind(filter.as_ref().map(|f| f.tool.clone()))
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(sessions)
}

#[tauri::command]
pub async fn agent_get_session(
    state: State<'_, DbState>,
    session_id: String,
) -> Result<SessionDetail, String> {
    let pool = &state.pool;
    
    let session = sqlx::query_as::<_, SessionDetail>(
        "SELECT * FROM sessions WHERE id = $1"
    )
    .bind(session_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(session)
}

#[tauri::command]
pub async fn agent_link_session(
    state: State<'_, DbState>,
    session_id: String,
    commit_sha: String,
) -> Result<(), String> {
    let pool = &state.pool;
    
    sqlx::query(
        "INSERT INTO session_links (session_id, commit_sha, confidence, auto_linked) 
         VALUES ($1, $2, 1.0, 0)"
    )
    .bind(session_id)
    .bind(commit_sha)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn agent_find_sessions_for_commit(
    state: State<'_, DbState>,
    commit_sha: String,
) -> Result<Vec<SessionSummary>, String> {
    let pool = &state.pool;
    
    let sessions = sqlx::query_as::<_, SessionSummary>(
        "SELECT s.* FROM sessions s
         JOIN session_links sl ON s.id = sl.session_id
         WHERE sl.commit_sha = $1"
    )
    .bind(commit_sha)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(sessions)
}
```

**Implementation evidence (2026-02-24):**
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/agent_tools/session_tools.rs`
- `/Users/jamiecraik/dev/firefly-narrative/src-tauri/src/lib.rs` invoke registration:
  - `agent_list_sessions`
  - `agent_get_session`
  - `agent_link_session_to_commit`
  - `agent_link_session`
- `/Users/jamiecraik/dev/firefly-narrative/src/core/repo/agentSessionTools.ts` TypeScript wrappers.

**Update system prompt** in `AGENTS.md`:
```markdown
## Available Session Tools

When working with AI coding sessions, you can:

- `list_sessions(tool?: string)` — Show recent sessions from any AI tool (Claude, Codex, Kimi, etc.)
- `get_session(session_id)` — Read full session content including messages and tool calls
- `link_session(session_id, commit_sha)` — Manually link a session to a commit
- `find_sessions_for_commit(commit_sha)` — Find all sessions related to a commit

Sessions capture the "why" behind code changes — the prompts, responses, and reasoning 
that led to the final code. Use these tools to understand the narrative behind changes.
```

**Acceptance criteria:**
- [x] Agent can list sessions via tool
- [x] Agent can read session content
- [x] Agent can link sessions to commits
- [x] Tools documented with live command names

---

## Database Schema Changes

### New Tables

```sql
-- Live sessions (in-progress, not yet linked to commit)
-- PERFORMANCE: Limited to 100 active sessions, LRU eviction
CREATE TABLE live_sessions (
    id TEXT PRIMARY KEY,
    tool TEXT NOT NULL,
    model TEXT,
    started_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed, error
    session_data TEXT NOT NULL, -- JSON: messages, files, etc.
    source_type TEXT NOT NULL, -- 'file', 'stream', 'mcp', 'ide'
    repo_id INTEGER,
    -- PERFORMANCE: Index for LRU eviction
    FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

-- Index for LRU cleanup queries
CREATE INDEX idx_live_sessions_activity ON live_sessions(last_activity_at);
CREATE INDEX idx_live_sessions_status ON live_sessions(status);

-- Adapter state tracking
CREATE TABLE adapter_state (
    id INTEGER PRIMARY KEY,
    adapter_type TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    config TEXT, -- JSON: binary path, API keys, etc.
    last_started_at TEXT,
    last_error TEXT
);
```

### Modified Tables

```sql
-- Add git_notes_written flag to session_links
ALTER TABLE session_links ADD COLUMN git_notes_written BOOLEAN NOT NULL DEFAULT 0;

-- Add archival tracking
ALTER TABLE sessions ADD COLUMN archived_at TEXT;
ALTER TABLE sessions ADD COLUMN archive_reason TEXT;
```

---

## UI Changes

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `LiveSessionBadge` | `src/ui/components/LiveSessionBadge.tsx` | Shows active sessions in timeline |
| `LiveSessionPanel` | `src/ui/components/LiveSessionPanel.tsx` | Real-time message streaming |
| `ApprovalModal` | `src/ui/components/ApprovalModal.tsx` | Tool execution gating |
| `ToolBadge` | `src/ui/components/ToolBadge.tsx` | Shows agent type (Kimi, Claude, etc.) |
| `AdapterSettings` | `src/ui/views/AdapterSettings.tsx` | Enable/disable adapters, configure paths |

### Modified Components

| Component | Change |
|-----------|--------|
| `Timeline.tsx` | Show `LiveSessionBadge` alongside commit nodes |
| `SessionExcerpts.tsx` | Support both live and completed sessions |
| `BranchView.tsx` | Add live session panel to right sidebar |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Live session latency** | < 500ms from event to UI | Tauri event timing logs |
| **Git notes coverage** | 100% of linked sessions | `session_links.git_notes_written` |
| **Adapter stability** | > 99% uptime per session | Error rate tracking |
| **Multi-tool sessions** | 3+ tools in single timeline | Manual testing |
| **IDE extension installs** | Functional in VS Code + Cursor | CI test |
| **Agent tool coverage** | 100% of UI features | `AGENTS.md` audit |

---

## Dependencies & Risks

### Dependencies

| Dependency | Status | Blocker? |
|------------|--------|----------|
| Codex App Server binary | Need download/bundle strategy | Yes — decide bundle vs BYO |
| Claude Desktop MCP docs | Verify protocol version | No — can prototype |
| VS Code Extension API | Stable | No |
| Kimi CLI log format | Verify output structure | No — can reverse engineer |
| `jsonrpsee` crate | ✅ Available | No — production-ready |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Codex App Server changes | High — protocol drift | Pin version, have fallback |
| Copilot API instability | Medium — extension may break | Version lock, error handling |
| MCP standard evolution | Medium — spec changes | Abstract MCP layer |
| Performance at scale | Medium — memory leaks | LRU eviction, retention policies |
| Secrets in git notes | **Critical** — data exposure | Redaction before write |

---

## Implementation Phases Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **1. Foundation** | Week 1-2 | OTLP refactor, Git notes writer (WITH REDACTION), AdapterManager |
| **1.3 Agent Tools** | Week 2 | `list_sessions`, `get_session`, `link_session` tools |
| **2. Real-Time** | Week 3-4 | Codex App Server adapter, MCP client/server (WITH AUTH) |
| **3. IDE + Kimi** | Week 5-6 | VS Code extension, Kimi parser |

---

## Security Checklist

- [ ] **Git Notes:** Content is redacted before write (no raw messages)
- [x] **MCP Client:** Implements RFC 8707 Resource Indicators
- [x] **MCP Server:** Requires authentication for HTTP transport
- [ ] **Session Storage:** Secrets scan before persistence
- [ ] **Agent Tools:** Proper authorization checks

---

## References & Research

### Internal

- `src-tauri/src/import/mod.rs` — ParserRegistry pattern
- `src-tauri/src/import/parser.rs` — SessionParser trait
- `src-tauri/src/otlp_receiver.rs` — Current OTLP implementation
- `docs/brainstorms/2026-02-17-codex-app-server-integration-brainstorm.md` — Original brainstorm

### External

- [Codex App Server Protocol](https://developers.openai.com/codex/app-server/)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25) — JSON-RPC 2.0 based
- [MCP Security Best Practices](https://modelcontextprotocol.info/docs/best-practices/) — OAuth Resource Indicators required
- [RFC 8707](https://tools.ietf.org/html/rfc8707) — Resource Indicators for OAuth 2.0
- [CodexMonitor](https://github.com/Dimillian/CodexMonitor) — Reference Tauri implementation
- [jsonrpsee](https://github.com/paritytech/jsonrpsee) — Rust JSON-RPC library
- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- Git notes: `git help notes`

---

## Open Questions

1. **Codex App Server distribution:** Bundle with Narrative or require user installation?
2. **MCP transport:** stdio (simpler) or HTTP (more flexible)?
3. **VS Code extension publishing:** VS Code Marketplace or manual install only?
4. **Cross-tool session identity:** How to detect same session from multiple sources?

---

## Next Steps

1. **URGENT:** Implement git notes redaction before any git notes work
2. **Decision:** Codex App Server bundle vs BYO?
3. **Start Phase 1.1:** Refactor OTLP receiver with enum dispatch
4. **Start Phase 1.3:** Implement agent tools for session introspection

**Ready to start:** Run `/prompts:workflows-work` with this plan.

---

*Plan generated: 2026-02-17*  
*Deepened: 2026-02-17*  
*Agent reviewed: 2026-02-17 (architecture, security, performance, agent-native)*  
*Research sources: MCP Spec, CodexMonitor, jsonrpsee, VS Code API docs, Compound Engineering agents*
