import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef } from "react";
import {
	importAgentTraceFile,
	scanAgentTraceRecords,
} from "../core/repo/agentTrace";
import { parseKimiContextJsonl } from "../core/repo/kimiAdapter";
import { refreshSessionBadges } from "../core/repo/sessionBadges";
import {
	deleteSessionLinkBySessionIdWithCommit,
	linkSessionToCommit,
} from "../core/repo/sessionLinking";
import { sha256Hex } from "../core/security/hash";
import { redactSecrets } from "../core/security/redact";
import {
	sanitizeToolText,
	type ToolSanitizerHit,
} from "../core/security/toolSanitizer";
import { exportSessionLinkNote } from "../core/story-anchors-api";
import { readTextFile, writeNarrativeFile } from "../core/tauri/narrativeFs";
import type {
	BranchViewModel,
	SessionExcerpt,
	SessionMessage,
	SessionTool,
} from "../core/types";
import { basename } from "./basename";
import { isoStampForFile } from "./isoStampForFile";
import { mergeSanitizerHits, sanitizePayloadMessages } from "./sessionUtils";

export interface UseSessionImportProps {
	repoRoot: string;
	repoId: number;
	model: BranchViewModel;
	setRepoState: (updater: (prev: BranchViewModel) => BranchViewModel) => void;
	setActionError: (error: string | null) => void;
}

export interface UseSessionImportReturn {
	importSession: () => Promise<void>;
	importKimiSession: () => Promise<void>;
	importAgentTrace: () => Promise<void>;
	unlinkSession: (sessionId: string) => Promise<void>;
}

/**
 * Hook for handling session imports (JSON, Kimi logs, Agent Traces).
 * Manages file import, sanitization, linking, and UI state updates.
 */
