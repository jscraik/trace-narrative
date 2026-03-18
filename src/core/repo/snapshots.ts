import {
	ensureNarrativeDirs,
	listNarrativeFiles,
	readNarrativeFile,
	writeNarrativeFile,
} from "../tauri/narrativeFs";
import type { Snapshot, SnapshotType } from "../types";
import {
	getDirtyFiles,
	getHeadBranch,
	getHeadSha,
	getWorkingTreeChurn,
} from "./git";

export type AutoCaptureResult = {
	snapshot: Snapshot | null;
	dirtyFiles: string[];
	dirtyChurnLines: number;
};

export async function captureSnapshot(
	repoRoot: string,
	branch: string,
	headSha: string,
	type: SnapshotType = "manual",
	message?: string,
): Promise<Snapshot> {
	await ensureNarrativeDirs(repoRoot);
	const dirtyFiles = await getDirtyFiles(repoRoot);
	const now = new Date();
	const id = `snap_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`;

	const snapshot: Snapshot = {
		id,
		atISO: now.toISOString(),
		type,
		branch,
		headSha,
		filesChanged: dirtyFiles,
		message,
	};

	const filename = `snapshots/${id}.json`;
	await writeNarrativeFile(
		repoRoot,
		filename,
		JSON.stringify(snapshot, null, 2),
	);

	return snapshot;
}

export async function listSnapshots(repoRoot: string): Promise<Snapshot[]> {
	try {
		const files = await listNarrativeFiles(repoRoot, "snapshots");
		const snapshots: Snapshot[] = [];

		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			try {
				const content = await readNarrativeFile(repoRoot, file);
				snapshots.push(JSON.parse(content));
			} catch (_e) {
				const _msg = String(_e);
				console.warn("[snapshots] skipping malformed snapshot file:", _msg);
			}
		}

		// Sort by date descending
		return snapshots.sort(
			(a, b) => new Date(b.atISO).getTime() - new Date(a.atISO).getTime(),
		);
	} catch (_e) {
		console.debug("[snapshots] directory not yet created (non-fatal):", _e);
		return [];
	}
}

export async function autoCaptureIfNeeded(
	repoRoot: string,
): Promise<AutoCaptureResult> {
	const snapshots = await listSnapshots(repoRoot);
	const [dirtyFiles, dirtyChurnLines] = await Promise.all([
		getDirtyFiles(repoRoot),
		getWorkingTreeChurn(repoRoot),
	]);

	if (dirtyFiles.length === 0)
		return { snapshot: null, dirtyFiles, dirtyChurnLines };

	// Check if we already have a recent snapshot for this exact set of changes
	const lastAuto = snapshots.find((s) => s.type === "automatic");
	if (lastAuto) {
		const lastTime = new Date(lastAuto.atISO).getTime();
		const now = Date.now();

		// Don't auto-snapshot more than once every 5 minutes if nothing changed in the file list
		const fiveMinutes = 5 * 60 * 1000;
		const lastFiles = [...lastAuto.filesChanged].sort();
		const currentFiles = [...dirtyFiles].sort();

		const sameFiles =
			JSON.stringify(lastFiles) === JSON.stringify(currentFiles);

		if (sameFiles && now - lastTime < fiveMinutes) {
			return { snapshot: null, dirtyFiles, dirtyChurnLines };
		}
	}

	const branch = await getHeadBranch(repoRoot);
	const headSha = await getHeadSha(repoRoot);

	const snapshot = await captureSnapshot(
		repoRoot,
		branch,
		headSha,
		"automatic",
		`Automatic capture of ${dirtyFiles.length} changed files`,
	);
	return { snapshot, dirtyFiles, dirtyChurnLines };
}
