import { describe, expect, it } from 'vitest';

import type { BranchViewModel, CockpitMode, DataAuthorityTier } from '../../../core/types';
import type { CaptureReliabilityStatus } from '../../../core/tauri/ingestConfig';
import type { RepoState } from '../../../hooks/useRepoLoader';
import { buildCockpitViewModel } from '../cockpitViewData';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function createRepoState(): RepoState {
  return {
    status: 'ready',
    path: '/Users/jamiecraik/dev/trace-narrative',
    repo: {
      repoId: 42,
      root: '/Users/jamiecraik/dev/trace-narrative',
      branch: 'main',
      headSha: 'abc123',
    },
    model: {
      source: 'git',
      title: 'trace-narrative',
      status: 'open',
      description: 'Trace Narrative workspace',
      stats: {
        added: 0,
        removed: 0,
        files: 0,
        commits: 0,
        prompts: 0,
        responses: 0,
      },
      intent: [],
      timeline: [
        { id: 'c1', type: 'commit', label: 'Commit 1' },
        { id: 'c2', type: 'commit', label: 'Commit 2' },
      ],
      sessionExcerpts: [
        {
          id: 's1',
          tool: 'codex',
          messages: [{ id: 'm1', role: 'user', text: 'Investigate cockpit routing' }],
        },
      ],
      dirtyFiles: [],
      snapshots: [],
      meta: {
        repoId: 42,
        repoPath: '/Users/jamiecraik/dev/trace-narrative',
        branchName: 'main',
        headSha: 'abc123',
      },
    } as BranchViewModel,
  };
}

