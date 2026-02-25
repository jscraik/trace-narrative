use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

const MANIFEST_SIGNATURE_SALT: &str = "narrative-codex-sidecar-signature-v1";
const MANIFEST_SCHEMA_VERSION: u64 = 1;
const MANIFEST_MIN_VERSION_FLOOR: u64 = 2026022501;
const MINIMUM_SIDECAR_VERSION_FLOOR: &str = "0.97.0";
const TRUSTED_SIGNERS: &[&str] = &[
    "narrative-codex-sidecar-2026q1",
    "narrative-codex-sidecar-2026q2",
];
const REVOKED_SIGNERS: &[&str] = &["narrative-codex-sidecar-2025q4"];

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarArtifactManifest {
    target: String,
    file: String,
    sha256: String,
    sidecar_version: String,
    minimum_sidecar_version: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarBinaryManifest {
    schema_version: u64,
    manifest_version: u64,
    minimum_manifest_version: u64,
    minimum_sidecar_version: String,
    active_signer: String,
    payload_hash: String,
    signature: String,
    artifacts: Vec<SidecarArtifactManifest>,
}

fn parse_version_tuple(value: &str) -> Option<(u64, u64, u64)> {
    let mut parts = value.trim().split('.');
    let major = parts
        .next()?
        .chars()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>()
        .parse()
        .ok()?;
    let minor = parts
        .next()?
        .chars()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>()
        .parse()
        .ok()?;
    let patch = parts
        .next()?
        .chars()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>()
        .parse()
        .ok()?;
    Some((major, minor, patch))
}

fn version_at_least(current: &str, minimum: &str) -> bool {
    match (parse_version_tuple(current), parse_version_tuple(minimum)) {
        (Some(current_parts), Some(minimum_parts)) => current_parts >= minimum_parts,
        _ => false,
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut digest = Sha256::new();
    digest.update(bytes);
    format!("{:x}", digest.finalize())
}

fn compute_manifest_payload_hash(manifest: &SidecarBinaryManifest) -> String {
    let mut artifact_rows = manifest
        .artifacts
        .iter()
        .map(|artifact| {
            format!(
                "{}|{}|{}|{}|{}",
                artifact.target,
                artifact.file,
                artifact.sha256.to_ascii_lowercase(),
                artifact.sidecar_version,
                artifact
                    .minimum_sidecar_version
                    .as_deref()
                    .unwrap_or_default(),
            )
        })
        .collect::<Vec<_>>();
    artifact_rows.sort_unstable();

    let payload = format!(
        "schemaVersion={}\nmanifestVersion={}\nminimumManifestVersion={}\nminimumSidecarVersion={}\nactiveSigner={}\n{}\n",
        manifest.schema_version,
        manifest.manifest_version,
        manifest.minimum_manifest_version,
        manifest.minimum_sidecar_version,
        manifest.active_signer,
        artifact_rows.join("\n"),
    );
    sha256_hex(payload.as_bytes())
}

fn compute_manifest_signature(payload_hash: &str, signer: &str) -> String {
    let raw = format!("payloadHash={payload_hash}|signer={signer}|salt={MANIFEST_SIGNATURE_SALT}");
    sha256_hex(raw.as_bytes())
}

fn manifest_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin/codex-app-server-manifest.json")
}

#[test]
fn codex_app_server_trust_manifest_is_integrity_validated() {
    let manifest_raw = fs::read_to_string(manifest_path()).expect("manifest should be readable");
    let manifest: SidecarBinaryManifest =
        serde_json::from_str(&manifest_raw).expect("manifest should parse");

    assert_eq!(manifest.schema_version, MANIFEST_SCHEMA_VERSION);
    assert!(manifest.manifest_version >= MANIFEST_MIN_VERSION_FLOOR);
    assert!(manifest.manifest_version >= manifest.minimum_manifest_version);
    assert!(TRUSTED_SIGNERS.contains(&manifest.active_signer.as_str()));
    assert!(!REVOKED_SIGNERS.contains(&manifest.active_signer.as_str()));

    let payload_hash = compute_manifest_payload_hash(&manifest);
    assert_eq!(payload_hash, manifest.payload_hash, "payload hash drift");
    let signature = compute_manifest_signature(&payload_hash, &manifest.active_signer);
    assert_eq!(signature, manifest.signature, "manifest signature mismatch");

    assert!(
        manifest
            .artifacts
            .iter()
            .any(|artifact| artifact.file == "codex-app-server"),
        "manifest must include generic codex-app-server entry"
    );

    for artifact in &manifest.artifacts {
        assert!(
            version_at_least(&artifact.sidecar_version, &manifest.minimum_sidecar_version),
            "artifact {} below manifest minimum version",
            artifact.file
        );
        if let Some(minimum_artifact_version) = artifact.minimum_sidecar_version.as_deref() {
            assert!(
                version_at_least(&artifact.sidecar_version, minimum_artifact_version),
                "artifact {} below artifact minimum version",
                artifact.file
            );
        }
        assert!(
            version_at_least(&artifact.sidecar_version, MINIMUM_SIDECAR_VERSION_FLOOR),
            "artifact {} below global sidecar version floor",
            artifact.file
        );

        let artifact_path = manifest_path()
            .parent()
            .expect("manifest parent")
            .join(&artifact.file);
        let bytes = fs::read(&artifact_path).expect("artifact file should exist");
        let digest = sha256_hex(&bytes);
        assert_eq!(
            digest,
            artifact.sha256.to_ascii_lowercase(),
            "checksum mismatch for {}",
            artifact.file
        );
    }
}
