/**
 * Unit tests for agentTrace.ts core logic.
 *
 * Coverage targets:
 *  - parseTraceRecord (internal, tested via importAgentTraceFile)
 *  - ingestCodexOtelLogFile pipeline: redact → parse → write → ingest
 *  - importAgentTraceFile: read → redact → parse → write → ingest
 *  - generateDerivedTraceRecord: git diff → TraceRecord
 *  - isCommitFallbackNotice classification (via partial/active status routing)
 *
 * Tauri bridges (narrativeFs, db, otelAdapter, gitDiff) are fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ingestCodexOtelLogFile,
  importAgentTraceFile,
  generateDerivedTraceRecord,
  ingestTraceRecord,
} from '../agentTrace';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../tauri/narrativeFs', () => ({
  readTextFile: vi.fn(),
  readNarrativeFile: vi.fn(),
  writeNarrativeFile: vi.fn(),
  listNarrativeFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../security/redact', () => ({
  redactSecrets: vi.fn((raw: string) => ({ redacted: raw, hits: [] })),
}));

vi.mock('../db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../otelAdapter', () => ({
  otelEnvelopeToCodexEvents: vi.fn(),
  codexOtelEventsToTraceRecords: vi.fn(),
}));

vi.mock('../../tauri/gitDiff', () => ({
  getCommitAddedRanges: vi.fn(),
}));

// Re-import mocked modules so we can control them per-test
import {
  readTextFile,
  writeNarrativeFile,
} from '../../tauri/narrativeFs';
import { redactSecrets } from '../../security/redact';
import { getDb } from '../db';
import { otelEnvelopeToCodexEvents, codexOtelEventsToTraceRecords } from '../otelAdapter';
import { getCommitAddedRanges } from '../../tauri/gitDiff';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Minimal valid TraceRecord JSON string */
function makeValidTraceJson(overrides?: Record<string, unknown>): string {
  return JSON.stringify({
    id: 'test-id-001',
    version: '0.1.0',
    timestamp: '2026-01-15T10:00:00.000Z',
    vcs: { type: 'git', revision: 'abc123' },
    tool: { name: 'codex', version: '1.0.0' },
    files: [
      {
        path: 'src/index.ts',
        conversations: [
          {
            url: 'https://conversation.test/1',
            contributor: { type: 'ai', model_id: 'gpt-4o' },
            ranges: [{ start_line: 1, end_line: 10, content_hash: 'hash01' }],
          },
        ],
      },
    ],
    ...overrides,
  });
}

/** Minimal mock DB that records writes */
function makeMockDb() {
  const executed: { sql: string; params: unknown[] }[] = [];
  return {
    db: {
      select: vi.fn().mockResolvedValue([]),
      execute: vi.fn(async (sql: string, params: unknown[]) => {
        executed.push({ sql, params });
      }),
    },
    executed,
  };
}

// ---------------------------------------------------------------------------
// parseTraceRecord (tested indirectly via importAgentTraceFile)
// ---------------------------------------------------------------------------

