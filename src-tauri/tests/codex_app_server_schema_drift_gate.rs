use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexAppServerContract {
    schema_version: u64,
    protocol_target: String,
    required_request_methods: Vec<String>,
    allowed_notification_methods: Vec<String>,
    auth_login_start_types: Vec<String>,
    auth_mode_values: Vec<String>,
}

fn read_file(path: PathBuf) -> String {
    fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()))
}

#[test]
fn codex_app_server_schema_contract_matches_runtime_and_bridge_surfaces() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let contract_path = manifest_dir.join("contracts/codex-app-server-v1-contract.json");
    let contract_raw = read_file(contract_path);
    let contract: CodexAppServerContract =
        serde_json::from_str(&contract_raw).expect("contract should parse");

    assert_eq!(
        contract.schema_version, 1,
        "unexpected contract schema version"
    );
    assert_eq!(contract.protocol_target, "v2");

    let runtime_source = read_file(manifest_dir.join("src/codex_app_server.rs"));
    let ts_bridge_source = read_file(manifest_dir.join("../src/core/tauri/ingestConfig.ts"));

    for method in &contract.required_request_methods {
        assert!(
            runtime_source.contains(method),
            "runtime is missing required request method contract string: {method}"
        );
    }

    for method in &contract.allowed_notification_methods {
        assert!(
            runtime_source.contains(method),
            "runtime is missing allowed notification method contract string: {method}"
        );
    }

    for login_type in &contract.auth_login_start_types {
        assert!(
            runtime_source.contains(login_type),
            "runtime is missing auth login start type: {login_type}"
        );
    }

    for mode in &contract.auth_mode_values {
        if mode == "null" {
            assert!(
                runtime_source.contains("authMode must be string or null"),
                "runtime missing null auth mode validation coverage"
            );
            continue;
        }

        assert!(
            runtime_source.contains(mode),
            "runtime missing auth mode value: {mode}"
        );

        assert!(
            ts_bridge_source.contains(mode),
            "ts bridge missing auth mode value: {mode}"
        );
    }
}
