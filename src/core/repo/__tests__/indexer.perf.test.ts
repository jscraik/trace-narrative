import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performance } from 'node:perf_hooks';
import { indexRepo } from '../indexer';

// Mock all heavy dependencies
vi.mock('../db', () => ({
  cacheCommitSummaries: vi.fn(),
  cacheFileChanges: vi.fn(),
  getCachedFileChanges: vi.fn(),
  upsertRepo: vi.fn(),
}));

vi.mock('../git', () => ({
  getAggregateStatsForCommits: vi.fn(),
  getCommitDetails: vi.fn(),
  getDirtyFiles: vi.fn(),
  getHeadBranch: vi.fn(),
  getHeadSha: vi.fn(),
  getWorkingTreeChurn: vi.fn(),
  listCommits: vi.fn(),
  resolveGitRoot: vi.fn(),
}));

vi.mock('../meta', () => ({
  branchStatsPayload: vi.fn(),
  ensureRepoNarrativeLayout: vi.fn(),
  writeBranchMeta: vi.fn(),
  writeCommitFilesMeta: vi.fn(),
  writeCommitSummaryMeta: vi.fn(),
  writeRepoMeta: vi.fn(),
}));

vi.mock('../sessions', () => ({
  loadSessionExcerpts: vi.fn(),
}));

vi.mock('../agentTrace', () => ({
  ingestCodexOtelLogFile: vi.fn(),
  scanAgentTraceRecords: vi.fn(),
}));

vi.mock('../traceConfig', () => ({
  loadTraceConfig: vi.fn(),
}));

vi.mock('../../attribution-api', () => ({
  importAttributionNotesBatch: vi.fn(),
}));

vi.mock('../../story-anchors-api', () => ({
  getStoryAnchorStatus: vi.fn(),
  importSessionLinkNotesBatch: vi.fn(),
}));

vi.mock('../testRuns', () => ({
  getLatestTestRunSummaryByCommit: vi.fn(),
}));

import { upsertRepo, cacheCommitSummaries } from '../db';
import {
  getAggregateStatsForCommits,
  getDirtyFiles,
  getHeadBranch,
  getHeadSha,
  getWorkingTreeChurn,
  listCommits,
  resolveGitRoot,
} from '../git';
import {
  ensureRepoNarrativeLayout,
  writeBranchMeta,
  writeCommitSummaryMeta,
  writeRepoMeta,
  branchStatsPayload,
} from '../meta';
import { loadSessionExcerpts } from '../sessions';
import { ingestCodexOtelLogFile, scanAgentTraceRecords } from '../agentTrace';
import { loadTraceConfig } from '../traceConfig';
import { importAttributionNotesBatch } from '../../attribution-api';
import {
  getStoryAnchorStatus,
  importSessionLinkNotesBatch,
} from '../../story-anchors-api';
import { getLatestTestRunSummaryByCommit } from '../testRuns';

// Helper to simulate Tauri IPC delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockResolveGitRoot = vi.mocked(resolveGitRoot);
const mockGetHeadBranch = vi.mocked(getHeadBranch);
const mockGetHeadSha = vi.mocked(getHeadSha);
const mockUpsertRepo = vi.mocked(upsertRepo);
const mockListCommits = vi.mocked(listCommits);
const mockCacheCommitSummaries = vi.mocked(cacheCommitSummaries);
const mockGetAggregateStatsForCommits = vi.mocked(getAggregateStatsForCommits);
const mockGetDirtyFiles = vi.mocked(getDirtyFiles);
const mockGetWorkingTreeChurn = vi.mocked(getWorkingTreeChurn);
const mockImportAttributionNotesBatch = vi.mocked(importAttributionNotesBatch);
const mockImportSessionLinkNotesBatch = vi.mocked(importSessionLinkNotesBatch);
const mockGetStoryAnchorStatus = vi.mocked(getStoryAnchorStatus);
const mockLoadSessionExcerpts = vi.mocked(loadSessionExcerpts);
const mockLoadTraceConfig = vi.mocked(loadTraceConfig);
const mockIngestCodexOtelLogFile = vi.mocked(ingestCodexOtelLogFile);
const mockScanAgentTraceRecords = vi.mocked(scanAgentTraceRecords);
const mockGetLatestTestRunSummaryByCommit = vi.mocked(getLatestTestRunSummaryByCommit);
const mockEnsureRepoNarrativeLayout = vi.mocked(ensureRepoNarrativeLayout);
const mockWriteRepoMeta = vi.mocked(writeRepoMeta);
const mockWriteBranchMeta = vi.mocked(writeBranchMeta);
const mockWriteCommitSummaryMeta = vi.mocked(writeCommitSummaryMeta);
const mockBranchStatsPayload = vi.mocked(branchStatsPayload);

