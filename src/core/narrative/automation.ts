import type { BranchViewModel } from '../types';

export type DriftDeltaMetricId = 'uncommitted_files' | 'uncommitted_churn' | 'snapshot_staleness';

export type DriftDeltaMetric = {
  id: DriftDeltaMetricId;
  label: string;
  value: number;
  threshold: number;
  status: 'ok' | 'warn' | 'critical';
  rationale: string;
};

export type DriftReport = {
  status: 'healthy' | 'watch' | 'critical';
  metrics: DriftDeltaMetric[];
  generatedAtISO: string;
};

/**
 * Automation Engine: Evaluates the "Drift Delta" between the last verified narrative/snapshot 
 * and the current workspace state.
 */
export function evaluateDriftDelta(model: BranchViewModel): DriftReport {
  const metrics: DriftDeltaMetric[] = [];
  
  // 1. Uncommitted files count (Direct signal of workspace drift)
  const dirtyFiles = model.dirtyFiles
    ?? model.filesChanged?.map((fileChange) => fileChange.path)
    ?? [];
  const dirtyFileCount = dirtyFiles.length;
  metrics.push({
    id: 'uncommitted_files',
    label: 'Uncommitted files',
    value: dirtyFileCount,
    threshold: 10,
    status: dirtyFileCount > 20 ? 'critical' : dirtyFileCount > 10 ? 'warn' : 'ok',
    rationale: dirtyFileCount > 10 
      ? `Large number of uncommitted files (${dirtyFileCount}) triggers high drift alert.`
      : 'Clean workspace or small delta relative to head.'
  });

  // 2. Uncommitted churn (Lines of code changed in workspace)
  const totalLines = model.dirtyChurnLines ?? countDiffLines(model.diffsByFile);
  
  metrics.push({
    id: 'uncommitted_churn',
    label: 'Uncommitted churn',
    value: totalLines,
    threshold: 500,
    status: totalLines > 1000 ? 'critical' : totalLines > 500 ? 'warn' : 'ok',
    rationale: totalLines > 500
      ? `High churn delta (${totalLines} lines) detected; narrative accuracy may be degraded.`
      : 'Churn delta is within healthy operational bounds.'
  });

  // 3. Snapshot staleness (Time since last checkpoint)
  const latestSnapshot = model.snapshots?.[0]; // snapshots are sorted by date desc in listSnapshots
  let stalenessHours = 0;
  if (latestSnapshot) {
    const lastTime = new Date(latestSnapshot.atISO).getTime();
    const now = Date.now();
    stalenessHours = (now - lastTime) / (1000 * 60 * 60);
  } else if (dirtyFileCount > 0) {
    // If dirty files exist but no snapshots, mark as stale
    stalenessHours = 24; 
  }

  metrics.push({
    id: 'snapshot_staleness',
    label: 'Snapshot staleness',
    value: Math.round(stalenessHours * 10) / 10,
    threshold: 4,
    status: stalenessHours > 12 ? 'critical' : stalenessHours > 4 ? 'warn' : 'ok',
    rationale: stalenessHours > 4
      ? `Workspace is drifting without a fresh checkpoint (last seen ${Math.round(stalenessHours)}h ago).`
      : 'Checkpoints are frequent enough to maintain a reliable recovery path.'
  });

  const hasCritical = metrics.some(m => m.status === 'critical');
  const hasWarn = metrics.some(m => m.status === 'warn');

  return {
    status: hasCritical ? 'critical' : hasWarn ? 'watch' : 'healthy',
    metrics,
    generatedAtISO: new Date().toISOString()
  };
}

function countDiffLines(diffsByFile: BranchViewModel['diffsByFile']): number {
  if (!diffsByFile) return 0;

  let totalLines = 0;
  Object.values(diffsByFile).forEach((diff) => {
    const lines = diff.split('\n');
    lines.forEach((line) => {
      if ((line.startsWith('+') || line.startsWith('-'))
        && !line.startsWith('+++')
        && !line.startsWith('---')) {
        totalLines++;
      }
    });
  });
  return totalLines;
}
