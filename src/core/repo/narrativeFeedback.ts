import { getDb } from './db';
import type {
  NarrativeCalibrationProfile,
  NarrativeFeedbackAction,
} from '../types';

const CALIBRATION_POLICY_VERSION = 'v1';
const TARGET_ID_REQUIRED = new Set(['highlight_key', 'highlight_wrong']);
const ALLOWED_ACTOR_ROLES = new Set(['developer', 'reviewer']);
const ALLOWED_FEEDBACK_TYPES = new Set([
  'highlight_key',
  'highlight_wrong',
  'branch_missing_decision',
]);
const ALLOWED_TARGET_KINDS = new Set(['highlight', 'branch']);
const MAX_INSERT_RETRIES = 2;
const RETRY_BACKOFF_MS = 40;
const DEFAULT_WINDOW_START_ISO = '1970-01-01T00:00:00.000Z';

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function isoNow(): string {
  return new Date().toISOString();
}

function resolveVerifiedActorRole(
  requestedRole: NarrativeFeedbackAction['actorRole']
): NarrativeFeedbackAction['actorRole'] {
  return requestedRole;
}

function addDays(iso: string, days: number): string {
  const base = new Date(iso);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientPersistenceError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('database is locked') ||
    message.includes('database is busy') ||
    message.includes('busy timeout') ||
    message.includes('temporarily unavailable')
  );
}

async function executeWithRetry(
  execute: (sql: string, bindValues?: unknown[]) => Promise<unknown>,
  sql: string,
  bindValues: unknown[]
): Promise<unknown> {
  let attempt = 0;
  let backoff = RETRY_BACKOFF_MS;

  while (true) {
    try {
      return await execute(sql, bindValues);
    } catch (error) {
      if (!isTransientPersistenceError(error) || attempt >= MAX_INSERT_RETRIES) {
        throw error;
      }
      await sleep(backoff);
      attempt += 1;
      backoff *= 2;
    }
  }
}

export function createFeedbackIdempotencyKey(args: {
  repoId: number;
  branchName?: string;
  action: NarrativeFeedbackAction;
  atISO?: string;
}): string {
  const atISO = args.atISO ?? isoNow();
  const minuteBucket = atISO.slice(0, 16);
  const targetId = args.action.targetId ?? args.action.targetKind;
  return [
    'narrative-feedback',
    String(args.repoId),
    args.branchName ?? 'unknown-branch',
    args.action.actorRole,
    args.action.feedbackType,
    args.action.targetKind,
    targetId,
    minuteBucket,
  ].join(':');
}

async function ensureNarrativeFeedbackSchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const db = await getDb();

    await db.execute(
      `CREATE TABLE IF NOT EXISTS narrative_feedback_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        branch_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        target_kind TEXT NOT NULL,
        target_id TEXT,
        detail_level TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(repo_id, idempotency_key),
        FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
      )`
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_narrative_feedback_repo_created ON narrative_feedback_events(repo_id, created_at)'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_narrative_feedback_repo_target_type ON narrative_feedback_events(repo_id, target_id, feedback_type)'
    );

    await db.execute(
      `CREATE TABLE IF NOT EXISTS narrative_calibration_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL UNIQUE,
        ranking_bias REAL NOT NULL DEFAULT 0,
        confidence_offset REAL NOT NULL DEFAULT 0,
        confidence_scale REAL NOT NULL DEFAULT 1,
        sample_count INTEGER NOT NULL DEFAULT 0,
        window_start TEXT,
        window_end TEXT,
        actor_weight_policy_version TEXT NOT NULL DEFAULT 'v1',
        branch_missing_decision_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        FOREIGN KEY(repo_id) REFERENCES repos(id) ON DELETE CASCADE
      )`
    );

    schemaReady = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

type HighlightAggregateRow = {
  target_id: string | null;
  key_weight: number | null;
  wrong_weight: number | null;
};

type FeedbackTotalRow = {
  missing_count: number | null;
  total_count: number | null;
  key_count: number | null;
  wrong_count: number | null;
};

type CalibrationProfileRow = {
  repo_id: number;
  ranking_bias: number;
  confidence_offset: number;
  confidence_scale: number;
  sample_count: number;
  window_start: string | null;
  window_end: string | null;
  actor_weight_policy_version: string;
  branch_missing_decision_count: number;
  updated_at: string;
};

type FeedbackInsertResult = {
  rowsAffected?: number;
};

