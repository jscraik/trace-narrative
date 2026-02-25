/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * Read top-to-bottom. Each `at` value is ms after trigger.
 *
 *    0ms   waiting for trigger
 *  100ms   summary bar appears
 *  180ms   branch header appears
 *  260ms   narrative panel appears
 *  340ms   details (governance, etc) appear
 *  420ms   intents appear
 *  500ms   files changed appears
 *  580ms   right panel tabs appear
 *  660ms   timeline appears
 * ───────────────────────────────────────────────────────── */
export const TIMING = {
  summary: 100,
  header: 180,
  narrative: 260,
  details: 340,
  intents: 420,
  files: 500,
  rightPanel: 580,
  timeline: 660,
};

export const PANEL = {
  initialY: 8,
  finalY: 0,
  spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

export function createNarrativeViewInstanceId(repoId: number, branchName?: string): string {
  return [
    String(repoId),
    branchName ?? 'unknown-branch',
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 8),
  ].join(':');
}