describe('parseTraceRecord (via importAgentTraceFile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { db } = makeMockDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(writeNarrativeFile).mockResolvedValue(undefined);
  });

  it('parses a fully-populated valid trace JSON', async () => {
    vi.mocked(readTextFile).mockResolvedValue(makeValidTraceJson());
    vi.mocked(redactSecrets).mockReturnValue({ redacted: makeValidTraceJson(), hits: [] });

    const result = await importAgentTraceFile('/repo', 1, '/path/trace.json');
    expect(result.recordId).toBe('test-id-001');
    expect(result.redactions).toEqual([]);
    expect(result.storedPath).toMatch(/^trace\//);
  });

  it('throws on invalid JSON input', async () => {
    vi.mocked(readTextFile).mockResolvedValue('not-json-at-all');
    vi.mocked(redactSecrets).mockReturnValue({ redacted: 'not-json-at-all', hits: [] });

    await expect(importAgentTraceFile('/repo', 1, '/path/bad.json')).rejects.toThrow(
      'Invalid Agent Trace record'
    );
  });

  it('throws on JSON that is not an object', async () => {
    vi.mocked(readTextFile).mockResolvedValue('"just a string"');
    vi.mocked(redactSecrets).mockReturnValue({ redacted: '"just a string"', hits: [] });

    await expect(importAgentTraceFile('/repo', 1, '/path/scalar.json')).rejects.toThrow(
      'Invalid Agent Trace record'
    );
  });

  it('throws when required fields (id) are missing', async () => {
    const missing = makeValidTraceJson({ id: undefined });
    vi.mocked(readTextFile).mockResolvedValue(missing);
    vi.mocked(redactSecrets).mockReturnValue({ redacted: missing, hits: [] });

    await expect(importAgentTraceFile('/repo', 1, '/path/missing-id.json')).rejects.toThrow(
      'Invalid Agent Trace record'
    );
  });

  it('throws when required fields (vcs) are missing', async () => {
    const missing = makeValidTraceJson({ vcs: undefined });
    vi.mocked(readTextFile).mockResolvedValue(missing);
    vi.mocked(redactSecrets).mockReturnValue({ redacted: missing, hits: [] });

    await expect(importAgentTraceFile('/repo', 1, '/path/missing-vcs.json')).rejects.toThrow(
      'Invalid Agent Trace record'
    );
  });

  it('throws when vcs.type is not "git"', async () => {
    // parseTraceRecord rejects non-git vcs at the parse stage (returns null),
    // so importAgentTraceFile raises 'Invalid Agent Trace record' rather than
    // the later 'Only git-based...' guard (which is unreachable from this path).
    const svn = makeValidTraceJson({ vcs: { type: 'svn', revision: 'r123' } });
    vi.mocked(readTextFile).mockResolvedValue(svn);
    vi.mocked(redactSecrets).mockReturnValue({ redacted: svn, hits: [] });

    await expect(importAgentTraceFile('/repo', 1, '/path/svn.json')).rejects.toThrow(
      'Invalid Agent Trace record'
    );
  });

  it('throws when files array is empty', async () => {
    const empty = makeValidTraceJson({ files: [] });
    vi.mocked(readTextFile).mockResolvedValue(empty);
    vi.mocked(redactSecrets).mockReturnValue({ redacted: empty, hits: [] });

    await expect(importAgentTraceFile('/repo', 1, '/path/empty-files.json')).rejects.toThrow(
      'Invalid Agent Trace record'
    );
  });

  it('filters out files without a path', async () => {
    const noPath = makeValidTraceJson({
      files: [
        { conversations: [] }, // no path → filtered
        { path: 'src/keep.ts', conversations: [] }, // keeps
      ],
    });
    vi.mocked(readTextFile).mockResolvedValue(noPath);
    vi.mocked(redactSecrets).mockReturnValue({ redacted: noPath, hits: [] });

    const result = await importAgentTraceFile('/repo', 1, '/path/partial.json');
    expect(result.recordId).toBe('test-id-001');
  });

  it('normalizes unknown contributor type to "unknown"', async () => {
    const weirdType = makeValidTraceJson({
      files: [
        {
          path: 'src/a.ts',
          conversations: [
            {
              contributor: { type: 'robot' }, // not in valid set
              ranges: [{ start_line: 1, end_line: 5 }],
            },
          ],
        },
      ],
    });
    vi.mocked(readTextFile).mockResolvedValue(weirdType);
    vi.mocked(redactSecrets).mockReturnValue({ redacted: weirdType, hits: [] });

    // Should not throw — unknown type is normalized
    const result = await importAgentTraceFile('/repo', 1, '/path/weird.json');
    expect(result.recordId).toBe('test-id-001');
  });

  it('accepts model_id (snake_case) on contributor', async () => {
    const snakeCase = makeValidTraceJson({
      files: [
        {
          path: 'src/b.ts',
          conversations: [
            {
              contributor: { type: 'ai', model_id: 'claude-opus-4' },
              ranges: [{ start_line: 1, end_line: 3 }],
            },
          ],
        },
      ],
    });
    vi.mocked(readTextFile).mockResolvedValue(snakeCase);
    vi.mocked(redactSecrets).mockReturnValue({ redacted: snakeCase, hits: [] });

    const result = await importAgentTraceFile('/repo', 1, '/path/snake.json');
    expect(result.recordId).toBe('test-id-001');
  });

  it('returns redaction hits from redactSecrets', async () => {
    const raw = makeValidTraceJson();
    vi.mocked(readTextFile).mockResolvedValue(raw);
    vi.mocked(redactSecrets).mockReturnValue({
      redacted: raw,
      hits: [{ type: 'api_key', count: 2 }],
    });

    const result = await importAgentTraceFile('/repo', 1, '/path/has-secrets.json');
    expect(result.redactions).toEqual([{ type: 'api_key', count: 2 }]);
  });

  it('writes the trace file to the correct relative path', async () => {
    const raw = makeValidTraceJson();
    vi.mocked(readTextFile).mockResolvedValue(raw);
    vi.mocked(redactSecrets).mockReturnValue({ redacted: raw, hits: [] });

    const result = await importAgentTraceFile('/repo', 1, '/path/trace.json');
    expect(vi.mocked(writeNarrativeFile)).toHaveBeenCalledWith(
      '/repo',
      result.storedPath,
      expect.any(String)
    );
    expect(result.storedPath).toMatch(/^trace\//);
    expect(result.storedPath).toMatch(/test-id-001/);
    expect(result.storedPath).toMatch(/\.agent-trace\.json$/);
  });
});

