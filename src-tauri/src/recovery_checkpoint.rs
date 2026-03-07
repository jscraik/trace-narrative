use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::{Row, SqlitePool};

pub const RECOVERY_CHECKPOINT_SCHEMA_VERSION: u32 = 1;
pub const TRUST_RECOVERY_CHECKPOINTS_TABLE: &str = "trust_recovery_checkpoints";
pub const TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT: &str = "snapshot_timeout";
pub const TRUST_PAUSE_REASON_SEQUENCE_GAP: &str = "sequence_gap";
pub const TRUST_PAUSE_REASON_CONTRADICTORY_KEYS: &str = "contradictory_keys";
pub const TRUST_PAUSE_REASON_AUTH_DRIFT: &str = "auth_drift";
pub const TRUST_PAUSE_REASON_THREAD_MISMATCH: &str = "thread_mismatch";
pub const TRUST_PAUSE_REASON_LEDGER_CORRUPTION: &str = "ledger_corruption";
pub const TRUST_PAUSE_REASON_RUNTIME_PROTOCOL_ERROR: &str = "runtime_protocol_error";
pub const TRUST_PAUSE_REASON_HYDRATE_FAILED: &str = "hydrate_failed";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCheckpoint {
    pub thread_id: Option<String>,
    pub last_applied_event_seq: Option<u64>,
    pub replay_cursor: Option<String>,
    pub inflight_effect_ids: Vec<String>,
    pub checkpoint_written_at_iso: String,
    pub schema_version: u32,
    /// Trust pause reason carried forward to prevent misclassification on restart
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trust_pause_reason: Option<String>,
}

pub fn new_recovery_checkpoint(
    thread_id: &str,
    checkpoint_written_at_iso: &str,
) -> RecoveryCheckpoint {
    RecoveryCheckpoint {
        thread_id: Some(thread_id.to_string()),
        last_applied_event_seq: None,
        replay_cursor: None,
        inflight_effect_ids: Vec::new(),
        checkpoint_written_at_iso: checkpoint_written_at_iso.to_string(),
        schema_version: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
        trust_pause_reason: None,
    }
}

pub fn requires_fresh_retry(
    checkpoint: &RecoveryCheckpoint,
    trust_pause_reason: Option<&str>,
) -> bool {
    if checkpoint.schema_version != RECOVERY_CHECKPOINT_SCHEMA_VERSION {
        return true;
    }

    if checkpoint
        .thread_id
        .as_deref()
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        return true;
    }

    if checkpoint.replay_cursor.is_none() && checkpoint.last_applied_event_seq.is_some() {
        return true;
    }

    // Unresolved inflight effects require fresh retry (partial state after crash)
    if !checkpoint.inflight_effect_ids.is_empty() {
        return true;
    }

    matches!(
        trust_pause_reason,
        Some(
            TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT
                | TRUST_PAUSE_REASON_SEQUENCE_GAP
                | TRUST_PAUSE_REASON_CONTRADICTORY_KEYS
                | TRUST_PAUSE_REASON_AUTH_DRIFT
                | TRUST_PAUSE_REASON_THREAD_MISMATCH
                | TRUST_PAUSE_REASON_LEDGER_CORRUPTION
                | TRUST_PAUSE_REASON_RUNTIME_PROTOCOL_ERROR
                | TRUST_PAUSE_REASON_HYDRATE_FAILED
        )
    )
}

pub fn begin_fresh_retry(
    checkpoint: &RecoveryCheckpoint,
    checkpoint_written_at_iso: &str,
    trust_pause_reason: Option<&str>,
) -> RecoveryCheckpoint {
    RecoveryCheckpoint {
        thread_id: checkpoint.thread_id.clone(),
        last_applied_event_seq: None,
        replay_cursor: None,
        inflight_effect_ids: Vec::new(),
        checkpoint_written_at_iso: checkpoint_written_at_iso.to_string(),
        schema_version: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
        trust_pause_reason: trust_pause_reason.map(|s| s.to_string()),
    }
}

