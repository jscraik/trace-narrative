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
  summary: 150,
  header: 200,
  narrative: 250,
  details: 300,
  intents: 350,
  files: 400,
  rightPanel: 450,
  timeline: 500,
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
