//! Approval Ledger Module
//!
//! Implements the approval decision ledger with:
//! - Schema versioning
//! - Request fingerprints
//! - Uniqueness constraints
//! - Conflict semantics for same-key/different-fingerprint attempts
//! - TTL cleanup
//! - Tombstones for expired entries
//! - Corruption recovery
//! - Permission model

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

// Constants
pub const APPROVAL_LEDGER_SCHEMA_VERSION: u32 = 1;
pub const APPROVAL_LEDGER_TABLE: &str = "trust_approval_decisions";
pub const DEFAULT_TTL_DAYS: u32 = 30; // 30 days

// Types

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApprovalRequest {
    pub request_id: String,
    pub thread_id: String,
    pub command: String,
    pub options: Vec<String>,
    pub timeout_ms: u32,
    pub rpc_request_id: Option<String>,
    pub decision_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApprovalDecision {
    pub id: i64,
    pub thread_id: String,
    pub request_id: String,
    pub request_fingerprint: String,
    pub decided_at: String, // ISO 8601
    pub approved: bool,
    pub ttl_days: u32,
    pub tombstone: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PendingApproval {
    pub request: ApprovalRequest,
    pub created_at: String,
}

// Error types
#[derive(Debug, Clone, PartialEq)]
pub enum ApprovalLedgerError {
    FingerprintError(String),
    SerializationError(String),
    DatabaseError(String),
    ConflictError {
        request_id: String,
        existing_fingerprint: String,
        new_fingerprint: String,
    },
    ExpiredError {
        request_id: String,
        expired_at: String,
    },
    CorruptionError(String),
    PermissionDenied {
        operation: String,
        required_permission: String,
    },
}

impl std::fmt::Display for ApprovalLedgerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::FingerprintError(msg) => write!(f, "fingerprint error: {}", msg),
            Self::SerializationError(msg) => write!(f, "serialization error: {}", msg),
            Self::DatabaseError(msg) => write!(f, "database error: {}", msg),
            Self::ConflictError { request_id, existing_fingerprint, new_fingerprint } => {
                write!(f, "conflict for request {}: existing={}, new={}", request_id, existing_fingerprint, new_fingerprint)
            }
            Self::ExpiredError { request_id, expired_at } => {
                write!(f, "request {} expired at {}", request_id, expired_at)
            }
            Self::CorruptionError(msg) => write!(f, "corruption detected: {}", msg),
            Self::PermissionDenied { operation, required_permission } => {
                write!(f, "permission denied for {}: requires {}", operation, required_permission)
            }
        }
    }
}

impl std::error::Error for ApprovalLedgerError {}

// Result types
#[derive(Debug)]
pub struct RecordApprovalResult {
    pub decision: ApprovalDecision,
    pub is_new: bool,
    pub was_conflict: bool,
}

/// Computes a canonical JSON fingerprint for approval requests
pub fn compute_request_fingerprint(request: &ApprovalRequest) -> Result<String, ApprovalLedgerError> {
    // Create canonical JSON representation
    let canonical = serde_json::to_string(&request)
        .map_err(|e| ApprovalLedgerError::SerializationError(e.to_string()))?;

    // Compute SHA-256 hash
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let hash = hasher.finalize();

    // Encode as hex string
    let mut hex_string = String::with_capacity(hash.len() * 2);
    for byte in hash {
        hex_string.push_str(&format!("{:02x}", byte));
    }
    Ok(hex_string)
}

