import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDb = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({
  getDb: mockGetDb,
}));

function createMockDb(inserted = true) {
  return {
    execute: vi.fn(async (sql: string) => {
      if (sql.includes('INSERT OR IGNORE INTO narrative_feedback_events')) {
        return { rowsAffected: inserted ? 1 : 0 };
      }
      return { rowsAffected: 0 };
    }),
    select: vi.fn(async (sql: string) => {
      if (sql.includes('SUM(CASE WHEN feedback_type = \'branch_missing_decision\'')) {
        return [{ missing_count: 0, total_count: 1, key_count: 1, wrong_count: 0 }];
      }
      if (sql.includes('GROUP BY target_id')) {
        return [{ target_id: 'highlight:h1', key_weight: 1, wrong_weight: 0 }];
      }
      if (sql.includes('FROM narrative_calibration_profiles')) {
        return [];
      }
      return [];
    }),
  };
}

describe('narrativeFeedback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates stable idempotency keys for the same minute bucket', async () => {
    const mod = await import('../narrativeFeedback');
    const key1 = mod.createFeedbackIdempotencyKey({
      repoId: 1,
      branchName: 'feature/narrative-loop',
      atISO: '2026-02-24T11:22:33.000Z',
      action: {
        actorRole: 'developer',
        feedbackType: 'highlight_key',
        targetKind: 'highlight',
        targetId: 'highlight:h1',
        detailLevel: 'summary',
      },
    });
    const key2 = mod.createFeedbackIdempotencyKey({
      repoId: 1,
      branchName: 'feature/narrative-loop',
      atISO: '2026-02-24T11:22:58.000Z',
      action: {
        actorRole: 'developer',
        feedbackType: 'highlight_key',
        targetKind: 'highlight',
        targetId: 'highlight:h1',
        detailLevel: 'summary',
      },
    });

    expect(key1).toBe(key2);
  });

  it('rejects highlight feedback with missing target id', async () => {
    mockGetDb.mockResolvedValue(createMockDb());
    const mod = await import('../narrativeFeedback');

    await expect(
      mod.submitNarrativeFeedback({
        repoId: 1,
        branchName: 'feature/narrative-loop',
        action: {
          actorRole: 'developer',
          feedbackType: 'highlight_key',
          targetKind: 'highlight',
          detailLevel: 'summary',
        },
      })
    ).rejects.toThrow('Highlight feedback requires a targetId.');
  });

  it('submits feedback and returns a recomputed calibration profile', async () => {
    const db = createMockDb(true);
    mockGetDb.mockResolvedValue(db);
    const mod = await import('../narrativeFeedback');

    const result = await mod.submitNarrativeFeedback({
      repoId: 1,
      branchName: 'feature/narrative-loop',
      atISO: '2026-02-24T12:00:00.000Z',
      action: {
        actorRole: 'reviewer',
        feedbackType: 'highlight_key',
        targetKind: 'highlight',
        targetId: 'highlight:h1',
        detailLevel: 'summary',
      },
    });

    expect(result.inserted).toBe(true);
    expect(result.profile.repoId).toBe(1);
    expect(result.profile.sampleCount).toBe(1);
    expect(result.profile.highlightAdjustments['highlight:h1']).toBeGreaterThan(0);
    expect(db.execute).toHaveBeenCalled();
  });

  it('treats duplicate writes as idempotent and does not inflate insert status', async () => {
    const db = createMockDb(false);
    mockGetDb.mockResolvedValue(db);
    const mod = await import('../narrativeFeedback');

    const result = await mod.submitNarrativeFeedback({
      repoId: 1,
      branchName: 'feature/narrative-loop',
      atISO: '2026-02-24T12:00:00.000Z',
      action: {
        actorRole: 'developer',
        feedbackType: 'highlight_key',
        targetKind: 'highlight',
        targetId: 'highlight:h1',
        detailLevel: 'summary',
      },
      idempotencyKey: 'narrative-feedback:1:feature/narrative-loop:developer:highlight_key:highlight:highlight:h1:2026-02-24T12:00',
    });

    expect(result.inserted).toBe(false);
    expect(result.profile.sampleCount).toBe(1);
  });

  it('retries transient persistence failures before succeeding', async () => {
    vi.useFakeTimers();

    let insertAttempts = 0;
    const baseDb = createMockDb(true);
    const db = {
      ...baseDb,
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('INSERT OR IGNORE INTO narrative_feedback_events')) {
          insertAttempts += 1;
          if (insertAttempts < 3) {
            throw new Error('database is locked');
          }
          return { rowsAffected: 1 };
        }
        return { rowsAffected: 0 };
      }),
    };
    mockGetDb.mockResolvedValue(db);
    const mod = await import('../narrativeFeedback');

    const submitPromise = mod.submitNarrativeFeedback({
      repoId: 1,
      branchName: 'feature/narrative-loop',
      atISO: '2026-02-24T12:00:00.000Z',
      action: {
        actorRole: 'developer',
        feedbackType: 'highlight_key',
        targetKind: 'highlight',
        targetId: 'highlight:h1',
        detailLevel: 'summary',
      },
    });

    await vi.runAllTimersAsync();
    const result = await submitPromise;
    vi.useRealTimers();

    expect(result.inserted).toBe(true);
    expect(insertAttempts).toBe(3);
  });
});