pub fn checkpoint_from_thread_snapshot_result(
    requested_thread_id: &str,
    result: &Value,
    checkpoint_written_at_iso: &str,
    inflight_effect_ids: Vec<String>,
) -> RecoveryCheckpoint {
    // SECURITY: Always use requested_thread_id as storage key to prevent
    // overwriting another thread's recovery state on threadId mismatch
    let _thread_id_from_response = extract_optional_string(result, &["threadId", "thread_id"]);
    let last_applied_event_seq = extract_optional_u64(
        result,
        &[
            "lastAppliedEventSeq",
            "last_applied_event_seq",
            "sequenceId",
            "sequence_id",
        ],
    )
    .or_else(|| extract_last_item_sequence(result));
    let replay_cursor =
        extract_optional_string(result, &["replayCursor", "replay_cursor", "cursor"]);

    RecoveryCheckpoint {
        thread_id: Some(requested_thread_id.to_string()),
        last_applied_event_seq,
        replay_cursor,
        inflight_effect_ids,
        checkpoint_written_at_iso: checkpoint_written_at_iso.to_string(),
        schema_version: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
        trust_pause_reason: None,
    }
}

pub fn hash_json_value(value: &Value) -> String {
    let canonical = serde_json::to_vec(&sort_json_value(value)).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(canonical);
    format!("{:x}", hasher.finalize())
}

pub async fn upsert_recovery_checkpoint(
    pool: &SqlitePool,
    checkpoint: &RecoveryCheckpoint,
) -> Result<(), String> {
    let thread_id = checkpoint_storage_key(checkpoint)?;
    let inflight_effect_ids = serde_json::to_string(&checkpoint.inflight_effect_ids)
        .map_err(|e| format!("failed to serialize checkpoint inflight effects: {e}"))?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("failed to begin transaction: {e}"))?;

    sqlx::query(
        r#"
        INSERT INTO trust_recovery_checkpoints (
          thread_id,
          last_applied_event_seq,
          replay_cursor,
          inflight_effect_ids,
          checkpoint_written_at_iso,
          schema_version,
          trust_pause_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(thread_id) DO UPDATE SET
          last_applied_event_seq = excluded.last_applied_event_seq,
          replay_cursor = excluded.replay_cursor,
          inflight_effect_ids = excluded.inflight_effect_ids,
          checkpoint_written_at_iso = excluded.checkpoint_written_at_iso,
          schema_version = excluded.schema_version,
          trust_pause_reason = excluded.trust_pause_reason
        "#,
    )
    .bind(thread_id)
    .bind(checkpoint.last_applied_event_seq.map(|value| value as i64))
    .bind(checkpoint.replay_cursor.as_deref())
    .bind(inflight_effect_ids)
    .bind(&checkpoint.checkpoint_written_at_iso)
    .bind(checkpoint.schema_version as i64)
    .bind(checkpoint.trust_pause_reason.as_deref())
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("failed to upsert trust recovery checkpoint: {e}"))?;

    tx.commit()
        .await
        .map_err(|e| format!("failed to commit checkpoint transaction: {e}"))?;

    Ok(())
}