describe('Indexer Performance (Cold Latency Benchmark)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockCommits = Array.from({ length: 1000 }, (_, i) => ({
      sha: `sha${i}`,
      subject: `Commit ${i}`,
      author: 'Test Author',
      authoredAtISO: new Date().toISOString(),
    }));

    // Setup very fast mocks for local TS logic, but enforce hard IPC latency delays
    mockResolveGitRoot.mockImplementation(async () => { await delay(5); return '/test/perf/repo'; });
    mockGetHeadBranch.mockImplementation(async () => { await delay(5); return 'main'; });
    mockGetHeadSha.mockImplementation(async () => { await delay(5); return 'head123'; });
    mockUpsertRepo.mockImplementation(async () => { await delay(5); return 1; });
    mockListCommits.mockImplementation(async () => { await delay(20); return mockCommits; });
    mockCacheCommitSummaries.mockResolvedValue(undefined);
    mockGetAggregateStatsForCommits.mockImplementation(async () => { await delay(10); return { added: 100, removed: 50, uniqueFiles: 10 }; });
    
    // Simulate slow Tauri commands mapped to disk reads / git queries (50ms base delay each)
    mockGetDirtyFiles.mockImplementation(async () => { await delay(50); return []; });
    mockGetWorkingTreeChurn.mockImplementation(async () => { await delay(50); return 0; });
    mockImportAttributionNotesBatch.mockImplementation(async () => { await delay(50); return { total: 0, imported: 0, missing: 0, failed: 0 }; });
    mockImportSessionLinkNotesBatch.mockImplementation(async () => { await delay(50); return { total: 0, imported: 0, missing: 0, failed: 0 }; });
    mockGetStoryAnchorStatus.mockImplementation(async () => { await delay(50); return []; });
    mockLoadSessionExcerpts.mockImplementation(async () => { await delay(50); return []; });
    mockLoadTraceConfig.mockImplementation(async () => { await delay(50); return { codexOtelLogPath: '/tmp/otel.log', codexOtelReceiverEnabled: false }; });
    mockIngestCodexOtelLogFile.mockImplementation(async () => { await delay(100); return { status: { state: 'inactive', message: 'None' }, recordsWritten: 0 }; });
    mockScanAgentTraceRecords.mockImplementation(async () => { await delay(50); return { byCommit: {}, byFileByCommit: {}, totals: { conversations: 0, ranges: 0 } }; });
    mockGetLatestTestRunSummaryByCommit.mockImplementation(async () => { await delay(50); return {}; });
    
    // Fast metadata writes
    mockEnsureRepoNarrativeLayout.mockResolvedValue(undefined);
    mockWriteRepoMeta.mockResolvedValue(undefined);
    mockWriteBranchMeta.mockResolvedValue(undefined);
    mockWriteCommitSummaryMeta.mockResolvedValue(undefined);
    mockBranchStatsPayload.mockReturnValue({ repoRoot: '/test', branch: 'main', headSha: 'head123', indexedAtISO: new Date().toISOString(), stats: { added: 0, removed: 0, files: 0, commits: 0, prompts: 0, responses: 0 }, commits: [] });
  });

  it('measures the newly parallelized fan-out E2E latency', async () => {
    // If these 7 IPC calls were sequential as they were previously, they would take:
    // 50 (anchors) + 50 (sessions) + 50 (traceConfig) + 50 (dirtyFiles) + 50 (dirtyChurn) + 50 (scans) + 50 (tests) = ~350ms just in the block.
    // Plus ingestCodexOtelLogFile (100) and scanAgentTraceRecords (50) -> ~500ms total IPC.

    const t0 = performance.now();
    await indexRepo('/test/perf/repo', 1000);
    const t1 = performance.now();
    const durationMs = t1 - t0;
    
    // A test failure here proves that parallel Promise.all constraints are regressed!
    expect(durationMs).toBeLessThan(350); 
  });
});