async function loadHighlightAdjustments(
  repoId: number,
  windowStartISO?: string
): Promise<Record<string, number>> {
  const db = await getDb();
  const effectiveWindowStartISO = windowStartISO ?? DEFAULT_WINDOW_START_ISO;
  const rows = await db.select<HighlightAggregateRow[]>(
    `SELECT
      target_id,
      SUM(CASE
        WHEN feedback_type = 'highlight_key' THEN (CASE WHEN actor_role = 'reviewer' THEN 1.2 ELSE 1.0 END)
        ELSE 0
      END) AS key_weight,
      SUM(CASE
        WHEN feedback_type = 'highlight_wrong' THEN (CASE WHEN actor_role = 'reviewer' THEN 1.2 ELSE 1.0 END)
        ELSE 0
      END) AS wrong_weight
    FROM narrative_feedback_events
    WHERE repo_id = $1
      AND created_at >= $2
      AND target_kind = 'highlight'
      AND target_id IS NOT NULL
    GROUP BY target_id`,
    [repoId, effectiveWindowStartISO]
  );

  const adjustments: Record<string, number> = {};
  for (const row of rows) {
    if (!row.target_id) continue;
    const keyWeight = Number(row.key_weight ?? 0);
    const wrongWeight = Number(row.wrong_weight ?? 0);
    adjustments[row.target_id] = round(clamp((keyWeight - wrongWeight) * 0.03, -0.15, 0.15));
  }

  return adjustments;
}

async function recomputeCalibrationProfile(repoId: number): Promise<NarrativeCalibrationProfile> {
  const db = await getDb();
  const windowEndISO = isoNow();
  const windowStartISO = addDays(windowEndISO, -30);

  const totalRows = await db.select<FeedbackTotalRow[]>(
    `SELECT
      SUM(CASE WHEN feedback_type = 'branch_missing_decision' THEN 1 ELSE 0 END) AS missing_count,
      COUNT(*) AS total_count,
      SUM(CASE WHEN feedback_type = 'highlight_key' THEN 1 ELSE 0 END) AS key_count,
      SUM(CASE WHEN feedback_type = 'highlight_wrong' THEN 1 ELSE 0 END) AS wrong_count
    FROM narrative_feedback_events
    WHERE repo_id = $1
      AND created_at >= $2`,
    [repoId, windowStartISO]
  );

  const totals = totalRows[0] ?? {
    missing_count: 0,
    total_count: 0,
    key_count: 0,
    wrong_count: 0,
  };

  const missingCount = Number(totals.missing_count ?? 0);
  const keyCount = Number(totals.key_count ?? 0);
  const wrongCount = Number(totals.wrong_count ?? 0);
  const sampleCount = Number(totals.total_count ?? 0);
  const effectiveTotal = Math.max(1, keyCount + wrongCount + missingCount);

  const rankingBias = round(
    clamp(((keyCount - wrongCount) / Math.max(1, keyCount + wrongCount)) * 0.12, -0.15, 0.15)
  );
  const confidenceOffset = round(
    clamp(((keyCount - wrongCount) / effectiveTotal) * 0.1 - Math.min(0.08, missingCount * 0.01), -0.12, 0.12)
  );
  const confidenceScale = round(clamp(1 + rankingBias * 0.25, 0.9, 1.1));

  await db.execute(
    `INSERT INTO narrative_calibration_profiles (
      repo_id,
      ranking_bias,
      confidence_offset,
      confidence_scale,
      sample_count,
      window_start,
      window_end,
      actor_weight_policy_version,
      branch_missing_decision_count,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT(repo_id) DO UPDATE SET
      ranking_bias = excluded.ranking_bias,
      confidence_offset = excluded.confidence_offset,
      confidence_scale = excluded.confidence_scale,
      sample_count = excluded.sample_count,
      window_start = excluded.window_start,
      window_end = excluded.window_end,
      actor_weight_policy_version = excluded.actor_weight_policy_version,
      branch_missing_decision_count = excluded.branch_missing_decision_count,
      updated_at = excluded.updated_at`,
    [
      repoId,
      rankingBias,
      confidenceOffset,
      confidenceScale,
      sampleCount,
      windowStartISO,
      windowEndISO,
      CALIBRATION_POLICY_VERSION,
      missingCount,
      windowEndISO,
    ]
  );

  const highlightAdjustments = await loadHighlightAdjustments(repoId, windowStartISO);

  return {
    repoId,
    rankingBias,
    confidenceOffset,
    confidenceScale,
    sampleCount,
    windowStartISO,
    windowEndISO,
    actorWeightPolicyVersion: CALIBRATION_POLICY_VERSION,
    branchMissingDecisionCount: missingCount,
    highlightAdjustments,
    updatedAtISO: windowEndISO,
  };
}