/// Atomically prepare a recovery checkpoint for a thread snapshot.
///
/// This function performs a read-modify-write operation within a transaction,
/// eliminating the race condition between loading and updating the checkpoint.
///
/// # Arguments
/// * `pool` - The SQLite connection pool
/// * `thread_id` - The thread ID to prepare the checkpoint for
/// * `checkpoint_written_at_iso` - The ISO timestamp for the checkpoint
///
/// # Returns
/// The prepared checkpoint (either fresh or existing)
pub async fn prepare_recovery_checkpoint_atomic(
    pool: &SqlitePool,
    thread_id: &str,
    checkpoint_written_at_iso: &str,
) -> Result<RecoveryCheckpoint, String> {
    let normalized_thread_id = normalize_thread_id(thread_id)?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("failed to begin transaction: {e}"))?;

    // Load existing checkpoint within the transaction (acquires lock)
    let existing: Option<RecoveryCheckpoint> = sqlx::query(
        r#"
        SELECT
          thread_id,
          last_applied_event_seq,
          replay_cursor,
          inflight_effect_ids,
          checkpoint_written_at_iso,
          schema_version,
          trust_pause_reason
        FROM trust_recovery_checkpoints
        WHERE thread_id = ?
        "#,
    )
    .bind(&normalized_thread_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("failed to load checkpoint in transaction: {e}"))?
    .map(checkpoint_from_row)
    .transpose()?;

    // Determine the checkpoint to use
    let checkpoint = match existing {
        Some(ref existing) if requires_fresh_retry(existing, existing.trust_pause_reason.as_deref()) => {
            begin_fresh_retry(existing, checkpoint_written_at_iso, existing.trust_pause_reason.as_deref())
        }
        Some(existing) => existing,
        None => new_recovery_checkpoint(thread_id, checkpoint_written_at_iso),
    };

    // Serialize and persist within the same transaction
    let inflight_effect_ids = serde_json::to_string(&checkpoint.inflight_effect_ids)
        .map_err(|e| format!("failed to serialize checkpoint inflight effects: {e}"))?;

    sqlx::query(
        r#"
        INSERT INTO trust_recovery_checkpoints (
          thread_id,
          last_applied_event_seq,
          replay_cursor,
          inflight_effect_ids,
          checkpoint_written_at_iso,
          schema_version,
          trust_pause_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(thread_id) DO UPDATE SET
          last_applied_event_seq = excluded.last_applied_event_seq,
          replay_cursor = excluded.replay_cursor,
          inflight_effect_ids = excluded.inflight_effect_ids,
          checkpoint_written_at_iso = excluded.checkpoint_written_at_iso,
          schema_version = excluded.schema_version,
          trust_pause_reason = excluded.trust_pause_reason
        "#,
    )
    .bind(&normalized_thread_id)
    .bind(checkpoint.last_applied_event_seq.map(|value| value as i64))
    .bind(checkpoint.replay_cursor.as_deref())
    .bind(inflight_effect_ids)
    .bind(&checkpoint.checkpoint_written_at_iso)
    .bind(checkpoint.schema_version as i64)
    .bind(checkpoint.trust_pause_reason.as_deref())
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("failed to upsert checkpoint in transaction: {e}"))?;

    tx.commit()
        .await
        .map_err(|e| format!("failed to commit prepare transaction: {e}"))?;

    Ok(checkpoint)
}

pub async fn load_recovery_checkpoint(
    pool: &SqlitePool,
    thread_id: &str,
) -> Result<Option<RecoveryCheckpoint>, String> {
    let thread_id = normalize_thread_id(thread_id)?;
    let row = sqlx::query(
        r#"
        SELECT
          thread_id,
          last_applied_event_seq,
          replay_cursor,
          inflight_effect_ids,
          checkpoint_written_at_iso,
          schema_version,
          trust_pause_reason
        FROM trust_recovery_checkpoints
        WHERE thread_id = ?
        "#,
    )
    .bind(thread_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("failed to load trust recovery checkpoint: {e}"))?;

    row.map(checkpoint_from_row).transpose()
}

pub async fn delete_recovery_checkpoint(
    pool: &SqlitePool,
    thread_id: &str,
) -> Result<bool, String> {
    let thread_id = normalize_thread_id(thread_id)?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("failed to begin transaction: {e}"))?;

    let result = sqlx::query("DELETE FROM trust_recovery_checkpoints WHERE thread_id = ?")
        .bind(thread_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("failed to delete trust recovery checkpoint: {e}"))?;

    tx.commit()
        .await
        .map_err(|e| format!("failed to commit delete transaction: {e}"))?;

    Ok(result.rows_affected() > 0)
}

