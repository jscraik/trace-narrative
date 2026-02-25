use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::{HashMap, VecDeque};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{command, AppHandle, Emitter, Manager, State};

const RESTART_BUDGET: usize = 3;
const RESTART_WINDOW_SECS: i64 = 60;
const MAX_DEDUPE_LOG: usize = 200;
const MAX_DEDUPE_SOURCES: usize = 10_000;
const MAX_TRANSITIONS: usize = 100;
const MONITOR_POLL_INTERVAL_MS: u64 = 250;
const RESTART_COOLDOWN_MS: u64 = 500;
const SHUTDOWN_GRACE_MS: u64 = 1_500;
const DEFAULT_LIVE_SESSIONS_TTL_HOURS: i64 = 72;
const DEFAULT_LIVE_SESSIONS_MAX_ROWS: i64 = 10_000;
const RECONNECT_REASON_SCHEMA_MISMATCH: &str = "schema_version_mismatch";
const RECONNECT_REASON_SESSION_INVALID: &str = "session_invalid";
const RECONNECT_REASON_TOKEN_INVALID: &str = "token_invalid";

pub const LIVE_SESSION_EVENT: &str = "session:live:event";

#[derive(Clone, Default)]
pub struct CodexAppServerState {
    inner: Arc<Mutex<CodexAppServerRuntime>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProcessState {
    Inactive,
    Starting,
    Running,
    Degraded,
    CrashLoop,
    Stopping,
}

impl ProcessState {
    fn as_status(self) -> &'static str {
        match self {
            ProcessState::Inactive => "inactive",
            ProcessState::Starting => "starting",
            ProcessState::Running => "running",
            ProcessState::Degraded => "degraded",
            ProcessState::CrashLoop => "crash_loop",
            ProcessState::Stopping => "stopping",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AuthState {
    NeedsLogin,
    Authenticating,
    Authenticated,
    LoggedOut,
}

impl AuthState {
    fn as_status(self) -> &'static str {
        match self {
            AuthState::NeedsLogin => "needs_login",
            AuthState::Authenticating => "authenticating",
            AuthState::Authenticated => "authenticated",
            AuthState::LoggedOut => "logged_out",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HandshakeState {
    NotStarted,
    InitializeSent,
    Initialized,
}

impl HandshakeState {
    fn initialize_sent(self) -> bool {
        matches!(
            self,
            HandshakeState::InitializeSent | HandshakeState::Initialized
        )
    }

    fn initialized(self) -> bool {
        matches!(self, HandshakeState::Initialized)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StreamSessionState {
    Disabled,
    Expected,
    Alive,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAppServerStatus {
    pub state: String, // inactive | starting | running | degraded | crash_loop | error | stopping
    pub initialized: bool,
    pub initialize_sent: bool,
    pub auth_state: String, // needs_login | authenticating | authenticated | logged_out
    pub auth_mode: String,
    pub stream_healthy: bool,
    pub stream_kill_switch: bool,
    pub restart_budget: usize,
    pub restart_attempts_in_window: usize,
    pub last_error: Option<String>,
    pub last_transition_at_iso: Option<String>,
}

impl Default for CodexAppServerStatus {
    fn default() -> Self {
        Self {
            state: "inactive".to_string(),
            initialized: false,
            initialize_sent: false,
            auth_state: "needs_login".to_string(),
            auth_mode: "chatgpt".to_string(),
            stream_healthy: false,
            stream_kill_switch: false,
            restart_budget: RESTART_BUDGET,
            restart_attempts_in_window: 0,
            last_error: None,
            last_transition_at_iso: Some(now_iso()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAccountStatus {
    pub auth_state: String,
    pub auth_mode: String,
    pub interactive_login_required: bool,
    pub supported_modes: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexStreamEventInput {
    pub provider: String,
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub event_type: String,
    pub source: String, // otel | app_server_stream
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexStreamIngestResult {
    pub key: String,
    pub decision: String, // accepted | duplicate | replaced | dropped
    pub chosen_source: String,
    pub replaced_source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexStreamDedupeDecision {
    pub at_iso: String,
    pub key: String,
    pub decision: String,
    pub incoming_source: String,
    pub chosen_source: String,
    pub replaced_source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureReliabilityMetrics {
    pub stream_events_accepted: u64,
    pub stream_events_duplicates: u64,
    pub stream_events_dropped: u64,
    pub stream_events_replaced: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureModeTransition {
    pub at_iso: String,
    pub from_mode: Option<String>,
    pub to_mode: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureReliabilityStatus {
    pub mode: String, // OTEL_ONLY | HYBRID_ACTIVE | DEGRADED_STREAMING | FAILURE
    pub otel_baseline_healthy: bool,
    pub stream_expected: bool,
    pub stream_healthy: bool,
    pub reasons: Vec<String>,
    pub metrics: CaptureReliabilityMetrics,
    pub transitions: Vec<CaptureModeTransition>,
    pub app_server: CodexAppServerStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LiveSessionEventPayload {
    #[serde(rename_all = "camelCase")]
    SessionDelta {
        thread_id: String,
        turn_id: String,
        item_id: String,
        event_type: String,
        source: String,
        sequence_id: u64,
        received_at_iso: String,
        payload: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    ApprovalRequest {
        request_id: String,
        thread_id: String,
        turn_id: String,
        command: String,
        options: Vec<String>,
        timeout_ms: u64,
    },
    #[serde(rename_all = "camelCase")]
    ApprovalResult {
        request_id: String,
        thread_id: String,
        approved: bool,
        decided_at_iso: String,
        decided_by: Option<String>,
        reason: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    ParserValidationError {
        kind: String, // schema_mismatch | missing_fields | protocol_violation
        raw_preview: String,
        reason: String,
        occurred_at_iso: String,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveSessionsCleanupResult {
    pub removed_rows: u64,
    pub ttl_hours: i64,
    pub max_rows: i64,
}

#[derive(Debug, Clone)]
struct PendingApproval {
    thread_id: String,
    created_at_epoch_ms: i64,
    timeout_ms: u64,
}

struct SidecarProcess {
    child: Child,
}

struct CodexAppServerRuntime {
    status: CodexAppServerStatus,
    process_state: ProcessState,
    auth_state: AuthState,
    handshake_state: HandshakeState,
    stream_session_state: StreamSessionState,
    restart_attempts: VecDeque<i64>,
    sidecar_path: Option<PathBuf>,
    sidecar: Option<SidecarProcess>,
    monitor_cancel: Arc<AtomicBool>,
    monitor_handle: Option<thread::JoinHandle<()>>,
    dedupe_sources: HashMap<String, String>,
    dedupe_key_order: VecDeque<String>,
    recent_dedupe: VecDeque<CodexStreamDedupeDecision>,
    stream_events_accepted: u64,
    stream_events_duplicates: u64,
    stream_events_dropped: u64,
    stream_events_replaced: u64,
    transitions: VecDeque<CaptureModeTransition>,
    last_mode: Option<String>,
    approval_waiters: HashMap<String, PendingApproval>,
    parse_error_total: HashMap<String, u64>,
    approval_result_total: HashMap<String, u64>,
    restart_total: HashMap<String, u64>,
    event_sequence_id: u64,
}

impl Default for CodexAppServerRuntime {
    fn default() -> Self {
        Self {
            status: CodexAppServerStatus::default(),
            process_state: ProcessState::Inactive,
            auth_state: AuthState::NeedsLogin,
            handshake_state: HandshakeState::NotStarted,
            stream_session_state: StreamSessionState::Disabled,
            restart_attempts: VecDeque::new(),
            sidecar_path: None,
            sidecar: None,
            monitor_cancel: Arc::new(AtomicBool::new(false)),
            monitor_handle: None,
            dedupe_sources: HashMap::new(),
            dedupe_key_order: VecDeque::new(),
            recent_dedupe: VecDeque::new(),
            stream_events_accepted: 0,
            stream_events_duplicates: 0,
            stream_events_dropped: 0,
            stream_events_replaced: 0,
            transitions: VecDeque::new(),
            last_mode: None,
            approval_waiters: HashMap::new(),
            parse_error_total: HashMap::new(),
            approval_result_total: HashMap::new(),
            restart_total: HashMap::new(),
            event_sequence_id: 0,
        }
    }
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn now_epoch_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn normalize_source(input: &str) -> String {
    let normalized = input.trim().to_lowercase();
    match normalized.as_str() {
        "app_server_stream" | "appserver" | "stream" => "app_server_stream".to_string(),
        "otel" | "codex_otel" => "otel".to_string(),
        _ => normalized,
    }
}

fn normalize_auth_mode(input: &str) -> String {
    input.trim().to_lowercase()
}

fn event_identity_key(input: &CodexStreamEventInput) -> String {
    format!(
        "v1|{}|{}|{}|{}|{}",
        input.provider.trim().to_lowercase(),
        input.thread_id.trim(),
        input.turn_id.trim(),
        input.item_id.trim(),
        input.event_type.trim().to_lowercase(),
    )
}

fn source_priority(event_type: &str, source: &str) -> i32 {
    let event_type = event_type.to_lowercase();
    if event_type.contains("delta") {
        return if source == "app_server_stream" {
            30
        } else {
            10
        };
    }
    if event_type.contains("completed") {
        return if source == "otel" { 30 } else { 20 };
    }
    if source == "app_server_stream" {
        20
    } else {
        10
    }
}

fn increment_labeled_counter(counter: &mut HashMap<String, u64>, key: &str) {
    let entry = counter.entry(key.to_string()).or_insert(0);
    *entry += 1;
}

fn sync_status(runtime: &mut CodexAppServerRuntime) {
    runtime.status.state = runtime.process_state.as_status().to_string();
    runtime.status.auth_state = runtime.auth_state.as_status().to_string();
    runtime.status.initialize_sent = runtime.handshake_state.initialize_sent();
    runtime.status.initialized = runtime.handshake_state.initialized();
    runtime.status.restart_attempts_in_window = runtime.restart_attempts.len();
    runtime.status.restart_budget = RESTART_BUDGET;
    runtime.status.last_transition_at_iso = Some(now_iso());
}

fn set_process_state(
    runtime: &mut CodexAppServerRuntime,
    process_state: ProcessState,
    last_error: Option<String>,
) {
    runtime.process_state = process_state;
    runtime.status.last_error = last_error;
    sync_status(runtime);
}

fn emit_status(app_handle: &AppHandle, status: &CodexAppServerStatus) {
    let _ = app_handle.emit("codex-app-server-status", status.clone());
}

fn emit_live_session_event(app_handle: &AppHandle, payload: &LiveSessionEventPayload) {
    let _ = app_handle.emit(LIVE_SESSION_EVENT, payload.clone());
}

fn detect_sidecar_path(app_handle: &AppHandle) -> Option<PathBuf> {
    if let Ok(override_path) = std::env::var("NARRATIVE_CODEX_APP_SERVER_BIN") {
        let path = PathBuf::from(override_path);
        if path.exists() && is_executable_candidate(&path) {
            return Some(path);
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join("bin/codex-app-server"));
        candidates.push(resource_dir.join("bin/codex-app-server.exe"));
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri/bin/codex-app-server"));
        candidates.push(cwd.join("src-tauri/bin/codex-app-server.exe"));
        candidates.push(cwd.join("bin/codex-app-server"));
    }

    candidates
        .into_iter()
        .find(|p| p.exists() && is_executable_candidate(p))
}

fn is_executable_candidate(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path) {
            let mode = meta.permissions().mode();
            return mode & 0o111 != 0;
        }
    }
    true
}

fn prune_restart_attempts(runtime: &mut CodexAppServerRuntime, now_epoch: i64) {
    while let Some(front) = runtime.restart_attempts.front() {
        if now_epoch - *front > RESTART_WINDOW_SECS {
            runtime.restart_attempts.pop_front();
        } else {
            break;
        }
    }
    runtime.status.restart_attempts_in_window = runtime.restart_attempts.len();
}

fn register_start_failure(runtime: &mut CodexAppServerRuntime, message: String, cause: &str) {
    let now_epoch = chrono::Utc::now().timestamp();
    runtime.restart_attempts.push_back(now_epoch);
    prune_restart_attempts(runtime, now_epoch);

    increment_labeled_counter(&mut runtime.restart_total, cause);

    runtime.status.stream_healthy = false;
    runtime.stream_session_state = StreamSessionState::Failed;
    if runtime.restart_attempts.len() >= RESTART_BUDGET {
        set_process_state(runtime, ProcessState::CrashLoop, Some(message));
    } else {
        set_process_state(runtime, ProcessState::Degraded, Some(message));
    }
}

fn remember_dedupe_source(runtime: &mut CodexAppServerRuntime, key: &str, source: &str) {
    runtime
        .dedupe_sources
        .insert(key.to_string(), source.to_string());

    if let Some(pos) = runtime
        .dedupe_key_order
        .iter()
        .position(|existing| existing == key)
    {
        runtime.dedupe_key_order.remove(pos);
    }
    runtime.dedupe_key_order.push_back(key.to_string());

    while runtime.dedupe_key_order.len() > MAX_DEDUPE_SOURCES {
        if let Some(evicted) = runtime.dedupe_key_order.pop_front() {
            runtime.dedupe_sources.remove(&evicted);
        }
    }
}

fn apply_account_updated(
    runtime: &mut CodexAppServerRuntime,
    auth_mode: &str,
    authenticated: bool,
) {
    let mode = normalize_auth_mode(auth_mode);
    if mode != "chatgpt" {
        runtime.status.auth_mode = mode.clone();
        runtime.auth_state = AuthState::NeedsLogin;
        runtime.status.stream_healthy = false;
        if runtime.process_state != ProcessState::CrashLoop {
            runtime.process_state = ProcessState::Degraded;
        }
        runtime.status.last_error = Some(format!(
            "Unsupported auth mode for v1: {mode}. Expected chatgpt",
        ));
        sync_status(runtime);
        return;
    }

    runtime.status.auth_mode = mode;
    if authenticated {
        runtime.auth_state = AuthState::Authenticated;
        runtime.status.last_error = None;
        if runtime.process_state == ProcessState::Running && runtime.status.stream_healthy {
            runtime.stream_session_state = StreamSessionState::Alive;
        }
    } else {
        runtime.auth_state = AuthState::NeedsLogin;
        runtime.status.stream_healthy = false;
        runtime.stream_session_state = StreamSessionState::Failed;
        if runtime.process_state != ProcessState::CrashLoop {
            runtime.process_state = ProcessState::Degraded;
        }
        runtime.status.last_error =
            Some("Authentication required via sidecar account update".to_string());
    }
    sync_status(runtime);
}

fn emit_mode_transition(
    app_handle: &AppHandle,
    runtime: &mut CodexAppServerRuntime,
    mode: &str,
    reason: &str,
) {
    let previous = runtime.last_mode.clone();
    if previous.as_deref() == Some(mode) {
        return;
    }

    let transition = CaptureModeTransition {
        at_iso: now_iso(),
        from_mode: previous,
        to_mode: mode.to_string(),
        reason: reason.to_string(),
    };

    runtime.last_mode = Some(mode.to_string());
    runtime.transitions.push_front(transition.clone());
    while runtime.transitions.len() > MAX_TRANSITIONS {
        runtime.transitions.pop_back();
    }

    let _ = app_handle.emit("capture-reliability-transition", transition);
}

fn spawn_sidecar_process(path: &Path) -> Result<SidecarProcess, String> {
    let mut command = Command::new(path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn Codex App Server sidecar: {e}"))?;

    let _ = child.id();
    Ok(SidecarProcess { child })
}

fn send_sidecar_message(
    runtime: &mut CodexAppServerRuntime,
    message: &serde_json::Value,
) -> Result<(), String> {
    let Some(sidecar) = runtime.sidecar.as_mut() else {
        return Err("Codex App Server sidecar is not running".to_string());
    };

    let Some(stdin) = sidecar.child.stdin.as_mut() else {
        return Err("Codex App Server stdin is unavailable".to_string());
    };

    let encoded =
        serde_json::to_vec(message).map_err(|e| format!("failed to encode sidecar message: {e}"))?;
    stdin
        .write_all(&encoded)
        .map_err(|e| format!("failed to write sidecar message: {e}"))?;
    stdin
        .write_all(b"\n")
        .map_err(|e| format!("failed to write sidecar message delimiter: {e}"))?;
    stdin
        .flush()
        .map_err(|e| format!("failed to flush sidecar message: {e}"))?;

    Ok(())
}

fn spawn_monitor_thread(
    app_handle: AppHandle,
    state: Arc<Mutex<CodexAppServerRuntime>>,
    cancel: Arc<AtomicBool>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        while !cancel.load(Ordering::SeqCst) {
            let mut should_restart = false;
            let mut restart_path: Option<PathBuf> = None;

            {
                let mut runtime = match state.lock() {
                    Ok(guard) => guard,
                    Err(_) => break,
                };

                if runtime.sidecar.is_none() {
                    break;
                }

                let child_status = runtime
                    .sidecar
                    .as_mut()
                    .and_then(|sidecar| sidecar.child.try_wait().ok().flatten());

                if let Some(exit_status) = child_status {
                    runtime.sidecar = None;
                    runtime.status.stream_healthy = false;
                    runtime.stream_session_state = StreamSessionState::Failed;
                    register_start_failure(
                        &mut runtime,
                        format!("Codex App Server sidecar exited: {exit_status}"),
                        "process_exit",
                    );

                    if runtime.process_state != ProcessState::CrashLoop
                        && !runtime.status.stream_kill_switch
                    {
                        should_restart = true;
                        restart_path = runtime.sidecar_path.clone();
                    }

                    emit_status(&app_handle, &runtime.status);
                }
            }

            if should_restart {
                thread::sleep(Duration::from_millis(RESTART_COOLDOWN_MS));
                if cancel.load(Ordering::SeqCst) {
                    break;
                }

                if let Some(path) = restart_path {
                    match spawn_sidecar_process(&path) {
                        Ok(sidecar) => {
                            let mut runtime = match state.lock() {
                                Ok(guard) => guard,
                                Err(_) => break,
                            };
                            runtime.sidecar = Some(sidecar);
                            runtime.process_state = ProcessState::Running;
                            runtime.stream_session_state = StreamSessionState::Expected;
                            runtime.handshake_state = HandshakeState::NotStarted;
                            runtime.status.stream_healthy = false;
                            runtime.status.last_error = Some(
                                "Sidecar restarted; waiting for initialize/auth handshake"
                                    .to_string(),
                            );
                            sync_status(&mut runtime);
                            emit_status(&app_handle, &runtime.status);
                        }
                        Err(err) => {
                            let mut runtime = match state.lock() {
                                Ok(guard) => guard,
                                Err(_) => break,
                            };
                            register_start_failure(&mut runtime, err, "restart_spawn_failed");
                            emit_status(&app_handle, &runtime.status);
                        }
                    }
                }
            }

            thread::sleep(Duration::from_millis(MONITOR_POLL_INTERVAL_MS));
        }
    })
}

fn with_db_pool(app_handle: &AppHandle) -> Option<Arc<SqlitePool>> {
    app_handle
        .try_state::<crate::DbState>()
        .map(|state| state.0.clone())
}

fn parse_i64_env(key: &str, default_value: i64) -> i64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(default_value)
}

fn extract_repo_id(payload: &serde_json::Value) -> Option<i64> {
    payload
        .get("repoId")
        .or_else(|| payload.get("repo_id"))
        .and_then(serde_json::Value::as_i64)
        .filter(|value| *value > 0)
}

fn validate_reconnect_payload(payload: &LiveSessionEventPayload) -> Result<(), &'static str> {
    let LiveSessionEventPayload::SessionDelta { payload, .. } = payload else {
        return Ok(());
    };

    let schema_version = payload
        .get("schemaVersion")
        .or_else(|| payload.get("schema_version"))
        .and_then(serde_json::Value::as_str);
    if let Some(schema_version) = schema_version {
        if schema_version != "v1" {
            return Err(RECONNECT_REASON_SCHEMA_MISMATCH);
        }
    }

    let session_valid = payload
        .get("sessionValid")
        .or_else(|| payload.get("session_valid"))
        .and_then(serde_json::Value::as_bool);
    if matches!(session_valid, Some(false)) {
        return Err(RECONNECT_REASON_SESSION_INVALID);
    }

    let token_valid = payload
        .get("tokenValid")
        .or_else(|| payload.get("token_valid"))
        .and_then(serde_json::Value::as_bool);
    let token_expired = payload
        .get("tokenExpired")
        .or_else(|| payload.get("token_expired"))
        .and_then(serde_json::Value::as_bool);
    if matches!(token_valid, Some(false)) || matches!(token_expired, Some(true)) {
        return Err(RECONNECT_REASON_TOKEN_INVALID);
    }

    Ok(())
}

fn apply_reconnect_validation_failure(runtime: &mut CodexAppServerRuntime, reason: &'static str) {
    runtime.status.stream_healthy = false;
    runtime.stream_session_state = StreamSessionState::Failed;
    if runtime.process_state != ProcessState::CrashLoop {
        runtime.process_state = ProcessState::Degraded;
    }
    runtime.status.last_error = Some(format!("Reconnect validation failed: {reason}"));
    increment_labeled_counter(&mut runtime.restart_total, reason);
    increment_labeled_counter(&mut runtime.parse_error_total, "protocol_violation");
    sync_status(runtime);
}

fn assert_thread_snapshot_access(runtime: &CodexAppServerRuntime) -> Result<(), String> {
    if runtime.handshake_state != HandshakeState::Initialized {
        return Err(
            "Handshake incomplete: initialize + initialized required before thread requests"
                .to_string(),
        );
    }
    if runtime.auth_state != AuthState::Authenticated {
        return Err("Authentication required before requesting thread data".to_string());
    }
    Ok(())
}

fn live_sessions_ttl_hours() -> i64 {
    parse_i64_env(
        "NARRATIVE_LIVE_SESSIONS_TTL_HOURS",
        DEFAULT_LIVE_SESSIONS_TTL_HOURS,
    )
}

fn live_sessions_max_rows() -> i64 {
    parse_i64_env(
        "NARRATIVE_LIVE_SESSIONS_MAX_ROWS",
        DEFAULT_LIVE_SESSIONS_MAX_ROWS,
    )
}

async fn upsert_live_session(
    pool: &SqlitePool,
    payload: &LiveSessionEventPayload,
) -> Result<(), String> {
    let (thread_id, turn_id, item_id, event_type, source, status, payload_json, last_activity_at) =
        match payload {
            LiveSessionEventPayload::SessionDelta {
                thread_id,
                turn_id,
                item_id,
                event_type,
                source,
                received_at_iso,
                ..
            } => {
                let status = if event_type.to_lowercase().contains("completed") {
                    "completed"
                } else {
                    "active"
                };
                (
                    thread_id.clone(),
                    turn_id.clone(),
                    item_id.clone(),
                    event_type.clone(),
                    source.clone(),
                    status.to_string(),
                    serde_json::to_string(payload).map_err(|e| e.to_string())?,
                    received_at_iso.clone(),
                )
            }
            _ => return Ok(()),
        };

    sqlx::query(
        r#"
        INSERT INTO live_sessions (
          thread_id, turn_id, item_id, event_type, source, status, payload, last_activity_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ','now')), (strftime('%Y-%m-%dT%H:%M:%fZ','now')))
        ON CONFLICT(thread_id, turn_id, item_id, event_type)
        DO UPDATE SET
          source = excluded.source,
          status = excluded.status,
          payload = excluded.payload,
          last_activity_at = excluded.last_activity_at,
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        "#,
    )
    .bind(thread_id)
    .bind(turn_id)
    .bind(item_id)
    .bind(event_type)
    .bind(source)
    .bind(status)
    .bind(payload_json)
    .bind(last_activity_at)
    .execute(pool)
    .await
    .map_err(|e| format!("failed to upsert live_sessions row: {e}"))?;

    Ok(())
}

async fn cleanup_live_sessions_with_policy(
    pool: &SqlitePool,
    ttl_hours: i64,
    max_rows: i64,
) -> Result<LiveSessionsCleanupResult, String> {
    let cutoff = format!("-{ttl_hours} hours");

    let ttl_result =
        sqlx::query("DELETE FROM live_sessions WHERE last_activity_at < datetime('now', ?)")
            .bind(cutoff)
            .execute(pool)
            .await
            .map_err(|e| format!("failed to cleanup live_sessions by ttl: {e}"))?;

    let cap_result = sqlx::query(
        r#"
        DELETE FROM live_sessions
        WHERE id IN (
          SELECT id
          FROM live_sessions
          ORDER BY datetime(last_activity_at) DESC, id DESC
          LIMIT -1 OFFSET ?
        )
        "#,
    )
    .bind(max_rows)
    .execute(pool)
    .await
    .map_err(|e| format!("failed to cleanup live_sessions by row cap: {e}"))?;

    Ok(LiveSessionsCleanupResult {
        removed_rows: ttl_result.rows_affected() + cap_result.rows_affected(),
        ttl_hours,
        max_rows,
    })
}

fn cleanup_live_sessions_blocking(
    app_handle: &AppHandle,
) -> Result<Option<LiveSessionsCleanupResult>, String> {
    let Some(pool) = with_db_pool(app_handle) else {
        return Ok(None);
    };

    let ttl_hours = live_sessions_ttl_hours();
    let max_rows = live_sessions_max_rows();

    tauri::async_runtime::block_on(cleanup_live_sessions_with_policy(
        &pool, ttl_hours, max_rows,
    ))
    .map(Some)
}

fn persist_live_event_blocking(
    app_handle: &AppHandle,
    payload: &LiveSessionEventPayload,
) -> Result<(), String> {
    let Some(pool) = with_db_pool(app_handle) else {
        return Ok(());
    };

    tauri::async_runtime::block_on(async {
        upsert_live_session(&pool, payload).await?;
        if let LiveSessionEventPayload::SessionDelta {
            thread_id,
            turn_id,
            item_id,
            event_type,
            source,
            payload,
            received_at_iso,
            ..
        } = payload
        {
            if event_type.to_lowercase().contains("completed") {
                let Some(repo_id) = extract_repo_id(payload) else {
                    return Err(format!(
                        "missing repoId for completed session persistence (thread_id={}, turn_id={}, item_id={})",
                        thread_id, turn_id, item_id
                    ));
                };

                crate::import::commands::store_codex_app_server_completed_session(
                    &pool,
                    repo_id,
                    thread_id,
                    turn_id,
                    item_id,
                    event_type,
                    source,
                    payload,
                    received_at_iso,
                )
                .await
                .map_err(|err| format!("canonical session persistence failed: {err}"))?;

                let _ = cleanup_live_sessions_with_policy(
                    &pool,
                    live_sessions_ttl_hours(),
                    live_sessions_max_rows(),
                )
                .await?;
            }
        }
        Ok::<(), String>(())
    })
}

fn parse_event_from_legacy_input(event: CodexStreamEventInput) -> LiveSessionEventPayload {
    LiveSessionEventPayload::SessionDelta {
        thread_id: event.thread_id,
        turn_id: event.turn_id,
        item_id: event.item_id,
        event_type: event.event_type,
        source: normalize_source(&event.source),
        sequence_id: 0,
        received_at_iso: now_iso(),
        payload: event.payload.unwrap_or(serde_json::Value::Null),
    }
}

fn parser_validation_error(
    kind: &str,
    raw: &serde_json::Value,
    reason: &str,
) -> LiveSessionEventPayload {
    let mut preview = raw.to_string();
    if preview.len() > 512 {
        preview.truncate(512);
    }
    LiveSessionEventPayload::ParserValidationError {
        kind: kind.to_string(),
        raw_preview: preview,
        reason: reason.to_string(),
        occurred_at_iso: now_iso(),
    }
}

fn parse_live_payload(
    raw: serde_json::Value,
) -> Result<LiveSessionEventPayload, LiveSessionEventPayload> {
    match serde_json::from_value::<LiveSessionEventPayload>(raw.clone()) {
        Ok(parsed) => Ok(parsed),
        Err(_) => {
            let provider = raw
                .get("provider")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("codex")
                .to_string();
            let thread_id = raw
                .get("threadId")
                .or_else(|| raw.get("thread_id"))
                .and_then(serde_json::Value::as_str)
                .map(ToOwned::to_owned);
            let turn_id = raw
                .get("turnId")
                .or_else(|| raw.get("turn_id"))
                .and_then(serde_json::Value::as_str)
                .map(ToOwned::to_owned);
            let item_id = raw
                .get("itemId")
                .or_else(|| raw.get("item_id"))
                .and_then(serde_json::Value::as_str)
                .map(ToOwned::to_owned);
            let event_type = raw
                .get("eventType")
                .or_else(|| raw.get("event_type"))
                .and_then(serde_json::Value::as_str)
                .map(ToOwned::to_owned);

            if let (Some(thread_id), Some(turn_id), Some(item_id), Some(event_type)) =
                (thread_id, turn_id, item_id, event_type)
            {
                let source = raw
                    .get("source")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("app_server_stream");
                let payload = raw
                    .get("payload")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);

                return Ok(parse_event_from_legacy_input(CodexStreamEventInput {
                    provider,
                    thread_id,
                    turn_id,
                    item_id,
                    event_type,
                    source: source.to_string(),
                    payload: Some(payload),
                }));
            }

            Err(parser_validation_error(
                "missing_fields",
                &raw,
                "Unable to parse sidecar event payload",
            ))
        }
    }
}

fn apply_session_delta(
    runtime: &mut CodexAppServerRuntime,
    input: &CodexStreamEventInput,
) -> CodexStreamIngestResult {
    let key = event_identity_key(input);
    let incoming_source = normalize_source(&input.source);
    let event_type = input.event_type.trim().to_lowercase();

    let mut decision = "accepted".to_string();
    let mut replaced_source: Option<String> = None;
    let chosen_source;

    if let Some(existing_source) = runtime.dedupe_sources.get(&key).cloned() {
        if existing_source == incoming_source {
            decision = "duplicate".to_string();
            runtime.stream_events_duplicates += 1;
            chosen_source = existing_source;
        } else {
            let incoming_priority = source_priority(&event_type, &incoming_source);
            let existing_priority = source_priority(&event_type, &existing_source);
            if incoming_priority > existing_priority {
                remember_dedupe_source(runtime, &key, &incoming_source);
                decision = "replaced".to_string();
                runtime.stream_events_replaced += 1;
                replaced_source = Some(existing_source.clone());
                chosen_source = incoming_source;
            } else {
                decision = "dropped".to_string();
                runtime.stream_events_dropped += 1;
                chosen_source = existing_source;
            }
        }
    } else {
        remember_dedupe_source(runtime, &key, &incoming_source);
        runtime.stream_events_accepted += 1;
        chosen_source = incoming_source;
    }

    let log_entry = CodexStreamDedupeDecision {
        at_iso: now_iso(),
        key: key.clone(),
        decision: decision.clone(),
        incoming_source: normalize_source(&input.source),
        chosen_source: chosen_source.clone(),
        replaced_source: replaced_source.clone(),
    };
    runtime.recent_dedupe.push_front(log_entry);
    while runtime.recent_dedupe.len() > MAX_DEDUPE_LOG {
        runtime.recent_dedupe.pop_back();
    }

    if runtime.process_state == ProcessState::Running
        && runtime.handshake_state == HandshakeState::Initialized
        && runtime.auth_state == AuthState::Authenticated
        && matches!(decision.as_str(), "accepted" | "replaced")
    {
        runtime.status.stream_healthy = true;
        runtime.stream_session_state = if event_type.contains("completed") {
            StreamSessionState::Completed
        } else {
            StreamSessionState::Alive
        };
        sync_status(runtime);
    }

    CodexStreamIngestResult {
        key,
        decision,
        chosen_source,
        replaced_source,
    }
}

fn expire_pending_approvals(
    runtime: &mut CodexAppServerRuntime,
    now_ms: i64,
) -> Vec<LiveSessionEventPayload> {
    let mut expired_request_ids: Vec<String> = Vec::new();
    for (request_id, pending) in &runtime.approval_waiters {
        let expires_at_ms = pending
            .created_at_epoch_ms
            .saturating_add(pending.timeout_ms as i64);
        if now_ms >= expires_at_ms {
            expired_request_ids.push(request_id.clone());
        }
    }

    let mut results = Vec::new();
    for request_id in expired_request_ids {
        if let Some(pending) = runtime.approval_waiters.remove(&request_id) {
            let payload = LiveSessionEventPayload::ApprovalResult {
                request_id,
                thread_id: pending.thread_id,
                approved: false,
                decided_at_iso: now_iso(),
                decided_by: Some("system".to_string()),
                reason: Some("Timed out waiting for approval response".to_string()),
            };
            increment_labeled_counter(&mut runtime.approval_result_total, "timeout");
            results.push(payload);
        }
    }

    results
}

fn handle_live_event_internal(
    runtime: &mut CodexAppServerRuntime,
    payload: &LiveSessionEventPayload,
) -> Option<CodexStreamIngestResult> {
    runtime.event_sequence_id = runtime.event_sequence_id.saturating_add(1);

    match payload {
        LiveSessionEventPayload::SessionDelta {
            thread_id,
            turn_id,
            item_id,
            event_type,
            source,
            payload,
            ..
        } => {
            let input = CodexStreamEventInput {
                provider: "codex".to_string(),
                thread_id: thread_id.clone(),
                turn_id: turn_id.clone(),
                item_id: item_id.clone(),
                event_type: event_type.clone(),
                source: source.clone(),
                payload: Some(payload.clone()),
            };
            Some(apply_session_delta(runtime, &input))
        }
        LiveSessionEventPayload::ApprovalRequest {
            request_id,
            thread_id,
            timeout_ms,
            ..
        } => {
            runtime.approval_waiters.insert(
                request_id.clone(),
                PendingApproval {
                    thread_id: thread_id.clone(),
                    created_at_epoch_ms: now_epoch_ms(),
                    timeout_ms: *timeout_ms,
                },
            );
            None
        }
        LiveSessionEventPayload::ApprovalResult {
            request_id,
            approved,
            ..
        } => {
            runtime.approval_waiters.remove(request_id);
            increment_labeled_counter(
                &mut runtime.approval_result_total,
                if *approved { "approved" } else { "rejected" },
            );
            None
        }
        LiveSessionEventPayload::ParserValidationError { kind, .. } => {
            increment_labeled_counter(&mut runtime.parse_error_total, kind);
            None
        }
    }
}

fn command_not_exposed_error(command: &str) -> String {
    format!("command-not-exposed: {command} is internal-only; use sidecar event bridge")
}

fn terminate_child_with_timeout(child: &mut Child, timeout: Duration) -> Result<(), String> {
    let start = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) => {
                if start.elapsed() >= timeout {
                    child
                        .kill()
                        .map_err(|e| format!("failed to kill sidecar process: {e}"))?;
                    let _ = child.wait();
                    return Ok(());
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(err) => return Err(format!("failed while waiting for sidecar exit: {err}")),
        }
    }
}

fn schedule_cleanup_task(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(err) = cleanup_live_sessions_blocking(&app_handle) {
            eprintln!("Narrative: live_sessions cleanup failed: {err}");
        }
    });
}

#[command(rename_all = "camelCase")]
pub fn get_codex_app_server_status(
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAppServerStatus, String> {
    let runtime = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn start_codex_app_server(
    app_handle: AppHandle,
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;

    if runtime.sidecar.is_some() {
        return Ok(runtime.status.clone());
    }

    runtime.process_state = ProcessState::Starting;
    runtime.stream_session_state = StreamSessionState::Expected;
    runtime.handshake_state = HandshakeState::NotStarted;
    runtime.auth_state = AuthState::NeedsLogin;
    runtime.status.stream_healthy = false;
    runtime.status.last_error = None;
    sync_status(&mut runtime);

    if runtime.status.stream_kill_switch {
        runtime.stream_session_state = StreamSessionState::Disabled;
        set_process_state(
            &mut runtime,
            ProcessState::Degraded,
            Some("Stream enrichment kill-switch enabled".to_string()),
        );
        emit_status(&app_handle, &runtime.status);
        return Ok(runtime.status.clone());
    }

    let Some(sidecar_path) = detect_sidecar_path(&app_handle) else {
        register_start_failure(
            &mut runtime,
            "Codex App Server sidecar binary not found (expected bin/codex-app-server)".to_string(),
            "spawn_path_missing",
        );
        emit_status(&app_handle, &runtime.status);
        return Ok(runtime.status.clone());
    };

    match spawn_sidecar_process(&sidecar_path) {
        Ok(sidecar) => {
            runtime.sidecar_path = Some(sidecar_path);
            runtime.sidecar = Some(sidecar);
            runtime.process_state = ProcessState::Running;
            runtime.status.stream_healthy = false;
            runtime.status.last_error = Some(
                "Sidecar started; waiting for initialize/initialized/authenticated handshake"
                    .to_string(),
            );
            sync_status(&mut runtime);

            let cancel = Arc::new(AtomicBool::new(false));
            runtime.monitor_cancel = cancel.clone();
            runtime.monitor_handle = Some(spawn_monitor_thread(
                app_handle.clone(),
                state.inner.clone(),
                cancel,
            ));
            emit_status(&app_handle, &runtime.status);
            drop(runtime);
            schedule_cleanup_task(app_handle);
        }
        Err(err) => {
            register_start_failure(&mut runtime, err, "spawn_failed");
            emit_status(&app_handle, &runtime.status);
        }
    }

    let runtime = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn stop_codex_app_server(
    app_handle: AppHandle,
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAppServerStatus, String> {
    let (mut sidecar, monitor_handle, cancel) = {
        let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
        runtime.process_state = ProcessState::Stopping;
        runtime.status.stream_healthy = false;
        runtime.stream_session_state = StreamSessionState::Failed;
        sync_status(&mut runtime);
        emit_status(&app_handle, &runtime.status);

        (
            runtime.sidecar.take(),
            runtime.monitor_handle.take(),
            runtime.monitor_cancel.clone(),
        )
    };

    cancel.store(true, Ordering::SeqCst);

    if let Some(ref mut process) = sidecar {
        let _ = terminate_child_with_timeout(
            &mut process.child,
            Duration::from_millis(SHUTDOWN_GRACE_MS),
        );
    }

    if let Some(handle) = monitor_handle {
        let _ = handle.join();
    }

    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    runtime.sidecar = None;
    runtime.stream_session_state = StreamSessionState::Disabled;
    runtime.handshake_state = HandshakeState::NotStarted;
    runtime.auth_state = AuthState::NeedsLogin;
    runtime.status.stream_healthy = false;
    set_process_state(&mut runtime, ProcessState::Inactive, None);
    emit_status(&app_handle, &runtime.status);
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_initialize(
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    if runtime.process_state == ProcessState::Inactive
        || runtime.process_state == ProcessState::CrashLoop
    {
        return Err("App Server is not running; cannot send initialize handshake".to_string());
    }
    let initialize_request = serde_json::json!({
        "method": "initialize",
        "id": 1,
        "params": {
            "clientInfo": {
                "name": "firefly-narrative",
                "title": "Firefly Narrative",
                "version": env!("CARGO_PKG_VERSION")
            }
        }
    });
    send_sidecar_message(&mut runtime, &initialize_request)?;
    runtime.handshake_state = HandshakeState::InitializeSent;
    sync_status(&mut runtime);
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_initialized(
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    if runtime.handshake_state != HandshakeState::InitializeSent {
        return Err("initialize must be called before initialized".to_string());
    }
    let initialized_notification = serde_json::json!({
        "method": "initialized",
        "params": {}
    });
    send_sidecar_message(&mut runtime, &initialized_notification)?;
    runtime.handshake_state = HandshakeState::Initialized;
    runtime.stream_session_state = StreamSessionState::Expected;
    sync_status(&mut runtime);
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_account_read(
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAccountStatus, String> {
    let runtime = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(CodexAccountStatus {
        auth_state: runtime.status.auth_state.clone(),
        auth_mode: runtime.status.auth_mode.clone(),
        interactive_login_required: runtime.status.auth_mode == "chatgpt",
        supported_modes: vec!["chatgpt".to_string()],
    })
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_account_login_start(
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAccountStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    runtime.auth_state = AuthState::Authenticating;
    sync_status(&mut runtime);
    Ok(CodexAccountStatus {
        auth_state: runtime.status.auth_state.clone(),
        auth_mode: runtime.status.auth_mode.clone(),
        interactive_login_required: true,
        supported_modes: vec!["chatgpt".to_string()],
    })
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_account_login_completed(
    state: State<'_, CodexAppServerState>,
    success: bool,
) -> Result<CodexAccountStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    if success {
        runtime.auth_state = AuthState::Authenticating;
        runtime.status.last_error = None;
    } else {
        runtime.auth_state = AuthState::NeedsLogin;
        runtime.status.stream_healthy = false;
        runtime.stream_session_state = StreamSessionState::Failed;
        if runtime.process_state != ProcessState::CrashLoop {
            runtime.process_state = ProcessState::Degraded;
        }
        runtime.status.last_error = Some("Authentication cancelled or failed".to_string());
    }
    sync_status(&mut runtime);
    Ok(CodexAccountStatus {
        auth_state: runtime.status.auth_state.clone(),
        auth_mode: runtime.status.auth_mode.clone(),
        interactive_login_required: true,
        supported_modes: vec!["chatgpt".to_string()],
    })
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_account_updated(
    state: State<'_, CodexAppServerState>,
    auth_mode: String,
    authenticated: bool,
) -> Result<CodexAccountStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    apply_account_updated(&mut runtime, &auth_mode, authenticated);
    Ok(CodexAccountStatus {
        auth_state: runtime.status.auth_state.clone(),
        auth_mode: runtime.status.auth_mode.clone(),
        interactive_login_required: true,
        supported_modes: vec!["chatgpt".to_string()],
    })
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_account_logout(
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAccountStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    runtime.auth_state = AuthState::LoggedOut;
    runtime.status.stream_healthy = false;
    runtime.stream_session_state = StreamSessionState::Failed;
    sync_status(&mut runtime);
    Ok(CodexAccountStatus {
        auth_state: runtime.status.auth_state.clone(),
        auth_mode: runtime.status.auth_mode.clone(),
        interactive_login_required: true,
        supported_modes: vec!["chatgpt".to_string()],
    })
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_set_stream_kill_switch(
    state: State<'_, CodexAppServerState>,
    enabled: bool,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    runtime.status.stream_kill_switch = enabled;
    if enabled {
        runtime.process_state = ProcessState::Degraded;
        runtime.stream_session_state = StreamSessionState::Disabled;
        runtime.status.stream_healthy = false;
        runtime.status.last_error = Some("Stream enrichment disabled by kill-switch".to_string());
    }
    sync_status(&mut runtime);
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_request_thread_snapshot(
    state: State<'_, CodexAppServerState>,
    thread_id: String,
) -> Result<serde_json::Value, String> {
    let runtime = state.inner.lock().map_err(|e| e.to_string())?;
    assert_thread_snapshot_access(&runtime)?;
    Ok(serde_json::json!({
        "threadId": thread_id,
        "status": "ok",
        "source": "codex-app-server",
    }))
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_receive_live_event(
    app_handle: AppHandle,
    state: State<'_, CodexAppServerState>,
    payload: serde_json::Value,
) -> Result<Option<CodexStreamIngestResult>, String> {
    let parsed = match parse_live_payload(payload.clone()) {
        Ok(parsed) => parsed,
        Err(parser_error) => {
            let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
            handle_live_event_internal(&mut runtime, &parser_error);
            emit_live_session_event(&app_handle, &parser_error);
            emit_status(&app_handle, &runtime.status);
            return Err("protocol-violation: failed to parse sidecar payload".to_string());
        }
    };

    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;

    if let Err(reason) = validate_reconnect_payload(&parsed) {
        apply_reconnect_validation_failure(&mut runtime, reason);
        let parser_error = LiveSessionEventPayload::ParserValidationError {
            kind: "protocol_violation".to_string(),
            raw_preview: "reconnect validation failed".to_string(),
            reason: format!("Reconnect validation failed: {reason}"),
            occurred_at_iso: now_iso(),
        };
        handle_live_event_internal(&mut runtime, &parser_error);
        emit_live_session_event(&app_handle, &parser_error);
        emit_status(&app_handle, &runtime.status);
        return Err(format!("reconnect-validation-failed:{reason}"));
    }

    for timed_out in expire_pending_approvals(&mut runtime, now_epoch_ms()) {
        emit_live_session_event(&app_handle, &timed_out);
    }

    let result = handle_live_event_internal(&mut runtime, &parsed);

    emit_live_session_event(&app_handle, &parsed);

    if let LiveSessionEventPayload::SessionDelta { .. } = &parsed {
        if let Err(err) = persist_live_event_blocking(&app_handle, &parsed) {
            let reason = format!("Dropped completion persistence due to error: {err}");
            eprintln!("Narrative: {reason}");
            let parser_error = LiveSessionEventPayload::ParserValidationError {
                kind: "protocol_violation".to_string(),
                raw_preview: "session persistence failed".to_string(),
                reason,
                occurred_at_iso: now_iso(),
            };
            handle_live_event_internal(&mut runtime, &parser_error);
            emit_live_session_event(&app_handle, &parser_error);
        }
    }

    emit_status(&app_handle, &runtime.status);
    Ok(result)
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_submit_approval(
    app_handle: AppHandle,
    state: State<'_, CodexAppServerState>,
    request_id: String,
    approved: bool,
    reason: Option<String>,
) -> Result<LiveSessionEventPayload, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    for timed_out in expire_pending_approvals(&mut runtime, now_epoch_ms()) {
        emit_live_session_event(&app_handle, &timed_out);
    }
    let Some(pending) = runtime.approval_waiters.remove(&request_id) else {
        return Err(format!("approval request not found: {request_id}"));
    };

    let payload = LiveSessionEventPayload::ApprovalResult {
        request_id,
        thread_id: pending.thread_id,
        approved,
        decided_at_iso: now_iso(),
        decided_by: Some("user".to_string()),
        reason,
    };

    handle_live_event_internal(&mut runtime, &payload);
    emit_live_session_event(&app_handle, &payload);
    Ok(payload)
}

#[command(rename_all = "camelCase")]
pub fn get_codex_stream_dedupe_log(
    state: State<'_, CodexAppServerState>,
    limit: Option<usize>,
) -> Result<Vec<CodexStreamDedupeDecision>, String> {
    let runtime = state.inner.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50).clamp(1, 200);
    Ok(runtime.recent_dedupe.iter().take(limit).cloned().collect())
}

#[command(rename_all = "camelCase")]
pub fn get_capture_reliability_status(
    app_handle: AppHandle,
    state: State<'_, CodexAppServerState>,
) -> Result<CaptureReliabilityStatus, String> {
    let config = crate::ingest_config::load_config().unwrap_or_default();

    let has_base_watch_paths = !config.watch_paths.claude.is_empty()
        || !config.watch_paths.cursor.is_empty()
        || ((config.codex.mode == "logs" || config.codex.mode == "both")
            && !config.watch_paths.codex_logs.is_empty());
    let otel_baseline_healthy =
        config.auto_ingest_enabled && (has_base_watch_paths || config.codex.receiver_enabled);

    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    let app_server = runtime.status.clone();

    let stream_expected = config.codex.stream_enrichment_enabled
        && !config.codex.stream_kill_switch
        && !app_server.stream_kill_switch;
    let stream_healthy = matches!(runtime.process_state, ProcessState::Running)
        && runtime.handshake_state == HandshakeState::Initialized
        && runtime.auth_state == AuthState::Authenticated
        && app_server.stream_healthy
        && runtime.stream_session_state != StreamSessionState::Failed;

    let mode = if otel_baseline_healthy && stream_healthy {
        "HYBRID_ACTIVE"
    } else if otel_baseline_healthy && stream_expected {
        "DEGRADED_STREAMING"
    } else if otel_baseline_healthy {
        "OTEL_ONLY"
    } else {
        "FAILURE"
    }
    .to_string();

    let mut reasons = Vec::new();
    if !otel_baseline_healthy {
        reasons.push("OTEL baseline capture is unavailable".to_string());
    }
    if stream_expected && !stream_healthy {
        reasons.push("Codex streaming unavailable; falling back to OTEL baseline".to_string());
    }
    if let Some(err) = &app_server.last_error {
        reasons.push(err.clone());
    }

    emit_mode_transition(
        &app_handle,
        &mut runtime,
        &mode,
        reasons
            .first()
            .map(String::as_str)
            .unwrap_or("capture mode evaluated"),
    );

    Ok(CaptureReliabilityStatus {
        mode,
        otel_baseline_healthy,
        stream_expected,
        stream_healthy,
        reasons,
        metrics: CaptureReliabilityMetrics {
            stream_events_accepted: runtime.stream_events_accepted,
            stream_events_duplicates: runtime.stream_events_duplicates,
            stream_events_dropped: runtime.stream_events_dropped,
            stream_events_replaced: runtime.stream_events_replaced,
        },
        transitions: runtime.transitions.iter().cloned().collect(),
        app_server,
    })
}

/// TODO(2026-02-24): migration-safe deprecation path — keep command shape for one release,
/// but reject renderer mutation attempts. Remove in next release after bridge rollout verification.
#[command(rename_all = "camelCase")]
pub fn codex_app_server_set_stream_health(
    _healthy: bool,
    _reason: Option<String>,
) -> Result<CodexAppServerStatus, String> {
    Err(command_not_exposed_error(
        "codex_app_server_set_stream_health",
    ))
}

/// TODO(2026-02-24): migration-safe deprecation path — keep command shape for one release,
/// but reject renderer mutation attempts. Remove in next release after bridge rollout verification.
#[command(rename_all = "camelCase")]
pub fn ingest_codex_stream_event(
    _event: CodexStreamEventInput,
) -> Result<CodexStreamIngestResult, String> {
    Err(command_not_exposed_error("ingest_codex_stream_event"))
}

#[cfg(test)]
mod tests {
    use super::{
        apply_account_updated, apply_reconnect_validation_failure, assert_thread_snapshot_access,
        cleanup_live_sessions_with_policy, command_not_exposed_error, event_identity_key,
        expire_pending_approvals, handle_live_event_internal, parse_event_from_legacy_input,
        parse_live_payload, parser_validation_error, register_start_failure,
        remember_dedupe_source, source_priority, terminate_child_with_timeout,
        validate_reconnect_payload, AuthState, CodexAppServerRuntime, CodexAppServerStatus,
        CodexStreamEventInput, HandshakeState, LiveSessionEventPayload, MAX_DEDUPE_SOURCES,
        RECONNECT_REASON_SCHEMA_MISMATCH, RECONNECT_REASON_SESSION_INVALID,
        RECONNECT_REASON_TOKEN_INVALID, RESTART_BUDGET,
    };
    use sqlx::sqlite::SqlitePoolOptions;
    use std::process::Command;
    use std::time::Duration;

    #[test]
    fn identity_key_is_stable() {
        let input = CodexStreamEventInput {
            provider: "codex".to_string(),
            thread_id: "th_1".to_string(),
            turn_id: "tu_1".to_string(),
            item_id: "it_1".to_string(),
            event_type: "item/completed".to_string(),
            source: "otel".to_string(),
            payload: None,
        };

        assert_eq!(
            event_identity_key(&input),
            "v1|codex|th_1|tu_1|it_1|item/completed"
        );
    }

    #[test]
    fn precedence_prefers_stream_for_delta_and_otel_for_completed() {
        assert!(
            source_priority("item/agentMessage/delta", "app_server_stream")
                > source_priority("item/agentMessage/delta", "otel")
        );
        assert!(
            source_priority("item/completed", "otel")
                > source_priority("item/completed", "app_server_stream")
        );
    }

    #[test]
    fn restart_budget_enters_crash_loop_at_threshold() {
        let mut runtime = CodexAppServerRuntime::default();
        for i in 0..RESTART_BUDGET {
            register_start_failure(&mut runtime, format!("failure-{i}"), "test");
        }
        assert_eq!(runtime.status.state, "crash_loop");
        assert_eq!(runtime.status.restart_attempts_in_window, RESTART_BUDGET);
    }

    #[test]
    fn start_failure_sets_degraded_state_before_crash_loop_threshold() {
        let mut runtime = CodexAppServerRuntime::default();
        register_start_failure(&mut runtime, "spawn failed".to_string(), "spawn_failed");

        assert_eq!(runtime.status.state, "degraded");
        assert_eq!(runtime.process_state, super::ProcessState::Degraded);
        assert_eq!(runtime.restart_total.get("spawn_failed").copied(), Some(1));
        assert!(runtime
            .status
            .last_error
            .as_deref()
            .unwrap_or_default()
            .contains("spawn failed"));
    }

    #[test]
    fn chatgpt_account_updated_sets_authenticated_when_verified() {
        let mut runtime = CodexAppServerRuntime {
            auth_state: AuthState::NeedsLogin,
            handshake_state: HandshakeState::Initialized,
            ..CodexAppServerRuntime::default()
        };
        runtime.status = CodexAppServerStatus {
            state: "running".to_string(),
            stream_healthy: true,
            ..CodexAppServerStatus::default()
        };

        apply_account_updated(&mut runtime, "chatgpt", true);

        assert_eq!(runtime.status.auth_state, "authenticated");
        assert!(runtime.status.last_error.is_none());
    }

    #[test]
    fn account_updated_rejects_unsupported_mode() {
        let mut runtime = CodexAppServerRuntime::default();
        apply_account_updated(&mut runtime, "apikey", true);
        assert_eq!(runtime.status.auth_state, "needs_login");
        assert_eq!(runtime.status.state, "degraded");
        assert_eq!(runtime.status.auth_mode, "apikey");
        assert!(runtime
            .status
            .last_error
            .as_deref()
            .unwrap_or_default()
            .contains("Unsupported auth mode"));
    }

    #[test]
    fn dedupe_source_cache_is_bounded() {
        let mut runtime = CodexAppServerRuntime::default();
        for idx in 0..(MAX_DEDUPE_SOURCES + 32) {
            let key = format!("k-{idx}");
            remember_dedupe_source(&mut runtime, &key, "otel");
        }

        assert_eq!(runtime.dedupe_sources.len(), MAX_DEDUPE_SOURCES);
        assert_eq!(runtime.dedupe_key_order.len(), MAX_DEDUPE_SOURCES);
        assert!(!runtime.dedupe_sources.contains_key("k-0"));
        assert!(runtime
            .dedupe_sources
            .contains_key(&format!("k-{}", MAX_DEDUPE_SOURCES + 31)));
    }

    #[test]
    fn parser_payload_fallback_supports_legacy_shape() {
        let raw = serde_json::json!({
            "provider": "codex",
            "threadId": "th_1",
            "turnId": "tu_1",
            "itemId": "it_1",
            "eventType": "item/completed",
            "source": "otel",
            "payload": {"done": true}
        });

        let parsed = parse_live_payload(raw).expect("legacy payload should parse");
        assert!(matches!(
            parsed,
            LiveSessionEventPayload::SessionDelta { .. }
        ));
    }

    #[test]
    fn parser_validation_error_is_produced_for_invalid_payload() {
        let raw = serde_json::json!({ "unexpected": "shape" });
        let err = parse_live_payload(raw).expect_err("invalid payload should return parser error");
        assert!(matches!(
            err,
            LiveSessionEventPayload::ParserValidationError {
                kind,
                reason,
                ..
            } if kind == "missing_fields" && !reason.is_empty()
        ));
    }

    #[test]
    fn internal_approval_round_trip_tracks_pending_requests() {
        let mut runtime = CodexAppServerRuntime::default();
        let request = LiveSessionEventPayload::ApprovalRequest {
            request_id: "req_1".to_string(),
            thread_id: "th_1".to_string(),
            turn_id: "tu_1".to_string(),
            command: "rm -rf /".to_string(),
            options: vec!["approve".to_string(), "deny".to_string()],
            timeout_ms: 5_000,
        };

        handle_live_event_internal(&mut runtime, &request);
        assert_eq!(runtime.approval_waiters.len(), 1);

        let result = LiveSessionEventPayload::ApprovalResult {
            request_id: "req_1".to_string(),
            thread_id: "th_1".to_string(),
            approved: false,
            decided_at_iso: "2026-02-24T00:00:00.000Z".to_string(),
            decided_by: Some("user".to_string()),
            reason: Some("Denied".to_string()),
        };
        handle_live_event_internal(&mut runtime, &result);

        assert_eq!(
            runtime.approval_result_total.get("rejected").copied(),
            Some(1)
        );
    }

    #[test]
    fn approval_timeout_produces_timeout_result() {
        let mut runtime = CodexAppServerRuntime::default();
        let request = LiveSessionEventPayload::ApprovalRequest {
            request_id: "req_timeout".to_string(),
            thread_id: "thread_timeout".to_string(),
            turn_id: "turn_timeout".to_string(),
            command: "write_file".to_string(),
            options: vec!["allow".to_string(), "deny".to_string()],
            timeout_ms: 1,
        };
        handle_live_event_internal(&mut runtime, &request);

        let expired = expire_pending_approvals(&mut runtime, i64::MAX);
        assert_eq!(expired.len(), 1);
        assert!(matches!(
            &expired[0],
            LiveSessionEventPayload::ApprovalResult {
                approved: false,
                reason: Some(reason),
                ..
            } if reason.contains("Timed out")
        ));
        assert_eq!(runtime.approval_waiters.len(), 0);
        assert_eq!(
            runtime.approval_result_total.get("timeout").copied(),
            Some(1)
        );
    }

    #[test]
    fn thread_snapshot_access_requires_initialized_and_authenticated() {
        let runtime = CodexAppServerRuntime::default();
        let err = assert_thread_snapshot_access(&runtime).expect_err("handshake gate should fail");
        assert!(err.contains("Handshake incomplete"));

        let runtime = CodexAppServerRuntime {
            handshake_state: HandshakeState::Initialized,
            auth_state: AuthState::NeedsLogin,
            ..CodexAppServerRuntime::default()
        };
        let err = assert_thread_snapshot_access(&runtime).expect_err("auth gate should fail");
        assert!(err.contains("Authentication required"));

        let runtime = CodexAppServerRuntime {
            handshake_state: HandshakeState::Initialized,
            auth_state: AuthState::Authenticated,
            ..CodexAppServerRuntime::default()
        };
        assert!(assert_thread_snapshot_access(&runtime).is_ok());
    }

    #[test]
    fn reconnect_validation_rejects_invalid_schema_session_and_token() {
        let make_payload = |payload: serde_json::Value| LiveSessionEventPayload::SessionDelta {
            thread_id: "th".to_string(),
            turn_id: "tu".to_string(),
            item_id: "it".to_string(),
            event_type: "item/delta".to_string(),
            source: "app_server_stream".to_string(),
            sequence_id: 1,
            received_at_iso: "2026-02-24T00:00:00.000Z".to_string(),
            payload,
        };

        let invalid_schema = make_payload(serde_json::json!({ "schemaVersion": "v2" }));
        assert_eq!(
            validate_reconnect_payload(&invalid_schema).unwrap_err(),
            RECONNECT_REASON_SCHEMA_MISMATCH
        );

        let invalid_session = make_payload(serde_json::json!({ "sessionValid": false }));
        assert_eq!(
            validate_reconnect_payload(&invalid_session).unwrap_err(),
            RECONNECT_REASON_SESSION_INVALID
        );

        let invalid_token = make_payload(serde_json::json!({ "tokenExpired": true }));
        assert_eq!(
            validate_reconnect_payload(&invalid_token).unwrap_err(),
            RECONNECT_REASON_TOKEN_INVALID
        );
    }

    #[test]
    fn reconnect_validation_failure_updates_runtime_with_normalized_reason() {
        let mut runtime = CodexAppServerRuntime::default();
        apply_reconnect_validation_failure(&mut runtime, RECONNECT_REASON_TOKEN_INVALID);
        assert_eq!(runtime.status.state, "degraded");
        assert_eq!(
            runtime.stream_session_state,
            super::StreamSessionState::Failed
        );
        assert!(runtime
            .status
            .last_error
            .as_deref()
            .unwrap_or_default()
            .contains(RECONNECT_REASON_TOKEN_INVALID));
        assert_eq!(
            runtime
                .restart_total
                .get(RECONNECT_REASON_TOKEN_INVALID)
                .copied(),
            Some(1)
        );
    }

    #[test]
    #[cfg(unix)]
    fn terminate_child_with_timeout_kills_process_when_needed() {
        let mut child = Command::new("sh")
            .arg("-c")
            .arg("sleep 5")
            .spawn()
            .expect("spawn child");

        terminate_child_with_timeout(&mut child, Duration::from_millis(10))
            .expect("terminate child");
        let status = child.try_wait().expect("wait child status");
        assert!(status.is_some());
    }

    #[test]
    fn live_sessions_cleanup_applies_ttl_and_row_cap() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async {
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .expect("memory sqlite");

            sqlx::query(include_str!("../migrations/015_live_sessions.sql"))
                .execute(&pool)
                .await
                .expect("migration applies");

            for idx in 0..8 {
                sqlx::query(
                    r#"
                    INSERT INTO live_sessions (
                      thread_id, turn_id, item_id, event_type, source, status, payload, last_activity_at
                    ) VALUES (?, ?, ?, 'item/completed', 'otel', 'completed', '{}', datetime('now', ?))
                    "#,
                )
                .bind(format!("th_{idx}"))
                .bind("tu")
                .bind("it")
                .bind(format!("-{} hours", idx + 1))
                .execute(&pool)
                .await
                .expect("insert row");
            }

            let cleanup = cleanup_live_sessions_with_policy(&pool, 2, 3)
                .await
                .expect("cleanup works");

            assert!(cleanup.removed_rows >= 5);

            let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM live_sessions")
                .fetch_one(&pool)
                .await
                .expect("count rows");
            assert!(remaining <= 3);
        });
    }

    #[test]
    fn deprecated_mutation_commands_return_explicit_error() {
        let stream_health_err = command_not_exposed_error("codex_app_server_set_stream_health");
        let ingest_err = command_not_exposed_error("ingest_codex_stream_event");

        assert!(stream_health_err.contains("command-not-exposed"));
        assert!(ingest_err.contains("command-not-exposed"));
    }

    #[test]
    fn parser_error_payload_truncates_raw_preview() {
        let raw = serde_json::json!({ "payload": "x".repeat(2_048) });
        let payload = parser_validation_error("protocol_violation", &raw, "boom");
        match payload {
            LiveSessionEventPayload::ParserValidationError { raw_preview, .. } => {
                assert!(raw_preview.len() <= 512);
            }
            _ => panic!("expected parser error"),
        }
    }

    #[test]
    fn legacy_input_conversion_sets_expected_source() {
        let payload = parse_event_from_legacy_input(CodexStreamEventInput {
            provider: "codex".to_string(),
            thread_id: "th_1".to_string(),
            turn_id: "tu_1".to_string(),
            item_id: "it_1".to_string(),
            event_type: "item/delta".to_string(),
            source: "stream".to_string(),
            payload: None,
        });

        match payload {
            LiveSessionEventPayload::SessionDelta { source, .. } => {
                assert_eq!(source, "app_server_stream");
            }
            _ => panic!("expected session delta"),
        }
    }
}
