import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BranchViewModel } from '../../../core/types';
import { RepoEvidenceOverview } from '../RepoEvidenceOverview';

function createModel(overrides: Partial<BranchViewModel> = {}): BranchViewModel {
  return {
    source: 'git',
    title: 'feature/evidence-shell',
    status: 'open',
    description: 'Tighten the repo evidence shell around branch verification.',
    stats: {
      added: 48,
      removed: 12,
      files: 4,
      commits: 3,
      prompts: 2,
      responses: 2,
    },
    intent: [],
    timeline: [
      { id: '1111111', type: 'commit', label: 'Commit A' },
      { id: '2222222', type: 'commit', label: 'Commit B' },
      { id: '3333333', type: 'commit', label: 'Commit C' },
    ],
    sessionExcerpts: [
      {
        id: 's1',
        tool: 'codex',
        linkedCommitSha: '1111111',
        messages: [{ id: 'm1', role: 'user', text: 'Explain this change.' }],
      },
      {
        id: 's2',
        tool: 'codex',
        messages: [{ id: 'm2', role: 'assistant', text: 'Need more evidence.' }],
      },
    ],
    filesChanged: [{ path: 'src/app.tsx', additions: 10, deletions: 2 }],
    traceSummaries: {
      byCommit: {
        '1111111': { commitSha: '1111111', aiLines: 10, humanLines: 5, mixedLines: 0, unknownLines: 0, aiPercent: 67, modelIds: ['gpt-5'], toolNames: ['codex'] },
        '2222222': { commitSha: '2222222', aiLines: 5, humanLines: 8, mixedLines: 0, unknownLines: 0, aiPercent: 38, modelIds: ['gpt-5'], toolNames: ['codex'] },
      },
      byFileByCommit: {},
    },
    narrative: {
      schemaVersion: 1,
      generatedAtISO: '2026-03-12T10:00:00Z',
      state: 'ready',
      summary: 'The branch story is now anchored to concrete repo evidence.',
      confidence: 0.86,
      highlights: [],
      evidenceLinks: [
        { id: 'commit:1111111', kind: 'commit', label: 'Commit 1111111', commitSha: '1111111' },
        { id: 'file:src/app.tsx', kind: 'file', label: 'src/app.tsx', filePath: 'src/app.tsx' },
      ],
    },
    snapshots: [
      {
        id: 'snap-1',
        atISO: '2026-03-12T09:00:00Z',
        type: 'automatic',
        branch: 'feature/evidence-shell',
        headSha: '3333333',
        filesChanged: ['src/app.tsx'],
      },
    ],
    meta: {
      repoPath: '/Users/jamiecraik/dev/trace-narrative',
      branchName: 'feature/evidence-shell',
      headSha: '3333333',
      repoId: 1,
    },
    ...overrides,
  };
}

describe('RepoEvidenceOverview', () => {
  it('renders evidence-first summary metrics', () => {
    render(<RepoEvidenceOverview model={createModel()} />);

    expect(screen.getByText('Verify feature/evidence-shell through commits, files, sessions, and checkpoints.')).toBeInTheDocument();
    expect(screen.getByText('Workspace continues below')).toBeInTheDocument();
    expect(screen.getByText('Claim support')).toBeInTheDocument();
    expect(screen.getByText('2 links')).toBeInTheDocument();
    expect(screen.getByText('1 linked')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('routes action cards into supporting verification lanes', () => {
    const onModeChange = vi.fn();
    render(<RepoEvidenceOverview model={createModel()} onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole('button', { name: /review trust posture/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolve session joins/i }));
    fireEvent.click(screen.getByRole('button', { name: /compare checkpoints/i }));

    expect(onModeChange).toHaveBeenNthCalledWith(1, 'status');
    expect(onModeChange).toHaveBeenNthCalledWith(2, 'sessions');
    expect(onModeChange).toHaveBeenNthCalledWith(3, 'snapshots');
  });
});
