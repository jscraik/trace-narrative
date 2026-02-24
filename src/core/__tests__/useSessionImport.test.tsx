import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionImport, type UseSessionImportProps } from '../../hooks/useSessionImport';
import type { BranchViewModel, TimelineNode } from '../types';

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('../tauri/narrativeFs', () => ({
  readTextFile: vi.fn(),
  writeNarrativeFile: vi.fn(),
}));

vi.mock('../security/hash', () => ({
  sha256Hex: vi.fn(),
}));

vi.mock('../security/redact', () => ({
  redactSecrets: vi.fn(),
}));

vi.mock('../repo/sessionLinking', () => ({
  linkSessionToCommit: vi.fn(),
  deleteSessionLinkBySessionIdWithCommit: vi.fn(),
}));

vi.mock('../repo/sessionBadges', () => ({
  refreshSessionBadges: vi.fn(),
}));

vi.mock('../repo/agentTrace', () => ({
  importAgentTraceFile: vi.fn(),
  scanAgentTraceRecords: vi.fn(),
}));

vi.mock('../story-anchors-api', () => ({
  exportSessionLinkNote: vi.fn(),
}));

import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeNarrativeFile } from '../tauri/narrativeFs';
import { sha256Hex } from '../security/hash';
import { redactSecrets } from '../security/redact';
import { linkSessionToCommit, deleteSessionLinkBySessionIdWithCommit } from '../repo/sessionLinking';
import { refreshSessionBadges } from '../repo/sessionBadges';
import { importAgentTraceFile, scanAgentTraceRecords } from '../repo/agentTrace';
import { exportSessionLinkNote } from '../story-anchors-api';

const mockOpen = vi.mocked(open);
const mockReadTextFile = vi.mocked(readTextFile);
const mockWriteNarrativeFile = vi.mocked(writeNarrativeFile);
const mockSha256Hex = vi.mocked(sha256Hex);
const mockRedactSecrets = vi.mocked(redactSecrets);
const mockLinkSessionToCommit = vi.mocked(linkSessionToCommit);
const mockDeleteSessionLinkBySessionId = vi.mocked(deleteSessionLinkBySessionIdWithCommit);
const mockRefreshSessionBadges = vi.mocked(refreshSessionBadges);
const mockImportAgentTraceFile = vi.mocked(importAgentTraceFile);
const mockScanAgentTraceRecords = vi.mocked(scanAgentTraceRecords);
const mockExportSessionLinkNote = vi.mocked(exportSessionLinkNote);

