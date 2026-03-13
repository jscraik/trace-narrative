import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode, SurfaceMode, DataAuthorityTier, SessionExcerpt, BranchNarrative, Snapshot } from '../../core/types';
import { evaluateDriftDelta, type DriftReport } from '../../core/narrative/automation';
import type { RepoState } from '../../hooks/useRepoLoader';
import { describeSurfaceTrust, deriveSurfaceTrustState } from './dashboardState';

function formatConfidence(confidence?: number): string {
  if (confidence === undefined) return 'unknown';
  return `${Math.round(confidence * 100)}%`;
}

function calculateDeterministicCost(session: SessionExcerpt): string {
  // Heuristic: $0.10 base + $0.05 per 5 messages + $0.02 per message length / 1000
  const messageCount = session.messages.length;
  const totalLength = session.messages.reduce((acc, m) => acc + (m.text?.length || 0), 0);
  const cost = 0.10 + (messageCount * 0.05) + (totalLength / 10000);
  return cost.toFixed(2);
}

// Re-export so existing consumers (tests, views) can still import from this module
export type { SurfaceMode } from '../../core/types';

export type SurfaceTone = 'blue' | 'violet' | 'green' | 'amber' | 'red' | 'slate';

export type SurfaceAuthorityCue = {
  authorityTier: DataAuthorityTier;
  authorityLabel: string;
};

export interface SurfaceMetric {
  label: string;
  value: string;
  detail: string;
  tone: SurfaceTone;
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
}

export interface SurfaceHighlight {
  eyebrow: string;
  title: string;
  body: string;
  tone: SurfaceTone;
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
  action?: SurfaceAction;
}

export type SurfaceAction = {
  type: 'open_evidence';
  evidenceId: string;
} | {
  type: 'open_raw_diff';
  commitSha: string;
} | {
  type: 'navigate';
  mode: Mode;
};

export interface SurfaceActivityItem {
  title: string;
  meta: string;
  detail: string;
  status: 'ok' | 'warn' | 'critical' | 'info';
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
  action?: SurfaceAction;
}

export interface SurfaceTableRow {
  primary: string;
  secondary: string;
  tertiary: string;
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
  action?: SurfaceAction;
}

export type SurfaceProvenanceNodeState = 'observed' | 'linked' | 'derived' | 'review';

export interface SurfaceProvenanceNode {
  eyebrow: string;
  title: string;
  detail: string;
  state: SurfaceProvenanceNodeState;
  tone: SurfaceTone;
  edgeLabel?: string;
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
  action?: SurfaceAction;
}

export interface SurfaceProvenancePanel {
  eyebrow: string;
  title: string;
  summary: string;
  footnote: string;
  nodes: Array<SurfaceProvenanceNode & SurfaceAuthorityCue>;
}

export interface NarrativeSurfaceViewModel {
  mode: SurfaceMode;
  section: string;
  title: string;
  subtitle: string;
  heroTitle: string;
  heroBody: string;
  heroAuthorityTier: DataAuthorityTier;
  heroAuthorityLabel: string;
  trustState: 'healthy' | 'degraded';
  metrics: Array<SurfaceMetric & SurfaceAuthorityCue>;
  highlightsTitle: string;
  highlights: Array<SurfaceHighlight & SurfaceAuthorityCue>;
  activityTitle: string;
  activity: Array<SurfaceActivityItem & SurfaceAuthorityCue>;
  tableTitle: string;
  tableColumns: [string, string, string];
  tableRows: Array<SurfaceTableRow & SurfaceAuthorityCue>;
  provenance?: SurfaceProvenancePanel;
  footerNote: string;
  driftReport?: import('../../core/narrative/automation').DriftReport;
}

interface SurfaceContext {
  repoName: string;
  repoPath: string;
  commitCount: number;
  sessionCount: number;
  sessionExcerpts: SessionExcerpt[];
  changedFiles: string[];
  unlinkedSessionCount: number;
  narrative?: BranchNarrative;
  snapshots: Snapshot[];
  hasLiveRepoData: boolean;
  autoIngestEnabled: boolean;
  captureReliabilityMode: string;
  captureReliabilityStatus: CaptureReliabilityStatus | null | undefined;
  trustState: 'healthy' | 'degraded';
  trustLabel: string;
  trustAuthority: SurfaceAuthorityCue;
  driftReport?: DriftReport;
}

const FALLBACK_AUTHORITY: SurfaceAuthorityCue = {
  authorityTier: 'static_scaffold',
  authorityLabel: 'Preview',
};

const LOCAL_REPO_AUTHORITY: SurfaceAuthorityCue = {
  authorityTier: 'derived_summary',
  authorityLabel: 'Derived',
};

const LIVE_CAPTURE_AUTHORITY: SurfaceAuthorityCue = {
  authorityTier: 'live_capture',
  authorityLabel: 'Live',
};

const OTEL_ONLY_AUTHORITY: SurfaceAuthorityCue = {
  authorityTier: 'derived_summary',
  authorityLabel: 'OTEL',
};


function inferCaptureAuthority(
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
): SurfaceAuthorityCue {
  if (!captureReliabilityStatus) {
    return LOCAL_REPO_AUTHORITY;
  }

  if (captureReliabilityStatus.mode === 'OTEL_ONLY') {
    const trustState = deriveSurfaceTrustState(captureReliabilityStatus);
    return {
      ...OTEL_ONLY_AUTHORITY,
      authorityLabel: trustState === 'healthy' ? 'OTEL' : 'OTEL · degraded',
    };
  }

  return {
    ...LIVE_CAPTURE_AUTHORITY,
    authorityLabel: 'Live',
  };
}

type SurfaceAuthoritySeed = {
  authorityTier?: DataAuthorityTier;
  authorityLabel?: string;
};

function normalizeAuthority<T extends SurfaceAuthoritySeed>(
  item: T,
  fallback: SurfaceAuthorityCue,
): T & SurfaceAuthorityCue {
  return {
    ...item,
    authorityTier: item.authorityTier ?? fallback.authorityTier,
    authorityLabel: item.authorityLabel ?? fallback.authorityLabel,
  };
}

function inferAuthorityFromText(
  text: string,
  context: SurfaceContext,
): SurfaceAuthorityCue {
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
      authorityLabel: context.hasLiveRepoData ? 'Repo' : 'Derived',
    };
  }

  return { ...FALLBACK_AUTHORITY };
}

function normalizeMetric(
  metric: SurfaceMetric,
  context: SurfaceContext,
): SurfaceMetric & SurfaceAuthorityCue {
  return normalizeAuthority(
    metric,
    inferAuthorityFromText(`${metric.label} ${metric.detail} ${metric.value}`, context),
  );
}

function normalizeHighlight(
  highlight: SurfaceHighlight,
  context: SurfaceContext,
): SurfaceHighlight & SurfaceAuthorityCue {
  return normalizeAuthority(
    highlight,
    inferAuthorityFromText(`${highlight.eyebrow} ${highlight.title} ${highlight.body}`, context),
  );
}

type ActivitySeed = {
  type: string;
  label: string;
  value: string;
  time: string;
  description: string;
  authority: SurfaceAuthorityCue;
  action?: SurfaceAction;
};

function normalizeActivity(
  activity: ActivitySeed,
): SurfaceActivityItem & SurfaceAuthorityCue {
  let status: SurfaceActivityItem['status'] = 'info';
  const text = `${activity.label} ${activity.value} ${activity.description}`.toLowerCase();
  
  if (text.includes('fail') || text.includes('critical') || text.includes('error') || text.includes('drift')) {
    status = 'critical';
  } else if (text.includes('degraded') || text.includes('warn') || text.includes('spike')) {
    status = 'warn';
  } else if (text.includes('pass') || text.includes('ok') || text.includes('active') || text.includes('healthy') || text.includes('imported')) {
    status = 'ok';
  }

  return {
    title: `${activity.type}: ${activity.label}`,
    meta: activity.time,
    detail: `${activity.value} - ${activity.description}`,
    status: status,
    authorityTier: activity.authority.authorityTier,
    authorityLabel: activity.authority.authorityLabel,
    action: activity.action,
  };
}

function normalizeActivityItem(
  activity: SurfaceActivityItem,
  context: SurfaceContext,
): SurfaceActivityItem & SurfaceAuthorityCue {
  return normalizeAuthority(
    activity,
    inferAuthorityFromText(`${activity.title} ${activity.meta} ${activity.detail}`, context),
  );
}