export type SubmitNarrativeFeedbackInput = {
  repoId: number;
  branchName?: string;
  action: NarrativeFeedbackAction;
  idempotencyKey?: string;
  atISO?: string;
};

export type SubmitNarrativeFeedbackResult = {
  inserted: boolean;
  idempotencyKey: string;
  verifiedActorRole: NarrativeFeedbackAction['actorRole'];
  profile: NarrativeCalibrationProfile;
};

export async function submitNarrativeFeedback(
  input: SubmitNarrativeFeedbackInput
): Promise<SubmitNarrativeFeedbackResult> {
  await ensureNarrativeFeedbackSchema();

  if (!Number.isFinite(input.repoId) || input.repoId <= 0) {
    throw new Error('Narrative feedback requires a valid repoId.');
  }

  if (TARGET_ID_REQUIRED.has(input.action.feedbackType) && !input.action.targetId) {
    throw new Error('Highlight feedback requires a targetId.');
  }

  if (!ALLOWED_ACTOR_ROLES.has(input.action.actorRole)) {
    throw new Error('Narrative feedback actor role is invalid.');
  }

  if (!ALLOWED_FEEDBACK_TYPES.has(input.action.feedbackType)) {
    throw new Error('Narrative feedback type is invalid.');
  }

  if (!ALLOWED_TARGET_KINDS.has(input.action.targetKind)) {
    throw new Error('Narrative feedback target kind is invalid.');
  }

  if (input.action.feedbackType === 'branch_missing_decision' && input.action.targetKind !== 'branch') {
    throw new Error('Branch feedback must target kind "branch".');
  }

  const verifiedActorRole = resolveVerifiedActorRole(input.action.actorRole);
  const verifiedAction: NarrativeFeedbackAction = {
    ...input.action,
    actorRole: verifiedActorRole,
  };

  const atISO = input.atISO ?? isoNow();
  const idempotencyKey =
    input.idempotencyKey ??
    createFeedbackIdempotencyKey({
      repoId: input.repoId,
      branchName: input.branchName,
      action: verifiedAction,
      atISO,
    });

  const db = await getDb();
  const insertResult = (await executeWithRetry(
    db.execute.bind(db),
    `INSERT OR IGNORE INTO narrative_feedback_events (
      repo_id,
      branch_name,
      actor_role,
      feedback_type,
      target_kind,
      target_id,
      detail_level,
      idempotency_key,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.repoId,
      input.branchName ?? 'unknown-branch',
      verifiedAction.actorRole,
      verifiedAction.feedbackType,
      verifiedAction.targetKind,
      verifiedAction.targetId ?? null,
      verifiedAction.detailLevel,
      idempotencyKey,
      atISO,
    ],
  )) as FeedbackInsertResult;

  const inserted = Number(insertResult.rowsAffected ?? 0) > 0;
  const profile = await recomputeCalibrationProfile(input.repoId);

  return {
    inserted,
    idempotencyKey,
    verifiedActorRole,
    profile,
  };
}

export async function getNarrativeCalibrationProfile(
  repoId: number
): Promise<NarrativeCalibrationProfile | null> {
  await ensureNarrativeFeedbackSchema();

  if (!Number.isFinite(repoId) || repoId <= 0) return null;

  const db = await getDb();
  const rows = await db.select<CalibrationProfileRow[]>(
    `SELECT
      repo_id,
      ranking_bias,
      confidence_offset,
      confidence_scale,
      sample_count,
      window_start,
      window_end,
      actor_weight_policy_version,
      branch_missing_decision_count,
      updated_at
    FROM narrative_calibration_profiles
    WHERE repo_id = $1
    LIMIT 1`,
    [repoId]
  );

  if (!rows[0]) return null;

  const row = rows[0];
  const highlightAdjustments = await loadHighlightAdjustments(repoId, row.window_start ?? undefined);

  return {
    repoId: row.repo_id,
    rankingBias: Number(row.ranking_bias ?? 0),
    confidenceOffset: Number(row.confidence_offset ?? 0),
    confidenceScale: Number(row.confidence_scale ?? 1),
    sampleCount: Number(row.sample_count ?? 0),
    windowStartISO: row.window_start ?? undefined,
    windowEndISO: row.window_end ?? undefined,
    actorWeightPolicyVersion: row.actor_weight_policy_version ?? CALIBRATION_POLICY_VERSION,
    branchMissingDecisionCount: Number(row.branch_missing_decision_count ?? 0),
    highlightAdjustments,
    updatedAtISO: row.updated_at,
  };
}