// ---------------------------------------------------------------------------
// ingestTraceRecord
// ---------------------------------------------------------------------------

describe('ingestTraceRecord', () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    vi.mocked(getDb).mockResolvedValue(mockDb.db as never);
  });

  it('skips insert when record already exists', async () => {
    // recordExists returns a row
    mockDb.db.select.mockResolvedValue([{ id: 'test-id-001' }]);

    const record = JSON.parse(makeValidTraceJson());
    await ingestTraceRecord(1, record);

    expect(mockDb.db.execute).not.toHaveBeenCalled();
  });

  it('inserts trace_records, trace_files, and trace_conversations for a new record', async () => {
    // recordExists returns empty
    mockDb.db.select
      .mockResolvedValueOnce([]) // recordExists check
      .mockResolvedValueOnce([{ id: 42 }]) // trace_files SELECT
      .mockResolvedValueOnce([{ id: 99 }]); // trace_conversations SELECT

    const record = JSON.parse(makeValidTraceJson());
    await ingestTraceRecord(1, record);

    const sqls = mockDb.executed.map((e) => e.sql);
    expect(sqls.some((s) => s.includes('INSERT OR IGNORE INTO trace_records'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO trace_files'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO trace_conversations'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO trace_ranges'))).toBe(true);
  });

  it('skips conversation insert if trace_files SELECT returns no id', async () => {
    mockDb.db.select
      .mockResolvedValueOnce([]) // recordExists
      .mockResolvedValueOnce([]); // trace_files SELECT → no id

    const record = JSON.parse(makeValidTraceJson());
    await ingestTraceRecord(1, record);

    const sqls = mockDb.executed.map((e) => e.sql);
    expect(sqls.some((s) => s.includes('INSERT INTO trace_conversations'))).toBe(false);
  });

  it('uses null for optional tool fields when tool is missing', async () => {
    mockDb.db.select.mockResolvedValue([]);

    const record = { ...JSON.parse(makeValidTraceJson()), tool: undefined };
    await ingestTraceRecord(1, record);

    const insertCall = mockDb.executed.find((e) =>
      e.sql.includes('INSERT OR IGNORE INTO trace_records')
    );
    expect(insertCall).toBeDefined();
    const [, , , , , , toolName, toolVersion] = insertCall!.params as unknown[];
    expect(toolName).toBeNull();
    expect(toolVersion).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ingestCodexOtelLogFile pipeline
// ---------------------------------------------------------------------------

describe('ingestCodexOtelLogFile', () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    vi.mocked(getDb).mockResolvedValue(mockDb.db as never);
    vi.mocked(writeNarrativeFile).mockResolvedValue(undefined);
  });

  it('returns inactive status when OTel log file is not found', async () => {
    vi.mocked(readTextFile).mockRejectedValue(new Error('path does not exist'));

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(result.status.state).toBe('inactive');
    expect(result.recordsWritten).toBe(0);
  });

  it('returns error status for unexpected read errors', async () => {
    vi.mocked(readTextFile).mockRejectedValue(new Error('permission denied'));

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(result.status.state).toBe('error');
    expect((result.status as { message?: string }).message).toBe('permission denied');
  });

  it('returns inactive when no Codex OTel events are parsed', async () => {
    vi.mocked(readTextFile).mockResolvedValue('{}');
    vi.mocked(redactSecrets).mockReturnValue({ redacted: '{}', hits: [] });
    vi.mocked(otelEnvelopeToCodexEvents).mockReturnValue([]);

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(result.status.state).toBe('inactive');
    expect(result.recordsWritten).toBe(0);
  });

  it('returns error when events parse but produce no trace records', async () => {
    vi.mocked(readTextFile).mockResolvedValue('{}');
    vi.mocked(redactSecrets).mockReturnValue({ redacted: '{}', hits: [] });
    vi.mocked(otelEnvelopeToCodexEvents).mockReturnValue([{ type: 'span' } as never]);
    vi.mocked(codexOtelEventsToTraceRecords).mockResolvedValue({
      records: [],
      errors: [{ message: 'missing commit context', commitSha: undefined }],
    });

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(result.status.state).toBe('error');
    expect(result.errors).toContain('missing commit context');
  });

  it('returns inactive (not error) when events parse but produce no records and no errors', async () => {
    vi.mocked(readTextFile).mockResolvedValue('{}');
    vi.mocked(redactSecrets).mockReturnValue({ redacted: '{}', hits: [] });
    vi.mocked(otelEnvelopeToCodexEvents).mockReturnValue([{ type: 'span' } as never]);
    vi.mocked(codexOtelEventsToTraceRecords).mockResolvedValue({ records: [], errors: [] });

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(result.status.state).toBe('inactive');
    expect(result.recordsWritten).toBe(0);
  });

  it('returns active status when records are successfully ingested', async () => {
    const record = JSON.parse(makeValidTraceJson());
    vi.mocked(readTextFile).mockResolvedValue('{}');
    vi.mocked(redactSecrets).mockReturnValue({ redacted: '{}', hits: [] });
    vi.mocked(otelEnvelopeToCodexEvents).mockReturnValue([{ type: 'span' } as never]);
    vi.mocked(codexOtelEventsToTraceRecords).mockResolvedValue({
      records: [record],
      errors: [],
    });
    // recordExists → empty (new record)
    mockDb.db.select
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }]);

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(result.status.state).toBe('active');
    expect(result.recordsWritten).toBe(1);
  });

  it('returns partial status when some records have actionable errors', async () => {
    const record = JSON.parse(makeValidTraceJson());
    vi.mocked(readTextFile).mockResolvedValue('{}');
    vi.mocked(redactSecrets).mockReturnValue({ redacted: '{}', hits: [] });
    vi.mocked(otelEnvelopeToCodexEvents).mockReturnValue([{ type: 'span' } as never]);
    vi.mocked(codexOtelEventsToTraceRecords).mockResolvedValue({
      records: [record],
      errors: [{ message: 'file missing from context', commitSha: 'abc123' }],
    });
    mockDb.db.select
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }]);

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(result.status.state).toBe('partial');
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0]).toContain('abc123');
  });

  it('downgrades commit fallback notices to informational (active, not partial)', async () => {
    const record = JSON.parse(makeValidTraceJson());
    const fallbackMsg = 'missing commit sha; attributed to repo head';
    vi.mocked(readTextFile).mockResolvedValue('{}');
    vi.mocked(redactSecrets).mockReturnValue({ redacted: '{}', hits: [] });
    vi.mocked(otelEnvelopeToCodexEvents).mockReturnValue([{ type: 'span' } as never]);
    vi.mocked(codexOtelEventsToTraceRecords).mockResolvedValue({
      records: [record],
      errors: [{ message: fallbackMsg, commitSha: undefined }],
    });
    mockDb.db.select
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }]);

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    // Fallback notices are informational — should still be active, not partial
    expect(result.status.state).toBe('active');
    // The message should include the fallback note
    expect((result.status as { message?: string }).message).toContain(fallbackMsg);
    // No actionable errors
    expect(result.errors ?? []).toHaveLength(0);
  });

  it('uses custom logPath when provided', async () => {
    vi.mocked(readTextFile).mockRejectedValue(new Error('path does not exist'));

    await ingestCodexOtelLogFile({
      repoRoot: '/repo',
      repoId: 1,
      logPath: '/custom/path/otel.json',
    });

    expect(vi.mocked(readTextFile)).toHaveBeenCalledWith('/custom/path/otel.json');
  });

  it('falls back to /tmp/codex-otel.json when no logPath supplied', async () => {
    vi.mocked(readTextFile).mockRejectedValue(new Error('path does not exist'));

    await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(vi.mocked(readTextFile)).toHaveBeenCalledWith('/tmp/codex-otel.json');
  });

  it('passes redaction hits through to result', async () => {
    const record = JSON.parse(makeValidTraceJson());
    vi.mocked(readTextFile).mockResolvedValue('{}');
    vi.mocked(redactSecrets).mockReturnValue({
      redacted: '{}',
      hits: [{ type: 'secret_key', count: 1 }],
    });
    vi.mocked(otelEnvelopeToCodexEvents).mockReturnValue([{ type: 'span' } as never]);
    vi.mocked(codexOtelEventsToTraceRecords).mockResolvedValue({ records: [record], errors: [] });
    mockDb.db.select
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }]);

    const result = await ingestCodexOtelLogFile({ repoRoot: '/repo', repoId: 1 });

    expect(result.redactions).toEqual([{ type: 'secret_key', count: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// generateDerivedTraceRecord
// ---------------------------------------------------------------------------

describe('generateDerivedTraceRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a valid TraceRecord from git diff ranges', async () => {
    vi.mocked(getCommitAddedRanges).mockResolvedValue([
      { start: 1, end: 10 },
      { start: 20, end: 30 },
    ]);

    const record = await generateDerivedTraceRecord({
      repoRoot: '/repo',
      commitSha: 'deadbeef',
      files: [{ path: 'src/index.ts', additions: 10, deletions: 0 }],
      sessionId: 'session-abc',
    });

    expect(record.vcs).toEqual({ type: 'git', revision: 'deadbeef' });
    expect(record.files).toHaveLength(1);
    expect(record.files[0].path).toBe('src/index.ts');
    expect(record.files[0].conversations[0].contributor?.type).toBe('ai');
    expect(record.files[0].conversations[0].ranges).toHaveLength(2);
    expect(record.files[0].conversations[0].ranges[0]).toEqual({ startLine: 1, endLine: 10 });
    expect(record.metadata?.['dev.narrative']).toMatchObject({
      derived: true,
      sessionId: 'session-abc',
    });
  });

  it('throws when no diff ranges are available across all files', async () => {
    vi.mocked(getCommitAddedRanges).mockResolvedValue([]);

    await expect(
      generateDerivedTraceRecord({
        repoRoot: '/repo',
        commitSha: 'deadbeef',
        files: [{ path: 'src/index.ts', additions: 0, deletions: 5 }],
        sessionId: null,
      })
    ).rejects.toThrow('No diff ranges available to derive Agent Trace record');
  });

  it('skips files with no ranges but includes files that do have ranges', async () => {
    vi.mocked(getCommitAddedRanges)
      .mockResolvedValueOnce([]) // first file: no ranges → skipped
      .mockResolvedValueOnce([{ start: 5, end: 15 }]); // second file: has ranges

    const record = await generateDerivedTraceRecord({
      repoRoot: '/repo',
      commitSha: 'cafef00d',
      files: [
        { path: 'src/empty.ts', additions: 0, deletions: 0 },
        { path: 'src/kept.ts', additions: 10, deletions: 0 },
      ],
      sessionId: undefined,
    });

    expect(record.files).toHaveLength(1);
    expect(record.files[0].path).toBe('src/kept.ts');
  });

  it('sets sessionId to null in metadata when not provided', async () => {
    vi.mocked(getCommitAddedRanges).mockResolvedValue([{ start: 1, end: 5 }]);

    const record = await generateDerivedTraceRecord({
      repoRoot: '/repo',
      commitSha: 'abc123',
      files: [{ path: 'src/a.ts', additions: 5, deletions: 0 }],
    });

    expect((record.metadata?.['dev.narrative'] as { sessionId?: unknown }).sessionId).toBeNull();
  });

  it('assigns a new unique id per call', async () => {
    vi.mocked(getCommitAddedRanges).mockResolvedValue([{ start: 1, end: 2 }]);

    const files = [{ path: 'src/a.ts', additions: 2, deletions: 0 }];
    const r1 = await generateDerivedTraceRecord({ repoRoot: '/repo', commitSha: 'abc', files });
    const r2 = await generateDerivedTraceRecord({ repoRoot: '/repo', commitSha: 'abc', files });

    expect(r1.id).not.toBe(r2.id);
  });

  it('sets tool.name to "narrative" in the derived record', async () => {
    vi.mocked(getCommitAddedRanges).mockResolvedValue([{ start: 1, end: 3 }]);

    const record = await generateDerivedTraceRecord({
      repoRoot: '/repo',
      commitSha: 'abc',
      files: [{ path: 'src/a.ts', additions: 3, deletions: 0 }],
    });

    expect(record.tool?.name).toBe('narrative');
  });
});