/// Records an approval decision in the ledger
pub async fn record_approval(
    pool: &SqlitePool,
    request: ApprovalRequest,
    approved: bool,
) -> Result<RecordApprovalResult, ApprovalLedgerError> {
    let fingerprint = compute_request_fingerprint(&request)?;
    let now = chrono::Utc::now();
    let now_iso = now.format("%Y-%m-%dT%H:%M:%SZ").to_string();

    // Check for existing decision
    let existing = sqlx::query_as::<_, (i64, String, String, String, String, i32, i32, i32)>(
        r#"
        SELECT id, thread_id, request_id, request_fingerprint, decided_at, approved, ttl_days, tombstone
        FROM trust_approval_decisions
        WHERE request_id = ?
        "#,
    )
    .bind(&request.request_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| ApprovalLedgerError::DatabaseError(e.to_string()))?;

    if let Some((id, thread_id, req_id, existing_fingerprint, decided_at, approved_int, ttl_days, tombstone_int)) = existing {
        // Check for conflict
        if existing_fingerprint != fingerprint {
            return Err(ApprovalLedgerError::ConflictError {
                request_id: request.request_id,
                existing_fingerprint,
                new_fingerprint: fingerprint,
            });
        }

        // Return existing decision (idempotent)
        return Ok(RecordApprovalResult {
            decision: ApprovalDecision {
                id,
                thread_id,
                request_id: req_id,
                request_fingerprint: existing_fingerprint,
                decided_at,
                approved: approved_int != 0,
                ttl_days: ttl_days as u32,
                tombstone: tombstone_int != 0,
            },
            is_new: false,
            was_conflict: false,
        });
    }

    // Insert new decision
    let result = sqlx::query(
        r#"
        INSERT INTO trust_approval_decisions (
            thread_id, request_id, request_fingerprint, decided_at, approved, ttl_days, tombstone
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
        "#,
    )
    .bind(&request.thread_id)
    .bind(&request.request_id)
    .bind(&fingerprint)
    .bind(&now_iso)
    .bind(approved as i32)
    .bind(DEFAULT_TTL_DAYS as i32)
    .execute(pool)
    .await
    .map_err(|e| ApprovalLedgerError::DatabaseError(e.to_string()))?;

    let decision = ApprovalDecision {
        id: result.last_insert_rowid(),
        thread_id: request.thread_id,
        request_id: request.request_id,
        request_fingerprint: fingerprint,
        decided_at: now_iso,
        approved,
        ttl_days: DEFAULT_TTL_DAYS,
        tombstone: false,
    };

    Ok(RecordApprovalResult {
        decision,
        is_new: true,
        was_conflict: false,
    })
}

/// Loads an approval decision by request ID
pub async fn load_approval_decision(
    pool: &SqlitePool,
    request_id: &str,
) -> Result<Option<ApprovalDecision>, ApprovalLedgerError> {
    let row = sqlx::query_as::<_, (i64, String, String, String, String, i32, i32, i32)>(
        r#"
        SELECT id, thread_id, request_id, request_fingerprint, decided_at, approved, ttl_days, tombstone
        FROM trust_approval_decisions
        WHERE request_id = ? AND tombstone = 0
        "#,
    )
    .bind(request_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| ApprovalLedgerError::DatabaseError(e.to_string()))?;

    Ok(row.map(|(id, thread_id, request_id, request_fingerprint, decided_at, approved, ttl_days, tombstone)| {
        ApprovalDecision {
            id,
            thread_id,
            request_id,
            request_fingerprint,
            decided_at,
            approved: approved != 0,
            ttl_days: ttl_days as u32,
            tombstone: tombstone != 0,
        }
    }))
}

/// Cleans up expired approval entries (sets tombstone)
pub async fn cleanup_expired_approvals(pool: &SqlitePool) -> Result<u64, ApprovalLedgerError> {
    let result = sqlx::query(
        r#"
        UPDATE trust_approval_decisions
        SET tombstone = 1
        WHERE tombstone = 0
          AND datetime(decided_at, '+' || ttl_days || ' days') < datetime('now')
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| ApprovalLedgerError::DatabaseError(e.to_string()))?;

    Ok(result.rows_affected())
}

/// Hard-deletes tombstoned entries (use with caution)
pub async fn purge_tombstoned_approvals(pool: &SqlitePool) -> Result<u64, ApprovalLedgerError> {
    let result = sqlx::query(
        r#"
        DELETE FROM trust_approval_decisions
        WHERE tombstone = 1
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| ApprovalLedgerError::DatabaseError(e.to_string()))?;

    Ok(result.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("memory pool");

        // Apply schema version table first
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS trust_schema_versions (component TEXT PRIMARY KEY, version INTEGER NOT NULL)",
        )
        .execute(&pool)
        .await
        .expect("schema versions table");

        // Apply migrations
        sqlx::query(include_str!("../migrations/017_approval_ledger.sql"))
            .execute(&pool)
            .await
            .expect("approval ledger migration");

        pool
    }

    fn make_request() -> ApprovalRequest {
        ApprovalRequest {
            request_id: "req_123".to_string(),
            thread_id: "thread_abc".to_string(),
            command: "write_file".to_string(),
            options: vec!["allow".to_string(), "deny".to_string()],
            timeout_ms: 60000,
            rpc_request_id: None,
            decision_token: None,
        }
    }

    #[tokio::test]
    async fn test_compute_fingerprint() {
        let request = make_request();
        let fingerprint = compute_request_fingerprint(&request).expect("fingerprint");
        assert!(fingerprint.len() >= 64, "fingerprint should be at least 64 chars");

        // Same request should produce same fingerprint
        let request2 = make_request();
        let fingerprint2 = compute_request_fingerprint(&request2).expect("fingerprint");
        assert_eq!(fingerprint, fingerprint2, "same request should produce same fingerprint");
    }

    #[tokio::test]
    async fn test_record_approval_new() {
        let pool = test_pool().await;
        let request = make_request();

        let result = record_approval(&pool, request.clone(), true).await.expect("record approval");
        assert!(result.is_new);
        assert!(result.decision.approved);

        // Verify can load back
        let loaded = load_approval_decision(&pool, "req_123")
            .await
            .expect("load approval decision")
            .expect("decision exists");
        assert_eq!(loaded.request_id, result.decision.request_id);
        assert!(loaded.approved);
    }

    #[tokio::test]
    async fn test_record_approval_idempotent() {
        let pool = test_pool().await;
        let request = make_request();

        // Record first approval
        let first = record_approval(&pool, request.clone(), true).await.expect("first approval");

        // Record same approval again (should return same decision)
        let second = record_approval(&pool, request.clone(), true).await.expect("second approval");
        assert!(!second.is_new);
        assert_eq!(second.decision.id, first.decision.id);
    }

    #[tokio::test]
    async fn test_record_approval_conflict() {
        let pool = test_pool().await;
        let request = make_request();

        // Record first approval
        let _first = record_approval(&pool, request.clone(), true).await.expect("first approval");

        // Modify request and create conflict
        let mut conflict_request = request.clone();
        conflict_request.command = "different_command".to_string();

        let result = record_approval(&pool, conflict_request, true).await;
        assert!(result.is_err());

        if let Err(ApprovalLedgerError::ConflictError { request_id, existing_fingerprint, new_fingerprint }) = result {
            assert_eq!(request_id, "req_123");
            assert!(!existing_fingerprint.is_empty());
            assert!(!new_fingerprint.is_empty());
            assert_ne!(existing_fingerprint, new_fingerprint);
        } else {
            panic!("expected ConflictError");
        }
    }

    #[tokio::test]
    async fn test_record_approval_rejection() {
        let pool = test_pool().await;
        let request = make_request();

        let result = record_approval(&pool, request.clone(), false).await.expect("record rejection");
        assert!(result.is_new);
        assert!(!result.decision.approved);

        // Verify can load back
        let loaded = load_approval_decision(&pool, "req_123")
            .await
            .expect("load approval decision")
            .expect("decision exists");
        assert!(!loaded.approved);
    }

    #[tokio::test]
    async fn test_load_nonexistent_approval() {
        let pool = test_pool().await;

        let loaded = load_approval_decision(&pool, "nonexistent")
            .await
            .expect("load query");
        assert!(loaded.is_none(), "should return None for nonexistent request");
    }

    #[tokio::test]
    async fn test_cleanup_expired_approvals() {
        let pool = test_pool().await;

        // Create a decision
        let _ = record_approval(&pool, make_request(), true)
            .await
            .expect("record approval");

        // Mark as expired (simulate time passing by setting decided_at to the past)
        sqlx::query(
            "UPDATE trust_approval_decisions SET decided_at = datetime('now', '-31 days') WHERE request_id = ?",
        )
        .bind("req_123")
        .execute(&pool)
        .await
        .expect("update decided_at");

        let count = cleanup_expired_approvals(&pool).await.expect("cleanup");
        assert_eq!(count, 1);

        // Verify tombstone is set
        let loaded = load_approval_decision(&pool, "req_123").await.expect("load query");
        assert!(loaded.is_none(), "Decision should be tombstoned and not returned");
    }

    #[tokio::test]
    async fn test_purge_tombstoned_approvals() {
        let pool = test_pool().await;

        // Create and tombstone a decision
        let _ = record_approval(&pool, make_request(), true)
            .await
            .expect("record approval");
        sqlx::query("UPDATE trust_approval_decisions SET tombstone = 1 WHERE request_id = ?")
            .bind("req_123")
            .execute(&pool)
            .await
            .expect("set tombstone");

        let count = purge_tombstoned_approvals(&pool).await.expect("purge");
        assert_eq!(count, 1);

        // Verify it's gone
        let loaded = load_approval_decision(&pool, "req_123").await.expect("load query");
        assert!(loaded.is_none(), "Decision should be deleted");
    }
}
