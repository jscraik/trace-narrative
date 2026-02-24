export type BranchStatus = 'open' | 'merged';

export type Stats = {
  added: number;
  removed: number;
  files: number;
  commits: number;
  prompts: number;
  responses: number;
};

export type HeaderMetricUnavailableReason =
  | 'NO_TRACE_DATA'
  | 'SOURCE_UNSUPPORTED'
  | 'LOADING'
  | 'PERMISSION_DENIED'
  | 'ERROR';

export type HeaderMetric =
  | { kind: 'known'; value: number }
  | { kind: 'unavailable'; reason: HeaderMetricUnavailableReason };

export type BranchHeaderMetricSet = {
  added: HeaderMetric;
  removed: HeaderMetric;
  files: HeaderMetric;
  commits: HeaderMetric;
  prompts: HeaderMetric;
  responses: HeaderMetric;
};

export type BranchHeaderViewModel =
  | {
      kind: 'hidden';
      reason:
        | 'mode_unsupported'
        | 'repo_idle'
        | 'model_missing'
        | 'feature_disabled';
    }
  | {
      kind: 'shell';
      state: 'loading' | 'error';
      message: string;
    }
  | {
      kind: 'full';
      title: string;
      status: BranchStatus;
      description: string;
      metrics: BranchHeaderMetricSet;
      isFilteredView: boolean;
    };

export type IntentType = 'feature' | 'fix' | 'refactor' | 'test' | 'docs' | 'other';

export type IntentItem = {
  id: string;
  text: string;
  tag?: string;
  type?: IntentType;
};

export type FileChange = {
  path: string;
  additions: number;
  deletions: number;
};

export type SessionTool =
  | 'claude-code'
  | 'codex'
  | 'kimi'
  | 'cursor'
  | 'gemini'
  | 'copilot'
  | 'continue'
  | 'unknown';

export type SessionMessageRole = 'user' | 'assistant' | 'thinking' | 'plan' | 'tool_call';

export type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  text: string;
  files?: string[];
  toolName?: string;
  toolInput?: unknown;
};

export type SessionExcerpt = {
  id: string;
  tool: SessionTool;
  agentName?: string;
  durationMin?: number;
  messages: SessionMessage[];
  importedAtISO?: string;
  // Link state (Phase 1 MVP)
  linkedCommitSha?: string;
  linkConfidence?: number;
  autoLinked?: boolean;
  needsReview?: boolean;
  redactionCount?: number;
};

export type TimelineStatus = 'ok' | 'warn' | 'error';

export type SessionBadgeTool =
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'gemini'
  | 'copilot'
  | 'continue'
  | 'kimi'
  | 'unknown';

export type TimelineBadge = {
  type: 'file' | 'test' | 'trace' | 'contribution' | 'session' | 'anchor';
  label: string;
  status?: 'passed' | 'failed' | 'mixed';
  stats?: {
    aiPercentage: number;
    tool?: string;
    model?: string;
  };
  anchor?: {
    hasAttributionNote: boolean;
    hasSessionsNote: boolean;
    hasLineageNote: boolean;
  };
  sessionTools?: SessionBadgeTool[];
};

export type TraceContributorType = 'human' | 'ai' | 'mixed' | 'unknown';

export type TraceContributor = {
  type: TraceContributorType;
  modelId?: string;
};

export type TraceRange = {
  startLine: number;
  endLine: number;
  contentHash?: string;
  contributor?: TraceContributor;
};

export type TraceConversation = {
  url?: string;
  contributor?: TraceContributor;
  ranges: TraceRange[];
  related?: Array<{ type: string; url: string }>;
};

export type TraceFile = {
  path: string;
  conversations: TraceConversation[];
};

export type TraceRecord = {
  id: string;
  version: string;
  timestamp: string;
  vcs: { type: 'git'; revision: string };
  tool?: { name?: string; version?: string };
  files: TraceFile[];
  metadata?: Record<string, unknown>;
};

export type TraceFileSummary = {
  path: string;
  aiLines: number;
  humanLines: number;
  mixedLines: number;
  unknownLines: number;
  aiPercent: number;
};

export type TraceCommitSummary = {
  commitSha: string;
  aiLines: number;
  humanLines: number;
  mixedLines: number;
  unknownLines: number;
  aiPercent: number;
  modelIds: string[];
  toolNames: string[];
};

export type TraceCollectorStatus = {
  state: 'active' | 'inactive' | 'error' | 'partial';
  message?: string;
  issues?: string[];
  lastSeenAtISO?: string;
};

export type TraceCollectorConfig = {
  codexOtelLogPath: string;
  codexOtelReceiverEnabled: boolean;
};

