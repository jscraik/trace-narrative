use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{command, AppHandle, Emitter, Manager, State};

const RESTART_BUDGET: usize = 3;
const RESTART_WINDOW_SECS: i64 = 60;
const MAX_DEDUPE_LOG: usize = 200;
const MAX_DEDUPE_SOURCES: usize = 10_000;
const MAX_TRANSITIONS: usize = 100;

#[derive(Clone, Default)]
pub struct CodexAppServerState {
    inner: Arc<Mutex<CodexAppServerRuntime>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAppServerStatus {
    pub state: String, // inactive | starting | healthy | degraded | crash_loop | error
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

#[derive(Default)]
struct CodexAppServerRuntime {
    status: CodexAppServerStatus,
    restart_attempts: VecDeque<i64>,
    dedupe_sources: HashMap<String, String>,
    dedupe_key_order: VecDeque<String>,
    recent_dedupe: VecDeque<CodexStreamDedupeDecision>,
    stream_events_accepted: u64,
    stream_events_duplicates: u64,
    stream_events_dropped: u64,
    stream_events_replaced: u64,
    transitions: VecDeque<CaptureModeTransition>,
    last_mode: Option<String>,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
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

fn emit_status(app_handle: &AppHandle, status: &CodexAppServerStatus) {
    let _ = app_handle.emit("codex-app-server-status", status.clone());
}

fn detect_sidecar_path(app_handle: &AppHandle) -> Option<PathBuf> {
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

fn register_start_failure(runtime: &mut CodexAppServerRuntime, message: String) {
    let now_epoch = chrono::Utc::now().timestamp();
    runtime.restart_attempts.push_back(now_epoch);
    prune_restart_attempts(runtime, now_epoch);

    runtime.status.last_error = Some(message);
    runtime.status.stream_healthy = false;
    runtime.status.last_transition_at_iso = Some(now_iso());

    if runtime.restart_attempts.len() >= RESTART_BUDGET {
        runtime.status.state = "crash_loop".to_string();
    } else {
        runtime.status.state = "degraded".to_string();
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

fn apply_account_updated(status: &mut CodexAppServerStatus, auth_mode: &str, authenticated: bool) {
    let mode = normalize_auth_mode(auth_mode);
    if mode != "chatgpt" {
        status.auth_mode = mode.clone();
        status.auth_state = "needs_login".to_string();
        status.stream_healthy = false;
        if status.state != "crash_loop" {
            status.state = "degraded".to_string();
        }
        status.last_error = Some(format!(
            "Unsupported auth mode for v1: {mode}. Expected chatgpt",
        ));
        return;
    }

    status.auth_mode = mode;
    if authenticated {
        status.auth_state = "authenticated".to_string();
        status.last_error = None;
        if status.state != "crash_loop" {
            status.state = if status.stream_healthy {
                "healthy".to_string()
            } else {
                "degraded".to_string()
            };
        }
    } else {
        status.auth_state = "needs_login".to_string();
        status.stream_healthy = false;
        if status.state != "crash_loop" {
            status.state = "degraded".to_string();
        }
        status.last_error = Some("Authentication required via sidecar account update".to_string());
    }
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
    runtime.status.state = "starting".to_string();
    runtime.status.last_error = None;
    runtime.status.last_transition_at_iso = Some(now_iso());

    if runtime.status.stream_kill_switch {
        runtime.status.state = "degraded".to_string();
        runtime.status.stream_healthy = false;
        runtime.status.last_error = Some("Stream enrichment kill-switch enabled".to_string());
        emit_status(&app_handle, &runtime.status);
        return Ok(runtime.status.clone());
    }

    if detect_sidecar_path(&app_handle).is_none() {
        register_start_failure(
            &mut runtime,
            "Codex App Server sidecar binary not found (expected bin/codex-app-server)".to_string(),
        );
    } else {
        runtime.status.state = "degraded".to_string();
        runtime.status.initialize_sent = false;
        runtime.status.initialized = false;
        runtime.status.auth_state = "needs_login".to_string();
        runtime.status.stream_healthy = false;
        runtime.status.last_error = Some(
            "Sidecar binary detected, but runtime supervision/auth verification is not yet active"
                .to_string(),
        );
        runtime.status.last_transition_at_iso = Some(now_iso());
    }

    emit_status(&app_handle, &runtime.status);
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn stop_codex_app_server(
    app_handle: AppHandle,
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    runtime.status.state = "inactive".to_string();
    runtime.status.initialized = false;
    runtime.status.initialize_sent = false;
    runtime.status.stream_healthy = false;
    runtime.status.last_transition_at_iso = Some(now_iso());
    emit_status(&app_handle, &runtime.status);
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_initialize(
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    if runtime.status.state == "inactive" || runtime.status.state == "crash_loop" {
        return Err("App Server is not running; cannot send initialize handshake".to_string());
    }
    runtime.status.initialize_sent = true;
    runtime.status.last_transition_at_iso = Some(now_iso());
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_initialized(
    state: State<'_, CodexAppServerState>,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    if !runtime.status.initialize_sent {
        return Err("initialize must be called before initialized".to_string());
    }
    runtime.status.initialized = true;
    runtime.status.last_transition_at_iso = Some(now_iso());
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
    runtime.status.auth_state = "authenticating".to_string();
    runtime.status.last_transition_at_iso = Some(now_iso());
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
        // Sidecar callback (account/updated) is the single source of truth for authenticated=true.
        runtime.status.auth_state = "authenticating".to_string();
        runtime.status.last_error = None;
    } else {
        runtime.status.auth_state = "needs_login".to_string();
        runtime.status.stream_healthy = false;
        if runtime.status.state != "crash_loop" {
            runtime.status.state = "degraded".to_string();
        }
        runtime.status.last_error = Some("Authentication cancelled or failed".to_string());
    }
    runtime.status.last_transition_at_iso = Some(now_iso());
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
    apply_account_updated(&mut runtime.status, &auth_mode, authenticated);
    runtime.status.last_transition_at_iso = Some(now_iso());
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
    runtime.status.auth_state = "logged_out".to_string();
    runtime.status.stream_healthy = false;
    runtime.status.last_transition_at_iso = Some(now_iso());
    Ok(CodexAccountStatus {
        auth_state: runtime.status.auth_state.clone(),
        auth_mode: runtime.status.auth_mode.clone(),
        interactive_login_required: true,
        supported_modes: vec!["chatgpt".to_string()],
    })
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_set_stream_health(
    state: State<'_, CodexAppServerState>,
    healthy: bool,
    reason: Option<String>,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    runtime.status.stream_healthy = healthy;
    if !healthy {
        runtime.status.state = "degraded".to_string();
        if let Some(reason) = reason {
            runtime.status.last_error = Some(reason);
        }
    } else if runtime.status.state != "crash_loop" {
        runtime.status.state = "healthy".to_string();
        runtime.status.last_error = None;
    }
    runtime.status.last_transition_at_iso = Some(now_iso());
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_set_stream_kill_switch(
    state: State<'_, CodexAppServerState>,
    enabled: bool,
) -> Result<CodexAppServerStatus, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    runtime.status.stream_kill_switch = enabled;
    if enabled {
        runtime.status.state = "degraded".to_string();
        runtime.status.stream_healthy = false;
        runtime.status.last_error = Some("Stream enrichment disabled by kill-switch".to_string());
    }
    runtime.status.last_transition_at_iso = Some(now_iso());
    Ok(runtime.status.clone())
}

#[command(rename_all = "camelCase")]
pub fn codex_app_server_request_thread_snapshot(
    state: State<'_, CodexAppServerState>,
    thread_id: String,
) -> Result<serde_json::Value, String> {
    let runtime = state.inner.lock().map_err(|e| e.to_string())?;
    if !runtime.status.initialize_sent || !runtime.status.initialized {
        return Err(
            "Handshake incomplete: initialize + initialized required before thread requests"
                .to_string(),
        );
    }
    if runtime.status.auth_state != "authenticated" {
        return Err("Authentication required before requesting thread data".to_string());
    }
    Ok(serde_json::json!({
        "threadId": thread_id,
        "status": "ok",
        "source": "codex-app-server",
    }))
}

#[command(rename_all = "camelCase")]
pub fn ingest_codex_stream_event(
    state: State<'_, CodexAppServerState>,
    event: CodexStreamEventInput,
) -> Result<CodexStreamIngestResult, String> {
    let mut runtime = state.inner.lock().map_err(|e| e.to_string())?;
    let _payload_seen = event.payload.as_ref().map(|_| true).unwrap_or(false);
    let key = event_identity_key(&event);
    let incoming_source = normalize_source(&event.source);
    let event_type = event.event_type.trim().to_lowercase();

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
                remember_dedupe_source(&mut runtime, &key, &incoming_source);
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
        remember_dedupe_source(&mut runtime, &key, &incoming_source);
        runtime.stream_events_accepted += 1;
        chosen_source = incoming_source;
    }

    let log_entry = CodexStreamDedupeDecision {
        at_iso: now_iso(),
        key: key.clone(),
        decision: decision.clone(),
        incoming_source: normalize_source(&event.source),
        chosen_source: chosen_source.clone(),
        replaced_source: replaced_source.clone(),
    };
    runtime.recent_dedupe.push_front(log_entry);
    while runtime.recent_dedupe.len() > MAX_DEDUPE_LOG {
        runtime.recent_dedupe.pop_back();
    }

    Ok(CodexStreamIngestResult {
        key,
        decision,
        chosen_source,
        replaced_source,
    })
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
    let stream_healthy = app_server.state == "healthy"
        && app_server.initialize_sent
        && app_server.initialized
        && app_server.auth_state == "authenticated"
        && app_server.stream_healthy;

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

#[cfg(test)]
mod tests {
    use super::{
        apply_account_updated, event_identity_key, register_start_failure, remember_dedupe_source,
        source_priority, CodexAppServerRuntime, CodexAppServerStatus, CodexStreamEventInput,
        MAX_DEDUPE_SOURCES, RESTART_BUDGET,
    };

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
            register_start_failure(&mut runtime, format!("failure-{i}"));
        }
        assert_eq!(runtime.status.state, "crash_loop");
        assert_eq!(runtime.status.restart_attempts_in_window, RESTART_BUDGET);
    }

    #[test]
    fn chatgpt_account_updated_sets_authenticated_when_verified() {
        let mut status = CodexAppServerStatus {
            state: "degraded".to_string(),
            stream_healthy: true,
            ..CodexAppServerStatus::default()
        };
        apply_account_updated(&mut status, "chatgpt", true);

        assert_eq!(status.auth_state, "authenticated");
        assert_eq!(status.state, "healthy");
        assert!(status.last_error.is_none());
    }

    #[test]
    fn account_updated_rejects_unsupported_mode() {
        let mut status = CodexAppServerStatus::default();
        apply_account_updated(&mut status, "apikey", true);
        assert_eq!(status.auth_state, "needs_login");
        assert_eq!(status.state, "degraded");
        assert_eq!(status.auth_mode, "apikey");
        assert!(status
            .last_error
            .as_deref()
            .unwrap_or_default()
            .contains("Unsupported auth mode"));
    }

    #[test]
    fn account_updated_unsupported_mode_preserves_crash_loop_state() {
        let mut status = CodexAppServerStatus {
            state: "crash_loop".to_string(),
            ..CodexAppServerStatus::default()
        };
        apply_account_updated(&mut status, "apikey", true);
        assert_eq!(status.state, "crash_loop");
        assert_eq!(status.auth_state, "needs_login");
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
}