export function useSessionImport({
	repoRoot,
	repoId,
	model,
	setRepoState,
	setActionError,
}: UseSessionImportProps): UseSessionImportReturn {
	const isMountedRef = useRef(true);
	const requestVersionRef = useRef(0);
	const repoContextRef = useRef({
		repoRoot,
		repoId,
		timeline: model.timeline,
	});

	useEffect(() => {
		repoContextRef.current = {
			repoRoot,
			repoId,
			timeline: model.timeline,
		};
		requestVersionRef.current += 1;
	}, [repoRoot, repoId, model.timeline]);

	useEffect(() => {
		return () => {
			isMountedRef.current = false;
			requestVersionRef.current += 1;
		};
	}, []);

	const beginActionGuard = useCallback(() => {
		const expectedRepoRoot = repoContextRef.current.repoRoot;
		const expectedRepoId = repoContextRef.current.repoId;
		const expectedTimeline = repoContextRef.current.timeline;
		const requestVersion = requestVersionRef.current + 1;
		requestVersionRef.current = requestVersion;
		const isStaleRequest = () =>
			!isMountedRef.current ||
			requestVersionRef.current !== requestVersion ||
			repoContextRef.current.repoRoot !== expectedRepoRoot ||
			repoContextRef.current.repoId !== expectedRepoId;

		return {
			expectedRepoRoot,
			expectedRepoId,
			expectedTimeline,
			isStaleRequest,
		};
	}, []);

	const applyScopedRepoUpdate = useCallback(
		(
			expectedRepoId: number,
			updater: (prev: BranchViewModel) => BranchViewModel,
		) => {
			setRepoState((prev) => {
				if (
					prev.meta?.repoId !== undefined &&
					prev.meta.repoId !== expectedRepoId
				) {
					return prev;
				}
				return updater(prev);
			});
		},
		[setRepoState],
	);

	const importSession = useCallback(async () => {
		const {
			expectedRepoRoot,
			expectedRepoId,
			expectedTimeline,
			isStaleRequest,
		} = beginActionGuard();
		setActionError(null);

		try {
			const selected = await open({
				multiple: false,
				title: "Import a session JSON file",
				filters: [{ name: "JSON", extensions: ["json"] }],
			});

			if (!selected || Array.isArray(selected)) return;
			if (isStaleRequest()) return;

			const raw = await readTextFile(selected);
			if (isStaleRequest()) return;
			const { redacted, hits } = redactSecrets(raw);
			const sha = await sha256Hex(redacted);
			if (isStaleRequest()) return;

			let payload: unknown;
			try {
				payload = JSON.parse(redacted);
			} catch {
				payload = {
					tool: "unknown",
					messages: [{ role: "user", text: redacted }],
				};
			}

			const sanitizedPayload = sanitizePayloadMessages(payload);
			const wrapper = {
				importedAtISO: new Date().toISOString(),
				sourceBasename: basename(selected),
				sha256: sha,
				redactions: hits,
				toolSanitizer: sanitizedPayload.hits,
				payload: sanitizedPayload.payload,
			};

			const rel = `sessions/imported/${isoStampForFile()}_${sha.slice(0, 8)}.json`;
			await writeNarrativeFile(
				expectedRepoRoot,
				rel,
				JSON.stringify(wrapper, null, 2),
			);
			if (isStaleRequest()) return;

			// Extract messages for linking
			let messages: SessionMessage[];
			if (
				sanitizedPayload.payload &&
				typeof sanitizedPayload.payload === "object" &&
				"messages" in sanitizedPayload.payload &&
				Array.isArray(sanitizedPayload.payload.messages)
			) {
				messages = sanitizedPayload.payload.messages
					.map((m: unknown, idx: number): SessionMessage | null => {
						if (!isSessionMessageRecord(m)) return null;
						return {
							id: `${sha.slice(0, 8)}-${idx}`,
							role: m.role,
							text: m.text,
							files: m.files,
						};
					})
					.filter((m): m is SessionMessage => m !== null);
			} else {
				messages = [
					{ id: `${sha.slice(0, 8)}-0`, role: "user" as const, text: redacted },
				];
			}

			// Create session excerpt for linking
			const sessionExcerpt: SessionExcerpt = {
				id: sha,
				tool: (sanitizedPayload.payload &&
				typeof sanitizedPayload.payload === "object" &&
				"tool" in sanitizedPayload.payload &&
				typeof sanitizedPayload.payload.tool === "string"
					? sanitizedPayload.payload.tool
					: "unknown") as SessionTool,
				durationMin: undefined,
				messages,
			};

			// Link to best matching commit
			const link = await linkSessionToCommit(expectedRepoId, sessionExcerpt);
			if (isStaleRequest()) return;
			// Best-effort: keep Story Anchors sessions note updated.
			try {
				await exportSessionLinkNote(expectedRepoId, link.commitSha);
				if (isStaleRequest()) return;
			} catch (e) {
				const _msg = String(e);
				console.warn(
					"[SessionImport] exportSessionLinkNote failed (best-effort):",
					_msg,
				);
				if (isStaleRequest()) return;
			}

			// Reload excerpts and update badges
			await refreshSessionBadges(
				expectedRepoRoot,
				expectedRepoId,
				expectedTimeline,
				setRepoState,
				{ limit: 10 },
			);
		} catch (e: unknown) {
			const _msg = String(e);
			if (isStaleRequest()) return;
			setActionError(e instanceof Error ? e.message : _msg);
		}
	}, [beginActionGuard, setRepoState, setActionError]);

	const importKimiSession = useCallback(async () => {
		const {
			expectedRepoRoot,
			expectedRepoId,
			expectedTimeline,
			isStaleRequest,
		} = beginActionGuard();
		setActionError(null);

		try {
			const selected = await open({
				multiple: false,
				title: "Import a Kimi CLI log (context.jsonl)",
				filters: [{ name: "JSON Lines", extensions: ["jsonl", "json"] }],
			});

			if (!selected || Array.isArray(selected)) return;
			if (isStaleRequest()) return;

			const raw = await readTextFile(selected);
			if (isStaleRequest()) return;
			const { redacted, hits } = redactSecrets(raw);
			const sha = await sha256Hex(redacted);
			if (isStaleRequest()) return;
			const parsed = parseKimiContextJsonl(redacted);

			if (parsed.messages.length === 0) {
				throw new Error("No readable messages found in the Kimi context log.");
			}

			const sanitizedMessages = parsed.messages.map((message) => {
				const sanitized = sanitizeToolText(message.text);
				return {
					message: {
						role: message.role,
						text: sanitized.sanitized,
						files: message.files,
					},
					hits: sanitized.hits,
				};
			});
			const toolHits: ToolSanitizerHit[] = [];
			for (const entry of sanitizedMessages) {
				mergeSanitizerHits(toolHits, entry.hits);
			}

			const payload = {
				tool: "kimi",
				modelId: parsed.modelId,
				messages: sanitizedMessages.map((entry) => entry.message),
			};

			const wrapper = {
				importedAtISO: new Date().toISOString(),
				sourceBasename: basename(selected),
				sha256: sha,
				sessionId: `kimi:${sha}`,
				redactions: hits,
				toolSanitizer: toolHits,
				payload,
			};

			const rel = `sessions/imported/${isoStampForFile()}_${sha.slice(0, 8)}_kimi.json`;
			await writeNarrativeFile(
				expectedRepoRoot,
				rel,
				JSON.stringify(wrapper, null, 2),
			);
			if (isStaleRequest()) return;

			// Create session excerpt for linking
			const sessionExcerpt: SessionExcerpt = {
				id: `kimi:${sha}`,
				tool: "kimi" as SessionTool,
				durationMin: undefined,
				messages: sanitizedMessages.map((entry, idx) => ({
					id: `kimi:${sha}-${idx}`,
					...entry.message,
				})),
			};

			// Link to best matching commit
			const link = await linkSessionToCommit(expectedRepoId, sessionExcerpt);
			if (isStaleRequest()) return;
			// Best-effort: keep Story Anchors sessions note updated.
			try {
				await exportSessionLinkNote(expectedRepoId, link.commitSha);
				if (isStaleRequest()) return;
			} catch (e) {
				const _msg = String(e);
				console.warn(
					"[SessionImport] exportSessionLinkNote failed (best-effort):",
					_msg,
				);
				if (isStaleRequest()) return;
			}

			// Reload excerpts and update badges
			await refreshSessionBadges(
				expectedRepoRoot,
				expectedRepoId,
				expectedTimeline,
				setRepoState,
				{ limit: 10 },
			);
		} catch (e: unknown) {
			const _msg = String(e);
			if (isStaleRequest()) return;
			setActionError(e instanceof Error ? e.message : _msg);
		}
	}, [beginActionGuard, setRepoState, setActionError]);

	const importAgentTrace = useCallback(async () => {
		const {
			expectedRepoRoot,
			expectedRepoId,
			expectedTimeline,
			isStaleRequest,
		} = beginActionGuard();
		setActionError(null);

		try {
			const selected = await open({
				multiple: false,
				title: "Import an Agent Trace JSON file",
				filters: [{ name: "Agent Trace", extensions: ["json"] }],
			});

			if (!selected || Array.isArray(selected)) return;
			if (isStaleRequest()) return;

			await importAgentTraceFile(expectedRepoRoot, expectedRepoId, selected);
			if (isStaleRequest()) return;

			const commitShas = expectedTimeline.map((n) => n.id);
			const trace = await scanAgentTraceRecords(
				expectedRepoRoot,
				expectedRepoId,
				commitShas,
			);
			if (isStaleRequest()) return;

			applyScopedRepoUpdate(expectedRepoId, (prev) =>
				applyTraceUpdate(prev, trace),
			);
		} catch (e: unknown) {
			const _msg = String(e);
			if (isStaleRequest()) return;
			setActionError(e instanceof Error ? e.message : _msg);
		}
	}, [beginActionGuard, applyScopedRepoUpdate, setActionError]);

	const unlinkSession = useCallback(
		async (sessionId: string) => {
			const {
				expectedRepoRoot,
				expectedRepoId,
				expectedTimeline,
				isStaleRequest,
			} = beginActionGuard();
			setActionError(null);

			try {
				const commitSha = await deleteSessionLinkBySessionIdWithCommit(
					expectedRepoId,
					sessionId,
				);
				if (isStaleRequest()) return;
				if (commitSha) {
					try {
						await exportSessionLinkNote(expectedRepoId, commitSha);
						if (isStaleRequest()) return;
					} catch (_e) {
						if (isStaleRequest()) return;
					}
				}

				// Reload excerpts and update badges
				await refreshSessionBadges(
					expectedRepoRoot,
					expectedRepoId,
					expectedTimeline,
					setRepoState,
					{ unlinkMode: true, limit: 10 },
				);
			} catch (e: unknown) {
				if (isStaleRequest()) return;
				setActionError(e instanceof Error ? e.message : String(e));
			}
		},
		[beginActionGuard, setRepoState, setActionError],
	);

	return {
		importSession,
		importKimiSession,
		importAgentTrace,
		unlinkSession,
	};
}

