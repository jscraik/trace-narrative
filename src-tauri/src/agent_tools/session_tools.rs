use crate::DbState;
use serde::Serialize;
use serde_json::Value;
use sqlx::{Row, SqlitePool};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionSummary {
    pub id: String,
    pub repo_id: i64,
    pub tool: String,
    pub model: Option<String>,
    pub checkpoint_kind: String,
    pub imported_at: String,
    pub duration_min: Option<i64>,
    pub message_count: i64,
    pub files: Vec<String>,
    pub linked_commit_sha: Option<String>,
    pub link_confidence: Option<f64>,
    pub auto_linked: Option<bool>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionDetail {
    pub id: String,
    pub repo_id: i64,
    pub tool: String,
    pub model: Option<String>,
    pub checkpoint_kind: String,
    pub imported_at: String,
    pub duration_min: Option<i64>,
    pub message_count: i64,
    pub files: Vec<String>,
    pub raw_json: Value,
    pub linked_commit_sha: Option<String>,
    pub link_confidence: Option<f64>,
    pub auto_linked: Option<bool>,
}

fn normalize_limit(limit: Option<u32>) -> i64 {
    limit.unwrap_or(25).clamp(1, 200) as i64
}

fn parse_files(files_json: Option<String>) -> Vec<String> {
    let Some(files_json) = files_json else {
        return Vec::new();
    };

    serde_json::from_str::<Vec<String>>(&files_json).unwrap_or_default()
}

fn validate_commit_sha(commit_sha: &str) -> Result<(), String> {
    let normalized = commit_sha.trim();
    if normalized.len() < 7 || normalized.len() > 64 {
        return Err("commit_sha must be between 7 and 64 hex characters".to_string());
    }
    if !normalized.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("commit_sha must contain only hexadecimal characters".to_string());
    }
    Ok(())
}

async fn agent_list_sessions_internal(
    db: &SqlitePool,
    repo_id: i64,
    tool: Option<&str>,
    limit: i64,
) -> Result<Vec<AgentSessionSummary>, String> {
    let rows = sqlx::query(
        r#"
        SELECT
          s.id,
          s.repo_id,
          s.tool,
          s.model,
          s.checkpoint_kind,
          s.imported_at,
          s.duration_min,
          s.message_count,
          s.files,
          sl.commit_sha AS linked_commit_sha,
          sl.confidence AS link_confidence,
          sl.auto_linked AS auto_linked
        FROM sessions s
        LEFT JOIN session_links sl
          ON sl.repo_id = s.repo_id
         AND sl.session_id = s.id
        WHERE s.repo_id = $1
          AND ($2 IS NULL OR s.tool = $2)
        ORDER BY s.imported_at DESC
        LIMIT $3
        "#,
    )
    .bind(repo_id)
    .bind(tool)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(|e| format!("Database error listing sessions: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|row| AgentSessionSummary {
            id: row.get("id"),
            repo_id: row.get("repo_id"),
            tool: row.get("tool"),
            model: row.get("model"),
            checkpoint_kind: row.get("checkpoint_kind"),
            imported_at: row.get("imported_at"),
            duration_min: row.get("duration_min"),
            message_count: row.get("message_count"),
            files: parse_files(row.get("files")),
            linked_commit_sha: row.get("linked_commit_sha"),
            link_confidence: row.get("link_confidence"),
            auto_linked: row
                .get::<Option<i64>, _>("auto_linked")
                .map(|value| value != 0),
        })
        .collect())
}

async fn agent_get_session_internal(
    db: &SqlitePool,
    repo_id: i64,
    session_id: &str,
) -> Result<AgentSessionDetail, String> {
    let row = sqlx::query(
        r#"
        SELECT
          s.id,
          s.repo_id,
          s.tool,
          s.model,
          s.checkpoint_kind,
          s.imported_at,
          s.duration_min,
          s.message_count,
          s.files,
          s.raw_json,
          sl.commit_sha AS linked_commit_sha,
          sl.confidence AS link_confidence,
          sl.auto_linked AS auto_linked
        FROM sessions s
        LEFT JOIN session_links sl
          ON sl.repo_id = s.repo_id
         AND sl.session_id = s.id
        WHERE s.repo_id = $1
          AND s.id = $2
        LIMIT 1
        "#,
    )
    .bind(repo_id)
    .bind(session_id)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("Database error fetching session: {e}"))?
    .ok_or_else(|| format!("Session not found for repo {repo_id}: {session_id}"))?;

    let raw_json_str: String = row.get("raw_json");
    let raw_json: Value = serde_json::from_str(&raw_json_str)
        .map_err(|e| format!("Session raw_json is invalid JSON: {e}"))?;

    Ok(AgentSessionDetail {
        id: row.get("id"),
        repo_id: row.get("repo_id"),
        tool: row.get("tool"),
        model: row.get("model"),
        checkpoint_kind: row.get("checkpoint_kind"),
        imported_at: row.get("imported_at"),
        duration_min: row.get("duration_min"),
        message_count: row.get("message_count"),
        files: parse_files(row.get("files")),
        raw_json,
        linked_commit_sha: row.get("linked_commit_sha"),
        link_confidence: row.get("link_confidence"),
        auto_linked: row
            .get::<Option<i64>, _>("auto_linked")
            .map(|value| value != 0),
    })
}

