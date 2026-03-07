//! Integration tests for the approval ledger module
//!
//! These tests verify the core functionality:
//! - Fingerprint computation
//! - Idempotent approval recording
//! - Conflict detection for different fingerprints
//! - TTL cleanup and tombstones

use narrative_desktop_mvp::approval_ledger::{
    compute_request_fingerprint, load_approval_decision, record_approval,
    cleanup_expired_approvals, purge_tombstoned_approvals,
    ApprovalRequest, ApprovalLedgerError,
};
use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;

/// Helper to create in-memory SQLite pool for tests
async fn test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("in-memory sqlite");

    // Apply schema version table first
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS trust_schema_versions (component TEXT PRIMARY KEY, version INTEGER NOT NULL)",
    )
    .execute(&pool)
    .await
    .expect("schema versions table");

    // Apply migration
    sqlx::query(include_str!("../migrations/017_approval_ledger.sql"))
        .execute(&pool)
        .await
        .expect("approval ledger migration applies");

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
async fn test_compute_fingerprint_deterministic() {
    let request = make_request();
    let fingerprint1 = compute_request_fingerprint(&request).expect("fingerprint 1");
    let fingerprint2 = compute_request_fingerprint(&request).expect("fingerprint 2");

    assert_eq!(fingerprint1, fingerprint2, "same request should produce same fingerprint");
    assert!(fingerprint1.len() >= 64, "fingerprint should be at least 64 chars (SHA-256 hex)");
}

#[tokio::test]
async fn test_record_approval_new() {
    let pool = test_pool().await;
    let request = make_request();

    let result = record_approval(&pool, request, true).await.expect("record approval");
    assert!(result.is_new, "should be new decision");
    assert!(result.decision.approved, "should be approved");

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
    let second = record_approval(&pool, request, true).await.expect("second approval");
    assert!(!second.is_new, "should not be new on second call");
    assert_eq!(second.decision.id, first.decision.id, "should return same decision");
}

#[tokio::test]
async fn test_record_approval_conflict() {
    let pool = test_pool().await;
    let request = make_request();

    // Record first approval
    let _first = record_approval(&pool, request.clone(), true).await.expect("first approval");

    // Modify request and create conflict (same request_id, different content)
    let mut conflict_request = request.clone();
    conflict_request.command = "different_command".to_string();

    let result = record_approval(&pool, conflict_request, true).await;
    assert!(result.is_err(), "should error on conflict");

    match result {
        Err(ApprovalLedgerError::ConflictError { request_id, existing_fingerprint, new_fingerprint }) => {
            assert_eq!(request_id, "req_123");
            assert!(!existing_fingerprint.is_empty());
            assert!(!new_fingerprint.is_empty());
            assert_ne!(existing_fingerprint, new_fingerprint, "fingerprints should differ");
        }
        _ => panic!("expected ConflictError, got {:?}", result),
    }
}

#[tokio::test]
async fn test_record_approval_rejection() {
    let pool = test_pool().await;
    let mut request = make_request();
    request.request_id = "req_reject".to_string(); // Use different ID to avoid conflicts

    let result = record_approval(&pool, request.clone(), false).await.expect("record rejection");
    assert!(result.is_new);
    assert!(!result.decision.approved, "should be rejected");

    // Verify can load back
    let loaded = load_approval_decision(&pool, "req_reject")
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
        .expect("load query should not error");
    assert!(loaded.is_none(), "should return None for nonexistent request");
}

#[tokio::test]
async fn test_cleanup_expired_approvals() {
    let pool = test_pool().await;

    // Create a decision
    let _ = record_approval(&pool, make_request(), true).await.expect("record approval");

    // Mark as expired (simulate time passing by setting decided_at to the past)
    sqlx::query(
        "UPDATE trust_approval_decisions SET decided_at = datetime('now', '-31 days') WHERE request_id = ?",
    )
    .bind("req_123")
    .execute(&pool)
    .await
    .expect("update decided_at");

    let count = cleanup_expired_approvals(&pool).await.expect("cleanup");
    assert_eq!(count, 1, "should have cleaned up one entry");

    // Verify tombstone is set (load should return None)
    let loaded = load_approval_decision(&pool, "req_123").await.expect("load query");
    assert!(loaded.is_none(), "Decision should be tombstoned and not returned");
}

#[tokio::test]
async fn test_purge_tombstoned_approvals() {
    let pool = test_pool().await;

    // Create and tombstone a decision
    let _ = record_approval(&pool, make_request(), true).await.expect("record approval");
    sqlx::query("UPDATE trust_approval_decisions SET tombstone = 1 WHERE request_id = ?")
        .bind("req_123")
        .execute(&pool)
        .await
        .expect("set tombstone");

    let count = purge_tombstoned_approvals(&pool).await.expect("purge");
    assert_eq!(count, 1, "should have purged one entry");

    // Verify it's gone from database entirely
    let row_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM trust_approval_decisions WHERE request_id = ?")
        .bind("req_123")
        .fetch_one(&pool)
        .await
        .expect("count query");
    assert_eq!(row_count, 0, "Decision should be completely deleted");
}
