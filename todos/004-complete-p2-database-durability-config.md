---
status: complete
priority: p2
issue_id: 004
tags: [code-review, data-integrity, sqlite, configuration]
dependencies: []
---

# SQLite Durability and Concurrency Configuration Gaps

## Problem Statement

The SQLite connection configuration in `lib.rs` lacks important durability and concurrency settings for a trust-based system where data integrity is critical.

## Findings

**Location:** `src-tauri/src/lib.rs:361-364`

```rust
let options = SqliteConnectOptions::new()
    .filename(&path)
    .journal_mode(SqliteJournalMode::Wal)
    .create_if_missing(true);
```

**Missing Configuration:**

1. **No synchronous mode specified** - Default may not provide durability guarantees
2. **No busy timeout** - Concurrent writes fail immediately instead of waiting
3. **Foreign keys not enabled at connection level** - `PRAGMA foreign_keys = ON` is per-connection

## Proposed Solutions

### Option A: Add Durability Configuration (Recommended)

```rust
use std::time::Duration;

let options = SqliteConnectOptions::new()
    .filename(&path)
    .journal_mode(SqliteJournalMode::Wal)
    .synchronous(sqlx::sqlite::SqliteSynchronous::Full)  // Ensure durability
    .busy_timeout(Duration::from_secs(5))  // Wait for locks
    .create_if_missing(true);

let pool = SqlitePool::connect_with(options).await?;

// Enable foreign keys for this connection
sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await?;
```

**Pros:**
- Guarantees data durability (fsync on commit)
- Prevents immediate failures under light contention
- Enforces referential integrity

**Cons:**
- Slight performance impact (acceptable for trust system)

**Effort:** Small
**Risk:** Very Low

### Option B: Application-Level Foreign Key Enforcement

If database-level FKs aren't possible, document and enforce at application level:

```rust
// Before deleting thread, delete checkpoints
async fn delete_thread_with_cleanup(pool: &SqlitePool, thread_id: &str) -> Result<()> {
    let mut tx = pool.begin().await?;
    delete_recovery_checkpoint(&mut tx, thread_id).await?;
    delete_thread(&mut tx, thread_id).await?;
    tx.commit().await?;
    Ok(())
}
```

**Pros:**
- More flexible
- Works with existing schema

**Cons:**
- Easy to miss cleanup calls
- Not enforced by database

**Effort:** Medium
**Risk:** Medium (developer discipline required)

## Recommended Action

Implement **Option A** - add `.synchronous(Full)`, `.busy_timeout()`, and foreign key pragma. This is the industry standard for production SQLite usage.

## Technical Details

**Affected File:**
- `src-tauri/src/lib.rs:361-378`

**SQLite Documentation:**
- Synchronous pragma: https://www.sqlite.org/pragma.html#pragma_synchronous
- Busy timeout: https://www.sqlite.org/pragma.html#pragma_busy_timeout
- Foreign keys: https://www.sqlite.org/foreignkeys.html

## Acceptance Criteria

- [ ] `.synchronous(Full)` added to connection options
- [ ] `.busy_timeout(Duration::from_secs(5))` added
- [ ] `PRAGMA foreign_keys = ON` executed after pool creation
- [ ] Verify settings with `PRAGMA` queries in tests
- [ ] Document configuration choices

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-03-07 | Created from code review | Found during PR #72 data integrity review |
| 2026-03-07 | Implemented durability settings | Added `.synchronous(Full)` and `.busy_timeout(5s)` |
| 2026-03-07 | Enabled foreign keys | Added `PRAGMA foreign_keys = ON` after pool creation |
| 2026-03-07 | Verified | All Rust tests pass |

## Resources

- PR: #72
- sqlx SqliteConnectOptions: https://docs.rs/sqlx/latest/sqlx/sqlite/struct.SqliteConnectOptions.html