function mapDriftStatusToActivityStatus(status: DriftReport['status']): SurfaceActivityItem['status'] {
  switch (status) {
    case 'critical':
      return 'critical';
    case 'watch':
      return 'warn';
    default:
      return 'ok';
  }
}

function normalizeTableRow(
  row: SurfaceTableRow,
  context: SurfaceContext,
): SurfaceTableRow & SurfaceAuthorityCue {
  return normalizeAuthority(
    row,
    inferAuthorityFromText(`${row.primary} ${row.secondary} ${row.tertiary}`, context),
  );
}

type SurfaceProvenancePanelSeed = Omit<SurfaceProvenancePanel, 'nodes'> & {
  nodes: SurfaceProvenanceNode[];
};

function normalizeProvenanceNode(
  node: SurfaceProvenanceNode,
  context: SurfaceContext,
): SurfaceProvenanceNode & SurfaceAuthorityCue {
  return normalizeAuthority(
    node,
    inferAuthorityFromText(`${node.eyebrow} ${node.title} ${node.detail}`, context),
  );
}

type SurfaceDefinition = {
  section: string;
  title: string;
  subtitle: (context: SurfaceContext) => string;
  heroTitle: (context: SurfaceContext) => string;
  heroBody: (context: SurfaceContext) => string;
  metrics: (context: SurfaceContext) => SurfaceMetric[];
  highlightsTitle: string;
  highlights: (context: SurfaceContext) => SurfaceHighlight[];
  activityTitle: string;
  activity: (context: SurfaceContext) => SurfaceActivityItem[];
  tableTitle: string;
  tableColumns: [string, string, string];
  tableRows: (context: SurfaceContext) => SurfaceTableRow[];
  provenance?: (context: SurfaceContext) => SurfaceProvenancePanelSeed;
  footerNote: (context: SurfaceContext) => string;
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
  autoIngestEnabled?: boolean,
): SurfaceContext {
  const commitCount = repoState.status === 'ready' ? Math.max(repoState.model.timeline.length, 1) : 47;
  const sessionExcerpts = repoState.status === 'ready' ? (repoState.model.sessionExcerpts ?? []) : [];
  const sessionCount = repoState.status === 'ready'
    ? Math.max(sessionExcerpts.length, 0)
    : 0;
  const trust = describeSurfaceTrust(captureReliabilityStatus);
  const hasLiveRepoData = repoState.status === 'ready';

  const changedFiles = repoState.status === 'ready'
    ? (repoState.model.dirtyFiles ?? repoState.model.filesChanged?.map((f) => f.path) ?? [])
    : [];
  const unlinkedSessionCount = sessionExcerpts.filter(s => !s.linkedCommitSha).length;
  const narrative = repoState.status === 'ready' ? repoState.model.narrative : undefined;
  const snapshots = repoState.status === 'ready' ? (repoState.model.snapshots ?? []) : [];

  return {
    repoName: getRepoName(repoState),
    repoPath: getRepoPath(repoState),
    commitCount,
    sessionCount,
    sessionExcerpts,
    changedFiles,
    unlinkedSessionCount,
    narrative,
    snapshots,
    hasLiveRepoData,
    autoIngestEnabled: autoIngestEnabled ?? false,
    captureReliabilityMode: captureReliabilityStatus?.mode ?? trust.reliabilityMode,
    captureReliabilityStatus,
    trustState: trust.trustState,
    trustLabel: trust.trustLabel,
    trustAuthority: captureReliabilityStatus
      ? inferCaptureAuthority(captureReliabilityStatus)
      : LOCAL_REPO_AUTHORITY,
    driftReport: repoState.status === 'ready' ? evaluateDriftDelta(repoState.model) : undefined,
  };
}

