use std::fs;
use std::path::PathBuf;

fn read_file(relative_path: &str) -> String {
    let absolute = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative_path);
    fs::read_to_string(&absolute)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", absolute.display()))
}

#[test]
fn codex_app_server_path_policy_blocks_production_override() {
    let source = read_file("src/codex_app_server.rs");

    assert!(
        source.contains("SIDECAR_OVERRIDE_ENV"),
        "override env constant should be explicit"
    );
    assert!(
        source.contains("SIDECAR_FORCE_PRODUCTION_ENV"),
        "production-force env constant should be explicit"
    );
    assert!(
        source.contains("sidecar_is_production_mode"),
        "production mode helper should exist"
    );
    assert!(
        source.contains("override is blocked in production mode"),
        "detect_sidecar_path should reject override in production mode"
    );
}

#[test]
fn codex_app_server_path_policy_requires_manifest_verification_for_candidates() {
    let source = read_file("src/codex_app_server.rs");

    assert!(
        source.contains("verify_sidecar_manifest_for_path(&candidate)"),
        "candidate sidecars should be manifest-verified"
    );
    assert!(
        source.contains("verify_sidecar_manifest_for_path(&path)"),
        "restart path should be manifest-verified"
    );
    assert!(
        source.contains("SIDECAR_MANIFEST_FILE"),
        "manifest file constant should be present"
    );
}

#[test]
fn codex_app_server_path_policy_enforces_manifest_check_during_build() {
    let tauri_conf = read_file("tauri.conf.json");
    assert!(
        tauri_conf.contains("tauri:verify-sidecar-manifest"),
        "beforeBuildCommand must invoke sidecar manifest verification"
    );
}
