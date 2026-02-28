//! Tauri commands for Story Anchors.

use super::hooks as hooks_impl;
use super::sessions_notes_io::{
    export_sessions_note, import_sessions_notes_batch, SessionsNoteBatchSummary,
    SessionsNoteExportSummary,
};
use super::status::{get_commit_story_anchor_status, StoryAnchorCommitStatus};
use crate::attribution::line_attribution::{
    ensure_line_attributions_for_commit, store_rewrite_key,
};
use crate::attribution::utils::fetch_repo_root;
use crate::story_anchors::refs::{ATTRIBUTION_REF_CANONICAL, ATTRIBUTION_REF_LEGACY_NARRATIVE};
use crate::DbState;
use git2::{Oid, Repository, Signature};
use serde::Serialize;
use std::{env, fs, path::PathBuf};
use tauri::Manager;
use tauri::State;

fn find_executable_on_path(candidates: &[&str]) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    for dir in env::split_paths(&path) {
        for name in candidates {
            let p = dir.join(name);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

fn find_packaged_narrative_cli(app: &tauri::AppHandle) -> Option<PathBuf> {
    let resource_dir = app.path().resource_dir().ok()?;
    let mut candidates: Vec<PathBuf> = Vec::new();

    // Bundled CLI binaries can land in either `resources/bin` (when explicitly
    // configured) or directly under `resources` on some bundle layouts.
    let bin_candidate_dirs = [
        resource_dir.join("bin"),
        resource_dir,
    ];
    for dir in bin_candidate_dirs {
        push_narrative_cli_candidates(&dir, &mut candidates);
    }

    if candidates.is_empty() {
        return None;
    }

    candidates.sort_by_key(|path| {
        (
            if path.file_name().and_then(|s| s.to_str()) == Some("narrative-cli") {
                0
            } else {
                1
            },
            path.to_string_lossy().to_string(),
        )
    });
    candidates.into_iter().next()
}

fn is_narrative_cli_candidate(name: &str) -> bool {
    if cfg!(windows) {
        return name == "narrative-cli.exe" || name.starts_with("narrative-cli-");
    }

    name == "narrative-cli" || name.starts_with("narrative-cli-")
}

fn push_narrative_cli_candidates(dir: &PathBuf, candidates: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        if !is_narrative_cli_candidate(name) {
            continue;
        }

        if cfg!(windows) {
            if path.extension().and_then(|s| s.to_str()) != Some("exe") {
                continue;
            }
        } else if path.extension().is_some() {
            continue;
        }

        candidates.push(path);
    }
}

/// Check result for git notes fetch configuration
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesFetchCheckResult {
    pub is_configured: bool,
    pub remote_name: String,
    pub fetch_refspec: Option<String>,
    pub notes_refspec: Option<String>,
    pub message: String,
}

/// Check if git notes fetch is configured for the given remote.
/// Git notes don't auto-fetch by default, which can cause narrative
/// data to appear "lost" when clones/fetches happen.
#[tauri::command(rename_all = "camelCase")]
pub async fn check_git_notes_fetch_config(
    db: State<'_, DbState>,
    repo_id: i64,
) -> Result<NotesFetchCheckResult, String> {
    let repo_root = fetch_repo_root(&db.0, repo_id).await?;
    let repo = Repository::open(&repo_root).map_err(|e| e.to_string())?;

    // Default to "origin" if it exists, otherwise use first remote
    let remote_name = repo
        .remotes()
        .ok()
        .and_then(|remotes| {
            if remotes.is_empty() {
                None
            } else {
                // Prefer "origin", fall back to first remote
                remotes
                    .iter()
                    .find(|r| *r == Some("origin"))
                    .or_else(|| remotes.iter().next())
                    .flatten()
                    .map(|s| s.to_string())
            }
        })
        .unwrap_or_else(|| "origin".to_string());

    let remote = repo.find_remote(&remote_name).ok();

    let fetch_refspec = remote.as_ref().and_then(|r| {
        r.fetch_refspecs()
            .ok()
            .and_then(|specs| specs.iter().next().flatten().map(|s| s.to_string()))
    });

    // Check if notes refspec is configured
    let notes_refspec = "+refs/notes/*:refs/notes/*".to_string();
    let notes_configured = remote.as_ref().is_some_and(|r| {
        r.fetch_refspecs()
            .ok()
            .map(|specs| {
                specs.iter().any(|spec| {
                    spec.is_some_and(|s| s.contains("refs/notes") || s.contains("refs/notes/*"))
                })
            })
            .unwrap_or(false)
    });

    let message = if notes_configured {
        format!(
            "Git notes fetch is configured for remote '{}'. Narrative data will sync automatically.",
            remote_name
        )
    } else {
        format!(
            "Git notes fetch is NOT configured for remote '{}'. \
             Narrative data (session links, attribution) won't sync on fetch/clone. \
             To fix: git config --add remote.{}.fetch '+refs/notes/*:refs/notes/*'",
            remote_name, remote_name
        )
    };

    Ok(NotesFetchCheckResult {
        is_configured: notes_configured,
        remote_name,
        fetch_refspec,
        notes_refspec: if notes_configured {
            Some(notes_refspec)
        } else {
            None
        },
        message,
    })
}

/// Configure git notes fetch for the given remote.
#[tauri::command(rename_all = "camelCase")]
pub async fn configure_git_notes_fetch(
    db: State<'_, DbState>,
    repo_id: i64,
    remote: Option<String>,
) -> Result<String, String> {
    use std::process::Command;

    let repo_root = fetch_repo_root(&db.0, repo_id).await?;

    // Determine remote name
    let remote_name = if let Some(r) = remote {
        r
    } else {
        let repo = Repository::open(&repo_root).map_err(|e| e.to_string())?;
        repo.remotes()
            .ok()
            .and_then(|remotes| {
                if remotes.is_empty() {
                    None
                } else {
                    remotes
                        .iter()
                        .find(|r| *r == Some("origin"))
                        .or_else(|| remotes.iter().next())
                        .flatten()
                        .map(|s| s.to_string())
                }
            })
            .ok_or_else(|| "No remote configured for repository".to_string())?
    };

    // Run git config to add notes fetch refspec
    let output = Command::new("git")
        .args([
            "config",
            "--add",
            &format!("remote.{}.fetch", remote_name),
            "+refs/notes/*:refs/notes/*",
        ])
        .current_dir(&repo_root)
        .output()
        .map_err(|e| format!("Failed to run git config: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git config failed: {}", stderr));
    }

    Ok(format!(
        "Successfully configured git notes fetch for remote '{}'",
        remote_name
    ))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_story_anchor_status(
    db: State<'_, DbState>,
    repo_id: i64,
    commit_shas: Vec<String>,
) -> Result<Vec<StoryAnchorCommitStatus>, String> {
    let mut out = Vec::new();
    for sha in commit_shas {
        out.push(get_commit_story_anchor_status(&db.0, repo_id, &sha).await);
    }
    Ok(out)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn import_session_link_notes_batch(
    db: State<'_, DbState>,
    repo_id: i64,
    commit_shas: Vec<String>,
) -> Result<SessionsNoteBatchSummary, String> {
    import_sessions_notes_batch(&db.0, repo_id, commit_shas).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn export_session_link_note(
    db: State<'_, DbState>,
    repo_id: i64,
    commit_sha: String,
) -> Result<SessionsNoteExportSummary, String> {
    export_sessions_note(&db.0, repo_id, &commit_sha).await
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkSessionsSummary {
    pub commit_sha: String,
    pub session_count: u32,
    pub note_status: String,
}

/// Link sessions to a commit (Story Anchors), then export the canonical sessions note.
#[tauri::command(rename_all = "camelCase")]
pub async fn link_sessions_to_commit(
    db: State<'_, DbState>,
    repo_id: i64,
    commit_sha: String,
    session_ids: Vec<String>,
) -> Result<LinkSessionsSummary, String> {
    // Write links into commit_session_links (source=notes)
    sqlx::query(
        r#"
        DELETE FROM commit_session_links
        WHERE repo_id = ? AND commit_sha = ? AND source = 'notes'
        "#,
    )
    .bind(repo_id)
    .bind(&commit_sha)
    .execute(&*db.0)
    .await
    .map_err(|e| e.to_string())?;

    for id in &session_ids {
        if id.trim().is_empty() {
            continue;
        }
        sqlx::query(
            r#"
            INSERT INTO commit_session_links (repo_id, commit_sha, session_id, source, confidence)
            VALUES (?, ?, ?, 'notes', NULL)
            ON CONFLICT(repo_id, commit_sha, session_id) DO UPDATE SET
                source = 'notes',
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(repo_id)
        .bind(&commit_sha)
        .bind(id.trim())
        .execute(&*db.0)
        .await
        .map_err(|e| e.to_string())?;
    }

    let export = export_sessions_note(&db.0, repo_id, &commit_sha).await?;

    Ok(LinkSessionsSummary {
        commit_sha,
        session_count: session_ids.len() as u32,
        note_status: export.status,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateAttributionNotesSummary {
    pub total: u32,
    pub migrated: u32,
    pub missing: u32,
    pub failed: u32,
}

/// Migrate attribution notes from legacy Narrative ref to canonical ref (per commit).
#[tauri::command(rename_all = "camelCase")]
pub async fn migrate_attribution_notes_ref(
    db: State<'_, DbState>,
    repo_id: i64,
    commit_shas: Vec<String>,
) -> Result<MigrateAttributionNotesSummary, String> {
    let repo_root = fetch_repo_root(&db.0, repo_id).await?;
    let repo = Repository::open(&repo_root).map_err(|e| e.to_string())?;
    let signature = repo
        .signature()
        .or_else(|_| Signature::now("Narrative", "narrative@local"))
        .map_err(|e| e.to_string())?;

    let mut migrated = 0;
    let mut missing = 0;
    let mut failed = 0;

    for sha in commit_shas {
        let oid = match Oid::from_str(&sha) {
            Ok(v) => v,
            Err(_) => {
                failed += 1;
                continue;
            }
        };

        // Only migrate from legacy narrative ref.
        let note = match repo.find_note(Some(ATTRIBUTION_REF_LEGACY_NARRATIVE), oid) {
            Ok(n) => n,
            Err(_) => {
                missing += 1;
                continue;
            }
        };

        let Some(message) = note.message() else {
            failed += 1;
            continue;
        };

        if repo
            .note(
                &signature,
                &signature,
                Some(ATTRIBUTION_REF_CANONICAL),
                oid,
                message,
                true,
            )
            .is_err()
        {
            failed += 1;
            continue;
        }

        migrated += 1;
    }

    Ok(MigrateAttributionNotesSummary {
        total: (migrated + missing + failed) as u32,
        migrated: migrated as u32,
        missing: missing as u32,
        failed: failed as u32,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileSummary {
    pub total: u32,
    pub recovered_sessions: u32,
    pub recovered_attribution: u32,
    pub wrote_notes: u32,
}

/// Reconcile Story Anchors after rewrite (patch-id recovery).
///
/// Optional-but-implemented:
/// - `write_recovered_notes`: if true, writes canonical notes after recovery.
#[tauri::command(rename_all = "camelCase")]
pub async fn reconcile_after_rewrite(
    db: State<'_, DbState>,
    repo_id: i64,
    commit_shas: Vec<String>,
    write_recovered_notes: bool,
) -> Result<ReconcileSummary, String> {
    use crate::attribution::git_utils::compute_rewrite_key;
    use crate::attribution::notes_io::export_attribution_note;
    use crate::story_anchors::sessions_notes_io::export_sessions_note;

    let repo_root = fetch_repo_root(&db.0, repo_id).await?;
    let repo = Repository::open(&repo_root).map_err(|e| e.to_string())?;

    let mut recovered_sessions = 0;
    let mut recovered_attribution = 0;
    let mut wrote_notes = 0;

    for sha in &commit_shas {
        // Ensure rewrite key exists for this commit.
        let rewrite_key = compute_rewrite_key(&repo, sha).ok();
        let _ = store_rewrite_key(
            &db.0,
            repo_id,
            sha,
            rewrite_key.as_deref(),
            Some("patch-id"),
        )
        .await;

        // Try recover attribution (this copies line_attributions if possible).
        if ensure_line_attributions_for_commit(&db.0, repo_id, sha)
            .await
            .is_ok()
        {
            recovered_attribution += 1;
        }

        // Recover sessions by rewrite key.
        if let Some(key) = rewrite_key.as_deref() {
            if let Ok(Some(source_commit)) =
                find_commit_by_rewrite_key(&db.0, repo_id, key, sha).await
            {
                let copied = copy_commit_session_links(&db.0, repo_id, &source_commit, sha).await?;
                if copied > 0 {
                    recovered_sessions += copied;
                }
            }
        }

        if write_recovered_notes {
            let a = export_attribution_note(&db.0, repo_id, sha.to_string()).await;
            let s = export_sessions_note(&db.0, repo_id, sha).await;
            if a.is_ok() || s.is_ok() {
                wrote_notes += 1;
            }
        }
    }

    Ok(ReconcileSummary {
        total: commit_shas.len() as u32,
        recovered_sessions,
        recovered_attribution,
        wrote_notes,
    })
}

async fn find_commit_by_rewrite_key(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    rewrite_key: &str,
    exclude_commit: &str,
) -> Result<Option<String>, String> {
    sqlx::query_scalar(
        r#"
        SELECT commit_sha
        FROM commit_rewrite_keys
        WHERE repo_id = ? AND rewrite_key = ? AND commit_sha != ?
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(repo_id)
    .bind(rewrite_key)
    .bind(exclude_commit)
    .fetch_optional(db)
    .await
    .map_err(|e| e.to_string())
}

async fn copy_commit_session_links(
    db: &sqlx::SqlitePool,
    repo_id: i64,
    source_commit: &str,
    target_commit: &str,
) -> Result<u32, String> {
    let session_ids: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT session_id
        FROM commit_session_links
        WHERE repo_id = ? AND commit_sha = ?
        "#,
    )
    .bind(repo_id)
    .bind(source_commit)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let mut copied = 0;
    for sid in session_ids {
        sqlx::query(
            r#"
            INSERT INTO commit_session_links (repo_id, commit_sha, session_id, source, confidence)
            VALUES (?, ?, ?, 'recovered', 0.8)
            ON CONFLICT(repo_id, commit_sha, session_id) DO UPDATE SET
              source = 'recovered',
              confidence = 0.8,
              updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(repo_id)
        .bind(target_commit)
        .bind(&sid)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
        copied += 1;
    }

    Ok(copied)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn install_repo_hooks(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    repo_id: i64,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("narrative.db");
    let db_path_str = db_path.to_string_lossy().to_string();

    // Ensure we have a stable narrative-cli binary path for hooks.
    // Prefer:
    // 1) sibling "narrative-cli" next to current executable (dev + some bundles)
    // 2) "narrative-cli" on PATH (cargo install)
    //
    // Then copy into app_data_dir so hooks can reference a stable absolute path.
    let exe_name = if cfg!(windows) {
        "narrative-cli.exe"
    } else {
        "narrative-cli"
    };
    let cli_dest = app_data_dir.join(exe_name);

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            push_narrative_cli_candidates(&dir.to_path_buf(), &mut candidates);
            // Some dev setups may have the binary without an extension even on Windows shells.
            if cfg!(windows) {
                candidates.push(dir.join("narrative-cli"));
            }
        }
    }
    if let Some(found) = find_executable_on_path(if cfg!(windows) {
        &["narrative-cli.exe", "narrative-cli"]
    } else {
        &["narrative-cli"]
    }) {
        candidates.push(found);
    }
    if let Some(found) = find_packaged_narrative_cli(&app) {
        candidates.push(found);
    }

    let source = candidates.into_iter().find(|p| p.is_file()).ok_or_else(|| {
        "Narrative CLI not found.\n\nTo enable Story Anchors hooks, install narrative-cli (one time):\n  cd src-tauri && cargo install --path . --bin narrative-cli\n\nThen click “Install hooks” again.".to_string()
    })?;

    // Always refresh the installed CLI on hook install so updates to Narrative keep hooks compatible.
    fs::copy(&source, &cli_dest).map_err(|e| format!("Failed to install narrative-cli: {e}"))?;
    hooks_impl::ensure_executable(&cli_dest)?;

    // Git hooks run under `sh`; prefer forward slashes for Windows compatibility (Git Bash / MSYS).
    let cli_path_for_hook = if cfg!(windows) {
        cli_dest.to_string_lossy().replace('\\', "/")
    } else {
        cli_dest.to_string_lossy().to_string()
    };

    hooks_impl::install_repo_hooks_by_id(&db.0, repo_id, &db_path_str, &cli_path_for_hook).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn uninstall_repo_hooks(db: State<'_, DbState>, repo_id: i64) -> Result<(), String> {
    hooks_impl::uninstall_repo_hooks_by_id(&db.0, repo_id).await
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoHooksStatusPayload {
    pub installed: bool,
    pub hooks_dir: String,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_repo_hooks_status(
    db: State<'_, DbState>,
    repo_id: i64,
) -> Result<RepoHooksStatusPayload, String> {
    let status = hooks_impl::get_repo_hooks_status(&db.0, repo_id).await?;
    Ok(RepoHooksStatusPayload {
        installed: status.installed,
        hooks_dir: status.hooks_dir.to_string_lossy().to_string(),
    })
}
