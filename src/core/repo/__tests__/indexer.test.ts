import { describe, it, expect, vi, beforeEach } from 'vitest';
import { indexRepo, getOrLoadCommitFiles, type RepoIndex } from '../indexer';

// Mock all dependencies
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

import {
  cacheCommitSummaries,
  cacheFileChanges,
  getCachedFileChanges,
  upsertRepo,
} from '../db';
import {
  getAggregateStatsForCommits,
  getCommitDetails,
  getDirtyFiles,
  getHeadBranch,
  getHeadSha,
  getWorkingTreeChurn,
  listCommits,
  resolveGitRoot,
} from '../git';
import {
  branchStatsPayload,
  ensureRepoNarrativeLayout,
  writeBranchMeta,
  writeCommitFilesMeta,
  writeCommitSummaryMeta,
  writeRepoMeta,
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

describe('indexer', () => {
  const mockCommits = [
    { sha: 'abc123', subject: 'First commit', author: 'Test Author', authoredAtISO: '2024-01-01T00:00:00Z' },
    { sha: 'def456', subject: 'Second commit', author: 'Test Author', authoredAtISO: '2024-01-02T00:00:00Z' },
  ];

  const mockAggregateStats = {
    added: 100,
    removed: 50,
    uniqueFiles: 10,
  };

  const mockTraceData = {
    byCommit: {
      abc123: { commitSha: 'abc123', aiLines: 10, humanLines: 5, mixedLines: 0, unknownLines: 0, aiPercent: 67, modelIds: ['gpt-4'], toolNames: ['codex'] },
    },
    byFileByCommit: {},
    totals: { conversations: 2, ranges: 15 },
  };

  const mockOtelIngest = {
    status: { state: 'active' as const, message: 'Connected' },
    recordsWritten: 100,
  };

  const mockTraceConfig = {
    codexOtelLogPath: '/path/to/otel.log',
    codexOtelReceiverEnabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mocks
    mockResolveGitRoot.mockResolvedValue('/test/repo');
    mockGetHeadBranch.mockResolvedValue('main');
    mockGetHeadSha.mockResolvedValue('head123');
    mockUpsertRepo.mockResolvedValue(1);
    mockListCommits.mockResolvedValue(mockCommits);
    mockCacheCommitSummaries.mockResolvedValue(undefined);
    mockGetAggregateStatsForCommits.mockResolvedValue(mockAggregateStats);
    mockGetDirtyFiles.mockResolvedValue([]);
    mockGetWorkingTreeChurn.mockResolvedValue(0);
    mockImportAttributionNotesBatch.mockResolvedValue({ total: 0, imported: 0, missing: 0, failed: 0 });
    mockImportSessionLinkNotesBatch.mockResolvedValue({ total: 0, imported: 0, missing: 0, failed: 0 });
    mockGetStoryAnchorStatus.mockResolvedValue([]);
    mockLoadSessionExcerpts.mockResolvedValue([]);
    mockLoadTraceConfig.mockResolvedValue(mockTraceConfig);
    mockIngestCodexOtelLogFile.mockResolvedValue(mockOtelIngest);
    mockScanAgentTraceRecords.mockResolvedValue(mockTraceData);
    mockGetLatestTestRunSummaryByCommit.mockResolvedValue({});
    mockEnsureRepoNarrativeLayout.mockResolvedValue(undefined);
    mockWriteRepoMeta.mockResolvedValue(undefined);
    mockWriteBranchMeta.mockResolvedValue(undefined);
    mockWriteCommitSummaryMeta.mockResolvedValue(undefined);
    mockBranchStatsPayload.mockReturnValue({ repoRoot: '/test/repo', branch: 'main', headSha: 'head123', indexedAtISO: new Date().toISOString(), stats: { added: 100, removed: 50, files: 10, commits: 2, prompts: 2, responses: 15 }, commits: ['def456', 'abc123'] });
  });

  describe('indexRepo', () => {
    it('should index a repository successfully with all phases', async () => {
      const progressCallbacks: string[] = [];
      const onProgress = (p: { phase: string; message: string }) => {
        progressCallbacks.push(p.phase);
      };

      const result = await indexRepo('/test/repo', 50, onProgress);

      // Verify all expected phases were reported
      expect(progressCallbacks).toContain('resolve');
      expect(progressCallbacks).toContain('branch');
      expect(progressCallbacks).toContain('repo');
      expect(progressCallbacks).toContain('commits');
      expect(progressCallbacks).toContain('summaries');
      expect(progressCallbacks).toContain('stats');
      expect(progressCallbacks).toContain('notes');
      expect(progressCallbacks).toContain('intent');
      expect(progressCallbacks).toContain('sessions');
      expect(progressCallbacks).toContain('trace-config');
      expect(progressCallbacks).toContain('trace');
      expect(progressCallbacks).toContain('meta');
      expect(progressCallbacks).toContain('done');

      // Verify result structure
      expect(result.repo.repoId).toBe(1);
      expect(result.repo.root).toBe('/test/repo');
      expect(result.repo.branch).toBe('main');
      expect(result.model.title).toBe('main');
      expect(result.model.status).toBe('open');
      expect(result.model.dirtyChurnLines).toBe(0);
    });

    it('should handle attribution notes import failure gracefully', async () => {
      mockImportAttributionNotesBatch.mockRejectedValue(new Error('Git error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await indexRepo('/test/repo');

      expect(result.model).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Indexer] Attribution notes import failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle session link notes import failure gracefully', async () => {
      mockImportSessionLinkNotesBatch.mockRejectedValue(new Error('Git error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await indexRepo('/test/repo');

      expect(result.model).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Indexer] Session link notes import failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle story anchor status failure gracefully', async () => {
      mockGetStoryAnchorStatus.mockRejectedValue(new Error('DB error'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await indexRepo('/test/repo');

      expect(result.model).toBeDefined();
      expect(result.model.timeline[0].badges).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it('should handle trace scanning failure gracefully', async () => {
      mockIngestCodexOtelLogFile.mockRejectedValue(new Error('File not found'));
      mockScanAgentTraceRecords.mockRejectedValue(new Error('Scan failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await indexRepo('/test/repo');

      expect(result.model).toBeDefined();
      expect(result.model.traceStatus?.state).toBe('inactive');

      consoleSpy.mockRestore();
    });

    it('should handle test run hydration failure gracefully', async () => {
      mockGetLatestTestRunSummaryByCommit.mockRejectedValue(new Error('Table missing'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await indexRepo('/test/repo');

      expect(result.model).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should handle metadata write failure gracefully', async () => {
      mockWriteRepoMeta.mockRejectedValue(new Error('Read-only filesystem'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await indexRepo('/test/repo');

      expect(result.model).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Indexer] Metadata write failed (repo may be read-only):',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should generate correct timeline with trace badges', async () => {
      const result = await indexRepo('/test/repo');

      // Timeline should be in reverse chronological order (newest first)
      expect(result.model.timeline).toHaveLength(2);
      expect(result.model.timeline[0].id).toBe('def456');
      expect(result.model.timeline[1].id).toBe('abc123');

      // Check trace badge on abc123 (which has trace data in mock)
      const secondNode = result.model.timeline[1];
      expect(secondNode.badges).toBeDefined();
      const traceBadge = secondNode.badges?.find((b) => b.type === 'trace');
      expect(traceBadge).toBeDefined();
      expect(traceBadge?.label).toBe('AI 67%');
    });

    it('should generate Unknown trace badge when only unknown lines', async () => {
      mockScanAgentTraceRecords.mockResolvedValue({
        byCommit: {
          def456: { commitSha: 'def456', aiLines: 0, humanLines: 0, mixedLines: 0, unknownLines: 10, aiPercent: 0, modelIds: [], toolNames: [] },
        },
        byFileByCommit: {},
        totals: { conversations: 1, ranges: 0 },
      });

      const result = await indexRepo('/test/repo');

      const firstNode = result.model.timeline[0];
      const traceBadge = firstNode.badges?.find((b) => b.type === 'trace');
      expect(traceBadge?.label).toBe('Unknown');
    });

    it('should include test badges when test data exists', async () => {
      mockGetLatestTestRunSummaryByCommit.mockResolvedValue({
        def456: { runId: 'run-1', passed: 10, failed: 2, skipped: 0, durationSec: 30 },
      });

      const result = await indexRepo('/test/repo');

      const firstNode = result.model.timeline[0];
      const testBadge = firstNode.badges?.find((b) => b.type === 'test');
      expect(testBadge).toBeDefined();
      expect(testBadge?.label).toBe('2 failed');
      expect(testBadge?.status).toBe('failed');
    });

    it('should show passed test badge when no failures', async () => {
      mockGetLatestTestRunSummaryByCommit.mockResolvedValue({
        def456: { runId: 'run-1', passed: 10, failed: 0, skipped: 0, durationSec: 30 },
      });

      const result = await indexRepo('/test/repo');

      const firstNode = result.model.timeline[0];
      const testBadge = firstNode.badges?.find((b) => b.type === 'test');
      expect(testBadge?.label).toBe('10 passed');
      expect(testBadge?.status).toBe('passed');
    });

    it('should include anchor badges when anchor status exists', async () => {
      mockGetStoryAnchorStatus.mockResolvedValue([
        {
          commitSha: 'def456',
          hasAttributionNote: true,
          hasSessionsNote: true,
          hasLineageNote: false,
        },
      ]);

      const result = await indexRepo('/test/repo');

      const firstNode = result.model.timeline[0];
      const anchorBadge = firstNode.badges?.find((b) => b.type === 'anchor');
      expect(anchorBadge).toBeDefined();
      expect(anchorBadge?.status).toBe('mixed');
      expect(anchorBadge?.anchor).toEqual({
        hasAttributionNote: true,
        hasSessionsNote: true,
        hasLineageNote: false,
      });
    });

    it('should calculate correct stats for the model', async () => {
      const result = await indexRepo('/test/repo');

      expect(result.model.stats).toEqual({
        added: 100,
        removed: 50,
        files: 10,
        commits: 2,
        prompts: 2,
        responses: 15,
      });
    });

    it('should generate intent items from recent commits', async () => {
      const manyCommits = Array.from({ length: 10 }, (_, i) => ({
        sha: `commit${i}`,
        subject: `Commit ${i}`,
        author: 'Test Author',
        authoredAtISO: `2024-01-${i + 1}T00:00:00Z`,
      }));
      mockListCommits.mockResolvedValue(manyCommits);

      const result = await indexRepo('/test/repo');

      expect(result.model.intent).toHaveLength(6);
      expect(result.model.intent[0].text).toBe('Commit 0');
      expect(result.model.intent[0].tag).toBe('commit0'.slice(0, 7));
    });

    it('should handle commit with no subject', async () => {
      mockListCommits.mockResolvedValue([
        { sha: 'abc123', subject: '', author: 'Test Author', authoredAtISO: '2024-01-01T00:00:00Z' },
      ]);

      const result = await indexRepo('/test/repo');

      expect(result.model.intent[0].text).toBe('(no subject)');
    });

    it('should pass correct limit to listCommits', async () => {
      await indexRepo('/test/repo', 100);

      expect(mockListCommits).toHaveBeenCalledWith('/test/repo', 100);
    });

    it('should report progress percentages', async () => {
      const progressReports: Array<{ phase: string; percent?: number }> = [];
      const onProgress = (p: { phase: string; percent?: number }) => {
        progressReports.push(p);
      };

      await indexRepo('/test/repo', 50, onProgress);

      // Check that progress increases
      const percents = progressReports
        .filter((p) => p.percent !== undefined)
        .map((p) => p.percent);

      expect(percents.length).toBeGreaterThan(0);
      expect(percents[percents.length - 1]).toBe(100);
    });

    it('should work without progress callback', async () => {
      const result = await indexRepo('/test/repo');

      expect(result.model).toBeDefined();
    });
  });

  describe('getOrLoadCommitFiles', () => {
    const mockRepoIndex: RepoIndex = {
      repoId: 1,
      root: '/test/repo',
      branch: 'main',
      headSha: 'head123',
    };

    const mockFileChanges = [
      { path: 'src/index.ts', changeType: 'modified', additions: 10, deletions: 5 },
      { path: 'README.md', changeType: 'added', additions: 20, deletions: 0 },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return cached file changes when available', async () => {
      vi.mocked(getCachedFileChanges).mockResolvedValue(mockFileChanges);

      const result = await getOrLoadCommitFiles(mockRepoIndex, 'abc123');

      expect(result).toEqual(mockFileChanges);
      expect(getCommitDetails).not.toHaveBeenCalled();
    });

    it('should fetch from git when not cached', async () => {
      vi.mocked(getCachedFileChanges).mockResolvedValue(null);
      vi.mocked(getCommitDetails).mockResolvedValue({ sha: 'abc123', fileChanges: mockFileChanges });
      vi.mocked(cacheFileChanges).mockResolvedValue(undefined);
      vi.mocked(writeCommitFilesMeta).mockResolvedValue(undefined);

      const result = await getOrLoadCommitFiles(mockRepoIndex, 'abc123');

      expect(getCommitDetails).toHaveBeenCalledWith('/test/repo', 'abc123');
      expect(cacheFileChanges).toHaveBeenCalledWith(1, { sha: 'abc123', fileChanges: mockFileChanges });
      expect(result).toEqual(mockFileChanges);
    });

    it('should write metadata after fetching from git', async () => {
      vi.mocked(getCachedFileChanges).mockResolvedValue(null);
      vi.mocked(getCommitDetails).mockResolvedValue({ sha: 'abc123', fileChanges: mockFileChanges });
      vi.mocked(cacheFileChanges).mockResolvedValue(undefined);
      vi.mocked(writeCommitFilesMeta).mockResolvedValue(undefined);

      await getOrLoadCommitFiles(mockRepoIndex, 'abc123');

      expect(writeCommitFilesMeta).toHaveBeenCalledWith('/test/repo', 'abc123', mockFileChanges);
    });

    it('should handle metadata write failure gracefully', async () => {
      vi.mocked(getCachedFileChanges).mockResolvedValue(null);
      vi.mocked(getCommitDetails).mockResolvedValue({ sha: 'abc123', fileChanges: mockFileChanges });
      vi.mocked(cacheFileChanges).mockResolvedValue(undefined);
      vi.mocked(writeCommitFilesMeta).mockRejectedValue(new Error('Write failed'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getOrLoadCommitFiles(mockRepoIndex, 'abc123');

      expect(result).toEqual(mockFileChanges);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
