mod activity;
mod adapters;
mod agent_tools;
mod atlas;
pub mod attribution;
mod codex_app_server;
mod commands;
mod file_watcher;
mod git_diff;
mod import;
mod ingest_config;
mod link_commands;
mod linking;
mod models;
mod otlp_receiver;
mod rules;
mod secret_store;
mod session_hash;
mod session_links;
pub mod story_anchors;
mod trace_commands;

use notify::RecommendedWatcher;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode},
    Row, SqlitePool,
};
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Global file watcher state
static FILE_WATCHER: std::sync::Mutex<Option<RecommendedWatcher>> = std::sync::Mutex::new(None);

/// Start the file watcher for auto-import
#[tauri::command(rename_all = "camelCase")]
fn start_file_watcher(
    app_handle: tauri::AppHandle,
    watch_paths: Vec<String>,
) -> Result<(), String> {
    // Stop existing watcher if any
    {
        let mut watcher = FILE_WATCHER.lock().map_err(|e| e.to_string())?;
        if watcher.is_some() {
            drop(watcher.take());
        }
    }

    // Start new watcher
    let new_watcher = file_watcher::start_session_watcher(app_handle, watch_paths)?;

    {
        let mut watcher = FILE_WATCHER.lock().map_err(|e| e.to_string())?;
        *watcher = Some(new_watcher);
    }

    Ok(())
}

/// Stop the file watcher (if running)
#[tauri::command(rename_all = "camelCase")]
fn stop_file_watcher() -> Result<(), String> {
    let mut watcher = FILE_WATCHER.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = watcher.take() {
        file_watcher::stop_session_watcher(existing);
    }
    Ok(())
}

async fn ensure_session_links_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS session_links (\
        id INTEGER PRIMARY KEY AUTOINCREMENT,\
        repo_id INTEGER NOT NULL,\
        session_id TEXT NOT NULL,\
        commit_sha TEXT NOT NULL,\
        confidence REAL NOT NULL,\
        auto_linked BOOLEAN NOT NULL DEFAULT 1,\
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),\
        UNIQUE(repo_id, session_id),\
        FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE\
      )",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_session_links_repo_commit ON session_links(repo_id, commit_sha)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_session_links_repo_id ON session_links(repo_id)")
        .execute(pool)
        .await?;

    let columns = sqlx::query("PRAGMA table_info(session_links)")
        .fetch_all(pool)
        .await?;
    let has_needs_review = columns
        .iter()
        .any(|row| row.get::<String, _>("name") == "needs_review");

    if !has_needs_review {
        sqlx::query("ALTER TABLE session_links ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0")
            .execute(pool)
            .await?;
    }

    Ok(())
}

/// Database state wrapper for Tauri commands
pub struct DbState(pub Arc<SqlitePool>);

