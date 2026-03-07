---
status: complete
priority: p2
issue_id: 002
tags: [code-review, data-integrity, rust, sqlite]
dependencies: []
---

# Missing Transaction Boundaries in Recovery Checkpoint Operations

## Problem Statement

The recovery checkpoint database operations do not use explicit transactions, which could lead to data inconsistency under concurrent access or partial failure conditions.

## Findings

**Location:** `src-tauri/src/recovery_checkpoint.rs:132-169`

The `upsert_recovery_checkpoint` function performs operations without a transaction wrapper:

```rust
pub async fn upsert_recovery_checkpoint(
    pool: &SqlitePool,
    checkpoint: &RecoveryCheckpoint,
) -> Result<(), String> {
    // ... serialization ...

    sqlx::query("...")
        .bind(thread_id)
        // ... binds
        .execute(pool)  // Direct execution, no transaction
        .await
        .map_err(|e| format!("failed to upsert trust recovery checkpoint: {e}"))?;

    Ok(())
}
```

**Issues:**
1. No rollback capability if subsequent operations fail
2. No row-level locking during UPSERT - concurrent writes could interleave
3. `delete_recovery_checkpoint` at line 197 has same issue

## Proposed Solutions

### Option A: Add Explicit Transactions (Recommended)

```rust
pub async fn upsert_recovery_checkpoint(
    pool: &SqlitePool,
    checkpoint: &RecoveryCheckpoint,
) -> Result<(), String> {
    let thread_id = checkpoint_storage_key(checkpoint)?;
    let inflight_effect_ids = serde_json::to_string(&checkpoint.inflight_effect_ids)
        .map_err(|e| format!("failed to serialize checkpoint inflight effects: {e}"))?;

    let mut tx = pool.begin().await
        .map_err(|e| format!("failed to begin transaction: {e}"))?;

    sqlx::query("...")
        .bind(thread_id)
        // ... other binds
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("failed to upsert trust recovery checkpoint: {e}"))?;

    tx.commit().await
        .map_err(|e| format!("failed to commit checkpoint: {e}"))?;

    Ok(())
}
```

**Pros:**
- Atomic operations guaranteed
- Proper error handling with rollback
- Industry standard pattern

**Cons:**
- Slight performance overhead (minimal for SQLite)

**Effort:** Small
**Risk:** Very Low

### Option B: Transaction-Aware API for Multi-Checkpoint Operations

For operations that modify multiple checkpoints, expose a transaction-based API:

```rust
pub async fn upsert_recovery_checkpoint_in_transaction(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    checkpoint: &RecoveryCheckpoint,
) -> Result<(), CheckpointError> { ... }
```

**Pros:**
- Enables atomic multi-checkpoint updates
- Better for complex operations

**Cons:**
- More complex API surface

**Effort:** Medium
**Risk:** Low

## Recommended Action

Implement **Option A** immediately - wrap all write operations (`upsert`, `delete`) in explicit transactions. This is a standard practice for data integrity.

## Technical Details

**Affected Functions:**
- `upsert_recovery_checkpoint` (line 132)
- `delete_recovery_checkpoint` (line 197)

**Database:** SQLite with WAL mode

## Acceptance Criteria

- [ ] `upsert_recovery_checkpoint` uses explicit transaction
- [ ] `delete_recovery_checkpoint` uses explicit transaction
- [ ] Transaction errors are properly propagated
- [ ] Tests verify atomic behavior
- [ ] No performance regression

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-03-07 | Created from code review | Found during PR #72 data integrity review |
| 2026-03-07 | Implemented transactions | Wrapped upsert/delete in `pool.begin()` transactions |
| 2026-03-07 | Verified | All 9 recovery checkpoint tests pass |

## Resources

- PR: #72
- sqlx transactions: https://docs.rs/sqlx/latest/sqlx/struct.Pool.html#method.begin
