use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

fn extract_codex_commands(lib_rs: &str) -> BTreeSet<String> {
    let mut commands = BTreeSet::new();
    for line in lib_rs.lines() {
        let Some(index) = line.find("codex_app_server::") else {
            continue;
        };
        let suffix = &line[index + "codex_app_server::".len()..];
        let command: String = suffix
            .chars()
            .take_while(|ch| ch.is_ascii_alphanumeric() || *ch == '_')
            .collect();
        let is_codex_command = command.starts_with("codex_app_server_")
            || command == "get_codex_app_server_status"
            || command == "get_capture_reliability_status"
            || command == "get_codex_stream_dedupe_log"
            || command == "start_codex_app_server"
            || command == "stop_codex_app_server";
        if !command.is_empty() && is_codex_command {
            commands.insert(command);
        }
    }
    commands
}

#[test]
fn codex_app_server_command_surface_is_allowlisted() {
    let lib_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/lib.rs");
    let lib_source = fs::read_to_string(&lib_path).expect("lib.rs should be readable");
    let actual = extract_codex_commands(&lib_source);

    let expected = BTreeSet::from([
        "codex_app_server_account_chatgpt_auth_tokens_refresh".to_string(),
        "codex_app_server_account_login_start".to_string(),
        "codex_app_server_account_logout".to_string(),
        "codex_app_server_account_read".to_string(),
        "codex_app_server_initialize".to_string(),
        "codex_app_server_initialized".to_string(),
        "codex_app_server_load_thread_recovery_checkpoint".to_string(),
        "codex_app_server_request_thread_snapshot".to_string(),
        "codex_app_server_set_stream_kill_switch".to_string(),
        "codex_app_server_submit_approval".to_string(),
        "get_capture_reliability_status".to_string(),
        "get_codex_app_server_status".to_string(),
        "get_codex_stream_dedupe_log".to_string(),
        "start_codex_app_server".to_string(),
        "stop_codex_app_server".to_string(),
    ]);

    assert_eq!(
        actual, expected,
        "Codex command surface drifted; update allowlist intentionally"
    );
}
