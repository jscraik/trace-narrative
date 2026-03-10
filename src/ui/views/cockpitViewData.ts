import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { DataAuthorityTier, Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import { describeCockpitTrust, deriveCockpitTrustState } from './dashboardState';

export type CockpitMode = Exclude<Mode, 'dashboard' | 'repo' | 'docs'>;

export type CockpitTone = 'blue' | 'violet' | 'green' | 'amber' | 'red' | 'slate';

export type CockpitAuthorityCue = {
  authorityTier: DataAuthorityTier;
  authorityLabel: string;
};

export interface CockpitMetric {
  label: string;
  value: string;
  detail: string;
  tone: CockpitTone;
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
}

export interface CockpitHighlight {
  eyebrow: string;
  title: string;
  body: string;
  tone: CockpitTone;
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
}

export interface CockpitActivityItem {
  title: string;
  meta: string;
  detail: string;
  status: 'ok' | 'warn' | 'critical' | 'info';
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
}

export interface CockpitTableRow {
  primary: string;
  secondary: string;
  tertiary: string;
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
}

export interface CockpitViewModel {
  mode: CockpitMode;
  section: string;
  title: string;
  subtitle: string;
  heroTitle: string;
  heroBody: string;
  heroAuthorityTier: DataAuthorityTier;
  heroAuthorityLabel: string;
  trustState: 'healthy' | 'degraded';
  metrics: Array<CockpitMetric & CockpitAuthorityCue>;
  highlightsTitle: string;
  highlights: Array<CockpitHighlight & CockpitAuthorityCue>;
  activityTitle: string;
  activity: Array<CockpitActivityItem & CockpitAuthorityCue>;
  tableTitle: string;
  tableColumns: [string, string, string];
  tableRows: Array<CockpitTableRow & CockpitAuthorityCue>;
  footerNote: string;
}

interface CockpitContext {
  repoName: string;
  repoPath: string;
  commitCount: number;
  sessionCount: number;
  hasLiveRepoData: boolean;
  captureReliabilityMode: string;
  trustState: 'healthy' | 'degraded';
  trustLabel: string;
  trustAuthority: CockpitAuthorityCue;
}

const FALLBACK_AUTHORITY: CockpitAuthorityCue = {
  authorityTier: 'static_scaffold',
  authorityLabel: 'Cockpit static scaffold',
};

const LOCAL_REPO_AUTHORITY: CockpitAuthorityCue = {
  authorityTier: 'derived_summary',
  authorityLabel: 'Derived from local repo state',
};

const LIVE_CAPTURE_AUTHORITY: CockpitAuthorityCue = {
  authorityTier: 'live_capture',
  authorityLabel: 'Live capture reliability diagnostics',
};

const OTEL_ONLY_AUTHORITY: CockpitAuthorityCue = {
  authorityTier: 'derived_summary',
  authorityLabel: 'Derived from baseline OTEL-only telemetry',
};

function inferCaptureAuthority(
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
): CockpitAuthorityCue {
  if (!captureReliabilityStatus) {
    return LOCAL_REPO_AUTHORITY;
  }

  if (captureReliabilityStatus.mode === 'OTEL_ONLY') {
    const trustState = deriveCockpitTrustState(captureReliabilityStatus);
    return {
      ...OTEL_ONLY_AUTHORITY,
      authorityLabel:
        trustState === 'healthy'
          ? OTEL_ONLY_AUTHORITY.authorityLabel
          : 'Derived from degraded OTEL-only baseline',
    };
  }

  return {
    ...LIVE_CAPTURE_AUTHORITY,
    authorityLabel: `Captured from ${captureReliabilityStatus.mode.toLowerCase()}`,
  };
}

type CockpitAuthoritySeed = {
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
};

function normalizeAuthority<T extends CockpitAuthoritySeed>(
  item: T,
  fallback: CockpitAuthorityCue,
): T & CockpitAuthorityCue {
  return {
    ...item,
    authorityTier: item.authorityTier ?? fallback.authorityTier,
    authorityLabel: item.authorityLabel ?? fallback.authorityLabel,
  };
}

function inferAuthorityFromText(
  text: string,
  context: CockpitContext,
): CockpitAuthorityCue {
  const lowered = text.toLowerCase();
  if (lowered.includes('capture') || lowered.includes('trust') || lowered.includes('stream')) {
    if (context.captureReliabilityMode === 'OTEL_ONLY') {
      return { ...OTEL_ONLY_AUTHORITY };
    }

    return { ...LIVE_CAPTURE_AUTHORITY };
  }

  if (
    lowered.includes('repo') ||
    lowered.includes('session') ||
    lowered.includes('commit') ||
    lowered.includes('file') ||
    lowered.includes('branch') ||
    lowered.includes('path')
  ) {
    return {
      authorityTier: context.hasLiveRepoData ? 'live_repo' : 'derived_summary',
      authorityLabel: context.hasLiveRepoData ? 'Derived from selected repo state' : 'Derived summary context',
    };
  }

  return { ...FALLBACK_AUTHORITY };
}

function normalizeMetric(
  metric: CockpitMetric,
  context: CockpitContext,
): CockpitMetric & CockpitAuthorityCue {
  return normalizeAuthority(
    metric,
    inferAuthorityFromText(`${metric.label} ${metric.detail} ${metric.value}`, context),
  );
}

function normalizeHighlight(
  highlight: CockpitHighlight,
  context: CockpitContext,
): CockpitHighlight & CockpitAuthorityCue {
  return normalizeAuthority(
    highlight,
    inferAuthorityFromText(`${highlight.eyebrow} ${highlight.title} ${highlight.body}`, context),
  );
}

function normalizeActivityItem(
  activity: CockpitActivityItem,
  context: CockpitContext,
): CockpitActivityItem & CockpitAuthorityCue {
  return normalizeAuthority(
    activity,
    inferAuthorityFromText(`${activity.title} ${activity.meta} ${activity.detail}`, context),
  );
}

function normalizeTableRow(
  row: CockpitTableRow,
  context: CockpitContext,
): CockpitTableRow & CockpitAuthorityCue {
  return normalizeAuthority(
    row,
    inferAuthorityFromText(`${row.primary} ${row.secondary} ${row.tertiary}`, context),
  );
}

type CockpitDefinition = {
  section: string;
  title: string;
  subtitle: string;
  heroTitle: (context: CockpitContext) => string;
  heroBody: (context: CockpitContext) => string;
  metrics: (context: CockpitContext) => CockpitMetric[];
  highlightsTitle: string;
  highlights: (context: CockpitContext) => CockpitHighlight[];
  activityTitle: string;
  activity: (context: CockpitContext) => CockpitActivityItem[];
  tableTitle: string;
  tableColumns: [string, string, string];
  tableRows: (context: CockpitContext) => CockpitTableRow[];
  footerNote: (context: CockpitContext) => string;
};

function getRepoName(repoState: RepoState): string {
  if (repoState.status !== 'ready') return 'Trace Narrative workspace';
  const parts = repoState.repo.root.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : repoState.repo.root;
}

function getRepoPath(repoState: RepoState): string {
  if (repoState.status === 'ready') return repoState.repo.root;
  if (repoState.status === 'loading' || repoState.status === 'error') {
    return repoState.path ?? '~/dev/trace-narrative';
  }
  return '~/dev/trace-narrative';
}

function buildContext(
  repoState: RepoState,
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
): CockpitContext {
  const commitCount = repoState.status === 'ready' ? Math.max(repoState.model.timeline.length, 1) : 47;
  const sessionCount =
    repoState.status === 'ready'
      ? Math.max(repoState.model.sessionExcerpts?.length ?? 0, 3)
      : 12;
  const trust = describeCockpitTrust(captureReliabilityStatus);
  const hasLiveRepoData = repoState.status === 'ready';

  return {
    repoName: getRepoName(repoState),
    repoPath: getRepoPath(repoState),
    commitCount,
    sessionCount,
    hasLiveRepoData,
    captureReliabilityMode: captureReliabilityStatus?.mode ?? trust.reliabilityMode,
    trustState: trust.trustState,
    trustLabel: trust.trustLabel,
    trustAuthority: captureReliabilityStatus
      ? inferCaptureAuthority(captureReliabilityStatus)
      : LOCAL_REPO_AUTHORITY,
  };
}

const cockpitDefinitions: Record<CockpitMode, CockpitDefinition> = {
  'work-graph': {
    section: 'Overview',
    title: 'Work Graph',
    subtitle: 'Cross-repo activity patterns, dormant branches, and operational hotspots.',
    heroTitle: (context) => `See where ${context.repoName} fits inside the wider workspace graph.`,
    heroBody: (_context) =>
      'This view maps active repos, sleeping branches, and attention clusters so the workspace feels readable at a glance instead of buried in lists.',
    metrics: (context) => [
      { label: 'Active repos', value: '8', detail: '4 pushed in the last 24h', tone: 'blue' },
      { label: 'Dormant lanes', value: '3', detail: 'Need explicit follow-up', tone: 'amber' },
      { label: 'Linked stories', value: `${context.commitCount}`, detail: 'Commits represented in graph', tone: 'violet' },
      { label: 'Trust posture', value: context.trustState === 'healthy' ? 'Stable' : 'Review', detail: context.trustLabel, tone: context.trustState === 'healthy' ? 'green' : 'amber' },
    ],
    highlightsTitle: 'Graph lenses',
    highlights: () => [
      { eyebrow: 'Hot path', title: 'Launch + telemetry cluster', body: 'Multiple recent branches converge on dashboard, telemetry, and rollout verification surfaces.', tone: 'violet' },
      { eyebrow: 'Dormant risk', title: 'Spec drift on older plans', body: 'Older planning artifacts are aging faster than implementation notes. Treat them as archival until revalidated.', tone: 'amber' },
      { eyebrow: 'Narrative moat', title: 'Trace-first provenance lane', body: 'Keep explainability and evidence trails visible at the graph level so this view feels more trustworthy than a generic activity chart.', tone: 'blue' },
    ],
    activityTitle: 'Recent graph movements',
    activity: (context) => [
      { title: 'trace-narrative', meta: 'now', detail: `${context.commitCount} commits contribute to the active story loop`, status: 'ok' },
      { title: 'coding-harness', meta: '42m ago', detail: 'Environment gate cleared after rollout evidence refresh', status: 'info' },
      { title: 'config/codex', meta: '1h ago', detail: 'Automation governance changes touched multiple operator surfaces', status: 'warn' },
      { title: 'otel-collector', meta: '2h ago', detail: 'Telemetry hardening remains a shared dependency for trust-heavy views', status: 'info' },
    ],
    tableTitle: 'Repos needing attention',
    tableColumns: ['Repository', 'Pressure', 'Next move'],
    tableRows: () => [
      { primary: 'trace-narrative', secondary: 'UI scope expanded', tertiary: 'Promote cockpit routing and validate nav clarity' },
      { primary: 'coding-harness', secondary: 'Rollout gates hot', tertiary: 'Keep artifact generation deterministic' },
      { primary: 'config/codex', secondary: 'Automation overlap', tertiary: 'Watch for guardrail drift and duplicate jobs' },
      { primary: 'otel-collector', secondary: 'Reliability dependency', tertiary: 'Protect stats-first diagnostics and cap-aware summaries' },
    ],
    footerNote: () => 'Recommended next step: use this page as the workspace triage entry point, then drop into repo mode for deep narrative evidence.',
  },
  assistant: {
    section: 'Overview',
    title: 'Assistant',
    subtitle: 'A guided operator copilot for repos, sessions, costs, and hygiene.',
    heroTitle: (context) => `Turn ${context.repoName} into a promptable control surface.`,
    heroBody: () =>
      'This assistant works as an orchestration layer, not a toy chat box. It emphasizes suggested asks, context packs, and safe action framing.',
    metrics: (context) => [
      { label: 'Context packs', value: '6', detail: 'Repo, session, cost, hooks, hygiene, docs', tone: 'blue' },
      { label: 'Live providers', value: '3', detail: 'Codex, Claude, Kimi ready for routing', tone: 'violet' },
      { label: 'Action guards', value: 'Fail-closed', detail: 'Recommend before acting', tone: 'green' },
      { label: 'Repo scope', value: context.repoName, detail: 'Primary active workspace', tone: 'slate' },
    ],
    highlightsTitle: 'Suggested asks',
    highlights: (context) => [
      { eyebrow: 'Explain', title: 'Why did this branch change?', body: `Bridge from cockpit context into ${context.repoName}'s narrative evidence and linked sessions.`, tone: 'violet' },
      { eyebrow: 'Triage', title: 'What needs attention today?', body: 'Use workspace health, cost drift, and recent activity to recommend the next operator move.', tone: 'blue' },
      { eyebrow: 'Protect', title: 'What is risky to clean up?', body: 'Make cleanup suggestions explicit about blast radius, rollback posture, and hidden dependencies.', tone: 'amber' },
    ],
    activityTitle: 'Conversation starters',
    activity: () => [
      { title: 'Ask about repo drift', meta: 'Prompt', detail: 'Summarize the biggest deltas between the current app shell and the intended cockpit flow.', status: 'info' },
      { title: 'Review telemetry health', meta: 'Prompt', detail: 'Explain why capture is degraded and which views are affected.', status: 'warn' },
      { title: 'Plan the next polish pass', meta: 'Prompt', detail: 'Recommend the highest-value cockpit sections to connect to real data.', status: 'ok' },
      { title: 'Simulate cleanup', meta: 'Prompt', detail: 'Preview safe remediation steps for worktrees, deps, and stale sessions.', status: 'info' },
    ],
    tableTitle: 'Available context sources',
    tableColumns: ['Source', 'Role', 'Why it matters'],
    tableRows: () => [
      { primary: 'Repo narrative', secondary: 'Ground truth', tertiary: 'Explains what changed and why' },
      { primary: 'Session excerpts', secondary: 'Operator memory', tertiary: 'Adds model and tool context to changes' },
      { primary: 'Dashboard stats', secondary: 'Signal layer', tertiary: 'Summarizes activity, costs, and attribution' },
      { primary: 'Health checks', secondary: 'Guardrail layer', tertiary: 'Prevents confident but unsafe suggestions' },
    ],
    footerNote: () => 'Recommendation: keep the assistant opinionated and context-rich, not an unbounded general chat surface.',
  },
  live: {
    section: 'Monitor',
    title: 'Live',
    subtitle: 'Active agent sessions, capture reliability, and current operator load.',
    heroTitle: () => 'Watch the workspace while it is still changing.',
    heroBody: (context) =>
      `This live surface is designed to be ambient and useful, while keeping the signal anchored to reliability and reviewability for ${context.repoName}.`,
    metrics: (context) => [
      { label: 'Active sessions', value: `${context.sessionCount}`, detail: 'Across connected agent tools', tone: 'green' },
      { label: 'Stale sessions', value: '2', detail: 'Candidates for cleanup or reconnection', tone: 'amber' },
      { label: 'Capture mode', value: context.trustState === 'healthy' ? 'Hybrid' : 'Degraded', detail: context.trustLabel, tone: context.trustState === 'healthy' ? 'blue' : 'amber' },
      { label: 'Action latency', value: '<100ms', detail: 'Interaction acknowledgement target', tone: 'violet' },
    ],
    highlightsTitle: 'Live monitors',
    highlights: () => [
      { eyebrow: 'Sessions', title: 'Agent activity strip', body: 'Show current sessions, stale age, memory pressure, and whether logs are still ingesting.', tone: 'green' },
      { eyebrow: 'Reliability', title: 'Capture trust rail', body: 'Keep degraded capture visible in the header and in row-level status so the operator never assumes perfect truth.', tone: 'amber' },
      { eyebrow: 'Intervention', title: 'Human override point', body: 'The view should recommend when to reopen a repo, re-import, or run a smoke check instead of silently failing.', tone: 'blue' },
    ],
    activityTitle: 'Current stream',
    activity: () => [
      { title: 'Codex session importing', meta: '14s ago', detail: 'New transcript linked to the active branch', status: 'ok' },
      { title: 'Collector retry requested', meta: '31s ago', detail: 'OTEL backoff budget consumed once', status: 'warn' },
      { title: 'Repo index stable', meta: '2m ago', detail: 'No re-scan required for current dashboard slice', status: 'info' },
      { title: 'Cleanup suggestion deferred', meta: '5m ago', detail: 'Stale process candidate requires explicit user action', status: 'critical' },
    ],
    tableTitle: 'Live lanes',
    tableColumns: ['Lane', 'State', 'Operator note'],
    tableRows: () => [
      { primary: 'Codex', secondary: 'Streaming', tertiary: 'Transcript + tool events still updating' },
      { primary: 'Claude', secondary: 'Quiet', tertiary: 'No new events in the last 10 minutes' },
      { primary: 'Kimi', secondary: 'Imported only', tertiary: 'Available for history, not live capture' },
      { primary: 'OTEL receiver', secondary: 'Watching', tertiary: 'Ready to surface stale/drop reasons' },
    ],
    footerNote: () => 'This page should feel ambient and calm: quick to scan, explicit about trust, and never noisy for the sake of motion.',
  },
  sessions: {
    section: 'Monitor',
    title: 'Sessions',
    subtitle: 'Recent AI sessions, linked commits, and conversation health.',
    heroTitle: (context) => `Browse session history without leaving ${context.repoName}.`,
    heroBody: () =>
      'Session history deserves a dedicated operational index, not just excerpts buried inside repo mode. This view makes those histories first-class.',
    metrics: (context) => [
      { label: 'Saved sessions', value: `${context.sessionCount}`, detail: 'Imported and linked where possible', tone: 'blue' },
      { label: 'Auto-linked', value: '68%', detail: 'Commit association confidence', tone: 'violet' },
      { label: 'Needs review', value: '4', detail: 'Manual confirmation recommended', tone: 'amber' },
      { label: 'Primary model', value: 'GPT-5', detail: 'Most recent session mix', tone: 'green' },
    ],
    highlightsTitle: 'Session lenses',
    highlights: () => [
      { eyebrow: 'Searchable', title: 'Fast transcript lookup', body: 'Prioritize filters for agent, repo, recency, and linked commit confidence.', tone: 'blue' },
      { eyebrow: 'Trust-aware', title: 'Low-confidence links stay obvious', body: 'Expose why a session is linked and when the evidence is incomplete.', tone: 'amber' },
      { eyebrow: 'Actionable', title: 'Session-to-repo bridge', body: 'One click should move from a session summary into the exact repo narrative context.', tone: 'violet' },
    ],
    activityTitle: 'Recent sessions',
    activity: () => [
      { title: 'Implement dashboard v3 contract', meta: 'Codex · 28m', detail: 'Linked to active dashboard branch with high confidence', status: 'ok' },
      { title: 'Audit rollout artifacts', meta: 'Claude · 41m', detail: 'Follow-up required on evidence packaging', status: 'warn' },
      { title: 'Trace ingestion validation', meta: 'Codex · 9m', detail: 'Imported but awaiting branch confirmation', status: 'info' },
      { title: 'Spec deepening loop', meta: 'Kimi · 52m', detail: 'Historical context only, no auto-link applied', status: 'info' },
    ],
    tableTitle: 'Session queues',
    tableColumns: ['Session', 'Link state', 'Next step'],
    tableRows: () => [
      { primary: 'dashboard-v3-plan', secondary: 'Linked', tertiary: 'Open repo evidence' },
      { primary: 'rollout-gates-review', secondary: 'Needs review', tertiary: 'Validate commit association' },
      { primary: 'telemetry-hardening', secondary: 'Linked', tertiary: 'Check capture confidence' },
      { primary: 'cost-anomaly-scan', secondary: 'Imported', tertiary: 'Route into costs cockpit' },
    ],
    footerNote: () => 'Sessions should read like reviewable narrative evidence, not just log storage.',
  },
  transcripts: {
    section: 'Monitor',
    title: 'Transcripts',
    subtitle: 'Indexed conversation search across imported sessions and commits.',
    heroTitle: () => 'Search the conversation layer directly.',
    heroBody: () =>
      'This surface focuses on precise lookup, quoted matches, and fast jumps into the surrounding repo or session context.',
    metrics: () => [
      { label: 'Indexed transcripts', value: '128', detail: 'Across local agent tools', tone: 'blue' },
      { label: 'Quoted matches', value: '19', detail: 'In the current filter set', tone: 'violet' },
      { label: 'Redactions applied', value: '7', detail: 'Unsafe content hidden before render', tone: 'green' },
      { label: 'Search freshness', value: 'Live', detail: 'Indexes refresh after import', tone: 'slate' },
    ],
    highlightsTitle: 'Search patterns',
    highlights: () => [
      { eyebrow: 'Query', title: 'Find why a file changed', body: 'Search by symbol, branch name, or intent phrase, then pivot into the linked commit narrative.', tone: 'violet' },
      { eyebrow: 'Review', title: 'Spot unsafe assumptions', body: 'Surface transcripts with high tool usage or low-confidence links for manual review.', tone: 'amber' },
      { eyebrow: 'Trace', title: 'Follow a decision', body: 'Jump from a quoted answer to the exact file, diff, and evidence trail.', tone: 'blue' },
    ],
    activityTitle: 'Search examples',
    activity: () => [
      { title: '“why this changed”', meta: '12 matches', detail: 'Mostly in branch narrative and rollout analysis sessions', status: 'ok' },
      { title: '“capture degraded”', meta: '7 matches', detail: 'Useful for trust-state debugging and regression checks', status: 'warn' },
      { title: '“dashboard v3”', meta: '16 matches', detail: 'Strong coverage across plan, spec, and implementation passes', status: 'info' },
      { title: '“open repo”', meta: '9 matches', detail: 'Good candidate for assistant prompt suggestions', status: 'info' },
    ],
    tableTitle: 'Common result groups',
    tableColumns: ['Query lane', 'Best source', 'Jump target'],
    tableRows: () => [
      { primary: 'Narrative rationale', secondary: 'Linked session excerpts', tertiary: 'Repo evidence panel' },
      { primary: 'Operational failures', secondary: 'Telemetry-heavy sessions', tertiary: 'Status or live view' },
      { primary: 'Cost questions', secondary: 'Budget review transcripts', tertiary: 'Costs cockpit' },
      { primary: 'Workflow history', secondary: 'Cross-repo discussions', tertiary: 'Work graph cockpit' },
    ],
    footerNote: () => 'Search quality matters more than volume here; keep results trustworthy and fast to inspect.',
  },
  tools: {
    section: 'Monitor',
    title: 'Tools',
    subtitle: 'Usage mix, failure hotspots, and most-edited files across sessions.',
    heroTitle: () => 'Understand how agent tools are shaping the repo.',
    heroBody: () =>
      'This page treats tool analytics as a first-class operator view while keeping the emphasis on where tool behavior produced meaningful repo impact.',
    metrics: () => [
      { label: 'Tool calls', value: '1.8k', detail: 'Last 30 days', tone: 'blue' },
      { label: 'Hot tool', value: 'codex', detail: 'Highest recent usage share', tone: 'violet' },
      { label: 'Error-prone lane', value: 'shell', detail: 'Most retries and guardrail hits', tone: 'amber' },
      { label: 'Edited files', value: '64', detail: 'Touched by tracked sessions', tone: 'green' },
    ],
    highlightsTitle: 'Tool insights',
    highlights: () => [
      { eyebrow: 'Habits', title: 'Tool mix over time', body: 'Reveal when a branch relied on chat, shell, or file-edit loops and whether that created risk.', tone: 'blue' },
      { eyebrow: 'Pressure', title: 'Retry concentration', body: 'Highlight tools that correlate with parse errors, blocked commands, or manual handoffs.', tone: 'amber' },
      { eyebrow: 'Impact', title: 'Most-edited files', body: 'Promote files that absorb the most tool-driven churn so review effort follows reality.', tone: 'violet' },
    ],
    activityTitle: 'Observed tool patterns',
    activity: () => [
      { title: 'Shell-heavy spike', meta: 'Today', detail: 'Inline script recovery and temp-file pivots remain common under strict shells', status: 'warn' },
      { title: 'Apply patch stable', meta: 'Today', detail: 'Manual edits stay deterministic when work is scoped cleanly', status: 'ok' },
      { title: 'View-image usage', meta: 'Today', detail: 'Useful for visual verification while the cockpit continues to evolve', status: 'info' },
      { title: 'Test loop intact', meta: 'Today', detail: 'Validation commands remain the final confidence layer', status: 'ok' },
    ],
    tableTitle: 'Tool hotspots',
    tableColumns: ['Tool', 'Observed pattern', 'Recommended response'],
    tableRows: () => [
      { primary: 'exec_command', secondary: 'Shell quoting failures cluster here', tertiary: 'Pivot to temp scripts sooner' },
      { primary: 'apply_patch', secondary: 'Cleanest code edit path', tertiary: 'Prefer for scoped UI changes' },
      { primary: 'view_image', secondary: 'High value for visual QA', tertiary: 'Use to verify layout families' },
      { primary: 'pnpm test:deep', secondary: 'Confidence gate', tertiary: 'Run after view routing changes' },
    ],
    footerNote: () => 'Tools view should help operators learn from execution patterns, not just count commands.',
  },
  costs: {
    section: 'Monitor',
    title: 'Costs',
    subtitle: 'Model spend, burn rate, projection, and anomaly windows.',
    heroTitle: () => 'Cost visibility is part of the operator cockpit, not an afterthought.',
    heroBody: () =>
      'This page turns cost analytics into a calmer, more decision-oriented surface: current burn, which models dominate it, and where a budget alert should trigger follow-up.',
    metrics: () => [
      { label: 'Today', value: '$18.40', detail: 'Within configured burn window', tone: 'green' },
      { label: 'Month', value: '$284', detail: 'Projected to land at $341', tone: 'blue' },
      { label: 'Top model', value: 'GPT-5', detail: 'Largest share of session spend', tone: 'violet' },
      { label: 'Anomalies', value: '2', detail: 'Review sessions with unusual spikes', tone: 'amber' },
    ],
    highlightsTitle: 'Budget lenses',
    highlights: () => [
      { eyebrow: 'Projection', title: 'Budget drift before it hurts', body: 'Make the forecast visible enough that spend questions can be answered without opening another tool.', tone: 'blue' },
      { eyebrow: 'Attribution', title: 'Explain where spend came from', body: 'Join cost spikes back to models, sessions, and operator workflows.', tone: 'violet' },
      { eyebrow: 'Intervention', title: 'Suggest safer responses', body: 'Recommend throttling, review, or provider shifts without performing them automatically.', tone: 'amber' },
    ],
    activityTitle: 'Recent spend signals',
    activity: () => [
      { title: 'Claude long-run session', meta: '$4.10', detail: 'Large transcript + diff review created a visible spike', status: 'warn' },
      { title: 'Codex implementation burst', meta: '$2.30', detail: 'Short, high-throughput edit loop with clean validation', status: 'ok' },
      { title: 'Kimi background analysis', meta: '$0.80', detail: 'Low-cost context expansion, no action required', status: 'info' },
      { title: 'Budget threshold warning', meta: 'Preview', detail: 'Monthly projection is nearing configured soft cap', status: 'warn' },
    ],
    tableTitle: 'Spend by model',
    tableColumns: ['Model', 'Trend', 'Operator response'],
    tableRows: () => [
      { primary: 'GPT-5', secondary: 'Up this week', tertiary: 'Keep for implementation-heavy loops' },
      { primary: 'Claude Sonnet', secondary: 'Stable', tertiary: 'Use for long-form review and synthesis' },
      { primary: 'Kimi', secondary: 'Low', tertiary: 'Good for supporting analysis' },
      { primary: 'Unknown legacy runs', secondary: 'Needs audit', tertiary: 'Backfill metadata where possible' },
    ],
    footerNote: () => 'Cost clarity becomes more credible when each spike has a session and workflow explanation attached to it.',
  },
  timeline: {
    section: 'Monitor',
    title: 'Timeline',
    subtitle: 'Commit rhythm, branch context, and narrative drill-down entry points.',
    heroTitle: () => 'Move from chronology to comprehension.',
    heroBody: () =>
      'Timeline should be more than chronology. In Trace Narrative it becomes the bridge between operator context and narrative evidence.',
    metrics: (context) => [
      { label: 'Commits indexed', value: `${context.commitCount}`, detail: 'In the active repo context', tone: 'blue' },
      { label: 'Narrative-ready', value: '81%', detail: 'Commits with summary + evidence', tone: 'violet' },
      { label: 'Linked sessions', value: `${context.sessionCount}`, detail: 'Available for timeline jumps', tone: 'green' },
      { label: 'Review gaps', value: '3', detail: 'Entries missing strong causal links', tone: 'amber' },
    ],
    highlightsTitle: 'Timeline jobs',
    highlights: () => [
      { eyebrow: 'Scan', title: 'See the branch story at a glance', body: 'Combine commit cadence, attribution, and linked sessions into a fast-reading vertical rhythm.', tone: 'blue' },
      { eyebrow: 'Explain', title: 'Jump into why', body: 'Every interesting timeline point should open the surrounding narrative, not just raw file lists.', tone: 'violet' },
      { eyebrow: 'Audit', title: 'Expose weak joins', body: 'Missing or low-confidence narrative links belong in the open, not behind perfect-looking badges.', tone: 'amber' },
    ],
    activityTitle: 'Timeline moments',
    activity: () => [
      { title: 'Spec deepening landed', meta: 'This morning', detail: 'Dashboard contract moved from visual demo to behavioral source of truth', status: 'ok' },
      { title: 'Trust overlay added', meta: 'Earlier', detail: 'Capture degradation is now distinct from dashboard state', status: 'ok' },
      { title: 'Stale-doc drift found', meta: 'Earlier', detail: 'Historical naming required cleanup and relabeling', status: 'warn' },
      { title: 'UI routing gap', meta: 'Now', detail: 'Sidebar modes exist but several still need first-class content', status: 'critical' },
    ],
    tableTitle: 'Drill-down paths',
    tableColumns: ['Entry point', 'Narrative use', 'Preferred landing'],
    tableRows: () => [
      { primary: 'Commit node', secondary: 'Why did this change?', tertiary: 'Repo mode narrative panel' },
      { primary: 'Session badge', secondary: 'Which prompt caused this?', tertiary: 'Linked session excerpt' },
      { primary: 'Trust warning', secondary: 'Can I rely on this?', tertiary: 'Status or attribution cockpit' },
      { primary: 'File hotspot', secondary: 'Where is the churn?', tertiary: 'Diffs or tools cockpit' },
    ],
    footerNote: () => 'Timeline should remain a bridge surface: lightweight, fast, and one click away from deeper evidence.',
  },
  'repo-pulse': {
    section: 'Workspace',
    title: 'Repo Pulse',
    subtitle: 'Repo cleanliness, freshness, and things that quietly need attention.',
    heroTitle: (context) => `${context.repoName} is only one pulse in the workspace.`,
    heroBody: () =>
      'This page helps the operator see which repos are quiet, drifting, or risky before those issues become interruptive.',
    metrics: () => [
      { label: 'Repos watched', value: '9', detail: 'Across the active workspace', tone: 'blue' },
      { label: 'Dirty repos', value: '3', detail: 'Uncommitted changes detected', tone: 'amber' },
      { label: 'Unpushed branches', value: '2', detail: 'Potential hidden work', tone: 'violet' },
      { label: 'Healthy repos', value: '4', detail: 'Clean and recently synced', tone: 'green' },
    ],
    highlightsTitle: 'Pulse heuristics',
    highlights: () => [
      { eyebrow: 'Freshness', title: 'What changed recently?', body: 'Sort by recent commit activity to keep the workspace map aligned with actual attention.', tone: 'blue' },
      { eyebrow: 'Risk', title: 'Where is drift hiding?', body: 'Call out dirty or unpushed repos that look harmless until they block a later flow.', tone: 'amber' },
      { eyebrow: 'Prioritization', title: 'What is actually worth opening?', body: 'Recommend the next repo to inspect instead of making the operator scan everything manually.', tone: 'violet' },
    ],
    activityTitle: 'Repo status feed',
    activity: () => [
      { title: 'trace-narrative', meta: 'dirty', detail: 'UI work in progress across cockpit and dashboard files', status: 'warn' },
      { title: 'coding-harness', meta: 'clean', detail: 'Recent rollout closure suggests no immediate action', status: 'ok' },
      { title: 'config/codex', meta: 'ahead', detail: 'Guardrail and automation changes pending review', status: 'info' },
      { title: 'otel-collector', meta: 'watch', detail: 'Telemetry hardening is still a shared dependency', status: 'warn' },
    ],
    tableTitle: 'Pulse queue',
    tableColumns: ['Repo', 'Current state', 'Suggested move'],
    tableRows: () => [
      { primary: 'trace-narrative', secondary: 'Active UI redesign', tertiary: 'Validate sidebar-to-view routing' },
      { primary: 'config/codex', secondary: 'Automation pressure', tertiary: 'Review blocker overlap before more additions' },
      { primary: 'otel-collector', secondary: 'Reliability infra', tertiary: 'Preserve stats-first diagnostics' },
      { primary: 'agent-skills', secondary: 'Documentation drift', tertiary: 'Reconcile skill paths and discoverability' },
    ],
    footerNote: () => 'Repo pulse works best when it pushes the operator toward the right repo, not just a bigger list.',
  },
  diffs: {
    section: 'Workspace',
    title: 'Diffs',
    subtitle: 'Session-linked file changes and high-churn surfaces.',
    heroTitle: () => 'Make file change review feel connected to the story, not detached from it.',
    heroBody: () =>
      'In Trace Narrative, the diff surface should become the evidence-centric companion to repo mode: changed files, linked sessions, and review hotspots.',
    metrics: () => [
      { label: 'Changed files', value: '27', detail: 'Across the active review window', tone: 'blue' },
      { label: 'Session-linked', value: '14', detail: 'Files with direct conversation context', tone: 'violet' },
      { label: 'High churn', value: '5', detail: 'Touched repeatedly this week', tone: 'amber' },
      { label: 'Ready for review', value: '18', detail: 'Sufficient evidence present', tone: 'green' },
    ],
    highlightsTitle: 'Diff workflows',
    highlights: () => [
      { eyebrow: 'Evidence', title: 'Show the file and the reason', body: 'A diff without nearby narrative evidence should feel obviously incomplete.', tone: 'violet' },
      { eyebrow: 'Heatmap', title: 'Expose repeated churn', body: 'Highlight files that are bouncing between tools, sessions, or branches.', tone: 'amber' },
      { eyebrow: 'Speed', title: 'Keep review friction low', body: 'Use this page for quick scan-and-open, then hand off to repo mode for deep reading.', tone: 'blue' },
    ],
    activityTitle: 'Diff hotspots',
    activity: () => [
      { title: 'src/App.tsx', meta: 'navigation', detail: 'Cockpit routing and fallback behavior are changing here', status: 'ok' },
      { title: 'src/ui/components/Sidebar.tsx', meta: 'shell', detail: 'Mode groups now need to align with the expanded cockpit information architecture', status: 'warn' },
      { title: 'src/ui/views/DashboardView.tsx', meta: 'dashboard', detail: 'Already carries the v3 cockpit visual language', status: 'info' },
      { title: 'src/styles.css', meta: 'system', detail: 'Existing tokens can support the broader cockpit without a rebrand', status: 'info' },
    ],
    tableTitle: 'File review queue',
    tableColumns: ['File', 'Narrative state', 'Why inspect'],
    tableRows: () => [
      { primary: 'src/App.tsx', secondary: 'High impact', tertiary: 'Controls shell routing and view orchestration' },
      { primary: 'src/ui/views/CockpitView.tsx', secondary: 'New', tertiary: 'Defines the updated operator surfaces' },
      { primary: 'src/ui/views/cockpitViewData.ts', secondary: 'New', tertiary: 'Encodes the new cockpit information architecture' },
      { primary: 'src/ui/components/TopNav.tsx', secondary: 'Shared nav', tertiary: 'Should reflect cockpit umbrella cleanly' },
    ],
    footerNote: () => 'Diffs page should reduce context-switch cost and make it obvious when repo mode is the right next step.',
  },
  snapshots: {
    section: 'Workspace',
    title: 'Snapshots',
    subtitle: 'Saved workspace states, branch checkpoints, and recovery moments.',
    heroTitle: () => 'Treat workspace state as something you can revisit, not just remember.',
    heroBody: () =>
      'This view keeps snapshot thinking simple: save meaningful checkpoints, then compare or recover from them later.',
    metrics: () => [
      { label: 'Saved snapshots', value: '11', detail: 'Across repos and worktrees', tone: 'blue' },
      { label: 'Pinned baselines', value: '3', detail: 'Used for rollout or release checks', tone: 'violet' },
      { label: 'Recovery ready', value: '6', detail: 'Include enough context to replay safely', tone: 'green' },
      { label: 'Stale captures', value: '2', detail: 'Need refresh before reuse', tone: 'amber' },
    ],
    highlightsTitle: 'Snapshot roles',
    highlights: () => [
      { eyebrow: 'Checkpoint', title: 'Freeze an operator moment', body: 'Capture repo state, session context, and intended next move together.', tone: 'blue' },
      { eyebrow: 'Compare', title: 'Detect drift from plan', body: 'Use snapshots to spot how far the live workspace has moved from the last verified baseline.', tone: 'amber' },
      { eyebrow: 'Recover', title: 'Support rollback reasoning', body: 'Keep enough metadata that a snapshot can justify a revert or a retry, not just exist as a timestamp.', tone: 'violet' },
    ],
    activityTitle: 'Recent checkpoints',
    activity: () => [
      { title: 'dashboard-v3 preflight', meta: 'Pinned', detail: 'Captured before layout migration work accelerated', status: 'ok' },
      { title: 'telemetry hardening baseline', meta: 'Pinned', detail: 'Used for degraded-capture comparisons', status: 'info' },
      { title: 'release artifacts checkpoint', meta: 'Saved', detail: 'Reference for rollout gating and audit review', status: 'ok' },
      { title: 'stale worktree snapshot', meta: 'Needs refresh', detail: 'Environment drift makes this unreliable now', status: 'warn' },
    ],
    tableTitle: 'Snapshot inventory',
    tableColumns: ['Checkpoint', 'Use case', 'Confidence'],
    tableRows: () => [
      { primary: 'dashboard-v3-preflight', secondary: 'UI migration baseline', tertiary: 'High' },
      { primary: 'telemetry-scale-check', secondary: 'Reliability comparison', tertiary: 'Medium' },
      { primary: 'release-artifacts-stage-a', secondary: 'Rollout audit', tertiary: 'High' },
      { primary: 'workspace-cleanup-before-after', secondary: 'Operational hygiene', tertiary: 'Medium' },
    ],
    footerNote: () => 'Snapshots become powerful when they explain what was true, not just when they were saved.',
  },
  worktrees: {
    section: 'Workspace',
    title: 'Worktrees',
    subtitle: 'Branch isolation, detached states, and workspace sprawl.',
    heroTitle: () => 'See every active worktree before it surprises you.',
    heroBody: () =>
      'This view helps the operator catch detached, stale, or oversized worktrees before they turn into cleanup debt.',
    metrics: () => [
      { label: 'Worktrees', value: '7', detail: 'Tracked across active repos', tone: 'blue' },
      { label: 'Detached', value: '1', detail: 'Requires deliberate action', tone: 'amber' },
      { label: 'Dirty', value: '3', detail: 'Uncommitted changes present', tone: 'violet' },
      { label: 'Safe', value: '3', detail: 'Merged and clean', tone: 'green' },
    ],
    highlightsTitle: 'Worktree checks',
    highlights: () => [
      { eyebrow: 'Safety', title: 'Delete only with confidence', body: 'Keep deletion cues behind clean, merged, no-stash rules and visible risk notes.', tone: 'amber' },
      { eyebrow: 'Context', title: 'Branch intent stays visible', body: 'Show what each worktree is for so cleanup decisions remain grounded.', tone: 'blue' },
      { eyebrow: 'Scale', title: 'Spot workspace sprawl', body: 'Track size and age so forgotten worktrees do not keep accumulating silently.', tone: 'violet' },
    ],
    activityTitle: 'Worktree watchlist',
    activity: () => [
      { title: 'feature/cockpit-views', meta: 'dirty', detail: 'Active UI pass across shell and view routing', status: 'warn' },
      { title: 'main', meta: 'clean', detail: 'Safe fallback for verification and comparison', status: 'ok' },
      { title: 'release/checkpoint', meta: 'detached', detail: 'Needs review before any cleanup action', status: 'critical' },
      { title: 'telemetry-lane', meta: 'clean', detail: 'Useful for isolated reliability experiments', status: 'info' },
    ],
    tableTitle: 'Worktree inventory',
    tableColumns: ['Worktree', 'Status', 'Operator advice'],
    tableRows: () => [
      { primary: 'feature/cockpit-views', secondary: 'Dirty', tertiary: 'Continue implementation and validate before prune' },
      { primary: 'main', secondary: 'Clean', tertiary: 'Use as stable comparison point' },
      { primary: 'release/checkpoint', secondary: 'Detached', tertiary: 'Do not delete until intent is confirmed' },
      { primary: 'telemetry-lane', secondary: 'Clean', tertiary: 'Keep for reliability verification' },
    ],
    footerNote: () => 'Worktrees page should be operationally conservative: more guardrails, fewer tempting destructive actions.',
  },
  attribution: {
    section: 'Workspace',
    title: 'Attribution',
    subtitle: 'AI vs human contribution signals, evidence gaps, and trust cues.',
    heroTitle: () => 'Attribution only helps if its confidence is visible.',
    heroBody: () =>
      'This view should make contribution signals useful without pretending they are perfect. The differentiator is not just attribution presence, but whether the operator can inspect and trust it.',
    metrics: (context) => [
      { label: 'AI share', value: '68%', detail: 'Across the current analysis window', tone: 'violet' },
      { label: 'Unknown lines', value: '11%', detail: 'Need more evidence or better linking', tone: 'amber' },
      { label: 'Human-led files', value: '7', detail: 'Keep visible to avoid flattening all work into AI', tone: 'blue' },
      { label: 'Trust state', value: context.trustState === 'healthy' ? 'Healthy' : 'Caution', detail: context.trustLabel, tone: context.trustState === 'healthy' ? 'green' : 'amber' },
    ],
    highlightsTitle: 'Attribution priorities',
    highlights: () => [
      { eyebrow: 'Evidence', title: 'Confidence beats certainty theater', body: 'If a line cannot be attributed strongly, the UI should say so plainly and offer the next-best evidence path.', tone: 'amber' },
      { eyebrow: 'Comparison', title: 'Keep the human contribution visible', body: 'Avoid turning attribution into an AI-only lens; the point is balance and explanation.', tone: 'blue' },
      { eyebrow: 'Reviewability', title: 'File-level hotspots matter', body: 'Surface files where attribution volatility is highest so the operator knows where to inspect deeper.', tone: 'violet' },
    ],
    activityTitle: 'Attribution watchlist',
    activity: () => [
      { title: 'Unknown-only segments found', meta: 'Today', detail: 'A few files still lack enough signal for confident attribution', status: 'warn' },
      { title: 'High-confidence AI lane', meta: 'Today', detail: 'Dashboard and telemetry changes have strong agent-session evidence', status: 'ok' },
      { title: 'Human-only maintenance', meta: 'Today', detail: 'Some cleanup and repo hygiene remains intentionally human-led', status: 'info' },
      { title: 'Degraded capture overlay', meta: 'When active', detail: 'Any reliability drop should immediately soften attribution certainty', status: 'critical' },
    ],
    tableTitle: 'Attribution hotspots',
    tableColumns: ['Surface', 'Observed issue', 'Review move'],
    tableRows: () => [
      { primary: 'Dashboard shell', secondary: 'Mixed authorship', tertiary: 'Inspect session-linked file changes' },
      { primary: 'Telemetry paths', secondary: 'Confidence sensitive', tertiary: 'Check degraded-capture warnings first' },
      { primary: 'Styles and tokens', secondary: 'Collaborative edits', tertiary: 'Compare design-system intent vs live diffs' },
      { primary: 'Docs artifacts', secondary: 'Historical drift', tertiary: 'Use narrative evidence before re-labeling authorship' },
    ],
    footerNote: () => 'Attribution page should reinforce trust, not weaken it by overclaiming.',
  },
  skills: {
    section: 'Ecosystem',
    title: 'Skills',
    subtitle: 'Local skill inventory, quality cues, and discovery lanes.',
    heroTitle: () => 'Skills are part of the workstation, not external trivia.',
    heroBody: () =>
      'This view promotes skill availability and quality signals into the cockpit. It should make local capabilities discoverable without becoming a marketplace.',
    metrics: () => [
      { label: 'Installed skills', value: '82', detail: 'Across shared and repo-specific paths', tone: 'blue' },
      { label: 'Recently used', value: '14', detail: 'Touched in the last day', tone: 'violet' },
      { label: 'Missing metadata', value: '3', detail: 'Need cleanup for better discoverability', tone: 'amber' },
      { label: 'Healthy paths', value: 'Mostly', detail: 'Shared skill registry resolving correctly', tone: 'green' },
    ],
    highlightsTitle: 'Skill goals',
    highlights: () => [
      { eyebrow: 'Discover', title: 'Find the right workflow fast', body: 'Make it obvious which skill helps with docs, UI, telemetry, or workflow routing.', tone: 'blue' },
      { eyebrow: 'Trust', title: 'Expose stale or missing paths', body: 'Users should see path health and last-touch signals, not just skill names.', tone: 'amber' },
      { eyebrow: 'Reuse', title: 'Support operator habits', body: 'Promote the skills that turn repeated work into consistent, auditable flows.', tone: 'violet' },
    ],
    activityTitle: 'Skill pulse',
    activity: () => [
      { title: 'brainstorming', meta: 'active', detail: 'Used to define the new cockpit-view direction before implementation', status: 'ok' },
      { title: 'diagram-cli', meta: 'recent', detail: 'Helpful for architecture-first routing before UI work', status: 'info' },
      { title: 'systematic-debugging', meta: 'idle', detail: 'Best reserved for failures rather than speculative use', status: 'info' },
      { title: 'ui-visual-regression', meta: 'next', detail: 'A good follow-up once visual parity and polish work deepens', status: 'warn' },
    ],
    tableTitle: 'Skill lanes',
    tableColumns: ['Skill', 'Best use', 'Current note'],
    tableRows: () => [
      { primary: 'brainstorming', secondary: 'Scope decisions', tertiary: 'Use before committing to major UI structure' },
      { primary: 'diagram-cli', secondary: 'Architecture bootstrap', tertiary: 'Required for repo-first understanding' },
      { primary: 'baseline-ui', secondary: 'Visual consistency', tertiary: 'Good follow-up for polish pass' },
      { primary: 'playwright-interactive', secondary: 'Visual QA', tertiary: 'Useful once cockpit routes render live' },
    ],
    footerNote: () => 'Skills view should help the operator choose the right workflow, not drown them in catalogue depth.',
  },
  agents: {
    section: 'Ecosystem',
    title: 'Agents',
    subtitle: 'Repo-local agent definitions, multi-agent roles, and orchestration readiness.',
    heroTitle: () => 'Make agent surfaces explicit when they exist, and honest when they do not.',
    heroBody: () =>
      'In Trace Narrative this should highlight actual agent presence, role coverage, and whether the workspace is ready for parallel execution.',
    metrics: () => [
      { label: 'Detected agents', value: '5', detail: 'Across shared and repo-local configs', tone: 'blue' },
      { label: 'Ready roles', value: '3', detail: 'Useful now for review or execution', tone: 'green' },
      { label: 'Gaps', value: '2', detail: 'Need clearer ownership or prompts', tone: 'amber' },
      { label: 'Parallel lanes', value: 'Available', detail: 'Use only when work is genuinely disjoint', tone: 'violet' },
    ],
    highlightsTitle: 'Agent inventory goals',
    highlights: () => [
      { eyebrow: 'Presence', title: 'Show real agent availability', body: 'If no repo-local agents exist, prefer a meaningful empty state over fake completeness.', tone: 'blue' },
      { eyebrow: 'Readiness', title: 'Clarify what each role is for', body: 'Help the operator decide whether to keep work local or fan out.', tone: 'violet' },
      { eyebrow: 'Safety', title: 'Avoid parallelism theater', body: 'Surface that multi-agent work is useful only when writes and ownership are truly separate.', tone: 'amber' },
    ],
    activityTitle: 'Agent notes',
    activity: () => [
      { title: 'Reviewer lane available', meta: 'Now', detail: 'Useful for post-implementation simplicity or parity review', status: 'ok' },
      { title: 'UI worker optional', meta: 'Now', detail: 'Good fit when visual slices have disjoint write scopes', status: 'info' },
      { title: 'Critical path local', meta: 'Now', detail: 'Routing and shell integration work should stay in the main flow', status: 'warn' },
      { title: 'Context handoff cost', meta: 'Always', detail: 'Only fan out when the saved time outweighs the briefing overhead', status: 'critical' },
    ],
    tableTitle: 'Agent readiness',
    tableColumns: ['Role', 'Why use it', 'Current fit'],
    tableRows: () => [
      { primary: 'worker', secondary: 'Bounded implementation task', tertiary: 'Good for isolated component work' },
      { primary: 'design-implementation-reviewer', secondary: 'Visual discrepancy review', tertiary: 'Useful after the first cockpit pass lands' },
      { primary: 'kieran-typescript-reviewer', secondary: 'Strict TS review', tertiary: 'Helpful after cockpit data wiring' },
      { primary: 'monitor', secondary: 'Long-running poll', tertiary: 'Only for external waits, not this UI pass' },
    ],
    footerNote: () => 'Agents page should help the operator decide when not to delegate just as much as when to do it.',
  },
  memory: {
    section: 'Ecosystem',
    title: 'Memory',
    subtitle: 'Workspace memory state, reusable learnings, and context hygiene.',
    heroTitle: () => 'Durable memory should be guidance, not mythology.',
    heroBody: () =>
      'This view makes memory awareness operational: what memory exists, what looks stale, and how it influences the current workspace.',
    metrics: () => [
      { label: 'Relevant memories', value: '6', detail: 'Directly related to this repo and task', tone: 'blue' },
      { label: 'Potential drift', value: '1', detail: 'Naming/path corrections recently required', tone: 'amber' },
      { label: 'Reusable lanes', value: '3', detail: 'Dashboard, telemetry, trust loops', tone: 'violet' },
      { label: 'Context hygiene', value: 'Good', detail: 'Memory stays bounded and cited', tone: 'green' },
    ],
    highlightsTitle: 'Memory rules',
    highlights: () => [
      { eyebrow: 'Use lightly', title: 'Pull memory only when it materially helps', body: 'Avoid bloating UI or implementation passes with irrelevant historical detail.', tone: 'blue' },
      { eyebrow: 'Verify', title: 'Trust current evidence over stale notes', body: 'If repo state contradicts memory, update memory and proceed with the live truth.', tone: 'amber' },
      { eyebrow: 'Cite', title: 'Keep reuse auditable', body: 'Memory should explain why a direction was chosen, not silently dictate it.', tone: 'violet' },
    ],
    activityTitle: 'Memory watchlist',
    activity: () => [
      { title: 'Dashboard v3 contract lane', meta: 'Relevant', detail: 'Useful for trust-state and workflow-spec routing guidance', status: 'ok' },
      { title: 'Repo naming drift', meta: 'Resolved', detail: 'trace-narrative is the active worktree; older names are historical', status: 'warn' },
      { title: 'Telemetry hardening notes', meta: 'Relevant', detail: 'Support reliability messaging in cockpit surfaces', status: 'info' },
      { title: 'Unverified specifics', meta: 'Avoid', detail: 'Do not present older counts or paths as current without checking', status: 'critical' },
    ],
    tableTitle: 'Memory lanes',
    tableColumns: ['Memory topic', 'Current relevance', 'How to use it'],
    tableRows: () => [
      { primary: 'dashboard_v3_contract_phase', secondary: 'High', tertiary: 'Guide view semantics and trust handling' },
      { primary: 'trace-narrative naming drift', secondary: 'High', tertiary: 'Avoid stale historical workspace labels in UI copy' },
      { primary: 'telemetry agents hardening', secondary: 'Medium', tertiary: 'Inform live and status view messaging' },
      { primary: 'older product-roadmap notes', secondary: 'Low', tertiary: 'Use only if they still match repo evidence' },
    ],
    footerNote: () => 'Memory page should keep prior context useful without letting it outrank current repository truth.',
  },
  hooks: {
    section: 'Ecosystem',
    title: 'Hooks',
    subtitle: 'Trigger points, health, and command safety around workstation hooks.',
    heroTitle: () => 'Hooks are part of the blast radius model.',
    heroBody: () =>
      'This page should show which hooks are active, where they fire, and whether they are healthy enough to trust.',
    metrics: () => [
      { label: 'Hook count', value: '9', detail: 'Across relevant repos and tools', tone: 'blue' },
      { label: 'Passing', value: '7', detail: 'Observed healthy on recent runs', tone: 'green' },
      { label: 'Flaky', value: '2', detail: 'Need closer inspection', tone: 'amber' },
      { label: 'Risk posture', value: 'Visible', detail: 'Blast radius called out before action', tone: 'violet' },
    ],
    highlightsTitle: 'Hook priorities',
    highlights: () => [
      { eyebrow: 'Visibility', title: 'Show trigger stage and command', body: 'Operators need to know what will fire before they kick off a workflow.', tone: 'blue' },
      { eyebrow: 'Safety', title: 'Flag risky hooks early', body: 'Especially where hooks can block pushes, mutate files, or rely on fragile env state.', tone: 'amber' },
      { eyebrow: 'Repair', title: 'Point to the right follow-up', body: 'A failing hook should lead to remediation guidance, not a dead-end red badge.', tone: 'violet' },
    ],
    activityTitle: 'Hook events',
    activity: () => [
      { title: 'pre-commit', meta: 'stable', detail: 'Lint and type checks remain predictable', status: 'ok' },
      { title: 'pre-push', meta: 'heavy', detail: 'Runs deep verification and can surface policy drift quickly', status: 'warn' },
      { title: 'automation trigger', meta: 'watch', detail: 'Useful, but should not hide shell fragility or quoting failures', status: 'info' },
      { title: 'unknown custom hook', meta: 'review', detail: 'Needs clearer documentation before trust can rise', status: 'critical' },
    ],
    tableTitle: 'Hook inventory',
    tableColumns: ['Hook', 'Observed behavior', 'Operator note'],
    tableRows: () => [
      { primary: 'pre-commit', secondary: 'Lint + typecheck', tertiary: 'Fast enough to keep enabled' },
      { primary: 'pre-push', secondary: 'Deep verification', tertiary: 'Document heavy failure modes clearly' },
      { primary: 'automation-webhook', secondary: 'Background trigger', tertiary: 'Make prompt safety visible' },
      { primary: 'repo-local custom', secondary: 'Unclear', tertiary: 'Treat as caution until documented' },
    ],
    footerNote: () => 'Hooks page should explain operational consequences, not just list file names.',
  },
  setup: {
    section: 'Ecosystem',
    title: 'Setup',
    subtitle: 'Repo instructions, config roots, MCP health, and onboarding readiness.',
    heroTitle: () => 'Operators need a setup map as much as a feature list.',
    heroBody: () =>
      'This page should tell a clear story about what is configured, what is missing, and how that affects trust in the rest of the app.',
    metrics: () => [
      { label: 'Instruction roots', value: '3', detail: 'Global, repo, local docs', tone: 'blue' },
      { label: 'MCP endpoints', value: 'Healthy', detail: 'Core connectors responding', tone: 'green' },
      { label: 'Permissions', value: 'Explicit', detail: 'Least-privilege posture visible', tone: 'violet' },
      { label: 'Setup gaps', value: '2', detail: 'Need follow-up before feature parity', tone: 'amber' },
    ],
    highlightsTitle: 'Setup concerns',
    highlights: () => [
      { eyebrow: 'Discovery', title: 'Show where truth comes from', body: 'Make AGENTS, instructions, and local setup files visible and explain their precedence.', tone: 'blue' },
      { eyebrow: 'Readiness', title: 'Call out missing capabilities', body: 'Users should know when setup gaps explain why a view is partial or empty.', tone: 'amber' },
      { eyebrow: 'Trust', title: 'Protect the operator contract', body: 'If a command boundary is missing, fail closed and say why.', tone: 'violet' },
    ],
    activityTitle: 'Setup checks',
    activity: () => [
      { title: 'Architecture manifest present', meta: 'Pass', detail: 'Diagram artifacts were available before planning edits', status: 'ok' },
      { title: 'Learnings file read', meta: 'Pass', detail: 'Repo shell gotchas and tool patterns were loaded up front', status: 'ok' },
      { title: 'Config drift watch', meta: 'Caution', detail: 'Historical path drift still matters for docs and memory', status: 'warn' },
      { title: 'Capabilities review', meta: 'Ongoing', detail: 'Keep Tauri authority narrow as cockpit breadth grows', status: 'info' },
    ],
    tableTitle: 'Setup surfaces',
    tableColumns: ['Surface', 'Why it matters', 'Current posture'],
    tableRows: () => [
      { primary: 'AGENTS instructions', secondary: 'Behavior contract', tertiary: 'Loaded and guiding work' },
      { primary: 'Architecture artifacts', secondary: 'Routing context', tertiary: 'Present and current enough for this pass' },
      { primary: 'Tauri capabilities', secondary: 'Authority boundary', tertiary: 'Needs continued audit as views expand' },
      { primary: 'Repo docs', secondary: 'Human onboarding', tertiary: 'Good foundation, still evolving' },
    ],
    footerNote: () => 'Setup page should answer “why is this view behaving this way?” before the operator has to ask.',
  },
  ports: {
    section: 'Ecosystem',
    title: 'Ports',
    subtitle: 'Bound services, local addresses, and process ownership clues.',
    heroTitle: () => 'Local network state belongs in the cockpit when it affects trust.',
    heroBody: () =>
      'Here the ports surface becomes a lightweight debugging tool for local app servers, OTEL receivers, and automation webhooks.',
    metrics: () => [
      { label: 'Bound ports', value: '5', detail: 'Relevant to current tooling', tone: 'blue' },
      { label: 'Healthy listeners', value: '4', detail: 'Responding as expected', tone: 'green' },
      { label: 'Unknown owners', value: '1', detail: 'Needs manual inspection', tone: 'amber' },
      { label: 'Critical lane', value: '4318', detail: 'OTEL receiver path', tone: 'violet' },
    ],
    highlightsTitle: 'Port checks',
    highlights: () => [
      { eyebrow: 'Health', title: 'What is listening right now?', body: 'Keep service ownership and purpose visible so troubleshooting starts from evidence.', tone: 'blue' },
      { eyebrow: 'Trust', title: 'Unknown listeners should stand out', body: 'Anything not clearly owned by the workspace deserves review, not a tiny footnote.', tone: 'amber' },
      { eyebrow: 'Context', title: 'Tie ports back to features', body: 'When a webhook or app server matters to the UI, point directly to the affected cockpit view.', tone: 'violet' },
    ],
    activityTitle: 'Port activity',
    activity: () => [
      { title: '4318 / OTEL', meta: 'active', detail: 'Supports ingest and reliability visibility', status: 'ok' },
      { title: '8787 / webhook', meta: 'idle', detail: 'Ready for agentation or local automation hooks', status: 'info' },
      { title: '5173 / Vite dev', meta: 'active', detail: 'Primary frontend dev server while UI views evolve', status: 'ok' },
      { title: 'Unknown listener', meta: 'review', detail: 'Operator should confirm owner before trusting it', status: 'critical' },
    ],
    tableTitle: 'Observed listeners',
    tableColumns: ['Port', 'Owner', 'Why it matters'],
    tableRows: () => [
      { primary: '4318', secondary: 'OTEL receiver', tertiary: 'Feeds live and status reliability surfaces' },
      { primary: '5173', secondary: 'Vite', tertiary: 'Current UI development target' },
      { primary: '8787', secondary: 'Webhook listener', tertiary: 'Used for automation and assistant flows' },
      { primary: '3000', secondary: 'Local app server', tertiary: 'Potential assistant or MCP integration lane' },
    ],
    footerNote: () => 'Ports page should stay diagnostic and quiet, not feel like a network operations console.',
  },
  hygiene: {
    section: 'Health',
    title: 'Hygiene',
    subtitle: 'Zombie processes, divergence, dead directories, and cleanup suggestions.',
    heroTitle: () => 'Operational cleanliness deserves a dedicated view.',
    heroBody: () =>
      'This page can be highly useful while still being clear about risk, reversibility, and when a human should inspect before acting.',
    metrics: () => [
      { label: 'Cleanup cues', value: '6', detail: 'Across repos and processes', tone: 'amber' },
      { label: 'Safe actions', value: '3', detail: 'Low-blast-radius suggestions', tone: 'green' },
      { label: 'Needs review', value: '3', detail: 'Human confirmation strongly recommended', tone: 'red' },
      { label: 'Hidden debt', value: '2', detail: 'Dead paths or stale stashes found', tone: 'violet' },
    ],
    highlightsTitle: 'Cleanup philosophy',
    highlights: () => [
      { eyebrow: 'Safety', title: 'Dry-run by default', body: 'Present cleanup suggestions with explicit blast radius and rollback posture before any action is taken.', tone: 'amber' },
      { eyebrow: 'Auditability', title: 'Explain why cleanup is recommended', body: 'Tie every remediation suggestion to an observed state, not just a heuristic label.', tone: 'blue' },
      { eyebrow: 'Trust', title: 'Human control stays visible', body: 'The UI should never imply that silent cleanup is a normal background behavior.', tone: 'violet' },
    ],
    activityTitle: 'Hygiene alerts',
    activity: () => [
      { title: 'Stale branch worktree', meta: 'High risk', detail: 'Potential delete candidate blocked until merge state is confirmed', status: 'critical' },
      { title: 'Unpushed repo', meta: 'Medium risk', detail: 'May hide work that should be synced before cleanup', status: 'warn' },
      { title: 'Zombie process', meta: 'Low risk', detail: 'Safe to inspect, but still requires explicit operator choice', status: 'info' },
      { title: 'Dead directory', meta: 'Low risk', detail: 'Good candidate for guided cleanup once confirmed', status: 'ok' },
    ],
    tableTitle: 'Cleanup queue',
    tableColumns: ['Issue', 'Observed risk', 'Recommended response'],
    tableRows: () => [
      { primary: 'Detached worktree', secondary: 'High', tertiary: 'Inspect branch intent before delete' },
      { primary: 'Remote divergence', secondary: 'Medium', tertiary: 'Review sync path and stash state first' },
      { primary: 'Zombie process', secondary: 'Low', tertiary: 'Offer kill preview, not instant action' },
      { primary: 'Dead directory', secondary: 'Low', tertiary: 'Surface path and owner before cleanup' },
    ],
    footerNote: () => 'Hygiene page should feel trustworthy because it is cautious, not because it is aggressive.',
  },
  deps: {
    section: 'Health',
    title: 'Dependencies',
    subtitle: 'Package freshness, major updates, and known risk signals.',
    heroTitle: () => 'Dependency drift is part of operational health.',
    heroBody: () =>
      'This version keeps the focus on decision-making: what is outdated, what is risky, and what is actually worth upgrading now.',
    metrics: () => [
      { label: 'Outdated packages', value: '12', detail: 'Across active repos', tone: 'blue' },
      { label: 'Major bumps', value: '4', detail: 'Need deliberate review', tone: 'amber' },
      { label: 'Security flags', value: '1', detail: 'Requires follow-up soon', tone: 'red' },
      { label: 'Stable core', value: 'Mostly', detail: 'Primary UI stack is aligned', tone: 'green' },
    ],
    highlightsTitle: 'Dependency decisions',
    highlights: () => [
      { eyebrow: 'Prioritize', title: 'Not every update matters equally', body: 'Rank upgrades by user impact, risk, and whether they touch trust-critical surfaces.', tone: 'blue' },
      { eyebrow: 'Explain', title: 'Show why something is risky', body: 'A major bump or vulnerability should include the affected lane, not just a version delta.', tone: 'amber' },
      { eyebrow: 'Bound', title: 'Keep upgrades intentional', body: 'Avoid making the dependency view feel like a call to churn every week.', tone: 'violet' },
    ],
    activityTitle: 'Dependency watchlist',
    activity: () => [
      { title: 'React + Vite lane', meta: 'Stable', detail: 'Core UI stack looks healthy for the current cockpit pass', status: 'ok' },
      { title: 'Charting bundle weight', meta: 'Watch', detail: 'Keep dense-chart dependencies lazy where possible', status: 'warn' },
      { title: 'Security patch available', meta: 'Soon', detail: 'One transitive lane needs follow-up in the next maintenance pass', status: 'critical' },
      { title: 'Token packages', meta: 'Aligned', detail: 'Design system tarball versions appear consistent', status: 'info' },
    ],
    tableTitle: 'Dependency queue',
    tableColumns: ['Package lane', 'Risk', 'Operator move'],
    tableRows: () => [
      { primary: 'core UI stack', secondary: 'Low', tertiary: 'Keep aligned with current verified versions' },
      { primary: 'charting', secondary: 'Medium', tertiary: 'Watch bundle growth and lazy-load strategy' },
      { primary: 'security-sensitive transitive', secondary: 'High', tertiary: 'Schedule targeted update with validation' },
      { primary: 'design-system vendor tarballs', secondary: 'Medium', tertiary: 'Refresh only when compatibility is clear' },
    ],
    footerNote: () => 'Dependencies page should guide judgment, not generate upgrade anxiety.',
  },
  env: {
    section: 'Health',
    title: 'Env Files',
    subtitle: 'Environment file hygiene, gitignore coverage, and example parity.',
    heroTitle: () => 'Config hygiene deserves its own visibility.',
    heroBody: () =>
      'Env-file inspection matters because these files shape trust and safety. This page keeps the signal focused on coverage, examples, and avoidable leakage risks.',
    metrics: () => [
      { label: 'Env files', value: '9', detail: 'Detected across tracked repos', tone: 'blue' },
      { label: 'Ignored safely', value: '7', detail: 'Covered by gitignore patterns', tone: 'green' },
      { label: 'Needs example', value: '2', detail: 'Missing companion docs or templates', tone: 'amber' },
      { label: 'Leak risk', value: 'Low', detail: 'No critical exposures in current sample', tone: 'violet' },
    ],
    highlightsTitle: 'Env hygiene goals',
    highlights: () => [
      { eyebrow: 'Coverage', title: 'Know which env files exist', body: 'Inventory alone helps the operator reason about risk and onboarding gaps.', tone: 'blue' },
      { eyebrow: 'Examples', title: 'Promote safer defaults', body: 'Missing example files are small issues that create bigger setup inconsistency later.', tone: 'amber' },
      { eyebrow: 'Safety', title: 'Keep sensitive paths out of summaries', body: 'Show counts and posture without leaking secrets or raw values.', tone: 'violet' },
    ],
    activityTitle: 'Env checks',
    activity: () => [
      { title: '.env.local', meta: 'ignored', detail: 'Safe posture for local overrides', status: 'ok' },
      { title: '.env.example', meta: 'missing', detail: 'One repo still needs a better onboarding template', status: 'warn' },
      { title: 'Gitignore coverage', meta: 'good', detail: 'Most known env lanes are protected', status: 'ok' },
      { title: 'Variable audit', meta: 'quiet', detail: 'No need to surface raw names in this UI', status: 'info' },
    ],
    tableTitle: 'Env hygiene queue',
    tableColumns: ['Surface', 'Current posture', 'Suggested response'],
    tableRows: () => [
      { primary: 'Local overrides', secondary: 'Ignored', tertiary: 'Keep out of telemetry and UI surfaces' },
      { primary: 'Example templates', secondary: 'Partial', tertiary: 'Add examples where onboarding is weak' },
      { primary: 'Gitignore coverage', secondary: 'Mostly good', tertiary: 'Patch the last uncovered patterns' },
      { primary: 'Docs references', secondary: 'Needs clarity', tertiary: 'Point setup view to env expectations' },
    ],
    footerNote: () => 'Env page should reinforce safe defaults without turning into a secret browser.',
  },
  settings: {
    section: 'Config',
    title: 'Settings',
    subtitle: 'Scan roots, provider toggles, budgets, and app behavior.',
    heroTitle: () => 'Settings should explain the operator contract, not just expose switches.',
    heroBody: () =>
      'Settings are a broad control surface, but the emphasis stays on why each setting affects trust, capture, or operator workload.',
    metrics: () => [
      { label: 'Scan roots', value: '3', detail: 'Active workspace directories', tone: 'blue' },
      { label: 'Data sources', value: '2', detail: 'Codex and Claude enabled', tone: 'violet' },
      { label: 'Budgets', value: 'Configured', detail: 'Daily and monthly caps visible', tone: 'green' },
      { label: 'Drift risk', value: 'Low', detail: 'Settings look aligned with current flows', tone: 'amber' },
    ],
    highlightsTitle: 'Settings priorities',
    highlights: () => [
      { eyebrow: 'Scope', title: 'Let users understand scan boundaries', body: 'Scan roots and source toggles should make it obvious what data the app can and cannot see.', tone: 'blue' },
      { eyebrow: 'Trust', title: 'Settings affect interpretation', body: 'When sources are disabled, other cockpit views should reflect that honestly.', tone: 'amber' },
      { eyebrow: 'Cost', title: 'Budgeting belongs here', body: 'Operator budgets and warnings are part of sustainable usage, not buried secondary preferences.', tone: 'violet' },
    ],
    activityTitle: 'Recent setting notes',
    activity: () => [
      { title: 'Codex source enabled', meta: 'Current', detail: 'Needed for richer session and cost visibility', status: 'ok' },
      { title: 'Budget thresholds set', meta: 'Current', detail: 'Soft warnings help costs stay understandable', status: 'info' },
      { title: 'Auto-scan scope review', meta: 'Suggested', detail: 'Keep roots explicit as workspace breadth grows', status: 'warn' },
      { title: 'Provider drift', meta: 'Watch', detail: 'Settings should stay aligned with actual assistant routes', status: 'critical' },
    ],
    tableTitle: 'Setting groups',
    tableColumns: ['Group', 'Why it matters', 'Current note'],
    tableRows: () => [
      { primary: 'Scan directories', secondary: 'Determines workspace visibility', tertiary: 'Keep minimal and intentional' },
      { primary: 'Source toggles', secondary: 'Affects session and dashboard truth', tertiary: 'Reflect disabled sources clearly' },
      { primary: 'Budgets', secondary: 'Controls cost behavior', tertiary: 'Good candidate for alerting tie-ins' },
      { primary: 'Update behavior', secondary: 'Controls operator interruption', tertiary: 'Stay quiet unless action matters' },
    ],
    footerNote: () => 'Settings page should make the app feel legible and controllable, not over-configured.',
  },
  status: {
    section: 'Health',
    title: 'System Status',
    subtitle: 'A single place for trust posture, capability health, and recent failures.',
    heroTitle: () => 'Make the app’s reliability visible without making it dramatic.',
    heroBody: (context) =>
      `This page gathers the trust signals that affect every other cockpit section in ${context.repoName}: capture posture, authority boundaries, and whether recent failures need explicit follow-up.`,
    metrics: (context) => [
      { label: 'Overall', value: context.trustState === 'healthy' ? 'OK' : 'Watch', detail: context.trustLabel, tone: context.trustState === 'healthy' ? 'green' : 'amber' },
      { label: 'Capability denials', value: '0', detail: 'No current authority blocks', tone: 'blue' },
      { label: 'Dropped requests', value: '1', detail: 'Recent stale-response discard observed', tone: 'violet' },
      { label: 'Action needed', value: context.trustState === 'healthy' ? 'None' : 'Review capture', detail: 'Operator-visible recovery path required', tone: context.trustState === 'healthy' ? 'green' : 'amber' },
    ],
    highlightsTitle: 'Status principles',
    highlights: () => [
      { eyebrow: 'Clarity', title: 'Separate degraded from broken', body: 'A trust overlay is not the same thing as a top-level failure, and the UI should not blur the two.', tone: 'blue' },
      { eyebrow: 'Recovery', title: 'Make next actions explicit', body: 'If the system is offline, denied, or degraded, show the operator what changed and what to try next.', tone: 'amber' },
      { eyebrow: 'Audit', title: 'Keep a bounded failure memory', body: 'Recent dropped requests or retry exhaustion should be inspectable without becoming permanent noise.', tone: 'violet' },
    ],
    activityTitle: 'Recent status events',
    activity: (context) => [
      { title: 'Capture posture', meta: 'Now', detail: context.trustLabel, status: context.trustState === 'healthy' ? 'ok' : 'warn' },
      { title: 'Retry budget', meta: 'Recent', detail: 'No exhausted retry loops in the current sample', status: 'ok' },
      { title: 'Permission boundary', meta: 'Recent', detail: 'No broadening beyond the approved dashboard contract', status: 'info' },
      { title: 'Dropped request record', meta: 'Recent', detail: 'One stale response was ignored instead of mutating current state', status: 'warn' },
    ],
    tableTitle: 'Status matrix',
    tableColumns: ['Surface', 'Current state', 'Operator action'],
    tableRows: (context) => [
      { primary: 'Capture reliability', secondary: context.trustState === 'healthy' ? 'Healthy' : 'Degraded', tertiary: context.trustState === 'healthy' ? 'No action required' : 'Review ingest and trust overlays' },
      { primary: 'Command authority', secondary: 'Allowed', tertiary: 'Stay fail-closed on new routes' },
      { primary: 'Dropped requests', secondary: 'Bounded', tertiary: 'Inspect only when the count climbs' },
      { primary: 'Telemetry events', secondary: 'Structured', tertiary: 'Keep redacted and operator-relevant' },
    ],
    footerNote: () => 'Status page should help the operator trust the rest of the cockpit, especially when something is only partially healthy.',
  },
};

export function buildCockpitViewModel(
  mode: CockpitMode,
  repoState: RepoState,
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
): CockpitViewModel {
  const context = buildContext(repoState, captureReliabilityStatus);
  const definition = cockpitDefinitions[mode];

  return {
    mode,
    section: definition.section,
    title: definition.title,
    subtitle: definition.subtitle,
    heroTitle: definition.heroTitle(context),
    heroBody: definition.heroBody(context),
    heroAuthorityTier: context.trustAuthority.authorityTier,
    heroAuthorityLabel: context.trustAuthority.authorityLabel,
    trustState: context.trustState,
    metrics: definition.metrics(context).map((metric) => normalizeMetric(metric, context)),
    highlightsTitle: definition.highlightsTitle,
    highlights: definition.highlights(context).map((highlight) => normalizeHighlight(highlight, context)),
    activityTitle: definition.activityTitle,
    activity: definition.activity(context).map((activityItem) => normalizeActivityItem(activityItem, context)),
    tableTitle: definition.tableTitle,
    tableColumns: definition.tableColumns,
    tableRows: definition.tableRows(context).map((row) => normalizeTableRow(row, context)),
    footerNote: definition.footerNote(context),
  };
}