fn checkpoint_storage_key(checkpoint: &RecoveryCheckpoint) -> Result<String, String> {
    let Some(thread_id) = checkpoint.thread_id.as_deref() else {
        return Err("trust recovery checkpoint requires thread_id before persistence".to_string());
    };
    normalize_thread_id(thread_id)
}

fn normalize_thread_id(thread_id: &str) -> Result<String, String> {
    let normalized = thread_id.trim();
    if normalized.is_empty() {
        return Err("trust recovery checkpoint requires non-empty thread_id".to_string());
    }
    Ok(normalized.to_string())
}

fn checkpoint_from_row(row: sqlx::sqlite::SqliteRow) -> Result<RecoveryCheckpoint, String> {
    let raw_seq = row
        .try_get::<Option<i64>, _>("last_applied_event_seq")
        .map_err(|e| format!("failed to read checkpoint sequence: {e}"))?;
    let last_applied_event_seq = raw_seq
        .map(|value| {
            u64::try_from(value).map_err(|_| {
                format!("invalid negative last_applied_event_seq in checkpoint row: {value}")
            })
        })
        .transpose()?;
    let inflight_raw = row
        .try_get::<String, _>("inflight_effect_ids")
        .map_err(|e| format!("failed to read checkpoint inflight_effect_ids: {e}"))?;
    let inflight_effect_ids: Vec<String> = serde_json::from_str(&inflight_raw)
        .map_err(|e| format!("failed to parse checkpoint inflight_effect_ids: {e}"))?;

    Ok(RecoveryCheckpoint {
        thread_id: Some(
            row.try_get::<String, _>("thread_id")
                .map_err(|e| format!("failed to read checkpoint thread_id: {e}"))?,
        ),
        last_applied_event_seq,
        replay_cursor: row
            .try_get::<Option<String>, _>("replay_cursor")
            .map_err(|e| format!("failed to read checkpoint replay_cursor: {e}"))?,
        inflight_effect_ids,
        checkpoint_written_at_iso: row
            .try_get::<String, _>("checkpoint_written_at_iso")
            .map_err(|e| format!("failed to read checkpoint timestamp: {e}"))?,
        schema_version: row
            .try_get::<i64, _>("schema_version")
            .map_err(|e| format!("failed to read checkpoint schema_version: {e}"))?
            as u32,
        trust_pause_reason: row
            .try_get::<Option<String>, _>("trust_pause_reason")
            .map_err(|e| format!("failed to read checkpoint trust_pause_reason: {e}"))?,
    })
}