export type TimelineNode = {
  id: string;
  atISO?: string;
  label?: string;
  status?: TimelineStatus;
  type: 'milestone' | 'commit';
  badges?: TimelineBadge[];
  testRunId?: string;
};

export type NarrativeExecutionState = 'running' | 'ready' | 'needs_attention' | 'failed';

export type NarrativeDetailLevel = 'summary' | 'evidence' | 'diff';

export type NarrativeFeedbackActorRole = 'developer' | 'reviewer';
export type NarrativeFeedbackType = 'highlight_key' | 'highlight_wrong' | 'branch_missing_decision';
export type NarrativeFeedbackTargetKind = 'highlight' | 'branch';

export type NarrativeFeedbackAction = {
  actorRole: NarrativeFeedbackActorRole;
  feedbackType: NarrativeFeedbackType;
  targetKind: NarrativeFeedbackTargetKind;
  targetId?: string;
  detailLevel: NarrativeDetailLevel;
};

export type NarrativeEvidenceKind = 'commit' | 'session' | 'file' | 'diff';

export type NarrativeEvidenceLink = {
  id: string;
  kind: NarrativeEvidenceKind;
  label: string;
  commitSha?: string;
  filePath?: string;
  sessionId?: string;
};

export type NarrativeHighlight = {
  id: string;
  title: string;
  whyThisMatters: string;
  confidence: number;
  evidenceLinks: NarrativeEvidenceLink[];
};

export type StakeholderAudience = 'executive' | 'manager' | 'engineer';

export type StakeholderProjection = {
  audience: StakeholderAudience;
  headline: string;
  bullets: string[];
  risks: string[];
  evidenceLinks: NarrativeEvidenceLink[];
};

export type StakeholderProjections = Record<StakeholderAudience, StakeholderProjection>;

export type DecisionArchaeologyEntry = {
  id: string;
  title: string;
  intent: string;
  tradeoffs: string[];
  alternatives: string[];
  evidenceLinks: NarrativeEvidenceLink[];
  confidence: number;
};

export type BranchNarrative = {
  schemaVersion: number;
  generatedAtISO: string;
  state: NarrativeExecutionState;
  summary: string;
  confidence: number;
  highlights: NarrativeHighlight[];
  evidenceLinks: NarrativeEvidenceLink[];
  fallbackReason?: string;
};

export type NarrativeCalibrationProfile = {
  repoId: number;
  rankingBias: number;
  confidenceOffset: number;
  confidenceScale: number;
  sampleCount: number;
  windowStartISO?: string;
  windowEndISO?: string;
  actorWeightPolicyVersion: string;
  branchMissingDecisionCount: number;
  highlightAdjustments: Record<string, number>;
  updatedAtISO: string;
};

export type GitHubContextStatus = 'disabled' | 'loading' | 'ready' | 'partial' | 'empty' | 'error';

export type GitHubContextEntry = {
  id: string;
  number?: number;
  title: string;
  body?: string;
  reviewSummary?: string;
  url?: string;
  updatedAtISO?: string;
  redactionHits: number;
};

export type GitHubContextState = {
  status: GitHubContextStatus;
  entries: GitHubContextEntry[];
  lastLoadedAtISO?: string;
  failedFileCount?: number;
  error?: string;
};

export type NarrativeObservabilityMetrics = {
  layerSwitchedCount: number;
  evidenceOpenedCount: number;
  fallbackUsedCount: number;
  killSwitchTriggeredCount: number;
  lastEventAtISO?: string;
};

export type NarrativeRolloutStatus = 'healthy' | 'watch' | 'rollback';

export type NarrativeRubricMetric = {
  id: 'confidence' | 'evidence_coverage' | 'projection_completeness' | 'fallback_health' | 'connector_safety';
  label: string;
  score: number;
  threshold: number;
  status: 'pass' | 'warn' | 'fail';
  rationale: string;
};

export type NarrativeKillSwitchRule = {
  id: string;
  label: string;
  severity: 'warning' | 'critical';
  triggered: boolean;
  rationale: string;
};

export type NarrativeRolloutReport = {
  status: NarrativeRolloutStatus;
  rubric: NarrativeRubricMetric[];
  rules: NarrativeKillSwitchRule[];
  averageScore: number;
  generatedAtISO: string;
};

