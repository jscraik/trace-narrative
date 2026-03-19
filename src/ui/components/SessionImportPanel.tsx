import {
	AlertTriangle,
	CheckCircle,
	RefreshCw,
	Upload,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type BatchImportResult,
	importSessionFile,
	importSessionFiles,
	type ScannedSession,
	scanForSessionFiles,
} from "../../core/attribution-api";
import { Checkbox } from "./Checkbox";

interface SessionImportPanelProps {
	repoId: number;
}

export function SessionImportPanel({ repoId }: SessionImportPanelProps) {
	const [sessions, setSessions] = useState<ScannedSession[]>([]);
	const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
	const [importing, setImporting] = useState(false);
	const [result, setResult] = useState<BatchImportResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [scanning, setScanning] = useState(false);
	const isMountedRef = useRef(true);
	const scanRequestVersionRef = useRef(0);
	const importRequestVersionRef = useRef(0);
	const repoIdRef = useRef(repoId);

	useEffect(() => {
		repoIdRef.current = repoId;
		scanRequestVersionRef.current += 1;
		importRequestVersionRef.current += 1;
		setImporting(false);
		setScanning(false);
		setResult(null);
		setError(null);
		setSelectedPaths(new Set());
	}, [repoId]);

	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const handleScan = useCallback(async () => {
		const expectedRepoId = repoIdRef.current;
		const requestVersion = scanRequestVersionRef.current + 1;
		scanRequestVersionRef.current = requestVersion;
		const isStaleRequest = () =>
			!isMountedRef.current ||
			scanRequestVersionRef.current !== requestVersion ||
			repoIdRef.current !== expectedRepoId;

		setScanning(true);
		setError(null);
		try {
			const found = await scanForSessionFiles();
			if (isStaleRequest()) return;
			setSessions(found);
			if (found.length === 0) {
				setError(
					"No session files found in standard locations (~/.claude, ~/.cursor, etc.)",
				);
			}
		} catch (e) {
			if (isStaleRequest()) return;
			setError(e instanceof Error ? e.message : "Scan failed");
		} finally {
			if (isMountedRef.current && !isStaleRequest()) {
				setScanning(false);
			}
		}
	}, []);

	const handleImportSelected = useCallback(async () => {
		const pathsToImport = Array.from(selectedPaths);
		if (pathsToImport.length === 0) return;
		const expectedRepoId = repoIdRef.current;
		const requestVersion = importRequestVersionRef.current + 1;
		importRequestVersionRef.current = requestVersion;
		const isStaleRequest = () =>
			!isMountedRef.current ||
			importRequestVersionRef.current !== requestVersion ||
			repoIdRef.current !== expectedRepoId;

		setImporting(true);
		setError(null);
		setResult(null);

		try {
			const result = await importSessionFiles(expectedRepoId, pathsToImport);
			if (isStaleRequest()) return;
			setResult(result);
			// Clear selection after successful import
			if (result.failed.length === 0) {
				setSelectedPaths((prev) => {
					const next = new Set(prev);
					for (const path of pathsToImport) {
						next.delete(path);
					}
					return next;
				});
			}
		} catch (e) {
			if (isStaleRequest()) return;
			setError(e instanceof Error ? e.message : "Import failed");
		} finally {
			if (isMountedRef.current && !isStaleRequest()) {
				setImporting(false);
			}
		}
	}, [selectedPaths]);

	const handleImportSingle = useCallback(async (path: string) => {
		const expectedRepoId = repoIdRef.current;
		const requestVersion = importRequestVersionRef.current + 1;
		importRequestVersionRef.current = requestVersion;
		const isStaleRequest = () =>
			!isMountedRef.current ||
			importRequestVersionRef.current !== requestVersion ||
			repoIdRef.current !== expectedRepoId;

		setImporting(true);
		setError(null);
		setResult(null);

		try {
			const result = await importSessionFile(expectedRepoId, path);
			if (isStaleRequest()) return;
			setResult(result);
		} catch (e) {
			if (isStaleRequest()) return;
			setError(e instanceof Error ? e.message : "Import failed");
		} finally {
			if (isMountedRef.current && !isStaleRequest()) {
				setImporting(false);
			}
		}
	}, []);

	const toggleSelection = useCallback((path: string) => {
		setSelectedPaths((prev) => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	}, []);

	return (
		<div className="card p-4">
			<div className="flex items-center justify-between mb-4">
				<h3 className="font-medium text-text-primary">Import AI Sessions</h3>
				<button
					type="button"
					onClick={handleScan}
					disabled={scanning}
					className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary bg-bg-tertiary border border-border-light rounded-md hover:bg-bg-hover disabled:opacity-50 transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105"
				>
					<RefreshCw
						className={`w-4 h-4 ${scanning ? "motion-safe:animate-spin" : ""}`}
					/>
					{scanning ? "Scanning..." : "Scan for Sessions"}
				</button>
			</div>

			{error && (
				<div className="mb-4 flex items-start gap-2 rounded-md border border-accent-red-light bg-accent-red-bg p-3">
					<AlertTriangle className="w-4 h-4 text-accent-red mt-0.5 flex-shrink-0" />
					<p className="text-sm text-text-secondary">{error}</p>
				</div>
			)}

			{sessions.length > 0 && (
				<div className="mb-4">
					<div className="flex items-center justify-between mb-2">
						<p className="text-sm text-text-secondary">
							Found {sessions.length} session file
							{sessions.length !== 1 ? "s" : ""}
						</p>
						{selectedPaths.size > 0 && (
							<button
								type="button"
								onClick={handleImportSelected}
								disabled={importing}
								className="flex items-center gap-2 rounded-md bg-accent-blue px-3 py-1.5 text-sm font-medium text-text-inverted transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105 hover:brightness-95 disabled:opacity-50"
							>
								<Upload className="w-4 h-4" />
								{importing
									? "Importing..."
									: `Import ${selectedPaths.size} Selected`}
							</button>
						)}
					</div>

					<div className="border border-border-light rounded-md divide-y divide-border-light max-h-64 overflow-auto">
						{sessions.map((session) => {
							const isSelected = selectedPaths.has(session.path);
							const fileName = session.path.split("/").pop() || session.path;
							// Show relative path from home directory
							const displayPath =
								session.path.startsWith("/Users/") ||
								session.path.startsWith("/home/")
									? session.path.replace(/^\/(?:Users|home)\/[^/]+/, "~")
									: session.path;
							return (
								<div
									key={session.path}
									className={`flex items-center justify-between p-3 hover:bg-bg-tertiary transition-colors ${
										isSelected ? "bg-accent-blue-bg" : ""
									}`}
								>
									<div className="flex items-center gap-3">
										<Checkbox
											checked={isSelected}
											onCheckedChange={(_checked) =>
												toggleSelection(session.path)
											}
											aria-label={`Select ${fileName}`}
											className="h-4 w-4"
										/>
										<button
											type="button"
											className="cursor-pointer text-left"
											title={session.path}
											onClick={() => toggleSelection(session.path)}
										>
											<p className="text-sm font-medium text-text-primary">
												{fileName}
											</p>
											<p className="text-xs text-text-tertiary">
												{displayPath}
											</p>
										</button>
									</div>
									<button
										type="button"
										onClick={() => handleImportSingle(session.path)}
										disabled={importing}
										className="text-xs font-medium text-accent-blue hover:text-accent-blue/80 disabled:opacity-50 transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-110"
									>
										Import
									</button>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{result && (
				<div
					className={`p-3 rounded-md border ${
						result.failed.length === 0
							? "bg-accent-green-bg border-accent-green-light"
							: "bg-accent-amber-bg border-accent-amber-light"
					}`}
				>
					<div className="flex items-center gap-2 mb-2">
						{result.failed.length === 0 ? (
							<>
								<CheckCircle className="w-4 h-4 text-accent-green" />
								<p className="text-sm font-medium text-accent-green">
									Successfully imported {result.succeeded.length} session
									{result.succeeded.length !== 1 ? "s" : ""}
								</p>
							</>
						) : (
							<>
								<AlertTriangle className="w-4 h-4 text-accent-amber" />
								<p className="text-sm font-medium text-accent-amber">
									Imported {result.succeeded.length} of {result.total} sessions
								</p>
							</>
						)}
					</div>

					{result.succeeded.length > 0 &&
						result.succeeded.some((s) => s.warnings.length > 0) && (
							<div className="mt-2 space-y-1">
								{result.succeeded
									.filter((s) => s.warnings.length > 0)
									.map((s) => (
										<p key={s.path} className="text-xs text-text-secondary">
											{s.path.split("/").pop()}: {s.warnings.length} warning
											{s.warnings.length !== 1 ? "s" : ""}
										</p>
									))}
							</div>
						)}

					{result.failed.length > 0 && (
						<div className="mt-2 space-y-1">
							{result.failed.map((f) => (
								<div key={f.path} className="flex items-start gap-1.5">
									<XCircle className="w-3 h-3 text-accent-red mt-0.5 flex-shrink-0" />
									<div>
										<p className="text-xs font-medium text-accent-red">
											{f.path.split("/").pop()}
										</p>
										<p className="text-xs text-text-secondary">{f.error}</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			<div className="mt-4 p-3 bg-bg-tertiary rounded-md">
				<p className="text-xs text-text-secondary">
					<strong>Supported locations:</strong> ~/.claude/projects/,
					~/.cursor/composer/, ~/.continue/
				</p>
				<p className="text-xs text-text-tertiary mt-1">
					Sessions are scanned for secrets before import. Files with potential
					secrets will be flagged.
				</p>
			</div>
		</div>
	);
}
