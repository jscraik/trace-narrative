import { invoke } from "@tauri-apps/api/core";

export async function setActiveRepoRoot(repoRoot: string): Promise<void> {
	await invoke("set_active_repo_root", { repoRoot });
}

export async function setOtelReceiverEnabled(enabled: boolean): Promise<void> {
	await invoke("set_otlp_receiver_enabled", { enabled });
}

export async function runOtlpSmokeTest(
	repoRoot: string,
	commitSha: string,
	filePaths: string[],
): Promise<void> {
	await invoke("run_otlp_smoke_test", {
		repoRoot,
		commitSha,
		filePaths,
	});
}
