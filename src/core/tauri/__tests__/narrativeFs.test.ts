/**
 * Unit tests for narrativeFs.ts — Tauri IPC command-shape contract.
 *
 * narrativeFs is a thin invoke() wrapper with 6 commands. There is no
 * transforming logic — the only testable surface is:
 *   1. Correct Tauri command name is sent.
 *   2. Correct argument shape is passed.
 *   3. Return value is forwarded unmodified.
 *   4. Errors propagate without being swallowed.
 *
 * @tauri-apps/api/core is mocked so these run without a Tauri runtime.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureNarrativeDirs,
  writeNarrativeFile,
  readNarrativeFile,
  listNarrativeFiles,
  readTextFile,
  fileExists,
} from '../narrativeFs';

// ---------------------------------------------------------------------------
// Mock Tauri invoke
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// ensureNarrativeDirs
// ---------------------------------------------------------------------------

describe('ensureNarrativeDirs', () => {
  it('invokes ensure_narrative_dirs with repoRoot', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await ensureNarrativeDirs('/home/user/project');

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('ensure_narrative_dirs', {
      repoRoot: '/home/user/project',
    });
  });

  it('propagates errors from the Tauri backend', async () => {
    mockInvoke.mockRejectedValue(new Error('permission denied'));

    await expect(ensureNarrativeDirs('/locked')).rejects.toThrow('permission denied');
  });
});

// ---------------------------------------------------------------------------
// writeNarrativeFile
// ---------------------------------------------------------------------------

describe('writeNarrativeFile', () => {
  it('invokes write_narrative_file with repoRoot, relativePath, and contents', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await writeNarrativeFile('/project', 'trace/abc.agent-trace.json', '{"id":"abc"}');

    expect(mockInvoke).toHaveBeenCalledWith('write_narrative_file', {
      repoRoot: '/project',
      relativePath: 'trace/abc.agent-trace.json',
      contents: '{"id":"abc"}',
    });
  });

  it('propagates write errors without swallowing them', async () => {
    mockInvoke.mockRejectedValue(new Error('disk full'));

    await expect(
      writeNarrativeFile('/project', 'trace/x.json', 'data')
    ).rejects.toThrow('disk full');
  });

  it('returns undefined on success (void contract)', async () => {
    mockInvoke.mockResolvedValue(undefined);

    const result = await writeNarrativeFile('/project', 'trace/y.json', '');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// readNarrativeFile
// ---------------------------------------------------------------------------

describe('readNarrativeFile', () => {
  it('invokes read_narrative_file with repoRoot and relativePath', async () => {
    mockInvoke.mockResolvedValue('{"version":"1"}');

    const result = await readNarrativeFile('/repo', 'sessions/foo.json');

    expect(mockInvoke).toHaveBeenCalledWith('read_narrative_file', {
      repoRoot: '/repo',
      relativePath: 'sessions/foo.json',
    });
    expect(result).toBe('{"version":"1"}');
  });

  it('returns the raw string exactly as the backend returns it', async () => {
    const raw = '  line1\nline2\t\nline3  ';
    mockInvoke.mockResolvedValue(raw);

    const result = await readNarrativeFile('/repo', 'meta/r.txt');
    expect(result).toBe(raw);
  });

  it('propagates file-not-found errors', async () => {
    mockInvoke.mockRejectedValue(new Error('path does not exist'));

    await expect(readNarrativeFile('/repo', 'missing.json')).rejects.toThrow(
      'path does not exist'
    );
  });
});

// ---------------------------------------------------------------------------
// listNarrativeFiles
// ---------------------------------------------------------------------------

describe('listNarrativeFiles', () => {
  it('invokes list_narrative_files with repoRoot and relativeDir', async () => {
    mockInvoke.mockResolvedValue(['trace/a.json', 'trace/b.json']);

    const result = await listNarrativeFiles('/repo', 'trace');

    expect(mockInvoke).toHaveBeenCalledWith('list_narrative_files', {
      repoRoot: '/repo',
      relativeDir: 'trace',
    });
    expect(result).toEqual(['trace/a.json', 'trace/b.json']);
  });

  it('returns an empty array when the directory has no files', async () => {
    mockInvoke.mockResolvedValue([]);

    const result = await listNarrativeFiles('/repo', 'empty-dir');
    expect(result).toEqual([]);
  });

  it('propagates errors from the backend', async () => {
    mockInvoke.mockRejectedValue(new Error('directory not found'));

    await expect(listNarrativeFiles('/repo', 'bad-dir')).rejects.toThrow('directory not found');
  });
});

// ---------------------------------------------------------------------------
// readTextFile
// ---------------------------------------------------------------------------

describe('readTextFile', () => {
  it('invokes read_text_file with the absolute path under the "path" key', async () => {
    mockInvoke.mockResolvedValue('hello world');

    const result = await readTextFile('/tmp/codex-otel.json');

    expect(mockInvoke).toHaveBeenCalledWith('read_text_file', {
      path: '/tmp/codex-otel.json',
    });
    expect(result).toBe('hello world');
  });

  it('does NOT send repoRoot or relativePath (different arg shape from readNarrativeFile)', async () => {
    mockInvoke.mockResolvedValue('');

    await readTextFile('/abs/path.json');

    const callArgs = mockInvoke.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs).toHaveProperty('path');
    expect(callArgs).not.toHaveProperty('repoRoot');
    expect(callArgs).not.toHaveProperty('relativePath');
  });

  it('propagates errors for non-existent paths', async () => {
    mockInvoke.mockRejectedValue(new Error('path does not exist'));

    await expect(readTextFile('/not/there.json')).rejects.toThrow('path does not exist');
  });
});

// ---------------------------------------------------------------------------
// fileExists
// ---------------------------------------------------------------------------

describe('fileExists', () => {
  it('invokes file_exists with repoRoot and relativePath', async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await fileExists('/repo', 'src/index.ts');

    expect(mockInvoke).toHaveBeenCalledWith('file_exists', {
      repoRoot: '/repo',
      relativePath: 'src/index.ts',
    });
    expect(result).toBe(true);
  });

  it('returns false when the file does not exist', async () => {
    mockInvoke.mockResolvedValue(false);

    const result = await fileExists('/repo', 'nonexistent.ts');
    expect(result).toBe(false);
  });

  it('propagates unexpected errors (e.g. IPC timeout)', async () => {
    mockInvoke.mockRejectedValue(new Error('IPC timeout'));

    await expect(fileExists('/repo', 'src/a.ts')).rejects.toThrow('IPC timeout');
  });
});