export type BranchViewModel = {
  source: 'demo' | 'git';
  title: string;
  status: BranchStatus;
  description: string;
  stats: Stats;
  intent: IntentItem[];
  timeline: TimelineNode[];
  // Optional, mainly for demo mode
  sessionExcerpts?: SessionExcerpt[];
  filesChanged?: FileChange[];
  diffsByFile?: Record<string, string>;
  traceSummaries?: {
    byCommit: Record<string, TraceCommitSummary>;
    byFileByCommit: Record<string, Record<string, TraceFileSummary>>;
  };
  traceStatus?: TraceCollectorStatus;
  traceConfig?: TraceCollectorConfig;
  narrative?: BranchNarrative;
  meta?: {
    repoPath?: string;
    branchName?: string;
    headSha?: string;
    repoId?: number;
  };
};

export type CommitSummary = {
  sha: string;
  subject: string;
  author: string;
  authoredAtISO: string;
};

export type CommitDetails = {
  sha: string;
  fileChanges: FileChange[];
};

export type TestStatus = 'passed' | 'failed' | 'skipped';

export type TestCase = {
  id: string;
  name: string;
  status: TestStatus;
  durationMs: number;
  errorMessage?: string;
  filePath?: string;
};

export type TestRun = {
  id: string;
  /** ISO timestamp when this test run was imported into Narrative (repo mode). */
  importedAtISO?: string;
  /** Basename of the imported artifact (repo mode). */
  sourceBasename?: string;
  /** Path under `.narrative/` where the raw artifact was stored (repo mode). */
  rawRelPath?: string;
  sessionId?: string;
  commitSha?: string;
  atISO: string;
  durationSec: number;
  passed: number;
  failed: number;
  skipped: number;
  tests: TestCase[];
};

// EnhancedTimelineNode is now just TimelineNode (badges and testRunId added above)
export type EnhancedTimelineNode = TimelineNode;

// ============================================================================
// Rules System Types
// ============================================================================

export type RuleSeverity = 'error' | 'warning';

export type Rule = {
  name: string;
  description: string;
  pattern: string;
  is_regex?: boolean;
  severity?: RuleSeverity;
  include_files?: string[];
  exclude_files?: string[];
  suggestion?: string;
};

export type RuleViolation = {
  rule_name: string;
  severity: RuleSeverity;
  file: string;
  line: number;
  matched: string;
  suggestion: string;
};

export type ReviewSummary = {
  total_files_scanned: number;
  total_rules: number;
  violations_found: number;
  errors: number;
  warnings: number;
};

export type ReviewResult = {
  summary: ReviewSummary;
  violations: RuleViolation[];
  files_scanned: string[];
  rules_applied: string[];
};

export type RuleValidationError = {
  rule_name: string;
  error: string;
};

// ============================================================================
// Dashboard Types (Phase 1: Analytics Dashboard)
// ============================================================================

export type TimeRangePreset = '7d' | '30d' | '90d' | 'all';

export interface CustomTimeRange {
  from: string; // ISO date string
  to: string; // ISO date string
}

export type TimeRange = TimeRangePreset | CustomTimeRange;

export interface DashboardStats {
  repo: RepoInfo;
  timeRange: TimeRange;
  currentPeriod: PeriodStats;
  previousPeriod?: PeriodStats;
  topFiles: PaginatedFiles;
}

export interface RepoInfo {
  id: number;
  path: string;
  name: string;
}

export interface PeriodStats {
  period: {
    start: string;
    end: string;
    commits: number;
  };
  attribution: {
    totalLines: number;
    humanLines: number;
    aiAgentLines: number;
    aiAssistLines: number;
    collaborativeLines: number;
    aiPercentage: number;
  };
  toolBreakdown: ToolStats[];
  trend: TrendPoint[];
}

export interface ToolStats {
  tool: string;
  model?: string;
  lineCount: number;
}

export interface TrendPoint {
  date: string;
  granularity: 'hour' | 'day' | 'week';
  aiPercentage: number;
  commitCount: number;
}

export interface PaginatedFiles {
  files: FileStats[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface FileStats {
  filePath: string;
  totalLines: number;
  aiLines: number;
  aiPercentage: number;
  commitCount: number;
}

export type DashboardEmptyReason =
  | 'no-repo'
  | 'no-commits'
  | 'no-ai'
  | 'no-attribution';

export interface DashboardFilter {
  type: 'ai-only' | 'tool' | 'file' | 'date-range';
  value?: string;
  dateRange?: { from: string; to: string };
}

export interface TrendContext {
  metric: 'ai-percentage' | 'commits' | 'ai-lines' | 'human-lines';
  direction: 'up' | 'down' | 'neutral';
  previousValue?: number;
  currentValue: number;
}

export interface TrendColor {
  color: string;
  label: string;
  icon: 'trending_up' | 'trending_down' | 'minus';
  ariaLabel: string;
}
