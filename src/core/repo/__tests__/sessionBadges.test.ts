import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BranchViewModel, SessionExcerpt } from '../../types';
import type { SessionLink } from '../sessionLinking';
import { refreshSessionBadges } from '../sessionBadges';

const mockLoadSessionExcerpts = vi.hoisted(() => vi.fn());
const mockGetSessionLinksForCommit = vi.hoisted(() => vi.fn());

vi.mock('../sessions', () => ({
  loadSessionExcerpts: mockLoadSessionExcerpts,
}));

vi.mock('../sessionLinking', () => ({
  getSessionLinksForCommit: mockGetSessionLinksForCommit,
}));

function createModel(repoId: number): BranchViewModel {
  return {
    source: 'git',
    title: `repo-${repoId}`,
    status: 'open',
    description: '',
    stats: {
      added: 0,
      removed: 0,
      files: 1,
      commits: 1,
      prompts: 0,
      responses: 0,
    },
    intent: [],
    timeline: [{ id: 'c1', type: 'commit', label: 'Commit 1' }],
    meta: {
      repoId,
      repoPath: `/repo/${repoId}`,
      branchName: 'main',
      headSha: 'c1',
    },
  };
}

function createExcerpt(sessionId: string, tool: SessionExcerpt['tool']): SessionExcerpt {
  return {
    id: sessionId,
    tool,
    messages: [],
  };
}

function createLink(sessionId: string): SessionLink {
  return {
    id: 1,
    repoId: 1,
    sessionId,
    commitSha: 'c1',
    confidence: 0.8,
    autoLinked: true,
    createdAt: '2026-02-24T00:00:00Z',
  };
}

describe('refreshSessionBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSessionExcerpts.mockResolvedValue([]);
    mockGetSessionLinksForCommit.mockResolvedValue([]);
  });

  it('applies session badges for the active repository', async () => {
    let state = createModel(1);
    const setRepoState = (updater: (prev: BranchViewModel) => BranchViewModel) => {
      state = updater(state);
    };

    mockLoadSessionExcerpts.mockResolvedValue([createExcerpt('s1', 'codex')]);
    mockGetSessionLinksForCommit.mockResolvedValue([createLink('s1')]);

    await refreshSessionBadges('/repo/1', 1, [{ id: 'c1' }], setRepoState, { limit: 10 });

    expect(state.sessionExcerpts?.[0]?.id).toBe('s1');
    expect(state.timeline[0].badges?.some((badge) => badge.type === 'session')).toBe(true);
  });

  it('ignores stale badge updates when model belongs to a different repository', async () => {
    const initial = createModel(2);
    let state = initial;
    const setRepoState = (updater: (prev: BranchViewModel) => BranchViewModel) => {
      state = updater(state);
    };

    mockLoadSessionExcerpts.mockResolvedValue([createExcerpt('s1', 'codex')]);
    mockGetSessionLinksForCommit.mockResolvedValue([createLink('s1')]);

    await refreshSessionBadges('/repo/1', 1, [{ id: 'c1' }], setRepoState, { limit: 10 });

    expect(state).toBe(initial);
    expect(state.sessionExcerpts).toBeUndefined();
    expect(state.timeline[0].badges).toBeUndefined();
  });
});