pub(crate) fn extract_optional_string(value: &Value, fields: &[&str]) -> Option<String> {
    fields.iter().find_map(|field| {
        value
            .get(field)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|candidate| !candidate.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn extract_optional_u64(value: &Value, fields: &[&str]) -> Option<u64> {
    fields.iter().find_map(|field| {
        value.get(field).and_then(|candidate| match candidate {
            Value::Number(number) => number.as_u64(),
            Value::String(text) => text.trim().parse::<u64>().ok(),
            _ => None,
        })
    })
}

fn extract_last_item_sequence(value: &Value) -> Option<u64> {
    value
        .get("items")
        .and_then(Value::as_array)
        .and_then(|items| {
            items.iter().rev().find_map(|item| {
                extract_optional_u64(item, &["sequenceId", "sequence_id", "lastAppliedEventSeq"])
            })
        })
}

fn sort_json_value(value: &Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.iter().map(sort_json_value).collect()),
        Value::Object(map) => {
            let mut entries = map.iter().collect::<Vec<_>>();
            entries.sort_by(|(left, _), (right, _)| left.cmp(right));
            let mut sorted = serde_json::Map::new();
            for (key, nested) in entries {
                sorted.insert(key.clone(), sort_json_value(nested));
            }
            Value::Object(sorted)
        }
        _ => value.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        begin_fresh_retry, checkpoint_from_thread_snapshot_result, delete_recovery_checkpoint,
        hash_json_value, load_recovery_checkpoint, new_recovery_checkpoint, requires_fresh_retry,
        upsert_recovery_checkpoint, RecoveryCheckpoint, RECOVERY_CHECKPOINT_SCHEMA_VERSION,
        TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT, TRUST_RECOVERY_CHECKPOINTS_TABLE,
    };
    use serde_json::json;
    use sqlx::sqlite::SqlitePoolOptions;
    use std::fs;

    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
    }

    async fn checkpoint_pool() -> sqlx::SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("memory sqlite");
        sqlx::query(include_str!(
            "../migrations/016_trust_recovery_checkpoints.sql"
        ))
        .execute(&pool)
        .await
        .expect("checkpoint migration applies");
        sqlx::query(include_str!(
            "../migrations/018_trust_recovery_pause_reason.sql"
        ))
        .execute(&pool)
        .await
        .expect("checkpoint migration applies");
        pool
    }

    #[test]
    fn durable_checkpoint_round_trips_through_json() {
        let checkpoint = RecoveryCheckpoint {
            thread_id: Some("thread_123".to_string()),
            last_applied_event_seq: Some(42),
            replay_cursor: Some("cursor:42".to_string()),
            inflight_effect_ids: vec!["approval:req_1".to_string(), "rpc:thread-read".to_string()],
            checkpoint_written_at_iso: "2026-03-07T02:10:00.000Z".to_string(),
            schema_version: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
            trust_pause_reason: Some(TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT.to_string()),
        };

        let encoded = serde_json::to_string(&checkpoint).expect("checkpoint should serialize");
        let decoded: RecoveryCheckpoint =
            serde_json::from_str(&encoded).expect("checkpoint should deserialize");

        assert_eq!(decoded, checkpoint);
    }

    #[test]
    fn fresh_retry_checkpoint_clears_durable_resume_state_after_timeout() {
        let persisted = RecoveryCheckpoint {
            thread_id: Some("thread_456".to_string()),
            last_applied_event_seq: Some(99),
            replay_cursor: Some("cursor:99".to_string()),
            inflight_effect_ids: vec!["approval:req_timeout".to_string()],
            checkpoint_written_at_iso: "2026-03-07T02:11:00.000Z".to_string(),
            schema_version: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
            trust_pause_reason: Some(TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT.to_string()),
        };

        assert!(requires_fresh_retry(
            &persisted,
            Some(TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT)
        ));

        let retry_checkpoint = begin_fresh_retry(&persisted, "2026-03-07T02:12:00.000Z", Some(TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT));
        assert_eq!(retry_checkpoint.thread_id.as_deref(), Some("thread_456"));
        assert_eq!(retry_checkpoint.last_applied_event_seq, None);
        assert_eq!(retry_checkpoint.replay_cursor, None);
        assert!(retry_checkpoint.inflight_effect_ids.is_empty());
        assert_eq!(
            retry_checkpoint.checkpoint_written_at_iso,
            "2026-03-07T02:12:00.000Z"
        );
        assert_eq!(
            retry_checkpoint.schema_version,
            RECOVERY_CHECKPOINT_SCHEMA_VERSION
        );
        assert_eq!(
            retry_checkpoint.trust_pause_reason.as_deref(),
            Some(TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT)
        );

        let encoded = serde_json::to_string(&retry_checkpoint)
            .expect("fresh retry checkpoint should serialize");
        let decoded: RecoveryCheckpoint =
            serde_json::from_str(&encoded).expect("fresh retry checkpoint should deserialize");
        assert_eq!(decoded, retry_checkpoint);
    }

    #[test]
    fn incompatible_checkpoint_schema_forces_fresh_retry() {
        let checkpoint = RecoveryCheckpoint {
            thread_id: Some("thread_789".to_string()),
            last_applied_event_seq: Some(12),
            replay_cursor: Some("cursor:12".to_string()),
            inflight_effect_ids: vec![],
            checkpoint_written_at_iso: "2026-03-07T02:13:00.000Z".to_string(),
            schema_version: RECOVERY_CHECKPOINT_SCHEMA_VERSION + 1,
            trust_pause_reason: None,
        };

        assert!(requires_fresh_retry(&checkpoint, None));
    }

    #[test]
    fn inflight_effects_require_fresh_retry() {
        let checkpoint = RecoveryCheckpoint {
            thread_id: Some("thread_inflight".to_string()),
            last_applied_event_seq: Some(50),
            replay_cursor: Some("cursor:50".to_string()),
            inflight_effect_ids: vec!["rpc:thread-read:123".to_string()],
            checkpoint_written_at_iso: "2026-03-07T02:14:00.000Z".to_string(),
            schema_version: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
            trust_pause_reason: None,
        };

        // Should require fresh retry due to inflight effects
        assert!(requires_fresh_retry(&checkpoint, None));
    }

    #[test]
    fn thread_snapshot_result_builds_durable_checkpoint_from_runtime_fields() {
        let checkpoint = checkpoint_from_thread_snapshot_result(
            "thread_requested",
            &json!({
                "threadId": "thread_runtime_mismatch",
                "lastAppliedEventSeq": 41,
                "replayCursor": "cursor:41",
                "items": [{ "sequenceId": 41 }]
            }),
            "2026-03-07T03:00:00.000Z",
            vec![],
        );

        // SECURITY: Should use requested thread ID, not response threadId (prevents cross-thread overwrite)
        assert_eq!(checkpoint.thread_id.as_deref(), Some("thread_requested"));
        assert_eq!(checkpoint.last_applied_event_seq, Some(41));
        assert_eq!(checkpoint.replay_cursor.as_deref(), Some("cursor:41"));
        assert!(checkpoint.inflight_effect_ids.is_empty());
    }

    #[test]
    fn sqlite_checkpoint_round_trip_persists_loads_and_deletes() {
        runtime().block_on(async {
            let pool = checkpoint_pool().await;
            let checkpoint = RecoveryCheckpoint {
                thread_id: Some("thread_db".to_string()),
                last_applied_event_seq: Some(7),
                replay_cursor: Some("cursor:7".to_string()),
                inflight_effect_ids: vec!["rpc:thread-read:7".to_string()],
                checkpoint_written_at_iso: "2026-03-07T03:10:00.000Z".to_string(),
                schema_version: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
                trust_pause_reason: Some(TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT.to_string()),
            };

            upsert_recovery_checkpoint(&pool, &checkpoint)
                .await
                .expect("checkpoint persists");
            let loaded = load_recovery_checkpoint(&pool, "thread_db")
                .await
                .expect("checkpoint loads")
                .expect("checkpoint row present");
            assert_eq!(loaded, checkpoint);

            let deleted = delete_recovery_checkpoint(&pool, "thread_db")
                .await
                .expect("checkpoint deletes");
            assert!(deleted);
            let missing = load_recovery_checkpoint(&pool, "thread_db")
                .await
                .expect("checkpoint load after delete");
            assert!(missing.is_none());
        });
    }

    #[test]
    fn runtime_recovery_checkpoint_evidence_snapshot() {
        runtime().block_on(async {
            let pool = checkpoint_pool().await;
            let runtime_snapshot = json!({
                "threadId": "thread_runtime_evidence",
                "lastAppliedEventSeq": 42,
                "replayCursor": "cursor:42",
                "items": [{ "sequenceId": 42, "id": "item_42" }]
            });
            let checkpoint = checkpoint_from_thread_snapshot_result(
                "thread_runtime_evidence",
                &runtime_snapshot,
                "2026-03-07T03:15:00.000Z",
                vec![],
            );
            upsert_recovery_checkpoint(&pool, &checkpoint)
                .await
                .expect("runtime checkpoint persists");
            let persisted = load_recovery_checkpoint(&pool, "thread_runtime_evidence")
                .await
                .expect("runtime checkpoint loads")
                .expect("runtime checkpoint row present");
            let fresh_retry = begin_fresh_retry(&persisted, "2026-03-07T03:16:00.000Z", Some(TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT));
            upsert_recovery_checkpoint(&pool, &fresh_retry)
                .await
                .expect("fresh retry checkpoint persists");
            let persisted_fresh_retry = load_recovery_checkpoint(&pool, "thread_runtime_evidence")
                .await
                .expect("fresh retry checkpoint loads")
                .expect("fresh retry checkpoint row present");
            let checkpoint_row_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM trust_recovery_checkpoints WHERE thread_id = ?",
            )
            .bind("thread_runtime_evidence")
            .fetch_one(&pool)
            .await
            .expect("checkpoint row count");

            let persisted_value = serde_json::to_value(&persisted).expect("persisted checkpoint json");
            let fresh_retry_value = serde_json::to_value(&persisted_fresh_retry)
                .expect("fresh retry checkpoint json");
            let evidence = json!({
                "schema_version": 1,
                "artifact_kind": "runtime_replay_output_evidence",
                "build_sha": std::env::var("NARRATIVE_RUNTIME_REPLAY_BUILD_SHA").unwrap_or_else(|_| "test-build".to_string()),
                "generated_at": "2026-03-07T03:17:00.000Z",
                "owner": std::env::var("NARRATIVE_RUNTIME_REPLAY_OWNER").unwrap_or_else(|_| "Jamie Craik".to_string()),
                "status": "captured",
                "evidence_source": "cargo_test:runtime_recovery_checkpoint_evidence_snapshot",
                "thread_id": "thread_runtime_evidence",
                "checkpoint_store": TRUST_RECOVERY_CHECKPOINTS_TABLE,
                "checkpoint_row_count": checkpoint_row_count,
                "runtime_snapshot_result": runtime_snapshot,
                "runtime_snapshot_sha256": hash_json_value(&json!({
                    "threadId": "thread_runtime_evidence",
                    "lastAppliedEventSeq": 42,
                    "replayCursor": "cursor:42",
                    "items": [{ "sequenceId": 42, "id": "item_42" }]
                })),
                "persisted_checkpoint": persisted_value,
                "persisted_checkpoint_sha256": hash_json_value(&serde_json::to_value(&persisted).expect("persisted hash json")),
                "fresh_retry_reason": TRUST_PAUSE_REASON_SNAPSHOT_TIMEOUT,
                "fresh_retry_checkpoint": fresh_retry_value,
                "fresh_retry_checkpoint_sha256": hash_json_value(&serde_json::to_value(&persisted_fresh_retry).expect("fresh retry hash json"))
            });

            if let Ok(output_path) = std::env::var("NARRATIVE_RUNTIME_REPLAY_EVIDENCE_PATH") {
                fs::write(
                    &output_path,
                    format!("{}\n", serde_json::to_string_pretty(&evidence).expect("pretty json")),
                )
                .expect("write runtime replay evidence");
            }

            assert_eq!(persisted.thread_id.as_deref(), Some("thread_runtime_evidence"));
            assert_eq!(persisted.last_applied_event_seq, Some(42));
            assert_eq!(persisted.replay_cursor.as_deref(), Some("cursor:42"));
            assert_eq!(persisted_fresh_retry.last_applied_event_seq, None);
            assert_eq!(persisted_fresh_retry.replay_cursor, None);
            assert_eq!(persisted_fresh_retry.thread_id.as_deref(), Some("thread_runtime_evidence"));
            assert_eq!(checkpoint_row_count, 1);
        });
    }

    #[test]
    fn new_checkpoint_starts_with_empty_replay_state() {
        let checkpoint = new_recovery_checkpoint("thread_zero", "2026-03-07T03:20:00.000Z");
        assert_eq!(checkpoint.thread_id.as_deref(), Some("thread_zero"));
        assert_eq!(checkpoint.last_applied_event_seq, None);
        assert_eq!(checkpoint.replay_cursor, None);
        assert!(checkpoint.inflight_effect_ids.is_empty());
    }
}