const surfaceDefinitions: Record<SurfaceMode, SurfaceDefinition> = {
  'work-graph': {
    section: 'Narrative',
    title: 'Story Map',
    subtitle: () => 'Cross-repo branch narratives, trust hotspots, and evidence gaps that deserve attention.',
    heroTitle: (context) => `See where ${context.repoName} fits inside the wider story map.`,
    heroBody: (_context) =>
      'This view maps active repos, sleeping branches, and fragile trust lanes so the workspace reads like connected evidence chains instead of disconnected status cards.',
    metrics: (context) => [
      { label: 'Active repos', value: '8', detail: '4 pushed in the last 24h', tone: 'blue' },
      { label: 'Dormant lanes', value: '3', detail: 'Need explicit follow-up', tone: 'amber' },
      { label: 'Linked stories', value: `${context.commitCount}`, detail: 'Commits represented in graph', tone: 'violet' },
      {
        label: 'Drift status',
        value: 'CRITICAL',
        description: 'Mocked critical drift alert.',
        status: 'critical',
        detail: context.driftReport ? context.driftReport.metrics[0].rationale : 'Gathering workspace signals...',
        tone: !context.driftReport
          ? 'slate'
          : context.driftReport.status === 'healthy'
            ? 'green'
            : context.driftReport.status === 'watch'
              ? 'amber'
              : 'red',
        authorityTier: 'system_signal',
        authorityLabel: 'Drift signal',
      },
      { label: 'Trust posture', value: context.trustState === 'healthy' ? 'Stable' : 'Review', detail: context.trustLabel, tone: context.trustState === 'healthy' ? 'green' : 'amber' },
    ],
    highlightsTitle: 'Graph lenses',
    highlights: () => [
      { eyebrow: 'Hot path', title: 'Evidence + telemetry knot', body: 'Recent work keeps converging on dashboard, capture, and rollout verification lanes. That overlap is where trace confidence is won or lost.', tone: 'violet' },
      { eyebrow: 'Dormant risk', title: 'Spec drift on older plans', body: 'Older planning artifacts are aging faster than implementation notes. Treat them as archival until revalidated.', tone: 'amber' },
      { eyebrow: 'Narrative moat', title: 'Trace-first provenance lane', body: 'Keep explainability and evidence trails visible at the graph level so this view feels more trustworthy than a generic activity chart.', tone: 'blue' },
    ],
    activityTitle: 'Recent graph movements',
    activity: (context) => [
      { title: 'trace-narrative', meta: 'now', detail: `${context.commitCount} commits contribute to the active narrative loop`, status: 'ok' },
      { title: 'coding-harness', meta: '42m ago', detail: 'Environment gate cleared after rollout evidence refresh', status: 'info' },
      { title: 'config/codex', meta: '1h ago', detail: 'Automation governance changes touched multiple operator surfaces', status: 'warn' },
      { title: 'otel-collector', meta: '2h ago', detail: 'Telemetry hardening remains a shared dependency for trust-heavy views', status: 'info' },
    ],
    tableTitle: 'Repos needing attention',
    tableColumns: ['Repository', 'Pressure', 'Next move'],
    tableRows: (context) => [
      { primary: context.repoName, secondary: context.hasLiveRepoData ? 'Active evidence lane' : 'Preview', tertiary: `Tracking ${context.commitCount} commits and ${context.sessionCount} sessions.` },
      { primary: 'coding-harness', secondary: 'Stable baseline', tertiary: 'High-confidence automated benchmarks' },
      { primary: 'config/codex', secondary: 'Rule lane', tertiary: 'Guardrails aligned with recent rollout' },
      { primary: 'otel-collector', secondary: 'System bus', tertiary: 'Telemetry source for all views' },
    ],
    provenance: (context) => ({
      eyebrow: 'Signature view',
      title: 'Trace provenance lane',
      summary:
        'Read this rail left to right to see where the story is directly observed, where it is only joined by evidence, and where the operator still needs to verify the claim.',
      footnote:
        context.unlinkedSessionCount === 0
          ? 'All visible sessions currently join to a commit or evidence lane.'
          : `${context.unlinkedSessionCount} session${context.unlinkedSessionCount === 1 ? '' : 's'} still float outside a commit join and should stay visible as unresolved work.`,
      nodes: [
        {
          eyebrow: 'Observed',
          title: context.captureReliabilityMode === 'HYBRID_ACTIVE' ? 'Capture posture is live' : 'Capture posture is constrained',
          detail:
            context.captureReliabilityMode === 'HYBRID_ACTIVE'
              ? 'Codex capture and local repo state are arriving together.'
              : `Current posture: ${context.trustLabel}`,
          state: 'observed',
          tone: context.trustState === 'healthy' ? 'blue' : 'amber',
          authorityTier: context.trustAuthority.authorityTier,
          authorityLabel: context.trustAuthority.authorityLabel,
        },
        {
          eyebrow: 'Joined',
          title: context.unlinkedSessionCount === 0 ? 'Sessions join to commits' : 'Floating sessions remain',
          detail:
            context.unlinkedSessionCount === 0
              ? 'The active branch story has commit-linked session evidence.'
              : 'Some session evidence still needs a commit or file join before the graph can be trusted.',
          state: 'linked',
          tone: context.unlinkedSessionCount === 0 ? 'green' : 'amber',
          edgeLabel: 'linked via',
          action: { type: 'navigate', mode: 'sessions' },
        },
        {
          eyebrow: 'Derived',
          title: context.narrative ? 'Narrative claim is assembled' : 'Narrative is still provisional',
          detail: context.narrative?.summary ?? 'Claims remain scaffolded until repo evidence is opened and reviewed.',
          state: 'derived',
          tone: context.narrative ? 'violet' : 'slate',
          edgeLabel: 'supports',
          action: context.narrative?.evidenceLinks[0]
            ? { type: 'open_evidence', evidenceId: context.narrative.evidenceLinks[0].id }
            : { type: 'navigate', mode: 'repo' },
        },
        {
          eyebrow: 'Decision',
          title: context.trustState === 'healthy' ? 'Open repo evidence next' : 'Pause and verify trust first',
          detail:
            context.trustState === 'healthy'
              ? 'The branch story is ready for deeper inspection in Repo Evidence.'
              : 'Use Trust Center and Live Capture before accepting derived claims as stable.',
          state: 'review',
          tone: context.trustState === 'healthy' ? 'green' : 'red',
          edgeLabel: 'gates',
          authorityTier: context.trustState === 'healthy' ? 'live_repo' : 'system_signal',
          authorityLabel:
            context.trustState === 'healthy'
              ? 'Repo ready'
              : 'Gate active',
          action: { type: 'navigate', mode: context.trustState === 'healthy' ? 'repo' : 'status' },
        },
      ],
    }),
    footerNote: () => 'Recommended next step: use this page to spot the weak joins first, then drop into Repo Evidence for the underlying branch story.',
  },
  assistant: {
    section: 'Integrations',
    title: 'Codex Copilot',
    subtitle: () => 'A Codex-first copilot for repos, sessions, costs, and hygiene.',
    heroTitle: (context) => `Turn ${context.repoName} into a Codex-grounded narrative partner.`,
    heroBody: () =>
      'This assistant is here to reconstruct what changed, why it changed, and how confident we should be. It starts from Codex evidence and keeps provider expansion as an explicit later step.',
    metrics: (context) => [
      { label: 'Context packs', value: '6', detail: 'Repo, session, cost, hooks, hygiene, docs', tone: 'blue' },
      { label: 'Provider phase', value: 'Codex-first', detail: 'Additional providers come after the core shell feels trustworthy', tone: 'violet' },
      { label: 'Action guards', value: 'Fail-closed', detail: 'Recommend before acting', tone: 'green' },
      { 
        label: 'Drift alert', 
        value: context.driftReport ? (context.driftReport.status === 'healthy' ? 'Healthy' : 'Drifting') : 'Calculating', 
        detail: context.driftReport?.metrics[1].rationale || 'Analyzing workspace churn...', 
        tone: !context.driftReport ? 'slate' : (context.driftReport.status === 'healthy' ? 'green' : 'amber') 
      },
      { label: 'Repo scope', value: context.repoName, detail: 'Primary active workspace', tone: 'slate' },
    ],
    highlightsTitle: 'Suggested asks',
    highlights: (context) => [
      {
        eyebrow: 'Explain', 
        title: 'Why did this branch change?', 
        body: `Bridge from this surface into ${context.repoName}'s repo evidence, linked sessions, and the claims we can actually support.`,
        tone: 'violet',
        action: context.narrative?.evidenceLinks[0] ? { type: 'open_evidence' as const, evidenceId: context.narrative.evidenceLinks[0].id } : undefined
      },
      { eyebrow: 'Triage', title: 'What needs attention today?', body: 'Use trust posture, workspace health, and recent activity to recommend the next safe move, not just the loudest move.', tone: 'blue' },
      { eyebrow: 'Protect', title: 'What is risky to clean up?', body: 'Make cleanup suggestions explicit about blast radius, rollback posture, and hidden dependencies before anything looks routine.', tone: 'amber' },
    ],
    activityTitle: 'Conversation starters',
    activity: (context) => [
      ...context.sessionExcerpts.slice(0, 2).map((s) => ({
        title: `Discuss ${s.tool || 'recent'} session`,
        meta: 'Prompt',
        detail: `${s.messages[0]?.text.slice(0, 50)}...`,
        status: 'info' as const,
        authorityTier: 'derived_summary' as const,
        authorityLabel: 'Suggested from recent activity',
        action: s.linkedCommitSha ? { type: 'open_raw_diff' as const, commitSha: s.linkedCommitSha } : undefined
      })),
      ...(context.sessionExcerpts.filter(s => !s.linkedCommitSha).length > 0 ? [{
        title: 'Resolve floating sessions',
        meta: 'Prompt',
        detail: `Link ${context.sessionExcerpts.filter(s => !s.linkedCommitSha).length} unlinked traces to commits.`,
        status: 'warn' as const,
        authorityTier: 'derived_summary' as const,
        authorityLabel: 'Suggested cleanup'
      }] : []),
      ...(context.driftReport && context.driftReport.status !== 'healthy' ? [{
        title: 'High Drift Delta Alert',
        meta: 'System',
        detail: context.driftReport.metrics.find(m => m.status === 'critical' || m.status === 'warn')?.rationale || 'Workspace is drifting from narrative.',
        status: mapDriftStatusToActivityStatus(context.driftReport.status),
        authorityTier: 'system_signal' as const,
        action: { type: 'navigate' as const, mode: 'snapshots' as const }
      }] : []),
      { title: 'Ask for the branch story', meta: 'Prompt', detail: `Summarize the biggest deltas in ${context.repoName} and explain the evidence behind them.`, status: context.hasLiveRepoData ? 'ok' : 'warn' },
      { title: 'Review trust posture', meta: 'Prompt', detail: context.trustLabel, status: context.trustState === 'healthy' ? 'ok' : 'warn' },
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
    section: 'Evidence',
    title: 'Live',
    subtitle: () => 'Active agent sessions, capture reliability, and current operator load.',
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
    activity: (context) => [
      ...context.sessionExcerpts.slice(0, 3).map(s => normalizeActivity({
        type: 'Live',
        label: `${s.tool} session`,
        value: 'Imported',
        description: `Linked at ${formatConfidence(s.linkConfidence)} confidence`,
        time: s.importedAtISO || 'now',
        authority: LIVE_CAPTURE_AUTHORITY
      })),
      { title: 'Repo index stable', meta: 'now', detail: 'No re-scan required for current dashboard slice', status: 'info', authorityTier: 'live_repo', authorityLabel: 'Local indexer' },
    ],
    tableTitle: 'Live lanes',
    tableColumns: ['Lane', 'State', 'Operator note'],
    tableRows: (context) => {
      const toolCues = Array.from(new Set(context.sessionExcerpts.map(s => s.tool))).filter(Boolean);
      return [
        ...toolCues.map(t => ({
          primary: String(t),
          secondary: context.sessionExcerpts.some(s => s.tool === t) ? 'Active' : 'Standby',
          tertiary: `${context.sessionExcerpts.filter(s => s.tool === t).length} sessions in history`
        })),
        { primary: 'OTEL receiver', secondary: context.trustState === 'healthy' ? 'Watching' : 'Degraded', tertiary: context.trustLabel },
      ].slice(0, 4);
    },
    footerNote: () => 'This page should feel ambient and calm: quick to scan, explicit about trust, and never noisy for the sake of motion.',
  },
  sessions: {
    section: 'Evidence',
    title: 'Sessions',
    subtitle: () => 'History of interactive traces and captures',
    heroTitle: (context) => `Browse session history without leaving ${context.repoName}.`,
    heroBody: () =>
      'Session history deserves a dedicated operational index, not just excerpts buried inside repo mode. This view makes those histories first-class.',
    metrics: (context) => [
      { label: 'Total sessions', value: String(context.sessionCount), detail: 'Indexed across all sources', tone: 'blue' },
      {
        label: 'Recorded today',
        value: String(context.sessionExcerpts.filter(s => {
          const today = new Date().toISOString().split('T')[0];
          return s.importedAtISO?.startsWith(today);
        }).length),
        detail: 'New captures since midnight',
        tone: 'violet'
      },
      {
        label: 'Auto-imports',
        value: context.autoIngestEnabled ? 'Active' : 'Standby',
        detail: context.autoIngestEnabled ? 'Listening for file changes' : 'Manual imports only',
        tone: context.autoIngestEnabled ? 'green' : 'slate'
      },
      { label: 'Primary model', value: 'GPT-5', detail: 'Most recent session mix', tone: 'green' },
    ],
    highlightsTitle: 'Session lenses',
    highlights: () => [
      { eyebrow: 'Searchable', title: 'Fast transcript lookup', body: 'Prioritize filters for agent, repo, recency, and linked commit confidence.', tone: 'blue' },
      { eyebrow: 'Trust-aware', title: 'Low-confidence links stay obvious', body: 'Expose why a session is linked and when the evidence is incomplete.', tone: 'amber' },
      { eyebrow: 'Actionable', title: 'Session-to-repo bridge', body: 'One click should move from a session summary into the exact repo narrative context.', tone: 'violet' },
    ],
    activityTitle: 'Recent sessions',
    activity: (context) => [
      ...context.sessionExcerpts.slice(0, 5).map(s => normalizeActivity({
        type: s.tool || 'Session',
        label: s.messages[0]?.text.slice(0, 30) || 'Active conversation',
        value: 'Imported',
        description: `Imported session with ${s.redactionCount ?? 0} redactions`,
        time: s.importedAtISO || 'Just now',
        authority: LIVE_CAPTURE_AUTHORITY
      })),
      { title: 'Session capture service', meta: 'Status', detail: context.trustLabel, status: context.trustState === 'healthy' ? 'ok' : 'info' },
    ],
    tableTitle: 'Session queues',
    tableColumns: ['Session', 'Link state', 'Next step'],
    tableRows: (context) => [
      ...context.sessionExcerpts.slice(0, 4).map(s => ({
        primary: s.messages[0]?.text.slice(0, 30) || 'Session context',
        secondary: s.linkedCommitSha ? `Linked to ${s.linkedCommitSha.slice(0, 7)}` : 'Floating',
        tertiary: s.needsReview ? 'Validate association' : 'Open repo evidence'
      })),
      ...(context.sessionCount === 0 ? [{ primary: 'No sessions found', secondary: '-', tertiary: 'Import a trace to begin' }] : [])
    ].slice(0, 4),
    footerNote: () => 'Sessions should read like reviewable narrative evidence, not just log storage.',
  },
  transcripts: {
    section: 'Evidence',
    title: 'Transcripts',
    subtitle: () => 'Indexed conversation search across imported sessions and commits.',
    heroTitle: () => 'Search the conversation layer directly.',
    heroBody: () =>
      'This surface focuses on precise lookup, quoted matches, and fast jumps into the surrounding repo or session context.',
    metrics: (context) => [
      { label: 'Indexed transcripts', value: String(context.sessionCount), detail: 'Across local agent tools', tone: 'blue' },
      { label: 'Total messages', value: String(context.sessionExcerpts.reduce((acc, s) => acc + s.messages.length, 0)), detail: 'Available for deep search', tone: 'violet' },
      { label: 'Redactions applied', value: String(context.sessionExcerpts.reduce((acc, s) => acc + (s.redactionCount || 0), 0)), detail: 'Unsafe content hidden', tone: 'green' },
      { label: 'Search freshness', value: 'Live', detail: 'Indexes refresh after import', tone: 'slate' },
    ],
    highlightsTitle: 'Search patterns',
    highlights: () => [
      { eyebrow: 'Query', title: 'Find why a file changed', body: 'Search by symbol, branch name, or intent phrase, then pivot into the linked commit narrative.', tone: 'violet' },
      { eyebrow: 'Review', title: 'Spot unsafe assumptions', body: 'Surface transcripts with high tool usage or low-confidence links for manual review.', tone: 'amber' },
      { eyebrow: 'Trace', title: 'Follow a decision', body: 'Jump from a quoted answer to the exact file, diff, and evidence trail.', tone: 'blue' },
    ],
    activityTitle: 'Search coverage',
    activity: (context) => {
      const toolGroups = Array.from(new Set(context.sessionExcerpts.map(s => s.tool))).filter(Boolean);
      return [
        ...toolGroups.map(t => ({
          title: `Search in ${t} sessions`,
          meta: `${context.sessionExcerpts.filter(s => s.tool === t).length} sessions`,
          detail: `Covering ${context.sessionExcerpts.filter(s => s.tool === t).reduce((acc, s) => acc + s.messages.length, 0)} messages`,
          status: 'info' as const
        })),
        ...(context.sessionCount === 0 ? [{ title: 'No transcripts indexed', meta: 'Empty', detail: 'Import sessions to enable transcript search', status: 'warn' as const }] : [])
      ].slice(0, 4);
    },
    tableTitle: 'Transcript sources',
    tableColumns: ['Source', 'Type', 'Search depth'],
    tableRows: (context) => [
      ...context.sessionExcerpts.slice(0, 3).map(s => ({
        primary: s.messages[0]?.text.slice(0, 25) || 'Session',
        secondary: String(s.tool),
        tertiary: `${s.messages.length} interactions`
      })),
      { primary: 'Git History', secondary: 'Repo', tertiary: `${context.commitCount} commit narratives` }
    ].slice(0, 4),
    footerNote: () => 'Search quality matters more than volume here; keep results trustworthy and fast to inspect.',
  },
  tools: {
    section: 'Evidence',
    title: 'Tools',
    subtitle: () => 'Usage mix, failure hotspots, and most-edited files across sessions.',
    heroTitle: () => 'Understand how agent tools are shaping the repo.',
    heroBody: () =>
      'This page treats tool analytics as a first-class operator view while keeping the emphasis on where tool behavior produced meaningful repo impact.',
    metrics: (context) => [
      { label: 'Active tools', value: String(new Set(context.sessionExcerpts.map(s => s.tool)).size), detail: 'Providing session traces', tone: 'blue' },
      { label: 'Hot tool', value: context.sessionExcerpts[0]?.tool || 'None', detail: 'Highest recent activity', tone: 'violet' },
      { label: 'Tool sessions', value: String(context.sessionCount), detail: 'Total instrumented sessions', tone: 'green' },
      { label: 'Avg duration', value: `${Math.round(context.sessionExcerpts.reduce((acc, s) => acc + (s.durationMin || 0), 0) / (context.sessionCount || 1))}m`, detail: 'Per session average', tone: 'slate' },
    ],
    highlightsTitle: 'Tool insights',
    highlights: () => [
      { eyebrow: 'Habits', title: 'Tool mix over time', body: 'Reveal when a branch relied on chat, shell, or file-edit loops and whether that created risk.', tone: 'blue' },
      { eyebrow: 'Pressure', title: 'Retry concentration', body: 'Highlight tools that correlate with parse errors, blocked commands, or manual handoffs.', tone: 'amber' },
      { eyebrow: 'Impact', title: 'Most-edited files', body: 'Promote files that absorb the most tool-driven churn so review effort follows reality.', tone: 'violet' },
    ],
    activityTitle: 'Observed tool activity',
    activity: (context) => [
      ...context.sessionExcerpts.slice(0, 4).map(s => normalizeActivity({
        type: String(s.tool),
        label: s.messages[0]?.text.slice(0, 25) || 'Tool session',
        value: s.durationMin ? `${s.durationMin}m` : 'Active',
        description: `Linked by ${s.autoLinked ? 'auto-link' : 'manual'} at ${formatConfidence(s.linkConfidence)}`,
        time: s.importedAtISO || 'Just now',
        authority: inferCaptureAuthority(context.captureReliabilityStatus)
      })),
      ...(context.sessionCount === 0 ? [{ title: 'No tool data', meta: 'Waiting', detail: 'Instrumented sessions will appear here', status: 'info' as const }] : [])
    ].slice(0, 4),
    tableTitle: 'Tool hotspots',
    tableColumns: ['Tool', 'Efficiency', 'Operator note'],
    tableRows: (context) => [
      ...Array.from(new Set(context.sessionExcerpts.map(s => s.tool))).map(t => {
        const count = context.sessionExcerpts.filter(s => s.tool === t).length;
        return {
          primary: String(t),
          secondary: count > 5 ? 'High volume' : 'Stable',
          tertiary: `${count} sessions tracked`
        };
      }),
      { primary: 'cli-shell', secondary: 'Manual', tertiary: 'Fallback for custom ops' }
    ].slice(0, 4),
    footerNote: () => 'Tools view should help operators learn from execution patterns, not just count commands.',
  },
  costs: {
    section: 'Evidence',
    title: 'Costs',
    subtitle: () => 'Model spend, burn rate, projection, and anomaly windows.',
    heroTitle: () => 'Cost visibility is part of the narrative workstation, not an afterthought.',
    heroBody: () =>
      'This page turns cost analytics into a calmer, more decision-oriented surface: current burn, which models dominate it, and where a budget alert should trigger follow-up.',
    metrics: (context) => [
      { label: 'Today', value: `$${(context.sessionCount * 0.15).toFixed(2)}`, detail: 'Estimated from session activity', tone: 'green' },
      { label: 'Month', value: `$${(context.sessionCount * 4.2).toFixed(0)}`, detail: 'Projected monthly burn', tone: 'blue' },
      { label: 'Primary spend lane', value: 'Codex', detail: 'Default cost posture for the current shell phase', tone: 'violet' },
      { label: 'Active sessions', value: String(context.sessionCount), detail: 'Contributing to total costs', tone: 'amber' },
    ],
    highlightsTitle: 'Budget lenses',
    highlights: () => [
      { eyebrow: 'Projection', title: 'Budget drift before it hurts', body: 'Make the forecast visible enough that spend questions can be answered without opening another tool.', tone: 'blue' },
      { eyebrow: 'Attribution', title: 'Explain where spend came from', body: 'Join cost spikes back to models, sessions, and operator workflows.', tone: 'violet' },
      { eyebrow: 'Intervention', title: 'Suggest safer responses', body: 'Recommend throttling, review, or provider shifts without performing them automatically.', tone: 'amber' },
    ],
    activityTitle: 'Recent spend signals',
    activity: (context) => [
      ...context.sessionExcerpts.slice(0, 3).map(s => ({
        title: `${s.tool} session cost`,
        meta: `$${calculateDeterministicCost(s)}`,
        detail: `Spend attributed to ${s.messages.length} messages`,
        status: 'info' as const,
      })),
      { title: 'Budget threshold warning', meta: 'Preview', detail: 'Monthly projection is nearing configured soft cap', status: 'warn' },
    ],
    tableTitle: 'Spend by model',
    tableColumns: ['Model', 'Trend', 'Operator response'],
    tableRows: (context) => {
      const tools = Array.from(new Set(context.sessionExcerpts.map(s => s.tool))).filter(Boolean);
      return [
        ...tools.map(t => ({
          primary: String(t),
          secondary: 'Stable',
          tertiary: `Attributed to ${context.sessionExcerpts.filter(s => s.tool === t).length} sessions`
        })),
        { primary: 'Legacy runs', secondary: 'Archived', tertiary: 'Historical context only' }
      ].slice(0, 4);
    },
    footerNote: () => 'Cost clarity becomes more credible when each spike has a session and workflow explanation attached to it.',
  },
  timeline: {
    section: 'Evidence',
    title: 'Timeline',
    subtitle: () => 'Commit rhythm, branch context, and narrative drill-down entry points.',
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
    activity: (context) => [
      { title: 'Active branch indexed', meta: 'now', detail: `${context.commitCount} commits verified in ${context.repoName}`, status: 'ok' },
      ...context.sessionExcerpts.slice(0, 2).map(s => normalizeActivity({
        type: 'Timeline',
        label: `${s.tool} link`,
        value: s.linkedCommitSha ? 'Linked' : 'Floating',
        description: s.linkedCommitSha ? `Tied to ${s.linkedCommitSha?.slice(0, 7)}` : 'Awaiting manual join',
        time: s.importedAtISO || 'recently',
        authority: LIVE_CAPTURE_AUTHORITY
      })),
      { title: 'Capture posture', meta: 'Current', detail: context.trustLabel, status: context.trustState === 'healthy' ? 'ok' : 'warn' },
    ],
    tableTitle: 'Drill-down paths',
    tableColumns: ['Entry point', 'Narrative use', 'Preferred landing'],
    tableRows: (context) => [
      { primary: 'Latest commit', secondary: context.repoName, tertiary: `Index of ${context.commitCount} verified entries` },
      ...context.sessionExcerpts.filter(s => !!s.linkedCommitSha).slice(0, 3).map(s => ({
        primary: `Session: ${s.tool}`,
        secondary: `Linked to ${s.linkedCommitSha?.slice(0, 7)}`,
        tertiary: 'Explore narrative bridge'
      })),
      ...(context.sessionExcerpts.filter(s => !s.linkedCommitSha).length > 0 ? [{
        primary: 'Unlinked traces',
        secondary: `${context.sessionExcerpts.filter(s => !s.linkedCommitSha).length} floating`,
        tertiary: 'Link sessions to commits for visibility'
      }] : [])
    ].slice(0, 4),
    provenance: (context) => ({
      eyebrow: 'Signature view',
      title: 'Causal chain rail',
      summary:
        'Timeline becomes more useful when chronology is paired with a visible evidence chain: commit boundary, session join, cited evidence, then the causal claim we are willing to repeat.',
      footnote:
        context.sessionExcerpts.some((session) => !session.linkedCommitSha)
          ? 'Floating sessions should remain visible in the rail so a missing join is treated as part of the story, not hidden debt.'
          : 'Every visible step has at least one commit-linked session join in the current workspace slice.',
      nodes: [
        {
          eyebrow: 'Observed',
          title: 'Commit boundary',
          detail: `${context.commitCount} commits are indexed in the active repo window.`,
          state: 'observed',
          tone: 'blue',
          authorityTier: context.hasLiveRepoData ? 'live_repo' : 'derived_summary',
          authorityLabel: context.hasLiveRepoData ? 'Repo' : 'Derived',
        },
        {
          eyebrow: 'Joined',
          title: context.sessionExcerpts.some((session) => session.linkedCommitSha) ? 'Session evidence attached' : 'Session join still pending',
          detail: context.sessionExcerpts.some((session) => session.linkedCommitSha)
            ? 'At least one session excerpt already lands on a commit boundary.'
            : 'No commit-linked session evidence is currently available in this timeline slice.',
          state: 'linked',
          tone: context.sessionExcerpts.some((session) => session.linkedCommitSha) ? 'green' : 'amber',
          edgeLabel: 'explained by',
          action: { type: 'navigate', mode: 'sessions' },
        },
        {
          eyebrow: 'Derived',
          title: context.narrative ? 'Evidence citation is ready' : 'Citations still need grounding',
          detail: context.narrative?.evidenceLinks[0]?.label ?? 'Open Repo Evidence to confirm which citation best supports this branch story.',
          state: 'derived',
          tone: context.narrative ? 'violet' : 'slate',
          edgeLabel: 'cited as',
          action: context.narrative?.evidenceLinks[0]
            ? { type: 'open_evidence', evidenceId: context.narrative.evidenceLinks[0].id }
            : { type: 'navigate', mode: 'repo' },
        },
        {
          eyebrow: 'Review',
          title: 'Causal claim',
          detail: context.trustState === 'healthy'
            ? 'The timeline is ready for why-driven drill-down.'
            : 'Keep the claim soft until capture posture and joins recover.',
          state: 'review',
          tone: context.trustState === 'healthy' ? 'green' : 'red',
          edgeLabel: 'repeated as',
          authorityTier: context.trustState === 'healthy' ? 'derived_summary' : 'system_signal',
          authorityLabel:
            context.trustState === 'healthy'
              ? 'Derived'
              : 'Trust warning',
          action: { type: 'navigate', mode: context.trustState === 'healthy' ? 'repo' : 'status' },
        },
      ],
    }),
    footerNote: () => 'Timeline should remain a bridge surface: lightweight, fast, and one click away from deeper evidence.',
  },
  'repo-pulse': {
    section: 'Workspace',
    title: 'Workspace Pulse',
    subtitle: (context) => context.narrative?.summary || 'Repo cleanliness, freshness, and things that quietly need attention.',
    heroTitle: (context) => `${context.repoName} is only one pulse in the workspace.`,
    heroBody: () =>
      'This page helps the operator see which repos are quiet, drifting, or risky before those issues become interruptive.',
    metrics: (context) => [
      { label: 'Repos watched', value: '1', detail: 'Primary workspace connected', tone: 'blue' },
      { label: 'Dirty repos', value: context.changedFiles.length > 0 ? '1' : '0', detail: context.changedFiles.length > 0 ? 'Uncommitted changes detected' : 'No uncommitted changes detected', tone: context.changedFiles.length > 0 ? 'amber' : 'green' },
      { label: 'Active story', value: String(context.commitCount), detail: 'Commits in current branch', tone: 'violet' },
      { label: 'Linked context', value: String(context.sessionCount), detail: 'Associated agent sessions', tone: 'amber' },
    ],
    highlightsTitle: 'Pulse heuristics',
    highlights: (context) => [
      { eyebrow: 'Narrative', title: 'Contextual Summary', body: context.narrative?.summary || 'No narrative detected for this branch yet.', tone: 'violet' },
      ... (context.narrative?.highlights.map(h => ({
        eyebrow: 'Insight',
        title: h.title,
        body: h.whyThisMatters,
        tone: 'blue' as SurfaceTone
      })) || [
        { eyebrow: 'Freshness', title: 'What changed recently?', body: 'Sort by recent commit activity to keep the workspace map aligned with actual attention.', tone: 'blue' },
        { eyebrow: 'Risk', title: 'Where is drift hiding?', body: 'Call out dirty or unpushed repos that look harmless until they block a later flow.', tone: 'amber' },
      ]),
    ],
    activityTitle: 'Repo status feed',
    activity: (context) => [
      { 
        title: context.repoName, 
        meta: context.hasLiveRepoData ? 'active' : 'preview', 
        detail: context.hasLiveRepoData 
          ? `Indexed state with ${context.commitCount} commits and ${context.sessionCount} sessions.` 
          : 'Showing fallback preview for the workspace.', 
        status: context.hasLiveRepoData ? 'ok' : 'warn' 
      },
      { title: 'coding-harness', meta: 'clean', detail: 'Recent rollout closure suggests no immediate action', status: 'ok' },
      { title: 'config/codex', meta: 'ahead', detail: 'Guardrail and automation changes pending review', status: 'info' },
      { title: 'otel-collector', meta: 'watch', detail: 'Telemetry hardening is still a shared dependency', status: 'warn' },
    ],
    tableTitle: 'Pulse queue',
    tableColumns: ['Repo', 'Current state', 'Suggested move'],
    tableRows: (context) => [
      { primary: context.repoName, secondary: context.hasLiveRepoData ? 'Ready' : 'Preview', tertiary: context.hasLiveRepoData ? 'Everything indexed and summarized' : 'Loading workspace context...' },
      { primary: 'coding-harness', secondary: 'Archived', tertiary: 'Rollout pass was 2 days ago' },
      { primary: 'config/codex', secondary: 'Clean', tertiary: 'No new guardrail drift detected' },
      { primary: 'otel-collector', secondary: 'Quiet', tertiary: 'Last activity was 4h ago' },
    ],
    footerNote: () => 'Repo pulse works best when it pushes the operator toward the right repo, not just a bigger list.',
  },
  diffs: {
    section: 'Workspace',
    title: 'Diffs',
    subtitle: () => 'Session-linked file changes and high-churn surfaces.',
    heroTitle: () => 'Make file change review feel connected to the story, not detached from it.',
    heroBody: () =>
      'In Trace Narrative, the diff surface should become the evidence-centric companion to repo mode: changed files, linked sessions, and review hotspots.',
    metrics: (context) => [
      { label: 'Changed files', value: String(context.changedFiles.length), detail: 'Across the active review window', tone: 'blue' },
      { label: 'Session-linked', value: String(context.sessionExcerpts.filter(s => !!s.linkedCommitSha).length), detail: 'Files with direct conversation context', tone: 'violet' },
      { label: 'Active traces', value: String(context.sessionCount), detail: 'Providing narrative evidence', tone: 'amber' },
      { label: 'Drift churn', value: String(context.driftReport?.metrics.find(m => m.id === 'uncommitted_churn')?.value || 0), detail: 'Uncommitted churn (loc)', tone: context.driftReport?.status === 'healthy' ? 'green' : 'amber' },
      { label: 'Ready for review', value: context.changedFiles.length > 0 ? String(context.changedFiles.length) : '0', detail: 'Sufficient evidence present', tone: 'green' },
    ],
    highlightsTitle: 'Diff workflows',
    highlights: () => [
      { eyebrow: 'Evidence', title: 'Show the file and the reason', body: 'A diff without nearby narrative evidence should feel obviously incomplete.', tone: 'violet' },
      { eyebrow: 'Heatmap', title: 'Expose repeated churn', body: 'Highlight files that are bouncing between tools, sessions, or branches.', tone: 'amber' },
      { eyebrow: 'Speed', title: 'Keep review friction low', body: 'Use this page for quick scan-and-open, then hand off to repo mode for deep reading.', tone: 'blue' },
    ],
    activityTitle: 'Diff hotspots',
    activity: (context) => [
      ...context.changedFiles.slice(0, 4).map(file => ({
        title: file,
        meta: 'local change',
        detail: 'Touched in current workspace session',
        status: 'ok' as const
      })),
      ...(context.changedFiles.length === 0 ? [{ title: 'No active diffs', meta: 'Clean', detail: 'Workspace matches branch head', status: 'ok' as const }] : [])
    ],
    tableTitle: 'File review queue',
    tableColumns: ['File', 'Narrative state', 'Why inspect'],
    tableRows: (context) => [
      ...context.changedFiles.slice(0, 8).map(file => {
        const isLinked = context.sessionExcerpts.some(s => s.messages.some(m => m.text?.includes(file)));
        const evidence = context.narrative?.evidenceLinks.find(e => e.filePath?.includes(file) || e.label.includes(file));
        
        return {
          primary: file,
          secondary: isLinked ? 'Linked' : 'Metadata',
          tertiary: isLinked ? 'Referenced in session activity' : (evidence ? 'Mentioned in narrative' : 'Pending narrative verification'),
          action: evidence ? { type: 'open_evidence' as const, evidenceId: evidence.id } : undefined
        };
      }),
      ...(context.changedFiles.length === 0 ? [
        { primary: 'src/App.tsx', secondary: 'Stable', tertiary: 'Controls shell routing and view orchestration' },
        { primary: 'src/ui/views/NarrativeSurfaceView.tsx', secondary: 'Stable', tertiary: 'Defines the updated operator surfaces' }
      ] : [])
    ],
    footerNote: () => 'Diffs page should reduce context-switch cost and make it obvious when repo mode is the right next step.',
  },
  snapshots: {
    section: 'Workspace',
    title: 'Snapshots',
    subtitle: () => 'Saved workspace states, branch snapshots, and recovery moments.',
    heroTitle: () => 'Treat workspace state as something you can revisit, not just remember.',
    heroBody: () =>
      'This view keeps snapshot thinking simple: save meaningful snapshots, then compare or recover from them later.',
    metrics: (context) => [
      { label: 'Saved snapshots', value: String(context.snapshots.length), detail: `${context.snapshots.length} snapshots in local storage`, tone: 'blue' },
      { label: 'Repo state', value: context.hasLiveRepoData ? 'Live' : 'Static', detail: 'Based on current loader health', tone: 'violet' },
      { label: 'Recovery ready', value: context.snapshots.length > 0 ? 'Yes' : 'No', detail: context.snapshots.length > 0 ? 'Latest snapshots available' : 'Awaiting local capture service', tone: 'green' },
      { label: 'Drift staleness', value: `${context.driftReport?.metrics.find(m => m.id === 'snapshot_staleness')?.value || 0}h`, detail: 'Time since last snapshot', tone: context.driftReport?.status === 'healthy' ? 'green' : 'amber' },
      { label: 'Files in dirty state', value: String(context.changedFiles.length), detail: 'Uncommitted changes in workspace', tone: 'amber' },
    ],
    highlightsTitle: 'Snapshot roles',
    highlights: () => [
      { eyebrow: 'Snapshot', title: 'Freeze an operator moment', body: 'Capture repo state, session context, and intended next move together.', tone: 'blue' },
      { eyebrow: 'Compare', title: 'Detect drift from plan', body: 'Use snapshots to spot how far the live workspace has moved from the last verified baseline.', tone: 'amber' },
      { eyebrow: 'Recover', title: 'Support rollback reasoning', body: 'Keep enough metadata that a snapshot can justify a revert or a retry, not just exist as a timestamp.', tone: 'violet' },
    ],
    activityTitle: 'Recent snapshots',
    activity: (context) => (context.snapshots.slice(0, 4).map(snap => ({
      title: snap.message || `Snapshot ${snap.id.slice(5, 12)}`,
      meta: new Date(snap.atISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      detail: `${snap.filesChanged.length} files changed on ${snap.branch}`,
      status: (snap.type === 'automatic' ? 'info' : 'ok') as 'info' | 'ok'
    })) as SurfaceActivityItem[]).concat(context.snapshots.length === 0 ? [
      { title: 'No snapshots captured', meta: 'Idle', detail: 'Snapshot engine is active but awaiting trigger', status: 'info' }
    ] : []),
    tableTitle: 'Snapshot inventory',
    tableColumns: ['Snapshot', 'Type', 'Change count'],
    tableRows: (context) => context.snapshots.map(snap => ({
      primary: snap.id,
      secondary: snap.type.charAt(0).toUpperCase() + snap.type.slice(1),
      tertiary: `${snap.filesChanged.length} files changed`
    })).concat(context.snapshots.length === 0 ? [
      { primary: 'Automatic preflight', secondary: 'Health check', tertiary: '0 files' }
    ] : []),
    footerNote: () => 'Snapshots become powerful when they explain what was true, not just when they were saved.',
  },
  worktrees: {
    section: 'Workspace',
    title: 'Worktrees',
    subtitle: () => 'Branch isolation, detached states, and workspace sprawl.',
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
      { title: 'feature/narrative-surfaces', meta: 'dirty', detail: 'Active UI pass across shell and view routing', status: 'warn' },
      { title: 'main', meta: 'clean', detail: 'Safe fallback for verification and comparison', status: 'ok' },
      { title: 'release/snapshot', meta: 'detached', detail: 'Needs review before any cleanup action', status: 'critical' },
      { title: 'telemetry-lane', meta: 'clean', detail: 'Useful for isolated reliability experiments', status: 'info' },
    ],
    tableTitle: 'Worktree inventory',
    tableColumns: ['Worktree', 'Status', 'Operator advice'],
    tableRows: () => [
      { primary: 'feature/narrative-surfaces', secondary: 'Dirty', tertiary: 'Continue implementation and validate before prune' },
      { primary: 'main', secondary: 'Clean', tertiary: 'Use as stable comparison point' },
      { primary: 'release/snapshot', secondary: 'Detached', tertiary: 'Do not delete until intent is confirmed' },
      { primary: 'telemetry-lane', secondary: 'Clean', tertiary: 'Keep for reliability verification' },
    ],
    footerNote: () => 'Worktrees page should be operationally conservative: more guardrails, fewer tempting destructive actions.',
  },
  attribution: {
    section: 'Workspace',
    title: 'Attribution',
    subtitle: () => 'AI vs human contribution signals, evidence gaps, and trust cues.',
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
    section: 'Integrations',
    title: 'Skills',
    subtitle: () => 'Local skill inventory, quality cues, and discovery lanes.',
    heroTitle: () => 'Skills are part of the workstation, not external trivia.',
    heroBody: () =>
      'This view promotes skill availability and quality signals into the workstation. It should make local capabilities discoverable without becoming a marketplace.',
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
      { title: 'brainstorming', meta: 'active', detail: 'Used to define the new surface direction before implementation', status: 'ok' },
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
      { primary: 'playwright-interactive', secondary: 'Visual QA', tertiary: 'Useful once surface routes render live' },
    ],
    footerNote: () => 'Skills view should help the operator choose the right workflow, not drown them in catalogue depth.',
  },
  agents: {
    section: 'Integrations',
    title: 'Agents',
    subtitle: () => 'Repo-local agent definitions, multi-agent roles, and orchestration readiness.',
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
      { primary: 'design-implementation-reviewer', secondary: 'Visual discrepancy review', tertiary: 'Useful after the first surface pass lands' },
      { primary: 'kieran-typescript-reviewer', secondary: 'Strict TS review', tertiary: 'Helpful after surface data wiring' },
      { primary: 'monitor', secondary: 'Long-running poll', tertiary: 'Only for external waits, not this UI pass' },
    ],
    footerNote: () => 'Agents page should help the operator decide when not to delegate just as much as when to do it.',
  },
  memory: {
    section: 'Integrations',
    title: 'Memory',
    subtitle: () => 'Workspace memory state, reusable learnings, and context hygiene.',
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
      { title: 'Telemetry hardening notes', meta: 'Relevant', detail: 'Support reliability messaging across shared narrative surfaces', status: 'info' },
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
    section: 'Integrations',
    title: 'Hooks',
    subtitle: () => 'Trigger points, health, and command safety around workstation hooks.',
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
    section: 'Integrations',
    title: 'Setup',
    subtitle: () => 'Repo instructions, config roots, MCP health, and onboarding readiness.',
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
      { title: 'Capabilities review', meta: 'Ongoing', detail: 'Keep Tauri authority narrow as surface breadth grows', status: 'info' },
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
    section: 'Integrations',
    title: 'Ports',
    subtitle: () => 'Bound services, local addresses, and process ownership clues.',
    heroTitle: () => 'Local network state belongs in the workstation when it affects trust.',
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
      { eyebrow: 'Context', title: 'Tie ports back to features', body: 'When a webhook or app server matters to the UI, point directly to the affected narrative surface.', tone: 'violet' },
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
    subtitle: () => 'Zombie processes, divergence, dead directories, and cleanup suggestions.',
    heroTitle: () => 'Operational cleanliness deserves a dedicated view.',
    heroBody: () =>
      'This page can be highly useful while still being clear about risk, reversibility, and when a human should inspect before acting.',
    metrics: (context) => [
      { label: 'Stale sessions', value: String(Math.max(0, context.sessionCount - 5)), detail: 'Candidates for cleanup or archival', tone: 'amber' },
      { label: 'Repo health', value: context.hasLiveRepoData ? 'Stable' : 'Unknown', detail: 'Based on current index state', tone: 'green' },
      { label: 'Linked rate', value: context.sessionCount > 0 ? `${Math.round((context.sessionExcerpts.filter(s => !!s.linkedCommitSha).length / context.sessionCount) * 100)}%` : '0%', detail: 'Sessions with thread connections', tone: 'blue' },
      { label: 'Trust state', value: context.trustState === 'healthy' ? 'Verified' : 'Review', detail: context.trustLabel, tone: 'violet' },
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
    tableRows: (context) => [
      ...(context.sessionExcerpts.filter(s => !s.linkedCommitSha).length > 0 ? [{
        primary: 'Unlinked sessions',
        secondary: 'Medium',
        tertiary: `${context.sessionExcerpts.filter(s => !s.linkedCommitSha).length} traces awaiting repo association`
      }] : []),
      { primary: 'Remote divergence', secondary: 'Low', tertiary: 'Review sync path and stash state first' },
      { primary: 'Zombie process', secondary: 'Low', tertiary: 'Offer kill preview, not instant action' },
      { primary: 'Dead directory', secondary: 'Low', tertiary: 'Surface path and owner before cleanup' },
    ].slice(0, 4),
    footerNote: () => 'Hygiene page should feel trustworthy because it is cautious, not because it is aggressive.',
  },
  deps: {
    section: 'Health',
    title: 'Dependencies',
    subtitle: () => 'Package freshness, major updates, and known risk signals.',
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
      { title: 'React + Vite lane', meta: 'Stable', detail: 'Core UI stack looks healthy for the current surface pass', status: 'ok' },
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
    subtitle: () => 'Environment file hygiene, gitignore coverage, and example parity.',
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
    section: 'Configure',
    title: 'Settings',
    subtitle: () => 'Scan roots, Codex capture defaults, budgets, and app behavior.',
    heroTitle: () => 'Settings should explain the operator contract, not just expose switches.',
    heroBody: () =>
      'Settings are a broad control surface, but the emphasis stays on why each setting affects trust, capture, or operator workload.',
    metrics: () => [
      { label: 'Scan roots', value: '3', detail: 'Active workspace directories', tone: 'blue' },
      { label: 'Data sources', value: 'Codex-first', detail: 'Other providers stay staged until the shell narrative is stable', tone: 'violet' },
      { label: 'Budgets', value: 'Configured', detail: 'Daily and monthly caps visible', tone: 'green' },
      { label: 'Drift risk', value: 'Low', detail: 'Settings look aligned with current flows', tone: 'amber' },
    ],
    highlightsTitle: 'Settings priorities',
    highlights: () => [
      { eyebrow: 'Scope', title: 'Let users understand scan boundaries', body: 'Scan roots and source toggles should make it obvious what data the app can and cannot see.', tone: 'blue' },
      { eyebrow: 'Trust', title: 'Settings affect interpretation', body: 'When sources are disabled, other narrative surfaces should reflect that honestly.', tone: 'amber' },
      { eyebrow: 'Cost', title: 'Budgeting belongs here', body: 'Operator budgets and warnings are part of sustainable usage, not buried secondary preferences.', tone: 'violet' },
    ],
    activityTitle: 'Recent setting notes',
    activity: () => [
      { title: 'Codex source enabled', meta: 'Current', detail: 'Needed for richer session and cost visibility', status: 'ok' },
      { title: 'Budget thresholds set', meta: 'Current', detail: 'Soft warnings help costs stay understandable', status: 'info' },
      { title: 'Auto-scan scope review', meta: 'Suggested', detail: 'Keep roots explicit as workspace breadth grows', status: 'warn' },
      { title: 'Provider expansion held', meta: 'Watch', detail: 'Do not broaden sources until Codex-first trust is working cleanly', status: 'critical' },
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
    title: 'Trust Center',
    subtitle: () => 'Codex capture health, authority boundaries, and the next safe recovery move.',
    heroTitle: () => 'Make trust visible, legible, and actionable.',
    heroBody: (context) =>
      `This page gathers the trust signals that affect every other narrative surface in ${context.repoName}: Codex capture posture, evidence joins, authority boundaries, and whether recent failures need explicit follow-up before the story is trusted.`,
    metrics: (context) => [
      {
        label: 'Evidence posture',
        value: context.trustState === 'healthy' ? 'Grounded' : 'Caution',
        detail: context.trustLabel,
        tone: context.trustState === 'healthy' ? 'green' : 'amber',
      },
      {
        label: 'Codex capture',
        value: context.captureReliabilityMode === 'HYBRID_ACTIVE' ? 'Hybrid' : context.captureReliabilityMode === 'OTEL_ONLY' ? 'Baseline' : 'Degraded',
        detail: 'Provider expansion stays secondary until this lane is trustworthy',
        tone: context.trustState === 'healthy' ? 'blue' : 'amber',
      },
      { label: 'Authority boundary', value: 'Fail-closed', detail: 'No privileged action should outrun its runtime check', tone: 'violet' },
      {
        label: 'Next safe move',
        value: context.trustState === 'healthy' ? 'Inspect evidence' : 'Review capture',
        detail: context.trustState === 'healthy' ? 'Repo Evidence and Live Capture can be trusted as-is' : 'Use Live Capture and Settings before trusting derived claims or attribution',
        tone: context.trustState === 'healthy' ? 'green' : 'amber',
      },
    ],
    highlightsTitle: 'Trust principles',
    highlights: () => [
      { eyebrow: 'Clarity', title: 'Separate degraded from broken', body: 'A trust overlay is not the same thing as a total system failure, and the UI should not blur the two.', tone: 'blue' },
      { eyebrow: 'Codex first', title: 'Protect the initial provider lane', body: 'Before adding more providers, make sure Codex capture, linking, and recovery cues are dependable.', tone: 'violet' },
      { eyebrow: 'Recovery', title: 'Make next actions explicit', body: 'If capture is degraded, show what changed, what is still safe to inspect, and which surface should be opened next.', tone: 'amber' },
    ],
    activityTitle: 'Recent trust events',
    activity: (context) => [
      { title: 'Capture posture', meta: 'Now', detail: context.trustLabel, status: context.trustState === 'healthy' ? 'ok' : 'warn' },
      { title: 'Codex session ingest', meta: 'Now', detail: context.sessionCount > 0 ? `${context.sessionCount} sessions available for trust-aware evidence` : 'No imported Codex sessions yet', status: context.sessionCount > 0 ? 'info' : 'warn' },
      { title: 'Authority boundary', meta: 'Recent', detail: 'No broadening beyond the approved Codex-first shell contract', status: 'ok' },
      { title: 'Dropped request record', meta: 'Recent', detail: 'Stale responses were ignored instead of mutating the active narrative state', status: 'warn' },
    ],
    tableTitle: 'Trust matrix',
    tableColumns: ['Surface', 'Current state', 'Operator action'],
    tableRows: (context) => [
      { primary: 'Capture reliability', secondary: context.trustState === 'healthy' ? 'Healthy' : 'Degraded', tertiary: context.trustState === 'healthy' ? 'Safe to inspect evidence normally' : 'Open Live Capture and Settings before trusting derived claims' },
      { primary: 'Repo evidence joins', secondary: context.unlinkedSessionCount === 0 ? 'Linked' : `${context.unlinkedSessionCount} floating`, tertiary: context.unlinkedSessionCount === 0 ? 'Narrative links are grounded' : 'Link floating sessions before over-reading attribution or intent' },
      { primary: 'Command authority', secondary: 'Fail-closed', tertiary: 'Keep new routes behind explicit capability checks' },
      { primary: 'Dropped requests', secondary: 'Bounded', tertiary: 'Inspect only when the count climbs' },
    ],
    provenance: (context) => ({
      eyebrow: 'Signature view',
      title: 'Trust decision rail',
      summary:
        'Trust Center should show what must be true before a narrative claim becomes safe to repeat: capture posture, evidence joins, authority boundary, then the next safe operator move.',
      footnote:
        context.trustState === 'healthy'
          ? 'The rail currently ends in an inspectable evidence action rather than a stop condition.'
          : 'The rail ends in a verification gate so degraded trust cannot masquerade as routine work.',
      nodes: [
        {
          eyebrow: 'Observed',
          title: context.trustState === 'healthy' ? 'Capture posture is grounded' : 'Capture posture is degraded',
          detail: context.trustLabel,
          state: 'observed',
          tone: context.trustState === 'healthy' ? 'green' : 'amber',
          authorityTier: context.trustAuthority.authorityTier,
          authorityLabel: context.trustAuthority.authorityLabel,
        },
        {
          eyebrow: 'Joined',
          title: context.unlinkedSessionCount === 0 ? 'Evidence joins hold' : 'Evidence joins are incomplete',
          detail:
            context.unlinkedSessionCount === 0
              ? 'Session evidence currently lands on commits or files.'
              : `${context.unlinkedSessionCount} floating session${context.unlinkedSessionCount === 1 ? '' : 's'} should be linked before trusting attribution-heavy claims.`,
          state: 'linked',
          tone: context.unlinkedSessionCount === 0 ? 'green' : 'amber',
          edgeLabel: 'depends on',
          action: { type: 'navigate', mode: 'sessions' },
        },
        {
          eyebrow: 'Derived',
          title: 'Authority gate stays fail-closed',
          detail: 'Runtime checks still decide whether privileged actions are actually allowed.',
          state: 'derived',
          tone: 'violet',
          edgeLabel: 'bounded by',
          authorityTier: 'derived_summary',
          authorityLabel: 'Shell contract',
        },
        {
          eyebrow: 'Review',
          title: context.trustState === 'healthy' ? 'Open repo evidence' : 'Review capture first',
          detail:
            context.trustState === 'healthy'
              ? 'The next safe move is deeper evidence inspection.'
              : 'Use Live Capture or Settings before promoting derived claims into operator truth.',
          state: 'review',
          tone: context.trustState === 'healthy' ? 'green' : 'red',
          edgeLabel: 'permits',
          authorityTier: context.trustState === 'healthy' ? 'live_repo' : 'system_signal',
          authorityLabel:
            context.trustState === 'healthy'
              ? 'Evidence ready'
              : 'Gate active',
          action: { type: 'navigate', mode: context.trustState === 'healthy' ? 'repo' : 'live' },
        },
      ],
    }),
    footerNote: () => 'Trust Center should help the operator decide what is safe to believe right now, what still needs verification, and where to go next to close the gap.',
  },
};

export function buildNarrativeSurfaceViewModel(
  mode: SurfaceMode,
  repoState: RepoState,
  captureReliabilityStatus?: CaptureReliabilityStatus | null,
  autoIngestEnabled?: boolean,
): NarrativeSurfaceViewModel {
  const context = buildContext(repoState, captureReliabilityStatus, autoIngestEnabled);
  const definition = surfaceDefinitions[mode];
  const provenance = definition.provenance?.(context);

  return {
    mode,
    section: definition.section,
    title: definition.title,
    subtitle: definition.subtitle(context),
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
    provenance: provenance
      ? {
          ...provenance,
          nodes: provenance.nodes.map((node) => normalizeProvenanceNode(node, context)),
        }
      : undefined,
    footerNote: definition.footerNote(context),
    driftReport: context.driftReport,
  };
}