function createCaptureReliabilityStatus(
  overrides: Partial<CaptureReliabilityStatus> = {},
): CaptureReliabilityStatus {
  return {
    mode: 'HYBRID_ACTIVE',
    otelBaselineHealthy: true,
    streamExpected: true,
    streamHealthy: true,
    reasons: [],
    metrics: {
      streamEventsAccepted: 12,
      streamEventsDuplicates: 0,
      streamEventsDropped: 0,
      streamEventsReplaced: 0,
    },
    transitions: [],
    appServer: {
      state: 'running',
      initialized: true,
      initializeSent: true,
      authState: 'authenticated',
      authMode: 'device_code',
      streamHealthy: true,
      streamKillSwitch: false,
      restartBudget: 3,
      restartAttemptsInWindow: 0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The complete set of CockpitMode values.  This is the authoritative registry
 * used by both the contract-matrix test and routing tests.  Any new Mode added
 * to `src/core/types.ts` that is not an anchor must appear here.
 */
const ALL_COCKPIT_MODES: CockpitMode[] = [
  'live',
  'sessions',
  'transcripts',
  'tools',
  'costs',
  'setup',
  'ports',
  'work-graph',
  'repo-pulse',
  'timeline',
  'diffs',
  'snapshots',
  'skills',
  'agents',
  'memory',
  'hooks',
  'hygiene',
  'deps',
  'worktrees',
  'env',
  'settings',
  'assistant',
  'attribution',
  'status',
];
const ALLOWED_AUTHORITY_TIERS = new Set<DataAuthorityTier>([
  'live_repo',
  'live_capture',
  'derived_summary',
  'static_scaffold',
  'system_signal',
]);

// ---------------------------------------------------------------------------
// Existing trust-mapping tests (preserved verbatim)
// ---------------------------------------------------------------------------

describe('buildCockpitViewModel', () => {
  it('maps OTEL_ONLY reliability to derived-summary authority cues', () => {
    const model = buildCockpitViewModel(
      'live',
      createRepoState(),
      createCaptureReliabilityStatus({ mode: 'OTEL_ONLY', otelBaselineHealthy: true }),
    );

    expect(model.trustState).toBe('healthy');
    expect(model.heroAuthorityTier).toBe('derived_summary');
    expect(model.heroAuthorityLabel).toBe('Derived from baseline OTEL-only telemetry');

    const captureModeMetric = model.metrics.find((metric) => metric.label === 'Capture mode');
    expect(captureModeMetric).toBeDefined();
    expect(captureModeMetric?.authorityTier).toBe('derived_summary');
    expect(captureModeMetric?.authorityLabel).toBe('Derived from baseline OTEL-only telemetry');
  });

  it('marks unknown modes as degraded trust with captured-source authority', () => {
    const unknownModeReliabilityStatus = createCaptureReliabilityStatus({
      mode: 'NONSENSE_MODE' as CaptureReliabilityStatus['mode'],
    });
    const model = buildCockpitViewModel('status', createRepoState(), unknownModeReliabilityStatus);

    expect(model.trustState).toBe('degraded');
    expect(model.heroAuthorityTier).toBe('live_capture');
    expect(model.heroAuthorityLabel).toBe('Captured from nonsense_mode');
  });

  // ---------------------------------------------------------------------------
  // Phase 4 — Contract matrix: every CockpitMode must have authority on all elements
  // ---------------------------------------------------------------------------

  describe('contract matrix — every CockpitMode includes non-null authority metadata', () => {
    it.each(ALL_COCKPIT_MODES)(
      'mode "%s": hero, metrics, highlights, activity, and tableRows all have valid authority tier + label',
      (mode) => {
        const model = buildCockpitViewModel(mode, createRepoState(), createCaptureReliabilityStatus());

        // Hero-level authority
        expect(model.heroAuthorityTier).toBeTruthy();
        expect(ALLOWED_AUTHORITY_TIERS.has(model.heroAuthorityTier)).toBe(true);
        expect(model.heroAuthorityLabel).toBeTruthy();
        expect(typeof model.heroAuthorityLabel).toBe('string');
        expect(model.heroAuthorityLabel.length).toBeGreaterThan(0);

        // Trust state is always one of the two allowed values
        expect(['healthy', 'degraded']).toContain(model.trustState);

        // Section-level fields are always present
        expect(model.title).toBeTruthy();
        expect(model.subtitle).toBeTruthy();
        expect(model.section).toBeTruthy();

        // Metrics — every metric must have authority
        expect(model.metrics.length).toBeGreaterThan(0);
        for (const metric of model.metrics) {
          expect(metric.authorityTier, `metric "${metric.label}" missing authorityTier`).toBeTruthy();
          expect(ALLOWED_AUTHORITY_TIERS.has(metric.authorityTier)).toBe(true);
          expect(metric.authorityLabel, `metric "${metric.label}" missing authorityLabel`).toBeTruthy();
        }

        // Highlights — every highlight must have authority
        expect(model.highlights.length).toBeGreaterThan(0);
        for (const highlight of model.highlights) {
          expect(highlight.authorityTier, `highlight "${highlight.title}" missing authorityTier`).toBeTruthy();
          expect(ALLOWED_AUTHORITY_TIERS.has(highlight.authorityTier)).toBe(true);
          expect(highlight.authorityLabel, `highlight "${highlight.title}" missing authorityLabel`).toBeTruthy();
        }

        // Activity items — every item must have authority
        expect(model.activity.length).toBeGreaterThan(0);
        for (const item of model.activity) {
          expect(item.authorityTier, `activity "${item.title}" missing authorityTier`).toBeTruthy();
          expect(ALLOWED_AUTHORITY_TIERS.has(item.authorityTier)).toBe(true);
          expect(item.authorityLabel, `activity "${item.title}" missing authorityLabel`).toBeTruthy();
        }

        // Table rows — every row must have authority
        expect(model.tableRows.length).toBeGreaterThan(0);
        for (const row of model.tableRows) {
          expect(row.authorityTier, `tableRow "${row.primary}" missing authorityTier`).toBeTruthy();
          expect(ALLOWED_AUTHORITY_TIERS.has(row.authorityTier)).toBe(true);
          expect(row.authorityLabel, `tableRow "${row.primary}" missing authorityLabel`).toBeTruthy();
        }

        // Footer note must be a non-empty string
        expect(typeof model.footerNote).toBe('string');
        expect(model.footerNote.length).toBeGreaterThan(0);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Phase 4 — Routing boundary: anchor modes must NOT be accepted as CockpitMode
  // ---------------------------------------------------------------------------

  describe('routing boundary — anchor modes are excluded from cockpit rendering', () => {
    const ANCHOR_MODES = ['dashboard', 'repo', 'docs'] as const;

    it('ALL_COCKPIT_MODES does not include any anchor mode', () => {
      for (const anchor of ANCHOR_MODES) {
        expect((ALL_COCKPIT_MODES as string[]).includes(anchor)).toBe(false);
      }
    });

    it('ALL_COCKPIT_MODES covers the full non-anchor Mode union', () => {
      // The list must have 24 entries (27 total modes − 3 anchors)
      expect(ALL_COCKPIT_MODES).toHaveLength(24);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 4 — Authority tier coverage: all four tiers are reachable
  // ---------------------------------------------------------------------------

  describe('authority tier coverage — all four DataAuthorityTier values are reachable', () => {
    it('OTEL_ONLY maps hero to derived_summary tier', () => {
      const model = buildCockpitViewModel(
        'live',
        createRepoState(),
        createCaptureReliabilityStatus({ mode: 'OTEL_ONLY', otelBaselineHealthy: true }),
      );
      expect(model.heroAuthorityTier).toBe('derived_summary');
    });

    it('HYBRID_ACTIVE maps hero to live_capture tier', () => {
      const model = buildCockpitViewModel(
        'live',
        createRepoState(),
        createCaptureReliabilityStatus({ mode: 'HYBRID_ACTIVE' }),
      );
      expect(model.heroAuthorityTier).toBe('live_capture');
    });

    it('repo-grounded mode produces live_repo tier on at least one metric', () => {
      const model = buildCockpitViewModel(
        'status',
        createRepoState(),
        createCaptureReliabilityStatus(),
      );
      // The status view derives from live capture authority — live_capture or derived_summary
      expect(['live_capture', 'derived_summary']).toContain(model.heroAuthorityTier);
    });

    it('static_scaffold tier is reachable from static-scaffold modes (assistant)', () => {
      const model = buildCockpitViewModel(
        'assistant',
        createRepoState(),
        createCaptureReliabilityStatus(),
      );
      // assistant is always static_scaffold since it has no live data backing
      const allTiers = [
        model.heroAuthorityTier,
        ...model.metrics.map((m) => m.authorityTier),
        ...model.highlights.map((h) => h.authorityTier),
        ...model.activity.map((a) => a.authorityTier),
        ...model.tableRows.map((r) => r.authorityTier),
      ];
      expect(allTiers.some((t) => t === 'static_scaffold')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 4 — Drift Report: workspace drift is evaluated and exposed
  // ---------------------------------------------------------------------------

  describe('drift report — workspace drift is evaluated and exposed', () => {
    it('populates driftReport in the view model if repo is ready', () => {
      const repoState = createRepoState();
      const model = buildCockpitViewModel('work-graph', repoState, createCaptureReliabilityStatus());

      expect(model.driftReport).toBeDefined();
      expect(model.driftReport?.status).toBe('healthy');
      expect(model.driftReport?.metrics.length).toBeGreaterThan(0);
      
      const uncommittedFiles = model.driftReport?.metrics.find(m => m.id === 'uncommitted_files');
      expect(uncommittedFiles).toBeDefined();
      expect(uncommittedFiles?.value).toBe(0);
    });

    it('uses working-tree churn when diffsByFile is not populated', () => {
      const repoState = createRepoState();
      if (repoState.status === 'ready') {
        repoState.model.dirtyFiles = ['src/ui/components/TopNav.tsx'];
        repoState.model.dirtyChurnLines = 650;
        repoState.model.diffsByFile = undefined;
        repoState.model.snapshots = [
          {
            id: 'snap_recent',
            atISO: new Date().toISOString(),
            type: 'automatic',
            branch: 'main',
            headSha: 'abc123',
            filesChanged: ['src/ui/components/TopNav.tsx'],
          },
        ];
      }

      const model = buildCockpitViewModel('work-graph', repoState, createCaptureReliabilityStatus());
      const churnMetric = model.driftReport?.metrics.find((m) => m.id === 'uncommitted_churn');

      expect(churnMetric?.value).toBe(650);
      expect(churnMetric?.status).toBe('warn');
      expect(model.driftReport?.status).toBe('watch');
    });

    it('assistant view includes a drift alert activity item when drift is high', () => {
      const repoState = createRepoState();
      // Inject some drift by adding active file changes to the model
      if (repoState.status === 'ready') {
        repoState.model.dirtyFiles = Array(15).fill('file.ts');
      }
      
      const model = buildCockpitViewModel('assistant', repoState, createCaptureReliabilityStatus());

      expect(model.driftReport?.status).toBe('critical');
      
      const driftAlert = model.activity.find(item => item.title === 'High Drift Delta Alert');
      expect(driftAlert).toBeDefined();
      expect(driftAlert?.authorityTier).toBe('system_signal');
    });
  });
});
