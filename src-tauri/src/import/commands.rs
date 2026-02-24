//! Tauri commands for session import

use super::{
    parser::{ParseError, ParseResult, ParsedSession, WarningSeverity},
    redactor::{redact_text, redact_value, RedactionSummary},
    ParserRegistry,
};
use crate::DbState;
use serde_json::Value;
use sqlx::FromRow;
use tauri::State;

/// Result of importing a single session
#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportSuccess {
    pub path: String,
    pub session_id: String,
    pub warnings: Vec<String>,
}

/// Result of a failed import
#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportFailure {
    pub path: String,
    pub error: String,
    /// Whether the error is retryable (e.g., network issue)
    pub retryable: bool,
}

/// Result of a batch import operation
#[derive(Debug, Clone, serde::Serialize)]
pub struct BatchImportResult {
    pub total: usize,
    pub succeeded: Vec<ImportSuccess>,
    pub failed: Vec<ImportFailure>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMessagePayload {
    pub id: String,
    pub role: SessionMessageRolePayload,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<serde_json::Value>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionMessageRolePayload {
    User,
    Assistant,
    Thinking,
    Plan,
    ToolCall,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionExcerptPayload {
    pub id: String,
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_min: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imported_at_iso: Option<String>,
    pub messages: Vec<SessionMessagePayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_commit_sha: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link_confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_linked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub needs_review: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redaction_count: Option<i64>,
}

#[derive(Debug, FromRow)]
struct SessionRow {
    id: String,
    tool: String,
    duration_min: Option<i64>,
    raw_json: String,
    imported_at: Option<String>,
    commit_sha: Option<String>,
    confidence: Option<f64>,
    auto_linked: Option<i64>,
    needs_review: Option<i64>,
    redaction_count: Option<i64>,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_recent_sessions(
    db: State<'_, DbState>,
    repo_id: i64,
    limit: Option<i64>,
) -> Result<Vec<SessionExcerptPayload>, String> {
    use super::parser::{SessionTrace, TraceMessage};

    let limit = limit.unwrap_or(1).clamp(1, 10);
    let rows = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT s.id, s.tool, s.duration_min, s.raw_json, s.imported_at,
               l.commit_sha, l.confidence, l.auto_linked, l.needs_review,
               s.redaction_count
        FROM sessions s
        LEFT JOIN session_links l
          ON l.repo_id = s.repo_id AND l.session_id = s.id
        WHERE s.repo_id = ?
        ORDER BY s.imported_at DESC
        LIMIT ?
        "#,
    )
    .bind(repo_id)
    .bind(limit)
    .fetch_all(&*db.0)
    .await
    .map_err(|e| e.to_string())?;

    let payloads: Vec<SessionExcerptPayload> = rows
        .into_iter()
        .map(|row| {
            let trace = serde_json::from_str::<SessionTrace>(&row.raw_json)
                .map_err(|e| format!("Failed to deserialize session: {}", e))?;
            let messages = trace
                .messages
                .iter()
                .enumerate()
                .map(|(idx, message)| match message {
                    TraceMessage::User { text, .. } => SessionMessagePayload {
                        id: format!("{}:m{}", row.id, idx),
                        role: SessionMessageRolePayload::User,
                        text: text.clone(),
                        files: None,
                        tool_name: None,
                        tool_input: None,
                    },
                    TraceMessage::Assistant { text, .. } => SessionMessagePayload {
                        id: format!("{}:m{}", row.id, idx),
                        role: SessionMessageRolePayload::Assistant,
                        text: text.clone(),
                        files: None,
                        tool_name: None,
                        tool_input: None,
                    },
                    TraceMessage::Thinking { text, .. } => SessionMessagePayload {
                        id: format!("{}:m{}", row.id, idx),
                        role: SessionMessageRolePayload::Thinking,
                        text: text.clone(),
                        files: None,
                        tool_name: None,
                        tool_input: None,
                    },
                    TraceMessage::Plan { text, .. } => SessionMessagePayload {
                        id: format!("{}:m{}", row.id, idx),
                        role: SessionMessageRolePayload::Plan,
                        text: text.clone(),
                        files: None,
                        tool_name: None,
                        tool_input: None,
                    },
                    TraceMessage::ToolCall {
                        tool_name, input, ..
                    } => {
                        let text = input
                            .as_ref()
                            .and_then(|value| {
                                if value.is_null() {
                                    None
                                } else {
                                    Some(value.to_string())
                                }
                            })
                            .unwrap_or_default();
                        SessionMessagePayload {
                            id: format!("{}:m{}", row.id, idx),
                            role: SessionMessageRolePayload::ToolCall,
                            text,
                            files: None,
                            tool_name: Some(tool_name.clone()),
                            tool_input: input.clone(),
                        }
                    }
                })
                .collect::<Vec<_>>();

            Ok(SessionExcerptPayload {
                id: row.id,
                tool: row.tool,
                agent_name: None,
                duration_min: row.duration_min,
                imported_at_iso: row.imported_at,
                messages,
                linked_commit_sha: row.commit_sha,
                link_confidence: row.confidence,
                auto_linked: row.auto_linked.map(|value| value != 0),
                needs_review: row.needs_review.map(|value| value != 0),
                redaction_count: row.redaction_count,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(payloads)
}

/// Import multiple session files
///
/// This command handles partial failures - successful imports are returned
/// even if some files fail. This is important for UX: we don't want one
/// corrupt file to prevent importing 50 valid sessions.
#[tauri::command(rename_all = "camelCase")]
pub async fn import_session_files(
    db: State<'_, DbState>,
    repo_id: i64,
    file_paths: Vec<String>,
) -> Result<BatchImportResult, String> {
    let registry = ParserRegistry::new();
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();
    let total = file_paths.len();

    for path_str in file_paths {
        let path = std::path::Path::new(&path_str);

        match registry.parse(path) {
            ParseResult::Success(session) => match store_session(&db.0, repo_id, &session).await {
                Ok(id) => {
                    log_import(&db.0, repo_id, &path_str, Some(&id), "success", None, None).await;
                    succeeded.push(ImportSuccess {
                        path: path_str,
                        session_id: id,
                        warnings: vec![],
                    });
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    log_import(
                        &db.0,
                        repo_id,
                        &path_str,
                        None,
                        "failed",
                        None,
                        Some(&error_msg),
                    )
                    .await;
                    failed.push(ImportFailure {
                        path: path_str,
                        error: error_msg,
                        retryable: true,
                    });
                }
            },
            ParseResult::Partial(session, warnings) => {
                // Check if any warnings are security-related
                let has_security = warnings
                    .iter()
                    .any(|w| matches!(w.severity, WarningSeverity::Security));

                if has_security {
                    // Security warnings require user confirmation
                    let warning_msgs: Vec<String> = warnings
                        .iter()
                        .filter(|w| matches!(w.severity, WarningSeverity::Security))
                        .map(|w| w.message.clone())
                        .collect();

                    let error_msg = format!(
                        "Security warnings detected: {}. User confirmation required.",
                        warning_msgs.join("; ")
                    );

                    log_import(
                        &db.0,
                        repo_id,
                        &path_str,
                        None,
                        "failed",
                        Some(&warning_msgs.join("\n")),
                        Some(&error_msg),
                    )
                    .await;

                    failed.push(ImportFailure {
                        path: path_str,
                        error: error_msg,
                        retryable: true, // Can retry after user confirmation
                    });
                    continue;
                }

                // Non-security warnings: store with warnings logged
                match store_session(&db.0, repo_id, &session).await {
                    Ok(id) => {
                        let warning_msgs: Vec<String> = warnings
                            .iter()
                            .map(|w| {
                                format!(
                                    "[{}] {}",
                                    match w.severity {
                                        WarningSeverity::Info => "INFO",
                                        WarningSeverity::Warning => "WARN",
                                        WarningSeverity::Security => "SEC",
                                    },
                                    w.message
                                )
                            })
                            .collect();

                        log_import(
                            &db.0,
                            repo_id,
                            &path_str,
                            Some(id.as_str()),
                            "partial",
                            Some(&warning_msgs.join("\n")),
                            None,
                        )
                        .await;

                        succeeded.push(ImportSuccess {
                            path: path_str,
                            session_id: id,
                            warnings: warning_msgs,
                        });
                    }
                    Err(e) => {
                        let error_msg = e.to_string();
                        log_import(
                            &db.0,
                            repo_id,
                            &path_str,
                            None,
                            "failed",
                            None,
                            Some(&error_msg),
                        )
                        .await;
                        failed.push(ImportFailure {
                            path: path_str,
                            error: error_msg,
                            retryable: true,
                        });
                    }
                }
            }
            ParseResult::Failure(e) => {
                let error_msg = e.to_string();
                let retryable = matches!(e, ParseError::Io(_));

                log_import(
                    &db.0,
                    repo_id,
                    &path_str,
                    None,
                    "failed",
                    None,
                    Some(&error_msg),
                )
                .await;

                failed.push(ImportFailure {
                    path: path_str,
                    error: error_msg,
                    retryable,
                });
            }
        }
    }

    Ok(BatchImportResult {
        total,
        succeeded,
        failed,
    })
}

/// Scan for available session files
///
/// Searches standard locations for AI session files without importing them.
#[tauri::command(rename_all = "camelCase")]
pub async fn scan_for_session_files() -> Result<Vec<ScannedSession>, String> {
    let mut results = Vec::new();

    // Scan Claude Code directories
    if let Some(home) = dirs::home_dir() {
        let claude_dir = home.join(".claude/projects");
        if claude_dir.exists() {
            scan_claude_directory(&claude_dir, &mut results).map_err(|e| e.to_string())?;
        }
    }

    Ok(results)
}

/// Import a single session file (convenience wrapper)
#[tauri::command(rename_all = "camelCase")]
pub async fn import_session_file(
    db: State<'_, DbState>,
    repo_id: i64,
    file_path: String,
) -> Result<BatchImportResult, String> {
    import_session_files(db, repo_id, vec![file_path]).await
}

/// Auto-import a session file (redact, dedupe, store, link).
#[tauri::command(rename_all = "camelCase")]
pub async fn auto_import_session_file(
    db: State<'_, DbState>,
    repo_id: i64,
    file_path: String,
) -> Result<AutoImportResult, String> {
    auto_import_session_file_inner(&db.0, repo_id, file_path).await
}

async fn auto_import_session_file_inner(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    file_path: String,
) -> Result<AutoImportResult, String> {
    let registry = ParserRegistry::new();
    let path = std::path::Path::new(&file_path);

    let session = match registry.parse(path) {
        ParseResult::Success(parsed) => parsed,
        ParseResult::Partial(parsed, _warnings) => parsed,
        ParseResult::Failure(e) => {
            log_auto_ingest(
                db,
                repo_id,
                "unknown",
                Some(&file_path),
                None,
                "failed",
                0,
                Some(&e.to_string()),
            )
            .await;
            return Err(e.to_string());
        }
    };

    let (redacted_session, redaction) = redact_session(session);
    let dedupe_key = build_dedupe_key(&redacted_session);

    let session_id = match store_session_with_meta(
        db,
        repo_id,
        &redacted_session,
        Some(&file_path),
        Some(&dedupe_key),
        &redaction,
    )
    .await
    {
        Ok(id) => id,
        Err(StoreSessionError::Duplicate) => {
            log_auto_ingest(
                db,
                repo_id,
                &redacted_session.origin.tool,
                Some(&file_path),
                Some(&redacted_session.origin.session_id),
                "skipped",
                redaction.total as i64,
                None,
            )
            .await;
            return Ok(AutoImportResult::skipped(
                redacted_session.origin.tool,
                redacted_session.origin.session_id,
            ));
        }
        Err(StoreSessionError::Db(err)) => {
            log_auto_ingest(
                db,
                repo_id,
                &redacted_session.origin.tool,
                Some(&file_path),
                Some(&redacted_session.origin.session_id),
                "failed",
                redaction.total as i64,
                Some(&err),
            )
            .await;
            return Err(err);
        }
    };

    let (link_result, link_error) =
        match link_session_to_commit_internal(db, repo_id, &redacted_session, &session_id).await {
            Ok(result) => (Some(result), None),
            Err(err) => (None, Some(err)),
        };

    log_auto_ingest(
        db,
        repo_id,
        &redacted_session.origin.tool,
        Some(&file_path),
        Some(&session_id),
        "imported",
        redaction.total as i64,
        link_error.as_deref(),
    )
    .await;

    Ok(AutoImportResult::imported(
        redacted_session.origin.tool,
        session_id,
        redaction.total as i64,
        link_result
            .map(|result| result.needs_review)
            .unwrap_or(false),
    ))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackfillResult {
    pub attempted: i64,
    pub imported: i64,
    pub skipped: i64,
    pub failed: i64,
}

fn expand_home(raw: &str) -> std::path::PathBuf {
    if let Some(stripped) = raw.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    }
    std::path::PathBuf::from(raw)
}

fn collect_recent_files(
    roots: &[String],
    predicate: impl Fn(&std::path::Path) -> bool,
    max_scan: usize,
) -> Vec<(std::path::PathBuf, std::time::SystemTime)> {
    let mut out: Vec<(std::path::PathBuf, std::time::SystemTime)> = Vec::new();

    fn walk(
        dir: &std::path::Path,
        predicate: &impl Fn(&std::path::Path) -> bool,
        out: &mut Vec<(std::path::PathBuf, std::time::SystemTime)>,
        max_scan: usize,
    ) {
        if out.len() >= max_scan {
            return;
        }
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            if out.len() >= max_scan {
                return;
            }
            let path = entry.path();
            if path.is_dir() {
                walk(&path, predicate, out, max_scan);
            } else if predicate(&path) {
                if let Ok(meta) = std::fs::metadata(&path) {
                    if let Ok(mtime) = meta.modified() {
                        out.push((path, mtime));
                    }
                }
            }
        }
    }

    for root in roots {
        let p = expand_home(root);
        if p.exists() && p.is_file() {
            if predicate(&p) {
                if let Ok(meta) = std::fs::metadata(&p) {
                    if let Ok(mtime) = meta.modified() {
                        out.push((p, mtime));
                    }
                }
            }
            continue;
        }
        if p.exists() && p.is_dir() {
            walk(&p, &predicate, &mut out, max_scan);
        }
    }

    out.sort_by(|a, b| b.1.cmp(&a.1));
    out
}

/// Backfill recent session files from configured capture sources.
///
/// This is used to make the UI feel alive immediately after enabling auto-ingest.
#[tauri::command(rename_all = "camelCase")]
pub async fn backfill_recent_sessions(
    db: State<'_, DbState>,
    repo_id: i64,
    limit_per_tool: i64,
) -> Result<BackfillResult, String> {
    let config = crate::ingest_config::load_config().unwrap_or_default();
    let limit = limit_per_tool.clamp(1, 50) as usize;

    let mut candidates: Vec<String> = Vec::new();

    // Claude session files
    let claude = collect_recent_files(
        &config.watch_paths.claude,
        |p| {
            p.extension().map(|e| e == "jsonl").unwrap_or(false)
                && p.to_string_lossy().contains(".claude")
        },
        5000,
    );
    candidates.extend(
        claude
            .into_iter()
            .take(limit)
            .map(|(p, _)| p.to_string_lossy().to_string()),
    );

    // Codex logs (fallback)
    if config.codex.mode == "logs" || config.codex.mode == "both" {
        let codex = collect_recent_files(
            &config.watch_paths.codex_logs,
            |p| {
                let s = p.to_string_lossy().replace('\\', "/");
                // Prefer structured Codex sessions.
                (s.contains(".codex/sessions/") && s.ends_with(".jsonl"))
                    || (s.contains(".codex/archived_sessions/") && s.ends_with(".jsonl"))
                    || s.ends_with("/.codex/history.jsonl")
                    // Legacy fallback: logs
                    || (s.contains(".codex/logs/") && s.contains(".log"))
            },
            5000,
        );
        candidates.extend(
            codex
                .into_iter()
                .take(limit)
                .map(|(p, _)| p.to_string_lossy().to_string()),
        );
    }

    let mut attempted = 0i64;
    let mut imported = 0i64;
    let mut skipped = 0i64;
    let mut failed = 0i64;

    for path in candidates {
        attempted += 1;
        match auto_import_session_file_inner(&db.0, repo_id, path).await {
            Ok(r) => match r.status.as_str() {
                "imported" => imported += 1,
                "skipped" => skipped += 1,
                _ => {}
            },
            Err(_) => failed += 1,
        }
    }

    Ok(BackfillResult {
        attempted,
        imported,
        skipped,
        failed,
    })
}

/// Purge sessions older than retentionDays by scrubbing raw_json.
#[tauri::command(rename_all = "camelCase")]
pub async fn purge_expired_sessions(
    db: State<'_, DbState>,
    repo_id: i64,
    retention_days: i64,
) -> Result<u64, String> {
    let result = sqlx::query(
        r#"
        UPDATE sessions
        SET raw_json = '{"messages":[]}', purged_at = datetime('now')
        WHERE repo_id = ? AND purged_at IS NULL
          AND imported_at <= datetime('now', ?)
        "#,
    )
    .bind(repo_id)
    .bind(format!("-{} days", retention_days))
    .execute(&*db.0)
    .await
    .map_err(|e| e.to_string())?;

    let _ = sqlx::query(
        r#"
        DELETE FROM atlas_chunks
        WHERE repo_id = ?
          AND session_id IN (
            SELECT id
            FROM sessions
            WHERE repo_id = ? AND purged_at IS NOT NULL
          )
        "#,
    )
    .bind(repo_id)
    .bind(repo_id)
    .execute(&*db.0)
    .await;

    Ok(result.rows_affected())
}

/// A discovered session file
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScannedSession {
    pub path: String,
    pub tool: String,
    pub detected_at: String,
}

/// Store a parsed session in the database
async fn store_session(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    session: &ParsedSession,
) -> Result<String, sqlx::Error> {
    use sqlx::query;

    // Generate deterministic session ID
    let session_id = generate_session_id(&session.origin);

    // Calculate session metadata
    let message_count = session.message_count() as i32;
    let duration_min = session.started_at.and_then(|start| {
        session
            .ended_at
            .map(|end| (end - start).num_minutes() as i32)
    });

    // Serialize trace to JSON
    let trace_json = serde_json::to_string(&session.trace).unwrap_or_else(|_| "{}".to_string());

    // Serialize files touched
    let files_json =
        serde_json::to_string(&session.files_touched).unwrap_or_else(|_| "[]".to_string());

    // Insert or update session (includes all fields from session_details)
    query(
        r#"
        INSERT INTO sessions (
            id,
            repo_id,
            tool,
            model,
            imported_at,
            duration_min,
            message_count,
            files,
            conversation_id,
            trace_available,
            raw_json,
            source_path,
            source_session_id,
            redaction_count,
            redaction_types,
            dedupe_key
        )
        VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?, ?, ?, ?, 1, ?, NULL, NULL, 0, NULL, NULL)
        ON CONFLICT(id) DO UPDATE SET
            imported_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            model = COALESCE(excluded.model, sessions.model),
            duration_min = COALESCE(excluded.duration_min, sessions.duration_min),
            message_count = excluded.message_count,
            files = excluded.files,
            conversation_id = COALESCE(excluded.conversation_id, sessions.conversation_id),
            trace_available = MAX(excluded.trace_available, sessions.trace_available),
            raw_json = excluded.raw_json
        "#,
    )
    .bind(&session_id)
    .bind(repo_id)
    .bind(&session.origin.tool)
    .bind(&session.origin.model)
    .bind(duration_min)
    .bind(message_count)
    .bind(files_json)
    .bind(&session.origin.conversation_id)
    .bind(&trace_json)
    .execute(db)
    .await?;

    Ok(session_id)
}

#[derive(Debug)]
enum StoreSessionError {
    Duplicate,
    Db(String),
}

async fn store_session_with_meta(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    session: &ParsedSession,
    source_path: Option<&str>,
    dedupe_key: Option<&str>,
    redaction: &RedactionSummary,
) -> Result<String, StoreSessionError> {
    use sqlx::query;

    let session_id = generate_session_id(&session.origin);
    let message_count = session.message_count() as i32;
    let duration_min = session.started_at.and_then(|start| {
        session
            .ended_at
            .map(|end| (end - start).num_minutes() as i32)
    });

    let trace_json = serde_json::to_string(&session.trace).unwrap_or_else(|_| "{}".to_string());
    let files_json =
        serde_json::to_string(&session.files_touched).unwrap_or_else(|_| "[]".to_string());
    let redaction_types =
        serde_json::to_string(&redaction.hits).unwrap_or_else(|_| "[]".to_string());

    let result = query(
        r#"
        INSERT INTO sessions (
            id,
            repo_id,
            tool,
            model,
            imported_at,
            duration_min,
            message_count,
            files,
            conversation_id,
            trace_available,
            raw_json,
            source_path,
            source_session_id,
            redaction_count,
            redaction_types,
            dedupe_key
        )
        VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        -- NOTE: idx_sessions_repo_dedupe is a *partial* unique index (dedupe_key IS NOT NULL),
        -- so the upsert target must include the same WHERE clause to match it.
        ON CONFLICT(repo_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        "#,
    )
    .bind(&session_id)
    .bind(repo_id)
    .bind(&session.origin.tool)
    .bind(&session.origin.model)
    .bind(duration_min)
    .bind(message_count)
    .bind(files_json)
    .bind(&session.origin.conversation_id)
    .bind(&trace_json)
    .bind(source_path)
    .bind(&session.origin.session_id)
    .bind(redaction.total as i64)
    .bind(redaction_types)
    .bind(dedupe_key)
    .execute(db)
    .await;

    let result = match result {
        Ok(result) => result,
        Err(e) => {
            let msg = e.to_string();
            // Treat duplicate primary-key inserts as a no-op duplicate for auto-import.
            // This prevents noisy failures when the same upstream session is observed again.
            if msg.contains("UNIQUE constraint failed: sessions.id")
                || msg.contains("UNIQUE constraint failed: sessions.repo_id, sessions.dedupe_key")
            {
                return Err(StoreSessionError::Duplicate);
            }
            return Err(StoreSessionError::Db(msg));
        }
    };

    if result.rows_affected() == 0 {
        return Err(StoreSessionError::Duplicate);
    }

    if let Err(err) =
        crate::atlas::projection::upsert_chunks_for_session(db, repo_id, &session_id, &trace_json)
            .await
    {
        eprintln!(
            "Narrative: Atlas projection failed during import (repo_id={}, session_id={}): {}",
            repo_id, session_id, err
        );
        crate::atlas::projection::mark_index_error(db, repo_id, &err).await;
    }

    Ok(session_id)
}

pub(crate) async fn store_codex_app_server_completed_session(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    thread_id: &str,
    turn_id: &str,
    item_id: &str,
    event_type: &str,
    source: &str,
    payload: &serde_json::Value,
    received_at_iso: &str,
) -> Result<String, String> {
    use super::parser::{ParsedSession, SessionOrigin, SessionTrace, TraceMessage};

    let model = payload
        .get("model")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);

    let files_touched = payload
        .get("filesTouched")
        .or_else(|| payload.get("files_touched"))
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let summary_text = payload
        .get("summary")
        .or_else(|| payload.get("text"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| payload.to_string());

    let mut trace = SessionTrace::new();
    trace.add_message(TraceMessage::Assistant {
        text: summary_text,
        timestamp: Some(received_at_iso.to_string()),
    });

    let session = ParsedSession {
        origin: SessionOrigin {
            tool: "codex_app_server".to_string(),
            session_id: format!("{thread_id}:{turn_id}:{item_id}:{event_type}:{source}"),
            conversation_id: thread_id.to_string(),
            model,
        },
        started_at: None,
        ended_at: None,
        trace,
        files_touched,
    };

    let dedupe_key = format!(
        "live|{}|{}|{}|{}",
        thread_id.trim(),
        turn_id.trim(),
        item_id.trim(),
        event_type.trim().to_lowercase(),
    );

    let redaction = RedactionSummary {
        total: 0,
        hits: vec![],
    };

    match store_session_with_meta(
        db,
        repo_id,
        &session,
        Some("codex-app-server"),
        Some(&dedupe_key),
        &redaction,
    )
    .await
    {
        Ok(session_id) => Ok(session_id),
        Err(StoreSessionError::Duplicate) => Ok(generate_session_id(&session.origin)),
        Err(StoreSessionError::Db(message)) => Err(message),
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoImportResult {
    pub status: String,
    pub tool: String,
    pub session_id: String,
    pub redaction_count: i64,
    pub needs_review: bool,
}

impl AutoImportResult {
    pub fn imported(
        tool: String,
        session_id: String,
        redaction_count: i64,
        needs_review: bool,
    ) -> Self {
        Self {
            status: "imported".to_string(),
            tool,
            session_id,
            redaction_count,
            needs_review,
        }
    }

    pub fn skipped(tool: String, session_id: String) -> Self {
        Self {
            status: "skipped".to_string(),
            tool,
            session_id,
            redaction_count: 0,
            needs_review: false,
        }
    }
}

fn redact_session(mut session: ParsedSession) -> (ParsedSession, RedactionSummary) {
    let mut total = 0;
    let mut hits = Vec::new();

    let mut messages = Vec::new();
    for msg in session.trace.messages.into_iter() {
        match msg {
            super::parser::TraceMessage::User { text, timestamp } => {
                let (redacted, summary) = redact_text(&text);
                total += summary.total;
                merge_hits(&mut hits, summary.hits);
                messages.push(super::parser::TraceMessage::User {
                    text: redacted,
                    timestamp,
                });
            }
            super::parser::TraceMessage::Assistant { text, timestamp } => {
                let (redacted, summary) = redact_text(&text);
                total += summary.total;
                merge_hits(&mut hits, summary.hits);
                messages.push(super::parser::TraceMessage::Assistant {
                    text: redacted,
                    timestamp,
                });
            }
            super::parser::TraceMessage::Thinking { text, timestamp } => {
                let (redacted, summary) = redact_text(&text);
                total += summary.total;
                merge_hits(&mut hits, summary.hits);
                messages.push(super::parser::TraceMessage::Thinking {
                    text: redacted,
                    timestamp,
                });
            }
            super::parser::TraceMessage::Plan { text, timestamp } => {
                let (redacted, summary) = redact_text(&text);
                total += summary.total;
                merge_hits(&mut hits, summary.hits);
                messages.push(super::parser::TraceMessage::Plan {
                    text: redacted,
                    timestamp,
                });
            }
            super::parser::TraceMessage::ToolCall {
                tool_name,
                input,
                timestamp,
            } => {
                let (redacted_input, summary) = match input {
                    Some(value) => redact_value(&value),
                    None => (
                        Value::Null,
                        RedactionSummary {
                            total: 0,
                            hits: vec![],
                        },
                    ),
                };
                total += summary.total;
                merge_hits(&mut hits, summary.hits);
                messages.push(super::parser::TraceMessage::ToolCall {
                    tool_name,
                    input: if redacted_input.is_null() {
                        None
                    } else {
                        Some(redacted_input)
                    },
                    timestamp,
                });
            }
        }
    }

    session.trace.messages = messages;
    (session, RedactionSummary { total, hits })
}

fn merge_hits(
    target: &mut Vec<super::redactor::RedactionHit>,
    incoming: Vec<super::redactor::RedactionHit>,
) {
    for hit in incoming {
        if let Some(existing) = target.iter_mut().find(|h| h.kind == hit.kind) {
            existing.count += hit.count;
        } else {
            target.push(hit);
        }
    }
}

fn build_dedupe_key(session: &ParsedSession) -> String {
    use sha2::{Digest, Sha256};
    let trace_json = serde_json::to_string(&session.trace).unwrap_or_default();
    let input = format!(
        "{}:{}:{}",
        session.origin.tool, session.origin.session_id, trace_json
    );
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

async fn link_session_to_commit_internal(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    session: &ParsedSession,
    stored_session_id: &str,
) -> Result<crate::linking::LinkResult, String> {
    use crate::linking::{
        link_session_to_commits_with_options, LinkOptions, SessionMessage, SessionMessageRole,
        SessionTool,
    };

    let imported_at_iso = session
        .ended_at
        .or(session.started_at)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    let mut messages: Vec<SessionMessage> = session
        .trace
        .messages
        .iter()
        .enumerate()
        .map(|(idx, msg)| SessionMessage {
            id: format!("{}:m{}", session.origin.session_id, idx),
            role: match msg {
                super::parser::TraceMessage::User { .. } => SessionMessageRole::User,
                _ => SessionMessageRole::Assistant,
            },
            text: match msg {
                super::parser::TraceMessage::User { text, .. } => text.clone(),
                super::parser::TraceMessage::Assistant { text, .. } => text.clone(),
                super::parser::TraceMessage::Thinking { text, .. } => text.clone(),
                super::parser::TraceMessage::Plan { text, .. } => text.clone(),
                super::parser::TraceMessage::ToolCall { tool_name, .. } => {
                    format!("tool: {}", tool_name)
                }
            },
            files: None,
        })
        .collect();

    if !session.files_touched.is_empty() {
        if let Some(first) = messages.first_mut() {
            first.files = Some(session.files_touched.clone());
        }
    }

    let session_excerpt = crate::linking::SessionExcerpt {
        id: stored_session_id.to_string(),
        tool: match session.origin.tool.as_str() {
            "claude_code" | "claude-code" => SessionTool::ClaudeCode,
            "codex" => SessionTool::Codex,
            "cursor" => SessionTool::Cursor,
            _ => SessionTool::Unknown,
        },
        duration_min: session
            .started_at
            .and_then(|start| session.ended_at.map(|end| (end - start).num_minutes())),
        imported_at_iso,
        messages,
    };

    let session_end = chrono::DateTime::parse_from_rfc3339(&session_excerpt.imported_at_iso)
        .map_err(|e| format!("Invalid session timestamp: {}", e))?
        .with_timezone(&chrono::Utc);
    let tolerance = chrono::Duration::minutes(240);
    let window_start = (session_end - tolerance)
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string();
    let window_end = (session_end + tolerance)
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string();

    let commits = super::super::link_commands::query_commits_in_window(
        db,
        repo_id,
        &window_start,
        &window_end,
    )
    .await
    .map_err(|e| e.to_string())?;

    let result = link_session_to_commits_with_options(
        &session_excerpt,
        &commits,
        LinkOptions {
            skip_secret_scan: true,
        },
    )
    .map_err(|e| format!("{:?}", e))?;

    sqlx::query(
        r#"
        INSERT INTO session_links (repo_id, session_id, commit_sha, confidence, auto_linked, needs_review)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(repo_id, session_id) DO UPDATE SET
            commit_sha = excluded.commit_sha,
            confidence = excluded.confidence,
            auto_linked = excluded.auto_linked,
            needs_review = excluded.needs_review
        "#,
    )
    .bind(repo_id)
    .bind(&session_excerpt.id)
    .bind(&result.commit_sha)
    .bind(result.confidence)
    .bind(result.auto_linked)
    .bind(if result.needs_review { 1 } else { 0 })
    .execute(db)
    .await
    .map_err(|e| format!("Failed to store link: {}", e))?;

    Ok(result)
}

#[allow(clippy::too_many_arguments)]
async fn log_auto_ingest(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    source_tool: &str,
    source_path: Option<&str>,
    session_id: Option<&str>,
    status: &str,
    redaction_count: i64,
    error_message: Option<&str>,
) {
    let _ = sqlx::query(
        r#"
        INSERT INTO ingest_audit_log
          (repo_id, source_tool, source_path, session_id, action, status, redaction_count, error_message, created_at)
        VALUES (?, ?, ?, ?, 'auto_import', ?, ?, ?, datetime('now'))
        "#,
    )
    .bind(repo_id)
    .bind(source_tool)
    .bind(source_path)
    .bind(session_id)
    .bind(status)
    .bind(redaction_count)
    .bind(error_message)
    .execute(db)
    .await;
}

/// Log import attempt for audit/debugging
async fn log_import(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    file_path: &str,
    session_id: Option<&str>,
    status: &str,
    warnings: Option<&str>,
    error: Option<&str>,
) {
    let _ = sqlx::query(
        r#"
        INSERT INTO session_import_log (repo_id, file_path, session_id, status, warnings, error_message, imported_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        "#
    )
    .bind(repo_id)
    .bind(file_path)
    .bind(session_id)
    .bind(status)
    .bind(warnings)
    .bind(error)
    .execute(db)
    .await;
}

/// Generate a deterministic session ID
fn generate_session_id(origin: &super::parser::SessionOrigin) -> String {
    use sha2::{Digest, Sha256};

    let input = format!("{}:{}", origin.tool, origin.session_id);
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();

    format!("{:x}", result)[..16].to_string()
}

/// Scan Claude Code directory recursively
fn scan_claude_directory(
    dir: &std::path::Path,
    results: &mut Vec<ScannedSession>,
) -> Result<(), std::io::Error> {
    use std::fs;

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Recurse into subdirectories
            scan_claude_directory(&path, results)?;
        } else if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
            results.push(ScannedSession {
                path: path.to_string_lossy().to_string(),
                tool: "claude_code".to_string(),
                detected_at: chrono::Utc::now().to_rfc3339(),
            });
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[test]
    fn test_generate_session_id_deterministic() {
        let origin = super::super::parser::SessionOrigin {
            tool: "claude_code".to_string(),
            session_id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            conversation_id: "conversation-1".to_string(),
            model: None,
        };

        let id1 = generate_session_id(&origin);
        let id2 = generate_session_id(&origin);

        assert_eq!(id1, id2);
        assert_eq!(id1.len(), 16);
    }

    #[test]
    fn test_generate_session_id_unique() {
        let origin1 = super::super::parser::SessionOrigin {
            tool: "claude_code".to_string(),
            session_id: "aaa".to_string(),
            conversation_id: "conversation-1".to_string(),
            model: None,
        };

        let origin2 = super::super::parser::SessionOrigin {
            tool: "cursor".to_string(),
            session_id: "aaa".to_string(),
            conversation_id: "conversation-2".to_string(),
            model: None,
        };

        let id1 = generate_session_id(&origin1);
        let id2 = generate_session_id(&origin2);

        assert_ne!(id1, id2);
    }

    #[test]
    fn store_codex_app_server_completed_session_uses_canonical_dedupe() {
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

            sqlx::query(include_str!("../../migrations/001_init.sql"))
                .execute(&pool)
                .await
                .expect("migration 001");
            sqlx::query(include_str!("../../migrations/004_session_attribution.sql"))
                .execute(&pool)
                .await
                .expect("migration 004");
            sqlx::query(include_str!("../../migrations/005_attribution_notes.sql"))
                .execute(&pool)
                .await
                .expect("migration 005");
            sqlx::query(include_str!("../../migrations/009_auto_ingest.sql"))
                .execute(&pool)
                .await
                .expect("migration 009");

            sqlx::query("INSERT INTO repos (id, path) VALUES (1, '/tmp/repo')")
                .execute(&pool)
                .await
                .expect("insert repo");

            let payload = serde_json::json!({
                "summary": "completed turn",
                "model": "gpt-5",
                "filesTouched": ["src/main.ts"]
            });

            let session_id = store_codex_app_server_completed_session(
                &pool,
                1,
                "thread-1",
                "turn-1",
                "item-1",
                "item/completed",
                "app_server_stream",
                &payload,
                "2026-02-24T00:00:00.000Z",
            )
            .await
            .expect("first persist succeeds");

            let session_id_duplicate = store_codex_app_server_completed_session(
                &pool,
                1,
                "thread-1",
                "turn-1",
                "item-1",
                "item/completed",
                "app_server_stream",
                &payload,
                "2026-02-24T00:00:01.000Z",
            )
            .await
            .expect("duplicate persist is deduped");

            assert_eq!(session_id, session_id_duplicate);

            let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions WHERE repo_id = 1")
                .fetch_one(&pool)
                .await
                .expect("session count");

            assert_eq!(rows, 1);
        });
    }
}