impl std::ops::Deref for DbState {
    type Target = Arc<SqlitePool>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_session_links_table",
            sql: include_str!("../migrations/002_add_session_links.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_agent_trace",
            sql: include_str!("../migrations/003_add_agent_trace.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_session_attribution",
            sql: include_str!("../migrations/004_session_attribution.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_attribution_notes",
            sql: include_str!("../migrations/005_attribution_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_commit_rewrite_keys",
            sql: include_str!("../migrations/006_rewrite_keys.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "add_attribution_note_meta",
            sql: include_str!("../migrations/007_attribution_note_meta.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_collaborative_lines",
            sql: include_str!("../migrations/008_add_collaborative_lines.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_auto_ingest",
            sql: include_str!("../migrations/009_auto_ingest.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "add_test_runs",
            sql: include_str!("../migrations/010_test_runs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_story_anchors",
            sql: include_str!("../migrations/011_story_anchors.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add_atlas",
            sql: include_str!("../migrations/012_atlas.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add_narrative_feedback",
            sql: include_str!("../migrations/013_narrative_feedback.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "add_narrative_feedback_hardening",
            sql: include_str!("../migrations/014_narrative_feedback_hardening.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "add_live_sessions",
            sql: include_str!("../migrations/015_live_sessions.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            activity::get_ingest_activity,
            activity::get_commit_capture_bundle,
            commands::ensure_narrative_dirs,
            commands::write_narrative_file,
            commands::read_narrative_file,
            commands::list_narrative_files,
            commands::read_text_file,
            commands::file_exists,
            // Session link commands
            session_links::create_or_update_session_link,
            session_links::get_session_links_for_repo,
            session_links::get_session_links_for_commit,
            session_links::delete_session_link,
            // Linking algorithm commands
            link_commands::link_session_to_commit,
            link_commands::import_and_link_session_file,
            agent_tools::session_tools::agent_list_sessions,
            agent_tools::session_tools::agent_get_session,
            agent_tools::session_tools::agent_link_session_to_commit,
            agent_tools::session_tools::agent_link_session,
            // Import commands
            import::commands::import_session_files,
            import::commands::import_session_file,
            import::commands::auto_import_session_file,
            import::commands::scan_for_session_files,
            import::commands::get_recent_sessions,
            import::commands::purge_expired_sessions,
            atlas::commands::atlas_capabilities,
            atlas::commands::atlas_introspect,
            atlas::commands::atlas_search,
            atlas::commands::atlas_get_session,
            atlas::commands::atlas_doctor_report,
            atlas::commands::atlas_doctor_rebuild_derived,
            // Git diff commands
            git_diff::get_commit_added_ranges,
            // Attribution commands
            attribution::commands::get_commit_contribution_stats,
            attribution::commands::get_file_source_lens,
            attribution::commands::compute_stats_batch,
            attribution::commands::import_attribution_note,
            attribution::commands::import_attribution_notes_batch,
            attribution::commands::export_attribution_note,
            attribution::commands::get_attribution_note_summary,
            attribution::commands::get_attribution_prefs,
            attribution::commands::set_attribution_prefs,
            attribution::commands::purge_attribution_prompt_meta,
            attribution::dashboard::get_dashboard_stats,
            // OTLP receiver commands
            otlp_receiver::set_active_repo_root,
            otlp_receiver::set_otlp_receiver_enabled,
            otlp_receiver::run_otlp_smoke_test,
            // Trace commands
            trace_commands::get_trace_summary_for_commit,
            trace_commands::get_trace_summaries_for_commits,
            trace_commands::get_trace_ranges_for_commit_file,
            // Rules commands
            rules::commands::review_repo,
            rules::commands::get_rules,
            rules::commands::validate_rules,
            rules::commands::create_default_rules,
            // File watcher commands
            start_file_watcher,
            stop_file_watcher,
            // Ingest config commands
            ingest_config::get_ingest_config,
            ingest_config::set_ingest_config,
            ingest_config::get_otlp_env_status,
            ingest_config::get_otlp_key_status,
            ingest_config::ensure_otlp_api_key,
            ingest_config::reset_otlp_api_key,
            ingest_config::discover_capture_sources,
            ingest_config::configure_codex_otel,
            ingest_config::get_collector_migration_status,
            ingest_config::run_collector_migration,
            ingest_config::rollback_collector_migration,
            // Codex App Server reliability + streaming
            codex_app_server::get_codex_app_server_status,
            codex_app_server::start_codex_app_server,
            codex_app_server::stop_codex_app_server,
            codex_app_server::codex_app_server_initialize,
            codex_app_server::codex_app_server_initialized,
            codex_app_server::codex_app_server_account_read,
            codex_app_server::codex_app_server_account_login_start,
            codex_app_server::codex_app_server_account_login_completed,
            codex_app_server::codex_app_server_account_updated,
            codex_app_server::codex_app_server_account_logout,
            // TODO(2026-02-24): deprecated internal aliases kept for one release.
            codex_app_server::codex_app_server_set_stream_health,
            codex_app_server::codex_app_server_set_stream_kill_switch,
            codex_app_server::codex_app_server_request_thread_snapshot,
            codex_app_server::codex_app_server_receive_live_event,
            codex_app_server::codex_app_server_submit_approval,
            codex_app_server::ingest_codex_stream_event,
            codex_app_server::get_codex_stream_dedupe_log,
            codex_app_server::get_capture_reliability_status,
            import::commands::backfill_recent_sessions,
            // Story Anchors (Git Notes + hooks)
            story_anchors::commands::get_story_anchor_status,
            story_anchors::commands::import_session_link_notes_batch,
            story_anchors::commands::export_session_link_note,
            story_anchors::commands::link_sessions_to_commit,
            story_anchors::commands::migrate_attribution_notes_ref,
            story_anchors::commands::reconcile_after_rewrite,
            story_anchors::commands::install_repo_hooks,
            story_anchors::commands::uninstall_repo_hooks,
            story_anchors::commands::get_repo_hooks_status,
            story_anchors::commands::check_git_notes_fetch_config,
            story_anchors::commands::configure_git_notes_fetch,
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:narrative.db", migrations)
                .build(),
        )
        .setup(|app| {
            // Create a separate sqlx pool for backend Rust operations
            // Use the same database as tauri_plugin_sql to avoid duplication
            let app_data_dir = app.path().app_data_dir().map_err(|e| {
                eprintln!("Narrative: Failed to resolve app data dir: {}", e);
                format!("Could not determine app data directory: {}", e)
            })?;
            std::fs::create_dir_all(&app_data_dir).map_err(|e| {
                eprintln!(
                    "Narrative: Failed to create app data dir at {:?}: {}",
                    app_data_dir, e
                );
                format!("Failed to create app data directory: {}", e)
            })?;

            let path = app_data_dir.join("narrative.db");

            // Use blocking connect since setup is not async
            let pool = tauri::async_runtime::block_on(async {
                // Create database if it doesn't exist, then connect
                // WAL mode enables better concurrency for reads/writes
                let options = SqliteConnectOptions::new()
                    .filename(&path)
                    .journal_mode(SqliteJournalMode::Wal)
                    .create_if_missing(true);

                let pool = SqlitePool::connect_with(options)
                    .await
                    .map_err(|e| {
                        eprintln!("Narrative: Database connection failed: {}", e);
                        format!("Failed to connect to database: {}. Please check file permissions and disk space.", e)
                    })?;

                if let Err(e) = ensure_session_links_schema(&pool).await {
                    eprintln!("Narrative: Failed to ensure session_links schema: {}", e);
                }

                Ok::<SqlitePool, String>(pool)
            })?;

            app.manage(DbState(Arc::new(pool)));

            let otel_state = otlp_receiver::OtelReceiverState::default();
            app.manage(otel_state.clone());
            let codex_app_server_state = codex_app_server::CodexAppServerState::default();
            app.manage(codex_app_server_state);

            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|e| {
            eprintln!("Narrative: Failed to run Tauri application: {}", e);
            Box::new(e) as Box<dyn std::error::Error>
        })?;
    Ok(())
}
