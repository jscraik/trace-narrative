import type {
	TraceCollectorStatus,
	TraceCommitSummary,
	TraceFileSummary,
} from "../types";

export type TraceScanResult = {
	byCommit: Record<string, TraceCommitSummary>;
	byFileByCommit: Record<string, Record<string, TraceFileSummary>>;
	totals: { conversations: number; ranges: number };
};

export type CodexOtelIngestResult = {
	status: TraceCollectorStatus;
	recordsWritten: number;
	errors?: string[];
	redactions?: { type: string; count: number }[];
};

export type TraceImportResult = {
	recordId: string;
	storedPath: string;
	redactions: { type: string; count: number }[];
};