describe('useSessionImport', () => {
  const mockTimeline: TimelineNode[] = [
    { id: 'abc123', type: 'commit', label: 'Test commit', atISO: '2024-01-01T00:00:00Z', status: 'ok' },
  ];

  const mockModel: BranchViewModel = {
    source: 'git',
    title: 'main',
    status: 'open',
    description: '/test/repo',
    stats: { added: 0, removed: 0, files: 0, commits: 1, prompts: 0, responses: 0 },
    intent: [],
    timeline: mockTimeline,
    sessionExcerpts: [],
    meta: { repoPath: '/test/repo', branchName: 'main', headSha: 'abc123', repoId: 1 },
  };

  const defaultProps: UseSessionImportProps = {
    repoRoot: '/test/repo',
    repoId: 1,
    model: mockModel,
    setRepoState: vi.fn(),
    setActionError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importSession', () => {
    it('should import a valid JSON session file successfully', async () => {
      const mockFilePath = '/path/to/session.json';
      const mockContent = JSON.stringify({
        tool: 'codex',
        messages: [
          { role: 'user', text: 'Hello' },
          { role: 'assistant', text: 'Hi there' },
        ],
      });
      const mockSha = 'abc123def456';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(mockContent);
      mockRedactSecrets.mockReturnValue({ redacted: mockContent, hits: [] });
      mockSha256Hex.mockResolvedValue(mockSha);
      mockLinkSessionToCommit.mockResolvedValue({ commitSha: 'abc123', confidence: 0.9, autoLinked: false, temporalScore: 0.5, fileScore: 0.4, needsReview: false });
      mockExportSessionLinkNote.mockResolvedValue({ commitSha: 'abc123', status: 'exported' });
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        title: 'Import a session JSON file',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      expect(mockWriteNarrativeFile).toHaveBeenCalled();
      expect(mockLinkSessionToCommit).toHaveBeenCalled();
      expect(mockRefreshSessionBadges).toHaveBeenCalled();
    });

    it('should handle user cancellation (no file selected)', async () => {
      mockOpen.mockResolvedValue(null);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(mockWriteNarrativeFile).not.toHaveBeenCalled();
    });

    it('should handle array selection (multiple files) as cancellation', async () => {
      mockOpen.mockResolvedValue(['file1.json', 'file2.json']);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      expect(mockReadTextFile).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockFilePath = '/path/to/invalid.json';
      const invalidContent = 'not valid json';
      const mockSha = 'abc123';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(invalidContent);
      mockRedactSecrets.mockReturnValue({ redacted: invalidContent, hits: [] });
      mockSha256Hex.mockResolvedValue(mockSha);
      mockLinkSessionToCommit.mockResolvedValue({ commitSha: 'abc123', confidence: 0.9, autoLinked: false, temporalScore: 0.5, fileScore: 0.4, needsReview: false });
      mockExportSessionLinkNote.mockResolvedValue({ commitSha: 'abc123', status: 'exported' });
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      // Should still write the file with fallback payload
      expect(mockWriteNarrativeFile).toHaveBeenCalled();
      const writtenContent = JSON.parse(mockWriteNarrativeFile.mock.calls[0][2]);
      expect(writtenContent.payload.tool).toBe('unknown');
      expect(writtenContent.payload.messages[0].text).toBe(invalidContent);
    });

    it('should set error when file read fails', async () => {
      const mockError = new Error('Permission denied');
      mockOpen.mockResolvedValue('/path/to/session.json');
      mockReadTextFile.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      expect(defaultProps.setActionError).toHaveBeenCalledWith('Permission denied');
    });

    it('should handle missing messages array in payload', async () => {
      const mockFilePath = '/path/to/session.json';
      const mockContent = JSON.stringify({ tool: 'codex', data: 'no messages' });
      const mockSha = 'abc123';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(mockContent);
      mockRedactSecrets.mockReturnValue({ redacted: mockContent, hits: [] });
      mockSha256Hex.mockResolvedValue(mockSha);
      mockLinkSessionToCommit.mockResolvedValue({ commitSha: 'abc123', confidence: 0.9, autoLinked: false, temporalScore: 0.5, fileScore: 0.4, needsReview: false });
      mockExportSessionLinkNote.mockResolvedValue({ commitSha: 'abc123', status: 'exported' });
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      expect(mockWriteNarrativeFile).toHaveBeenCalled();
    });

    it('should filter out invalid message objects', async () => {
      const mockFilePath = '/path/to/session.json';
      const mockContent = JSON.stringify({
        tool: 'codex',
        messages: [
          { role: 'user', text: 'Valid message' },
          { role: 'invalid', text: 'Invalid role' },
          { text: 'Missing role' },
          null,
          'not an object',
        ],
      });
      const mockSha = 'abc123';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(mockContent);
      mockRedactSecrets.mockReturnValue({ redacted: mockContent, hits: [] });
      mockSha256Hex.mockResolvedValue(mockSha);
      mockLinkSessionToCommit.mockResolvedValue({ commitSha: 'abc123', confidence: 0.9, autoLinked: false, temporalScore: 0.5, fileScore: 0.4, needsReview: false });
      mockExportSessionLinkNote.mockResolvedValue({ commitSha: 'abc123', status: 'exported' });
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      expect(mockLinkSessionToCommit).toHaveBeenCalled();
      const sessionExcerpt = mockLinkSessionToCommit.mock.calls[0][1];
      expect(sessionExcerpt.messages).toHaveLength(1);
      expect(sessionExcerpt.messages[0].text).toBe('Valid message');
    });

    it('should handle files property in messages', async () => {
      const mockFilePath = '/path/to/session.json';
      const mockContent = JSON.stringify({
        tool: 'codex',
        messages: [
          { role: 'user', text: 'Check these files', files: ['file1.ts', 'file2.ts'] },
        ],
      });
      const mockSha = 'abc123';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(mockContent);
      mockRedactSecrets.mockReturnValue({ redacted: mockContent, hits: [] });
      mockSha256Hex.mockResolvedValue(mockSha);
      mockLinkSessionToCommit.mockResolvedValue({ commitSha: 'abc123', confidence: 0.9, autoLinked: false, temporalScore: 0.5, fileScore: 0.4, needsReview: false });
      mockExportSessionLinkNote.mockResolvedValue({ commitSha: 'abc123', status: 'exported' });
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      const sessionExcerpt = mockLinkSessionToCommit.mock.calls[0][1];
      expect(sessionExcerpt.messages[0].files).toEqual(['file1.ts', 'file2.ts']);
    });

    it('should reject messages with non-string file entries', async () => {
      const mockFilePath = '/path/to/session.json';
      const mockContent = JSON.stringify({
        tool: 'codex',
        messages: [
          { role: 'user', text: 'Valid message', files: ['file1.ts'] },
          { role: 'assistant', text: 'Invalid files', files: ['file2.ts', 123] },
        ],
      });
      const mockSha = 'abc123';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(mockContent);
      mockRedactSecrets.mockReturnValue({ redacted: mockContent, hits: [] });
      mockSha256Hex.mockResolvedValue(mockSha);
      mockLinkSessionToCommit.mockResolvedValue({ commitSha: 'abc123', confidence: 0.9, autoLinked: false, temporalScore: 0.5, fileScore: 0.4, needsReview: false });
      mockExportSessionLinkNote.mockResolvedValue({ commitSha: 'abc123', status: 'exported' });
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      const sessionExcerpt = mockLinkSessionToCommit.mock.calls[0][1];
      expect(sessionExcerpt.messages).toHaveLength(1);
      expect(sessionExcerpt.messages[0].text).toBe('Valid message');
      expect(sessionExcerpt.messages[0].files).toEqual(['file1.ts']);
    });

    it('should continue if exportSessionLinkNote fails (best-effort)', async () => {
      const mockFilePath = '/path/to/session.json';
      const mockContent = JSON.stringify({ tool: 'codex', messages: [] });
      const mockSha = 'abc123';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(mockContent);
      mockRedactSecrets.mockReturnValue({ redacted: mockContent, hits: [] });
      mockSha256Hex.mockResolvedValue(mockSha);
      mockLinkSessionToCommit.mockResolvedValue({ commitSha: 'abc123', confidence: 0.9, autoLinked: false, temporalScore: 0.5, fileScore: 0.4, needsReview: false });
      mockExportSessionLinkNote.mockRejectedValue(new Error('Export failed'));
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importSession();
      });

      expect(mockRefreshSessionBadges).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('importKimiSession', () => {
    it('should import a Kimi JSONL file successfully', async () => {
      const mockFilePath = '/path/to/context.jsonl';
      const mockContent = JSON.stringify({ role: 'user', content: 'Hello' }) + '\n' +
                         JSON.stringify({ role: 'assistant', content: 'Hi' });
      const mockSha = 'kimi123';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(mockContent);
      mockRedactSecrets.mockReturnValue({ redacted: mockContent, hits: [] });
      mockSha256Hex.mockResolvedValue(mockSha);
      mockLinkSessionToCommit.mockResolvedValue({ commitSha: 'abc123', confidence: 0.9, autoLinked: false, temporalScore: 0.5, fileScore: 0.4, needsReview: false });
      mockExportSessionLinkNote.mockResolvedValue({ commitSha: 'abc123', status: 'exported' });
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importKimiSession();
      });

      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        title: 'Import a Kimi CLI log (context.jsonl)',
        filters: [{ name: 'JSON Lines', extensions: ['jsonl', 'json'] }],
      });

      expect(mockWriteNarrativeFile).toHaveBeenCalled();
      const writtenPath = mockWriteNarrativeFile.mock.calls[0][1];
      expect(writtenPath).toContain('_kimi.json');
    });

    it('should throw error when no messages are found', async () => {
      const mockFilePath = '/path/to/empty.jsonl';
      const mockContent = 'not valid jsonl';

      mockOpen.mockResolvedValue(mockFilePath);
      mockReadTextFile.mockResolvedValue(mockContent);
      mockRedactSecrets.mockReturnValue({ redacted: mockContent, hits: [] });

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importKimiSession();
      });

      expect(defaultProps.setActionError).toHaveBeenCalledWith(
        expect.stringContaining('No readable messages found')
      );
    });
  });

  describe('importAgentTrace', () => {
    it('should import an agent trace file successfully', async () => {
      const mockFilePath = '/path/to/trace.json';
      const mockTraceData = {
        byCommit: { abc123: { commitSha: 'abc123', aiLines: 10, humanLines: 5, mixedLines: 0, unknownLines: 0, aiPercent: 67, modelIds: ['gpt-4'], toolNames: ['codex'] } },
        byFileByCommit: {},
        totals: { conversations: 1, ranges: 10 },
      };

      mockOpen.mockResolvedValue(mockFilePath);
      mockImportAgentTraceFile.mockResolvedValue({ recordId: 'trace-1', storedPath: '/path/to/stored', redactions: [] });
      mockScanAgentTraceRecords.mockResolvedValue(mockTraceData);

      const mockSetRepoState = vi.fn();
      const props = { ...defaultProps, setRepoState: mockSetRepoState };

      const { result } = renderHook(() => useSessionImport(props));

      await act(async () => {
        await result.current.importAgentTrace();
      });

      expect(mockImportAgentTraceFile).toHaveBeenCalledWith('/test/repo', 1, mockFilePath);
      expect(mockScanAgentTraceRecords).toHaveBeenCalled();
      expect(mockSetRepoState).toHaveBeenCalled();
    });

    it('should handle importAgentTraceFile errors', async () => {
      const mockError = new Error('Invalid trace format');
      mockOpen.mockResolvedValue('/path/to/trace.json');
      mockImportAgentTraceFile.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.importAgentTrace();
      });

      expect(defaultProps.setActionError).toHaveBeenCalledWith('Invalid trace format');
    });
  });

  describe('unlinkSession', () => {
    it('should unlink a session successfully', async () => {
      mockDeleteSessionLinkBySessionId.mockResolvedValue('abc123');
      mockExportSessionLinkNote.mockResolvedValue({ commitSha: 'abc123', status: 'exported' });
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.unlinkSession('session-123');
      });

      expect(mockDeleteSessionLinkBySessionId).toHaveBeenCalledWith(1, 'session-123');
      expect(mockExportSessionLinkNote).toHaveBeenCalledWith(1, 'abc123');
      expect(mockRefreshSessionBadges).toHaveBeenCalledWith(
        '/test/repo',
        1,
        mockTimeline,
        defaultProps.setRepoState,
        { unlinkMode: true, limit: 10 }
      );
    });

    it('should handle unlink when no commit is returned', async () => {
      mockDeleteSessionLinkBySessionId.mockResolvedValue(null);
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.unlinkSession('session-123');
      });

      expect(mockExportSessionLinkNote).not.toHaveBeenCalled();
      expect(mockRefreshSessionBadges).toHaveBeenCalled();
    });

    it('should continue if export fails during unlink (best-effort)', async () => {
      mockDeleteSessionLinkBySessionId.mockResolvedValue('abc123');
      mockExportSessionLinkNote.mockRejectedValue(new Error('Export failed'));
      mockRefreshSessionBadges.mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.unlinkSession('session-123');
      });

      expect(mockRefreshSessionBadges).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should set error when unlink fails', async () => {
      const mockError = new Error('Database error');
      mockDeleteSessionLinkBySessionId.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSessionImport(defaultProps));

      await act(async () => {
        await result.current.unlinkSession('session-123');
      });

      expect(defaultProps.setActionError).toHaveBeenCalledWith('Database error');
    });
  });
});
