//! App-level ingest configuration (non-committable).
//!
//! Stored in the app data directory alongside the SQLite cache.

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::command;

use crate::secret_store;

pub const CANONICAL_COLLECTOR_ROOT: &str = "~/.agents/otel-collector";
pub const LEGACY_COLLECTOR_ROOT: &str = "~/.agents/otel/collector";
pub const SECONDARY_LEGACY_COLLECTOR_ROOT: &str = "~/.codex/otel-collector";
pub const APP_IDENTIFIER: &str = "com.jamie.trace-narrative";
pub const FIREFLY_LEGACY_APP_IDENTIFIER: &str = "com.jamie.firefly-narrative";
pub const LEGACY_APP_IDENTIFIER: &str = "com.jamie.narrative-mvp";

fn default_chatgpt_auth_mode() -> String {
    "chatgpt".to_string()
}

fn default_collector_migration_status() -> String {
    "not_started".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestConfig {
    #[serde(default)]
    pub auto_ingest_enabled: bool,
    #[serde(default)]
    pub watch_paths: WatchPaths,
    #[serde(default)]
    pub codex: CodexConfig,
    #[serde(default)]
    pub collector: CollectorConfig,
    #[serde(default)]
    pub retention_days: i64,
    #[serde(default)]
    pub redaction_mode: String,
    #[serde(default)]
    pub consent: ConsentState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchPaths {
    #[serde(default)]
    pub claude: Vec<String>,
    #[serde(default)]
    pub cursor: Vec<String>,
    #[serde(default)]
    pub codex_logs: Vec<String>,
}

impl Default for WatchPaths {
    fn default() -> Self {
        Self {
            claude: vec!["~/.claude/projects".to_string()],
            // Cursor stores composer sessions in ~/.cursor/composer/composer.database.
            // Watching the entire ~/.cursor tree is noisy (many non-session JSON files).
            cursor: vec!["~/.cursor/composer".to_string()],
            // Codex sessions can be stored as per-session JSONL files plus an aggregated history file.
            codex_logs: vec![
                "~/.codex/sessions".to_string(),
                "~/.codex/archived_sessions".to_string(),
                "~/.codex/history.jsonl".to_string(),
                "~/.codex/logs".to_string(), // legacy fallback
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectorMigrationState {
    #[serde(default = "default_collector_migration_status")]
    pub status: String, // not_started | migrated | deferred | failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_attempt_at_iso: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_backup_path: Option<String>,
}

impl Default for CollectorMigrationState {
    fn default() -> Self {
        Self {
            status: default_collector_migration_status(),
            last_attempt_at_iso: None,
            last_error: None,
            last_backup_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectorConfig {
    #[serde(default = "default_canonical_collector_root")]
    pub canonical_root: String,
    #[serde(default = "default_legacy_collector_root")]
    pub legacy_root: String,
    #[serde(default)]
    pub migration: CollectorMigrationState,
}

impl Default for CollectorConfig {
    fn default() -> Self {
        Self {
            canonical_root: default_canonical_collector_root(),
            legacy_root: default_legacy_collector_root(),
            migration: CollectorMigrationState::default(),
        }
    }
}

fn default_canonical_collector_root() -> String {
    CANONICAL_COLLECTOR_ROOT.to_string()
}

fn default_legacy_collector_root() -> String {
    LEGACY_COLLECTOR_ROOT.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexConfig {
    #[serde(default)]
    pub receiver_enabled: bool,
    #[serde(default)]
    pub mode: String, // "otlp" | "logs" | "both"
    #[serde(default)]
    pub endpoint: String,
    #[serde(default)]
    pub header_env_key: String,
    #[serde(default)]
    pub stream_enrichment_enabled: bool,
    #[serde(default)]
    pub stream_kill_switch: bool,
    #[serde(default = "default_chatgpt_auth_mode")]
    pub app_server_auth_mode: String,
}

impl Default for CodexConfig {
    fn default() -> Self {
        Self {
            receiver_enabled: false,
            mode: "both".to_string(),
            endpoint: "http://127.0.0.1:4318/v1/logs".to_string(),
            header_env_key: "NARRATIVE_OTEL_API_KEY".to_string(),
            stream_enrichment_enabled: true,
            stream_kill_switch: false,
            app_server_auth_mode: default_chatgpt_auth_mode(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConsentState {
    #[serde(default)]
    pub codex_telemetry_granted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub granted_at_iso: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestConfigUpdate {
    pub auto_ingest_enabled: Option<bool>,
    pub watch_paths: Option<WatchPaths>,
    pub codex: Option<CodexConfig>,
    pub collector: Option<CollectorConfig>,
    pub retention_days: Option<i64>,
    pub redaction_mode: Option<String>,
    pub consent: Option<ConsentState>,
}

impl Default for IngestConfig {
    fn default() -> Self {
        Self {
            auto_ingest_enabled: false,
            watch_paths: WatchPaths::default(),
            codex: CodexConfig::default(),
            collector: CollectorConfig::default(),
            retention_days: 30,
            redaction_mode: "redact".to_string(),
            consent: ConsentState::default(),
        }
    }
}

pub fn load_config() -> Result<IngestConfig, String> {
    let path = config_path_for_read()?;
    if !path.exists() {
        return Ok(IngestConfig::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut parsed = serde_json::from_str::<IngestConfig>(&raw).map_err(|e| e.to_string())?;

    // Best-effort migration / normalization:
    // - Add newly supported Codex sources if present (sessions + archived_sessions + history.jsonl).
    // - Remove legacy noisy Codex internal logs dir (~/.codex/log).
    normalize_codex_watch_paths(&mut parsed.watch_paths);
    normalize_codex_mode(&mut parsed.codex);
    normalize_collector_config(&mut parsed.collector);

    Ok(parsed)
}

pub fn save_config(config: &IngestConfig) -> Result<(), String> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, raw).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn apply_update(update: IngestConfigUpdate) -> Result<IngestConfig, String> {
    let mut config = load_config().unwrap_or_default();

    if let Some(value) = update.auto_ingest_enabled {
        config.auto_ingest_enabled = value;
    }
    if let Some(value) = update.watch_paths {
        config.watch_paths = value;
    }
    if let Some(value) = update.codex {
        config.codex = value;
    }
    if update.collector.is_some() {
        return Err(
            "Collector root paths are managed by Narrative and cannot be overridden".to_string(),
        );
    }
    if let Some(value) = update.retention_days {
        config.retention_days = value;
    }
    if let Some(value) = update.redaction_mode {
        config.redaction_mode = value;
    }
    if let Some(value) = update.consent {
        config.consent = value;
    }

    normalize_codex_watch_paths(&mut config.watch_paths);
    normalize_codex_mode(&mut config.codex);
    normalize_collector_config(&mut config.collector);
    enforce_collector_roots(&mut config.collector)?;

    save_config(&config)?;
    Ok(config)
}

fn normalize_codex_mode(codex: &mut CodexConfig) {
    let mode = codex.mode.trim().to_lowercase();
    codex.mode = match mode.as_str() {
        "otlp" | "logs" | "both" => mode,
        _ => "both".to_string(),
    };
    let auth_mode = codex.app_server_auth_mode.trim().to_lowercase();
    codex.app_server_auth_mode = if auth_mode.is_empty() {
        default_chatgpt_auth_mode()
    } else {
        auth_mode
    };
}

fn normalize_collector_config(collector: &mut CollectorConfig) {
    if collector.canonical_root.trim().is_empty() {
        collector.canonical_root = default_canonical_collector_root();
    }
    if collector.legacy_root.trim().is_empty() {
        collector.legacy_root = default_legacy_collector_root();
    }
    let normalized = collector.migration.status.trim().to_lowercase();
    collector.migration.status = match normalized.as_str() {
        "migrated" | "deferred" | "failed" | "not_started" => normalized,
        _ => default_collector_migration_status(),
    };
}

fn enforce_collector_roots(collector: &mut CollectorConfig) -> Result<(), String> {
    let expected_canonical = expand_tilde_to_abs(CANONICAL_COLLECTOR_ROOT)?;
    let expected_legacy = expand_tilde_to_abs(LEGACY_COLLECTOR_ROOT)?;
    let current_canonical = expand_tilde_to_abs(&collector.canonical_root)?;
    let current_legacy = expand_tilde_to_abs(&collector.legacy_root)?;

    if current_canonical != expected_canonical || current_legacy != expected_legacy {
        collector.migration.last_error =
            Some("Collector roots were reset to managed defaults for safety".to_string());
    }

    collector.canonical_root = default_canonical_collector_root();
    collector.legacy_root = default_legacy_collector_root();
    Ok(())
}

fn normalize_codex_watch_paths(paths: &mut WatchPaths) {
    // De-dupe and upgrade Codex watch paths.
    let mut out: Vec<String> = Vec::new();
    for p in paths.codex_logs.iter() {
        let mut p = p.trim().replace('\\', "/");
        if p.is_empty() {
            continue;
        }
        // Normalize legacy variants.
        if p.ends_with("/.codex/log") || p.ends_with("~/.codex/log") {
            continue; // never watch internal logs dir
        }
        if p.contains(".codex/otel-collector")
            || p.contains(".agents/otel/collector")
            || p.contains(".agents/otel-collector")
        {
            continue; // collector state path is not a session-log source
        }
        if p.contains(".codex/archived-sessions") {
            p = p.replace(".codex/archived-sessions", ".codex/archived_sessions");
        }
        if !out.contains(&p) {
            out.push(p);
        }
    }

    // Add recommended sources when they exist and are missing.
    if let Some(home) = dirs::home_dir() {
        let recommended = [
            ("~/.codex/sessions", home.join(".codex/sessions").exists()),
            (
                "~/.codex/archived_sessions",
                home.join(".codex/archived_sessions").exists(),
            ),
            (
                "~/.codex/history.jsonl",
                home.join(".codex/history.jsonl").exists(),
            ),
        ];
        for (p, exists) in recommended {
            if !exists {
                continue;
            }
            if !out.iter().any(|v| v == p) {
                out.push(p.to_string());
            }
        }
    }

    // Ensure legacy fallback is last (if present).
    out.sort_by(|a, b| {
        let a_legacy = a.contains(".codex/logs");
        let b_legacy = b.contains(".codex/logs");
        a_legacy.cmp(&b_legacy)
    });

    paths.codex_logs = out;
}

pub fn config_path() -> Result<PathBuf, String> {
    // Cross-platform equivalent of Tauri's app_data_dir resolution:
    // dirs::data_dir() / <bundle_identifier> / ingest-config.json
    let base = dirs::data_dir().ok_or_else(|| "Could not determine data directory".to_string())?;
    Ok(base.join(APP_IDENTIFIER).join("ingest-config.json"))
}

fn config_path_for_read() -> Result<PathBuf, String> {
    let canonical = config_path()?;
    if canonical.exists() {
        return Ok(canonical);
    }

    let base = dirs::data_dir().ok_or_else(|| "Could not determine data directory".to_string())?;
    
    // Check firefly-narrative (immediate predecessor)
    let firefly_legacy = base.join(FIREFLY_LEGACY_APP_IDENTIFIER).join("ingest-config.json");
    if firefly_legacy.exists() {
        return Ok(firefly_legacy);
    }

    // Check narrative-mvp (legacy)
    let legacy = base.join(LEGACY_APP_IDENTIFIER).join("ingest-config.json");
    if legacy.exists() {
        return Ok(legacy);
    }

    Ok(canonical)
}

#[command(rename_all = "camelCase")]
pub fn get_ingest_config() -> Result<IngestConfig, String> {
    load_config()
}

#[command(rename_all = "camelCase")]
pub fn set_ingest_config(update: IngestConfigUpdate) -> Result<IngestConfig, String> {
    apply_update(update)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtlpEnvStatus {
    pub present: bool,
    pub key_name: String,
}

#[command(rename_all = "camelCase")]
pub fn get_otlp_env_status() -> Result<OtlpEnvStatus, String> {
    // Back-compat for older UI: treat "present" as "key exists" (keychain or env).
    let present = secret_store::get_otlp_api_key()?.is_some()
        || std::env::var("NARRATIVE_OTEL_API_KEY")
            .ok()
            .map(|v| !v.is_empty())
            .unwrap_or(false);
    Ok(OtlpEnvStatus {
        present,
        key_name: "NARRATIVE_OTEL_API_KEY".to_string(),
    })
}

#[command(rename_all = "camelCase")]
pub fn configure_codex_otel(endpoint: String) -> Result<(), String> {
    let endpoint = validate_otel_endpoint(&endpoint)?;
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    let config_dir = home.join(".codex");
    let config_path = config_dir.join("config.toml");
    let backup_path = config_dir.join("config.toml.narrative.bak");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let existing = if config_path.exists() {
        fs::read_to_string(&config_path).map_err(|e| e.to_string())?
    } else {
        String::new()
    };

    if !existing.is_empty() {
        fs::write(&backup_path, &existing).map_err(|e| e.to_string())?;
    }

    // Ensure a local receiver key exists (stored in keychain).
    let api_key = secret_store::ensure_otlp_api_key()?;

    // Narrative receiver expects this header.
    let header_name = "x-narrative-api-key";
    let otel_block = format!(
        "[otel]\nexporter = {{ otlp-http = {{ endpoint = \"{}\", protocol = \"json\", headers = {{ \"{}\" = \"{}\" }} }} }}\nlog_user_prompt = false\n",
        endpoint, header_name, api_key
    );

    let updated = upsert_otel_block(&existing, &otel_block);
    fs::write(&config_path, updated).map_err(|e| e.to_string())?;

    // Keep collector state canonicalized and persisted for migration-aware UI.
    let mut ingest = load_config().unwrap_or_default();
    normalize_collector_config(&mut ingest.collector);
    enforce_collector_roots(&mut ingest.collector)?;
    let canonical = expand_tilde_to_abs(&ingest.collector.canonical_root)?;
    let legacy_sources = existing_legacy_collector_sources(&ingest.collector.legacy_root)?;
    let mut migrated_now = false;
    let migration_attempt_at = iso_now();

    let migration_result = (|| -> Result<(), String> {
        // If legacy data exists and canonical root does not, perform an actual migration here
        // so we do not accidentally mask required migration by creating canonical state only.
        if !legacy_sources.is_empty() && canonical_requires_legacy_migration(&canonical)? {
            let source = &legacy_sources[0];
            let backup_abs = migration_backup_path(&canonical);
            if backup_abs.exists() {
                return Err(format!(
                    "Backup path already exists; refusing to overwrite: {}",
                    backup_abs.display()
                ));
            }
            copy_dir_recursive(source, &backup_abs, false)?;
            copy_dir_recursive(source, &canonical, true)?;
            ingest.collector.migration.last_backup_path =
                Some(backup_abs.to_string_lossy().to_string());
            ingest.collector.migration.status = "migrated".to_string();
            ingest.collector.migration.last_attempt_at_iso = Some(iso_now());
            ingest.collector.migration.last_error = None;
            save_config(&ingest)?;
            migrated_now = true;
        } else if canonical.exists() {
            // Canonical already exists; preserve prior status unless it is explicitly failed.
            if ingest.collector.migration.status == "failed" {
                ingest.collector.migration.status = "deferred".to_string();
            }
        }
        Ok(())
    })();

    if let Err(err) = migration_result {
        ingest.collector.migration.status = "failed".to_string();
        ingest.collector.migration.last_attempt_at_iso = Some(migration_attempt_at);
        ingest.collector.migration.last_error = Some(err.clone());
        if let Err(save_err) = save_config(&ingest) {
            return Err(format!(
                "{err}; additionally failed to persist migration failure status: {save_err}"
            ));
        }
        return Err(err);
    }

    fs::create_dir_all(&canonical).map_err(|e| e.to_string())?;
    let state_file = canonical.join("narrative-collector-state.json");
    let state_payload = serde_json::json!({
        "configuredAtISO": iso_now(),
        "endpoint": endpoint,
        "header": header_name,
    });
    fs::write(
        state_file,
        serde_json::to_string_pretty(&state_payload).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    ingest.collector.migration.last_attempt_at_iso = Some(iso_now());
    ingest.collector.migration.last_error = None;
    if migrated_now {
        ingest.collector.migration.status = "migrated".to_string();
    }
    save_config(&ingest)?;

    Ok(())
}

fn validate_otel_endpoint(endpoint: &str) -> Result<String, String> {
    let trimmed = endpoint.trim();
    if trimmed.is_empty() {
        return Err("OTEL endpoint cannot be empty".to_string());
    }
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("OTEL endpoint must start with http:// or https://".to_string());
    }
    if trimmed.chars().any(|ch| {
        ch == '"' || ch == '\n' || ch == '\r' || ch == '\t' || ch == '\\' || ch.is_control()
    }) {
        return Err("OTEL endpoint contains unsupported characters".to_string());
    }
    Ok(trimmed.to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtlpKeyStatus {
    pub present: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub masked_preview: Option<String>,
}

#[command(rename_all = "camelCase")]
pub fn get_otlp_key_status() -> Result<OtlpKeyStatus, String> {
    let key = secret_store::get_otlp_api_key()?;
    Ok(OtlpKeyStatus {
        present: key.is_some(),
        masked_preview: key.as_deref().map(secret_store::masked_preview),
    })
}

#[command(rename_all = "camelCase")]
pub fn ensure_otlp_api_key() -> Result<OtlpKeyStatus, String> {
    let key = secret_store::ensure_otlp_api_key()?;
    Ok(OtlpKeyStatus {
        present: true,
        masked_preview: Some(secret_store::masked_preview(&key)),
    })
}

#[command(rename_all = "camelCase")]
pub fn reset_otlp_api_key() -> Result<OtlpKeyStatus, String> {
    secret_store::delete_otlp_api_key()?;
    let key = secret_store::ensure_otlp_api_key()?;
    Ok(OtlpKeyStatus {
        present: true,
        masked_preview: Some(secret_store::masked_preview(&key)),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectorMigrationStatus {
    pub canonical_root: String,
    pub legacy_root: String,
    pub canonical_exists: bool,
    pub legacy_exists: bool,
    pub migration_required: bool,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_attempt_at_iso: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectorMigrationResult {
    pub status: CollectorMigrationStatus,
    pub migrated: bool,
    pub rolled_back: bool,
    pub dry_run: bool,
    pub actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredSources {
    pub claude: Vec<String>,
    pub cursor: Vec<String>,
    pub codex_logs: Vec<String>,
    pub collector: CollectorMigrationStatus,
}

#[command(rename_all = "camelCase")]
pub fn discover_capture_sources() -> Result<DiscoveredSources, String> {
    let mut claude = Vec::new();
    let mut cursor = Vec::new();
    let mut codex_logs = Vec::new();

    if let Some(home) = dirs::home_dir() {
        let claude_dir = home.join(".claude/projects");
        if claude_dir.exists() {
            claude.push(claude_dir.to_string_lossy().to_string());
        }

        let cursor_composer_dir = home.join(".cursor/composer");
        if cursor_composer_dir.exists() {
            cursor.push(cursor_composer_dir.to_string_lossy().to_string());
        } else {
            let cursor_dir = home.join(".cursor");
            if cursor_dir.exists() {
                cursor.push(cursor_dir.to_string_lossy().to_string());
            }
        }

        // Codex (preferred): per-session JSONL folders
        let codex_sessions = home.join(".codex/sessions");
        if codex_sessions.exists() {
            codex_logs.push(codex_sessions.to_string_lossy().to_string());
        }
        let codex_archived = home.join(".codex/archived_sessions");
        if codex_archived.exists() {
            codex_logs.push(codex_archived.to_string_lossy().to_string());
        }
        // Codex (index/pointer): aggregated history file
        let codex_history = home.join(".codex/history.jsonl");
        if codex_history.exists() {
            codex_logs.push(codex_history.to_string_lossy().to_string());
        }
        // Codex (legacy fallback): logs
        let codex_logs_dir = home.join(".codex/logs");
        if codex_logs_dir.exists() {
            codex_logs.push(codex_logs_dir.to_string_lossy().to_string());
        }
    }

    let collector = get_collector_migration_status_inner()?;

    Ok(DiscoveredSources {
        claude,
        cursor,
        codex_logs,
        collector,
    })
}

#[command(rename_all = "camelCase")]
pub fn get_collector_migration_status() -> Result<CollectorMigrationStatus, String> {
    get_collector_migration_status_inner()
}

#[command(rename_all = "camelCase")]
pub fn run_collector_migration(dry_run: Option<bool>) -> Result<CollectorMigrationResult, String> {
    let dry_run = dry_run.unwrap_or(false);
    let mut config = load_config().unwrap_or_default();
    normalize_collector_config(&mut config.collector);
    enforce_collector_roots(&mut config.collector)?;
    let canonical_abs = expand_tilde_to_abs(&config.collector.canonical_root)?;
    let legacy_sources = existing_legacy_collector_sources(&config.collector.legacy_root)?;
    let attempt_at = iso_now();

    let mut actions = Vec::new();
    let mut migrated = false;
    let mut backup_path = config.collector.migration.last_backup_path.clone();
    let migration_result = (|| -> Result<(), String> {
        actions.push(format!(
            "Assess legacy roots ({}) and canonical ({}) collector root",
            legacy_sources
                .iter()
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>()
                .join(", "),
            canonical_abs.display()
        ));

        let migration_required =
            !legacy_sources.is_empty() && canonical_requires_legacy_migration(&canonical_abs)?;

        if legacy_sources.is_empty() && !canonical_abs.exists() {
            actions.push("No collector directory exists; create canonical root".to_string());
            if !dry_run {
                fs::create_dir_all(&canonical_abs).map_err(|e| e.to_string())?;
            }
        } else if migration_required {
            let source = &legacy_sources[0];
            let backup_abs = migration_backup_path(&canonical_abs);
            actions.push(format!(
                "Create non-destructive backup snapshot at {}",
                backup_abs.display()
            ));
            actions.push(format!(
                "Copy legacy collector data from {} to canonical {}",
                source.display(),
                canonical_abs.display()
            ));
            if !dry_run {
                if backup_abs.exists() {
                    return Err(format!(
                        "Backup path already exists; refusing to overwrite: {}",
                        backup_abs.display()
                    ));
                }
                copy_dir_recursive(source, &backup_abs, false)?;
                copy_dir_recursive(source, &canonical_abs, true)?;
                backup_path = Some(backup_abs.to_string_lossy().to_string());
                migrated = true;
            }
        } else {
            actions.push("Canonical collector already exists; no migration required".to_string());
        }
        Ok(())
    })();

    if let Err(err) = migration_result {
        if !dry_run {
            config.collector.migration.status = "failed".to_string();
            config.collector.migration.last_attempt_at_iso = Some(attempt_at);
            config.collector.migration.last_error = Some(err.clone());
            if let Err(save_err) = save_config(&config) {
                return Err(format!(
                    "{err}; additionally failed to persist migration failure status: {save_err}"
                ));
            }
        }
        return Err(err);
    }

    if !dry_run {
        config.collector.migration.last_backup_path = backup_path;
        config.collector.migration.last_attempt_at_iso = Some(attempt_at);
        config.collector.migration.last_error = None;
        if migrated {
            config.collector.migration.status = "migrated".to_string();
        } else if config.collector.migration.status == "failed" {
            config.collector.migration.status = "deferred".to_string();
        }
        save_config(&config)?;
    }

    Ok(CollectorMigrationResult {
        status: get_collector_migration_status_inner()?,
        migrated,
        rolled_back: false,
        dry_run,
        actions,
    })
}

#[command(rename_all = "camelCase")]
pub fn rollback_collector_migration() -> Result<CollectorMigrationResult, String> {
    let mut config = load_config().unwrap_or_default();
    normalize_collector_config(&mut config.collector);
    enforce_collector_roots(&mut config.collector)?;
    let attempt_at = iso_now();
    let canonical_abs = expand_tilde_to_abs(&config.collector.canonical_root)?;
    let backup_path = match config.collector.migration.last_backup_path.clone() {
        Some(path) => path,
        None => {
            let err = "No backup snapshot available to rollback".to_string();
            config.collector.migration.status = "failed".to_string();
            config.collector.migration.last_attempt_at_iso = Some(attempt_at.clone());
            config.collector.migration.last_error = Some(err.clone());
            save_config(&config)?;
            return Err(err);
        }
    };
    let backup_abs = expand_tilde_to_abs(&backup_path)?;

    if !backup_abs.exists() {
        let err = format!(
            "Backup path not found; cannot rollback: {}",
            backup_abs.display()
        );
        config.collector.migration.status = "failed".to_string();
        config.collector.migration.last_attempt_at_iso = Some(attempt_at.clone());
        config.collector.migration.last_error = Some(err.clone());
        save_config(&config)?;
        return Err(err);
    }

    let mut actions = vec![format!(
        "Restore collector data from backup {}",
        backup_abs.display()
    )];
    let mut rollback_snapshot: Option<PathBuf> = None;
    if canonical_abs.exists() {
        let snapshot = canonical_abs
            .parent()
            .map(std::path::Path::to_path_buf)
            .unwrap_or_else(|| canonical_abs.clone())
            .join(format!(
                "collector-rollback-current-{}",
                chrono::Utc::now().timestamp_millis()
            ));
        if snapshot.exists() {
            let err = format!(
                "Rollback snapshot destination already exists: {}",
                snapshot.display()
            );
            config.collector.migration.status = "failed".to_string();
            config.collector.migration.last_attempt_at_iso = Some(attempt_at.clone());
            config.collector.migration.last_error = Some(err.clone());
            save_config(&config)?;
            return Err(err);
        }
        if let Err(e) = fs::rename(&canonical_abs, &snapshot) {
            let err = format!(
                "Failed to snapshot current canonical collector {} -> {}: {}",
                canonical_abs.display(),
                snapshot.display(),
                e
            );
            config.collector.migration.status = "failed".to_string();
            config.collector.migration.last_attempt_at_iso = Some(attempt_at.clone());
            config.collector.migration.last_error = Some(err.clone());
            save_config(&config)?;
            return Err(err);
        }
        actions.push(format!(
            "Snapshot current canonical collector to {}",
            snapshot.display()
        ));
        rollback_snapshot = Some(snapshot);
    }
    actions.push(format!(
        "Restore into canonical root {}",
        canonical_abs.display()
    ));
    if let Err(copy_err) = copy_dir_recursive(&backup_abs, &canonical_abs, true) {
        let mut recovery_error: Option<String> = None;
        if rollback_snapshot.is_none() {
            if let Err(remove_err) = remove_path_recursively(&canonical_abs) {
                recovery_error = Some(format!(
                    "failed to clear partial canonical restore: {}",
                    remove_err
                ));
            }
        } else if let Some(snapshot) = rollback_snapshot.as_ref() {
            if let Err(remove_err) = remove_path_recursively(&canonical_abs) {
                recovery_error = Some(format!(
                    "failed to clear partial canonical restore: {}",
                    remove_err
                ));
            } else if let Err(rename_err) = fs::rename(snapshot, &canonical_abs) {
                recovery_error = Some(format!(
                    "failed to restore snapshot {} -> {}: {}",
                    snapshot.display(),
                    canonical_abs.display(),
                    rename_err
                ));
            }
        }
        let composed_error = if let Some(recovery_error) = recovery_error {
            format!("{copy_err}; rollback recovery failed: {recovery_error}")
        } else {
            copy_err
        };
        config.collector.migration.status = "failed".to_string();
        config.collector.migration.last_attempt_at_iso = Some(attempt_at.clone());
        config.collector.migration.last_error = Some(composed_error.clone());
        save_config(&config)?;
        return Err(composed_error);
    }
    if let Some(snapshot) = rollback_snapshot.as_ref() {
        if snapshot.exists() {
            let _ = remove_path_recursively(snapshot);
        }
    }

    config.collector.migration.status = "deferred".to_string();
    config.collector.migration.last_attempt_at_iso = Some(attempt_at);
    config.collector.migration.last_error = None;
    save_config(&config)?;

    Ok(CollectorMigrationResult {
        status: get_collector_migration_status_inner()?,
        migrated: false,
        rolled_back: true,
        dry_run: false,
        actions,
    })
}

fn get_collector_migration_status_inner() -> Result<CollectorMigrationStatus, String> {
    let mut config = load_config().unwrap_or_default();
    normalize_collector_config(&mut config.collector);
    enforce_collector_roots(&mut config.collector)?;
    let canonical_abs = expand_tilde_to_abs(&config.collector.canonical_root)?;
    let legacy_sources = existing_legacy_collector_sources(&config.collector.legacy_root)?;
    let legacy_exists = !legacy_sources.is_empty();

    Ok(CollectorMigrationStatus {
        canonical_root: config.collector.canonical_root,
        legacy_root: config.collector.legacy_root,
        canonical_exists: canonical_abs.exists(),
        legacy_exists,
        migration_required: legacy_exists && canonical_requires_legacy_migration(&canonical_abs)?,
        status: config.collector.migration.status,
        last_attempt_at_iso: config.collector.migration.last_attempt_at_iso,
        last_error: config.collector.migration.last_error,
        last_backup_path: config.collector.migration.last_backup_path,
    })
}

fn iso_now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn canonical_requires_legacy_migration(canonical_abs: &std::path::Path) -> Result<bool, String> {
    if !canonical_abs.exists() {
        return Ok(true);
    }
    canonical_is_stub_or_empty(canonical_abs)
}

fn canonical_is_stub_or_empty(canonical_abs: &std::path::Path) -> Result<bool, String> {
    if !canonical_abs.exists() {
        return Ok(true);
    }
    if canonical_abs.is_file() {
        return Ok(true);
    }
    if !canonical_abs.is_dir() {
        return Ok(true);
    }

    let mut names: Vec<String> = fs::read_dir(canonical_abs)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect();
    names.retain(|name| !name.starts_with('.'));

    if names.is_empty() {
        return Ok(true);
    }
    if names.len() == 1 && names[0] == "narrative-collector-state.json" {
        return Ok(true);
    }
    Ok(false)
}

fn expand_tilde_to_abs(path: &str) -> Result<PathBuf, String> {
    if let Some(stripped) = path.strip_prefix("~/") {
        let home =
            dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
        return Ok(home.join(stripped));
    }
    Ok(PathBuf::from(path))
}

fn existing_legacy_collector_sources(primary_legacy_root: &str) -> Result<Vec<PathBuf>, String> {
    let mut sources = Vec::new();
    for candidate in [primary_legacy_root, SECONDARY_LEGACY_COLLECTOR_ROOT] {
        let abs = expand_tilde_to_abs(candidate)?;
        if abs.exists() && !sources.iter().any(|existing| existing == &abs) {
            sources.push(abs);
        }
    }
    Ok(sources)
}

fn remove_path_recursively(path: &std::path::Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if meta.file_type().is_symlink() {
        return Err(format!(
            "Refusing to remove symlink during rollback recovery: {}",
            path.display()
        ));
    }
    if meta.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

fn migration_backup_path(canonical_abs: &std::path::Path) -> PathBuf {
    let parent = canonical_abs
        .parent()
        .map(std::path::Path::to_path_buf)
        .unwrap_or_else(|| canonical_abs.to_path_buf());
    let stamp = chrono::Utc::now().timestamp_millis();
    parent.join(format!("collector-backup-{stamp}"))
}

fn copy_dir_recursive(
    source: &std::path::Path,
    destination: &std::path::Path,
    overwrite: bool,
) -> Result<(), String> {
    let source_meta = fs::symlink_metadata(source).map_err(|e| e.to_string())?;
    if source_meta.file_type().is_symlink() {
        return Err(format!(
            "Symlink source is not supported during collector migration: {}",
            source.display()
        ));
    }
    if destination.exists() {
        let destination_meta = fs::symlink_metadata(destination).map_err(|e| e.to_string())?;
        if destination_meta.file_type().is_symlink() {
            return Err(format!(
                "Symlink destination is not supported during collector migration: {}",
                destination.display()
            ));
        }
    }

    if source.is_file() {
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        if overwrite || !destination.exists() {
            fs::copy(source, destination).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src = entry.path();
        let dst = destination.join(entry.file_name());
        let src_meta = fs::symlink_metadata(&src).map_err(|e| e.to_string())?;
        if src_meta.file_type().is_symlink() {
            return Err(format!(
                "Symlink entry is not supported during collector migration: {}",
                src.display()
            ));
        }
        if src.is_dir() {
            copy_dir_recursive(&src, &dst, overwrite)?;
        } else if overwrite || !dst.exists() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src, &dst).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn parse_toml_table_header(line: &str) -> Option<String> {
    let trimmed = line.trim();
    let header_only = trimmed.split('#').next().unwrap_or_default().trim_end();
    if !(header_only.starts_with('[') && header_only.ends_with(']')) {
        return None;
    }
    if header_only.starts_with("[[") && header_only.ends_with("]]") {
        return Some(header_only[2..header_only.len() - 2].trim().to_string());
    }
    Some(header_only[1..header_only.len() - 1].trim().to_string())
}

fn is_otel_table(section: &str) -> bool {
    section == "otel" || section.starts_with("otel.")
}

fn upsert_otel_block(existing: &str, block: &str) -> String {
    if existing.trim().is_empty() {
        return format!("{block}\n");
    }

    let mut out: Vec<&str> = Vec::new();
    let mut in_otel_section = false;

    for line in existing.lines() {
        if let Some(section) = parse_toml_table_header(line) {
            if is_otel_table(&section) {
                in_otel_section = true;
                continue;
            }
            in_otel_section = false;
        }

        if in_otel_section {
            continue;
        }
        out.push(line);
    }

    while out.last().is_some_and(|line| line.trim().is_empty()) {
        out.pop();
    }
    if !out.is_empty() {
        out.push("");
    }
    out.push(block.trim_end());

    out.join("\n") + "\n"
}

#[cfg(test)]
mod tests {
    use super::{
        canonical_is_stub_or_empty, copy_dir_recursive, enforce_collector_roots,
        normalize_codex_mode, normalize_codex_watch_paths, parse_toml_table_header,
        upsert_otel_block, validate_otel_endpoint, CodexConfig, CollectorConfig, WatchPaths,
    };
    use std::fs;

    #[test]
    fn normalize_codex_mode_enforces_valid_mode_and_auth_mode() {
        let mut codex = CodexConfig {
            receiver_enabled: false,
            mode: "invalid".to_string(),
            endpoint: "http://localhost".to_string(),
            header_env_key: "NARRATIVE_OTEL_API_KEY".to_string(),
            stream_enrichment_enabled: true,
            stream_kill_switch: false,
            app_server_auth_mode: "".to_string(),
        };
        normalize_codex_mode(&mut codex);
        assert_eq!(codex.mode, "both");
        assert_eq!(codex.app_server_auth_mode, "chatgpt");
    }

    #[test]
    fn normalize_codex_watch_paths_drops_non_session_legacy_collector_paths() {
        let mut paths = WatchPaths {
            claude: Vec::new(),
            cursor: Vec::new(),
            codex_logs: vec![
                "~/.codex/sessions".to_string(),
                "~/.codex/otel-collector".to_string(),
                "~/.agents/otel/collector".to_string(),
                "~/.agents/otel-collector".to_string(),
                "~/.codex/log".to_string(),
            ],
        };
        normalize_codex_watch_paths(&mut paths);
        assert!(paths.codex_logs.iter().any(|p| p == "~/.codex/sessions"));
        assert!(!paths
            .codex_logs
            .iter()
            .any(|p| p.contains("otel-collector")));
        assert!(!paths.codex_logs.iter().any(|p| p.ends_with("/.codex/log")));
    }

    #[test]
    fn copy_dir_recursive_copies_nested_structure() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let source = tmp.path().join("src");
        let nested = source.join("nested");
        let destination = tmp.path().join("dst");
        fs::create_dir_all(&nested).expect("mkdir");
        fs::write(nested.join("sample.txt"), "hello").expect("write");

        copy_dir_recursive(&source, &destination, true).expect("copy");
        let copied = fs::read_to_string(destination.join("nested/sample.txt")).expect("read");
        assert_eq!(copied, "hello");
    }

    #[test]
    fn enforce_collector_roots_resets_custom_values() {
        let mut collector = CollectorConfig {
            canonical_root: "/tmp/custom-canonical".to_string(),
            legacy_root: "/tmp/custom-legacy".to_string(),
            ..CollectorConfig::default()
        };
        enforce_collector_roots(&mut collector).expect("collector roots");
        assert_eq!(collector.canonical_root, super::CANONICAL_COLLECTOR_ROOT);
        assert_eq!(collector.legacy_root, super::LEGACY_COLLECTOR_ROOT);
        assert!(collector.migration.last_error.is_some());
    }

    #[test]
    fn canonical_stub_detection_treats_state_only_dir_as_empty() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let canonical = tmp.path().join("collector");
        fs::create_dir_all(&canonical).expect("mkdir");
        fs::write(
            canonical.join("narrative-collector-state.json"),
            "{\"configured\":true}",
        )
        .expect("write");
        assert!(canonical_is_stub_or_empty(&canonical).expect("stub check"));
    }

    #[test]
    fn canonical_stub_detection_treats_file_path_as_needing_migration() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let canonical = tmp.path().join("collector");
        fs::write(&canonical, "not-a-directory").expect("write");
        assert!(canonical_is_stub_or_empty(&canonical).expect("stub check"));
    }

    #[test]
    fn canonical_stub_detection_treats_real_content_as_migrated() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let canonical = tmp.path().join("collector");
        fs::create_dir_all(canonical.join("sessions")).expect("mkdir");
        fs::write(canonical.join("sessions/data.jsonl"), "[]").expect("write");
        assert!(!canonical_is_stub_or_empty(&canonical).expect("stub check"));
    }

    #[test]
    fn validate_otel_endpoint_rejects_toml_injection_chars() {
        assert!(validate_otel_endpoint("https://localhost:4318/v1/logs").is_ok());
        assert!(validate_otel_endpoint("https://localhost:4318/v1/logs\"\n[evil]").is_err());
    }

    #[test]
    fn upsert_otel_block_replaces_nested_otel_tables() {
        let existing = r#"
[core]
enabled = true

[otel]
log_user_prompt = true

[otel.exporter]
protocol = "grpc"

[after]
value = 1
"#;
        let block = "[otel]\nexporter = { otlp-http = { endpoint = \"http://127.0.0.1:4318/v1/logs\" } }\nlog_user_prompt = false\n";
        let updated = upsert_otel_block(existing, block);
        assert!(updated.contains("[core]"));
        assert!(updated.contains("[after]"));
        assert!(updated.contains("log_user_prompt = false"));
        assert!(!updated.contains("[otel.exporter]"));
        assert_eq!(updated.matches("[otel]").count(), 1);
    }

    #[test]
    fn parse_toml_table_header_supports_inline_comment() {
        assert_eq!(
            parse_toml_table_header("[otel] # comment"),
            Some("otel".to_string())
        );
        assert_eq!(
            parse_toml_table_header("[[otel.exporter]] # comment"),
            Some("otel.exporter".to_string())
        );
    }
}