// Helper functions

function applyTraceUpdate(
	model: BranchViewModel,
	trace: Awaited<ReturnType<typeof scanAgentTraceRecords>>,
): BranchViewModel {
	const timeline = model.timeline.map((node) => {
		const traceSummary = trace.byCommit[node.id];
		if (!traceSummary) return node;
		const existing = node.badges?.filter((b) => b.type !== "trace") ?? [];

		const isUnknownOnly =
			traceSummary.unknownLines > 0 &&
			traceSummary.aiLines === 0 &&
			traceSummary.humanLines === 0 &&
			traceSummary.mixedLines === 0;

		const label = isUnknownOnly ? "Unknown" : `AI ${traceSummary.aiPercent}%`;

		return {
			...node,
			badges: [...existing, { type: "trace" as const, label }],
		};
	});

	return {
		...model,
		traceSummaries: {
			byCommit: trace.byCommit,
			byFileByCommit: trace.byFileByCommit,
		},
		stats: {
			...model.stats,
			prompts: trace.totals.conversations,
			responses: trace.totals.ranges,
		},
		timeline,
	};
}

function isSessionMessageRecord(
	value: unknown,
): value is { role: "user" | "assistant"; text: string; files?: string[] } {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	const role = record.role;
	if (role !== "user" && role !== "assistant") return false;
	if (typeof record.text !== "string") return false;
	if (record.files && !Array.isArray(record.files)) return false;
	if (
		Array.isArray(record.files) &&
		record.files.some((entry) => typeof entry !== "string")
	)
		return false;
	return true;
}