async fn agent_link_session_to_commit_internal(
    db: &SqlitePool,
    repo_id: i64,
    session_id: &str,
    commit_sha: &str,
    confidence: f64,
) -> Result<i64, String> {
    if !(0.0..=1.0).contains(&confidence) {
        return Err(format!(
            "Invalid confidence: {confidence}. Must be between 0.0 and 1.0."
        ));
    }

    validate_commit_sha(commit_sha)?;

    let session_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM sessions WHERE repo_id = $1 AND id = $2)")
            .bind(repo_id)
            .bind(session_id)
            .fetch_one(db)
            .await
            .map_err(|e| format!("Database error validating session: {e}"))?;

    if !session_exists {
        return Err(format!(
            "Session not found for repo {repo_id}: {session_id}"
        ));
    }

    let commit_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM commits WHERE repo_id = $1 AND sha = $2)")
            .bind(repo_id)
            .bind(commit_sha)
            .fetch_one(db)
            .await
            .map_err(|e| format!("Database error validating commit: {e}"))?;

    if !commit_exists {
        return Err(format!("Commit not found for repo {repo_id}: {commit_sha}"));
    }

    let row = sqlx::query(
        r#"
        INSERT INTO session_links (repo_id, session_id, commit_sha, confidence, auto_linked, needs_review)
        VALUES ($1, $2, $3, $4, 0, 0)
        ON CONFLICT(repo_id, session_id)
        DO UPDATE SET
          commit_sha = excluded.commit_sha,
          confidence = excluded.confidence,
          auto_linked = 0,
          needs_review = 0
        RETURNING id
        "#,
    )
    .bind(repo_id)
    .bind(session_id)
    .bind(commit_sha)
    .bind(confidence)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database error linking session to commit: {e}"))?;

    Ok(row.get("id"))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn agent_list_sessions(
    pool: tauri::State<'_, DbState>,
    repo_id: i64,
    tool: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<AgentSessionSummary>, String> {
    let db = &*pool.0;
    let normalized_tool = tool
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    agent_list_sessions_internal(db, repo_id, normalized_tool, normalize_limit(limit)).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn agent_get_session(
    pool: tauri::State<'_, DbState>,
    repo_id: i64,
    session_id: String,
) -> Result<AgentSessionDetail, String> {
    let db = &*pool.0;
    let session_id = session_id.trim();
    if session_id.is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    agent_get_session_internal(db, repo_id, session_id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn agent_link_session_to_commit(
    pool: tauri::State<'_, DbState>,
    repo_id: i64,
    session_id: String,
    commit_sha: String,
    confidence: Option<f64>,
) -> Result<i64, String> {
    let db = &*pool.0;
    let session_id = session_id.trim();
    let commit_sha = commit_sha.trim();

    if session_id.is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    agent_link_session_to_commit_internal(
        db,
        repo_id,
        session_id,
        commit_sha,
        confidence.unwrap_or(1.0),
    )
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn agent_link_session(
    pool: tauri::State<'_, DbState>,
    repo_id: i64,
    session_id: String,
    commit_sha: String,
    confidence: Option<f64>,
) -> Result<i64, String> {
    agent_link_session_to_commit(pool, repo_id, session_id, commit_sha, confidence).await
}

#[cfg(test)]
mod tests {
    use super::{
        agent_get_session_internal, agent_link_session_to_commit_internal,
        agent_list_sessions_internal, normalize_limit, validate_commit_sha,
    };
    use sqlx::{sqlite::SqlitePoolOptions, Executor};

    async fn setup_db() -> sqlx::SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("memory sqlite should connect");

        pool.execute(
            r#"
            CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                repo_id INTEGER NOT NULL,
                tool TEXT NOT NULL,
                model TEXT,
                checkpoint_kind TEXT NOT NULL,
                imported_at TEXT NOT NULL,
                duration_min INTEGER,
                message_count INTEGER DEFAULT 0,
                files TEXT,
                raw_json TEXT NOT NULL
            );
            "#,
        )
        .await
        .expect("sessions table");

        pool.execute(
            r#"
            CREATE TABLE commits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_id INTEGER NOT NULL,
                sha TEXT NOT NULL
            );
            "#,
        )
        .await
        .expect("commits table");

        pool.execute(
            r#"
            CREATE TABLE session_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_id INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                commit_sha TEXT NOT NULL,
                confidence REAL NOT NULL,
                auto_linked BOOLEAN NOT NULL DEFAULT 1,
                needs_review BOOLEAN NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                UNIQUE(repo_id, session_id)
            );
            "#,
        )
        .await
        .expect("session_links table");

        pool
    }

    #[test]
    fn normalize_limit_bounds_values() {
        assert_eq!(normalize_limit(None), 25);
        assert_eq!(normalize_limit(Some(0)), 1);
        assert_eq!(normalize_limit(Some(500)), 200);
    }

    #[test]
    fn validate_commit_sha_enforces_hex_format() {
        assert!(validate_commit_sha("abcdef1").is_ok());
        assert!(validate_commit_sha("abc").is_err());
        assert!(validate_commit_sha("abcdefg").is_err());
    }

    #[tokio::test]
    async fn list_sessions_respects_tool_filter_and_limit() {
        let pool = setup_db().await;

        sqlx::query(
            "INSERT INTO sessions (id, repo_id, tool, checkpoint_kind, imported_at, message_count, files, raw_json)
             VALUES ('sess-1', 1, 'codex', 'ai_agent', '2026-02-24T10:00:00.000Z', 3, '[\"a.ts\"]', '{\"id\":\"sess-1\"}')",
        )
        .execute(&pool)
        .await
        .expect("insert session 1");

        sqlx::query(
            "INSERT INTO sessions (id, repo_id, tool, checkpoint_kind, imported_at, message_count, files, raw_json)
             VALUES ('sess-2', 1, 'claude_code', 'ai_agent', '2026-02-24T12:00:00.000Z', 4, '[\"b.ts\"]', '{\"id\":\"sess-2\"}')",
        )
        .execute(&pool)
        .await
        .expect("insert session 2");

        let codex_only = agent_list_sessions_internal(&pool, 1, Some("codex"), 10)
            .await
            .expect("list codex sessions");
        assert_eq!(codex_only.len(), 1);
        assert_eq!(codex_only[0].id, "sess-1");

        let capped = agent_list_sessions_internal(&pool, 1, None, 1)
            .await
            .expect("list capped sessions");
        assert_eq!(capped.len(), 1);
        assert_eq!(capped[0].id, "sess-2");
    }

    #[tokio::test]
    async fn get_session_returns_raw_json_and_link_metadata() {
        let pool = setup_db().await;

        sqlx::query(
            "INSERT INTO sessions (id, repo_id, tool, checkpoint_kind, imported_at, message_count, files, raw_json)
             VALUES ('sess-3', 2, 'codex', 'ai_agent', '2026-02-24T12:00:00.000Z', 2, '[\"src/lib.rs\"]', '{\"messages\":[]}')",
        )
        .execute(&pool)
        .await
        .expect("insert session");

        sqlx::query(
            "INSERT INTO session_links (repo_id, session_id, commit_sha, confidence, auto_linked, needs_review)
             VALUES (2, 'sess-3', 'abcdef1234567', 0.8, 0, 0)",
        )
        .execute(&pool)
        .await
        .expect("insert link");

        let detail = agent_get_session_internal(&pool, 2, "sess-3")
            .await
            .expect("get session");

        assert_eq!(detail.id, "sess-3");
        assert_eq!(detail.files, vec!["src/lib.rs".to_string()]);
        assert_eq!(detail.linked_commit_sha.as_deref(), Some("abcdef1234567"));
        assert_eq!(
            detail.raw_json["messages"].as_array().map(|a| a.len()),
            Some(0)
        );
    }

    #[tokio::test]
    async fn link_session_requires_existing_session_and_commit() {
        let pool = setup_db().await;

        sqlx::query(
            "INSERT INTO sessions (id, repo_id, tool, checkpoint_kind, imported_at, message_count, files, raw_json)
             VALUES ('sess-4', 3, 'codex', 'ai_agent', '2026-02-24T12:00:00.000Z', 1, '[]', '{\"ok\":true}')",
        )
        .execute(&pool)
        .await
        .expect("insert session");

        sqlx::query("INSERT INTO commits (repo_id, sha) VALUES (3, 'abcdef1234567')")
            .execute(&pool)
            .await
            .expect("insert commit");

        let link_id =
            agent_link_session_to_commit_internal(&pool, 3, "sess-4", "abcdef1234567", 0.9)
                .await
                .expect("link session");
        assert!(link_id > 0);

        let missing_commit =
            agent_link_session_to_commit_internal(&pool, 3, "sess-4", "deadbeef123456", 0.9).await;
        assert!(missing_commit.is_err());
    }
}
