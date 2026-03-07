---
status: complete
priority: p2
issue_id: 003
tags: [code-review, data-integrity, concurrency, rust]
dependencies: [002]
---

# Race Condition in prepare_thread_snapshot_checkpoint

## Problem Statement

The `prepare_thread_snapshot_checkpoint_blocking` function has a read-modify-write race condition that could cause lost updates under concurrent access.

## Findings

**Location:** `src-tauri/src/codex_app_server.rs:2802-2817`

```rust
fn prepare_thread_snapshot_checkpoint_blocking(...) -> Result<RecoveryCheckpoint, String> {
    let existing = load_recovery_checkpoint_blocking(app_handle, thread_id)?;  // Read

    // ... logic to determine checkpoint based on existing ...

    upsert_recovery_checkpoint_blocking(app_handle, &checkpoint)?;  // Write
    Ok(checkpoint)
}
```

**Problem:** Between the read (line 2806) and write (line 2816), another thread could modify the checkpoint, causing a **lost update**.

## Proposed Solutions

### Option A: Use BEGIN IMMEDIATE Transaction (Recommended)

SQLite supports `BEGIN IMMEDIATE` which acquires the write lock immediately, preventing concurrent modifications:

```rust
pub async fn prepare_thread_checkpoint_atomic(
    pool: &SqlitePool,
    thread_id: &str,
    compute_fn: impl FnOnce(Option<RecoveryCheckpoint>) -> RecoveryCheckpoint,
) -> Result<RecoveryCheckpoint, String> {
    let mut tx = pool.begin().await?;

    // Acquire lock immediately with SELECT FOR UPDATE equivalent
    let existing: Option<RecoveryCheckpoint> = sqlx::query_as(
        "SELECT * FROM trust_recovery_checkpoints WHERE thread_id = ?"
    )
    .bind(thread_id)
    .fetch_optional(&mut *tx)
    .await?;

    let checkpoint = compute_fn(existing);

    // UPSERT within same transaction
    sqlx::query("INSERT ... ON CONFLICT DO UPDATE ...")
        .bind(thread_id)
        // ...
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(checkpoint)
}
```

**Pros:**
- True atomicity
- No lost updates possible
- Database-level locking

**Cons:**
- Requires refactoring the function signature

**Effort:** Medium
**Risk:** Low

### Option B: Optimistic Locking with Version Column

Add a `version` column and use optimistic locking:

```rust
// Check version hasn't changed since read
sqlx::query("UPDATE ... WHERE thread_id = ? AND version = ?")
    .bind(thread_id)
    .bind(expected_version)
    // ...
```

**Pros:**
- No long-held locks
- Good for high-contention scenarios

**Cons:**
- Requires schema change
- More complex (retry logic needed)

**Effort:** Medium
**Risk:** Medium

## Recommended Action

Implement **Option A** - refactor to use a transaction with immediate lock acquisition. This should be done together with the transaction boundary fix (issue #002).

## Technical Details

**Affected Function:**
- `prepare_thread_snapshot_checkpoint_blocking` in `codex_app_server.rs`

**Race Condition Type:** Lost Update (read-modify-write)

**Impact:** In concurrent scenarios, checkpoint updates could be lost, leading to incorrect recovery state.

## Acceptance Criteria

- [ ] Race condition eliminated through atomic operation
- [ ] Concurrent access test passes
- [ ] Performance benchmark shows no regression
- [ ] Code review approved

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-03-07 | Created from code review | Found during PR #72 data integrity review |
| 2026-03-07 | Implemented atomic function | Added `prepare_recovery_checkpoint_atomic()` in recovery_checkpoint.rs |
| 2026-03-07 | Updated caller | Modified `prepare_thread_snapshot_checkpoint_blocking` to use atomic function |
| 2026-03-07 | Verified | All tests pass, race condition eliminated |

## Resources

- PR: #72
- SQLite locking: https://www.sqlite.org/lockingv3.html
