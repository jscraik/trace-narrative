use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn read_default_capability() -> Value {
    let capability_path =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("capabilities/default.json");
    let raw = fs::read_to_string(&capability_path).expect("default capability should be readable");
    serde_json::from_str(&raw).expect("default capability should be valid json")
}

#[test]
fn default_capability_is_scoped_to_main_window() {
    let capability = read_default_capability();
    let windows = capability
        .get("windows")
        .and_then(Value::as_array)
        .expect("capability.windows should be an array");

    assert_eq!(
        windows.len(),
        1,
        "default capability should target only main window"
    );
    assert_eq!(windows[0].as_str(), Some("main"));
}

#[test]
fn default_capability_shell_scope_is_explicit_and_minimal() {
    let capability = read_default_capability();
    let permissions = capability
        .get("permissions")
        .and_then(Value::as_array)
        .expect("capability.permissions should be an array");

    let execute_scope = permissions
        .iter()
        .find(|entry| {
            entry.get("identifier").and_then(Value::as_str) == Some("shell:allow-execute")
        })
        .expect("shell:allow-execute scoped entry is required");

    let allowed = execute_scope
        .get("allow")
        .and_then(Value::as_array)
        .expect("shell:allow-execute entry must define allow list");

    let mut names = allowed
        .iter()
        .filter_map(|entry| entry.get("name").and_then(Value::as_str))
        .collect::<Vec<_>>();
    names.sort_unstable();

    assert_eq!(
        names,
        vec!["codex-app-server", "git"],
        "shell execution scope widened unexpectedly"
    );

    let forbidden_permissions = [
        "shell:allow-spawn",
        "shell:allow-kill",
        "shell:allow-stdin-write",
        "shell:deny-open",
    ];
    for forbidden in forbidden_permissions {
        let present = permissions
            .iter()
            .any(|entry| entry.as_str() == Some(forbidden));
        assert!(
            !present,
            "forbidden shell capability present in default policy: {forbidden}"
        );
    }
}

#[test]
fn default_capability_does_not_reference_removed_codex_mutation_surfaces() {
    let capability = read_default_capability();
    let encoded = capability.to_string();

    let removed_surfaces = [
        "codex_app_server_set_stream_health",
        "ingest_codex_stream_event",
        "codex_app_server_receive_live_event",
    ];

    for removed in removed_surfaces {
        assert!(
            !encoded.contains(removed),
            "removed command surface leaked into capability policy: {removed}"
        );
    }
}
