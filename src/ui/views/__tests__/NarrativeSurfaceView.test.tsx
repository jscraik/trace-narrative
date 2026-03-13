import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@design-studio/tokens', () => ({
  useTheme: () => ({ colorScheme: 'dark', theme: 'system' })
}));

import type { BranchViewModel } from '../../../core/types';
import type { CaptureReliabilityStatus } from '../../../core/tauri/ingestConfig';
import type { RepoState } from '../../../hooks/useRepoLoader';
import { NarrativeSurfaceView } from '../NarrativeSurfaceView';

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
          messages: [{ id: 'm1', role: 'user', text: 'Investigate surface routing' }],
        },
      ],
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

describe('NarrativeSurfaceView', () => {
  it('renders a Trace Narrative-native live operations view', () => {
    render(
      <NarrativeSurfaceView
        mode="live"
        repoState={createRepoState()}
        captureReliabilityStatus={createCaptureReliabilityStatus()}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Live' })).toBeInTheDocument();
    expect(screen.getByText('Live capture surface')).toBeInTheDocument();
    expect(screen.getByText('Active sessions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Live monitors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Current stream' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Live lanes' })).toBeInTheDocument();
    expect(screen.getByText('Capture posture')).toBeInTheDocument();
  });

  it('surfaces the degraded trust badge when capture is not healthy', () => {
    render(
      <NarrativeSurfaceView
        mode="status"
        repoState={createRepoState()}
        captureReliabilityStatus={createCaptureReliabilityStatus({ mode: 'DEGRADED_STREAMING' })}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Capture reliability degraded')).toBeInTheDocument();
    expect(screen.getByText('Trust Center')).toBeInTheDocument();
    expect(screen.getByText('Recent trust events')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trust decision rail' })).toBeInTheDocument();
  });

  it('renders the provenance lane on Story Map surfaces', () => {
    render(
      <NarrativeSurfaceView
        mode="work-graph"
        repoState={createRepoState()}
        captureReliabilityStatus={createCaptureReliabilityStatus()}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />,
    );

    expect(screen.getByText('Topology and prioritization view for pressure points, weak joins, and next inspection.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Narrative pressure map' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What should move first' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trace provenance lane' })).toBeInTheDocument();
    expect(screen.getByText('Observed')).toBeInTheDocument();
    expect(screen.getByText('Joined')).toBeInTheDocument();
    expect(screen.getByText('Derived')).toBeInTheDocument();
  });

  it('renders Sessions as a dedicated evidence review surface', () => {
    render(
      <NarrativeSurfaceView
        mode="sessions"
        repoState={createRepoState()}
        captureReliabilityStatus={createCaptureReliabilityStatus()}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Sessions' })).toBeInTheDocument();
    expect(screen.getByText('Review Window')).toBeInTheDocument();
  });

  it('renders Transcript Lens as a dedicated search-and-verification surface', () => {
    render(
      <NarrativeSurfaceView
        mode="transcripts"
        repoState={createRepoState()}
        captureReliabilityStatus={createCaptureReliabilityStatus()}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Transcripts' })).toBeInTheDocument();
    expect(screen.getByText('Transcript query surface')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ask transcript-first questions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quoted snippets and source joins' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sources and follow-through' })).toBeInTheDocument();
  });

  it('renders Causal Timeline as a dedicated causal-analysis surface', () => {
    render(
      <NarrativeSurfaceView
        mode="timeline"
        repoState={createRepoState()}
        captureReliabilityStatus={createCaptureReliabilityStatus()}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByText('Causal Timeline earns its place when the chronology dominates the page and the review gates sit alongside it instead of competing with it.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ordered commit and milestone sequence' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What makes the sequence safe to repeat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Session joins and trust posture' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Causal chain rail' })).toBeInTheDocument();
  });

  it('treats unknown capture modes as degraded trust', () => {
    const unknownModeReliabilityStatus = {
      ...createCaptureReliabilityStatus(),
      mode: 'NONSENSE_MODE',
    } as unknown as CaptureReliabilityStatus;

    render(
      <NarrativeSurfaceView
        mode="live"
        repoState={createRepoState()}
        captureReliabilityStatus={unknownModeReliabilityStatus}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Capture reliability degraded')).toBeInTheDocument();
    expect(screen.getAllByText('Capture degraded').length).toBeGreaterThan(0);
  });

  it('renders derived-summary authority cues for OTEL_ONLY capture reliability', () => {
    render(
      <NarrativeSurfaceView
        mode="live"
        repoState={createRepoState()}
        captureReliabilityStatus={createCaptureReliabilityStatus({
          mode: 'OTEL_ONLY',
          otelBaselineHealthy: true,
        })}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />,
    );

    const derivedCues = document.querySelectorAll('[data-authority-tier="derived_summary"]');
    expect(derivedCues.length).toBeGreaterThan(0);

    const captureModeMetric = screen.getByText('Capture mode');
    const captureModeCard = captureModeMetric.closest('article');
    expect(captureModeCard).toBeInstanceOf(HTMLElement);
    if (!(captureModeCard instanceof HTMLElement)) {
      throw new Error('Expected capture mode metric container to be an HTMLElement');
    }
    expect(captureModeCard).toHaveAttribute('data-authority-tier', 'derived_summary');
    expect(captureModeCard).toHaveAttribute('data-authority-label', 'OTEL');

    const derivedLabelElements = captureModeCard.querySelectorAll('[data-authority-short-label="Derived"]');
    expect(derivedLabelElements.length).toBeGreaterThan(0);
  });

  it('includes per-element authority cues on surface sections', () => {
    render(
      <NarrativeSurfaceView
        mode="live"
        repoState={createRepoState()}
        captureReliabilityStatus={createCaptureReliabilityStatus()}
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
        onImportSession={vi.fn()}
      />
    );

    const cueElements = document.querySelectorAll('[data-authority-tier][data-authority-label]');
    expect(cueElements.length).toBeGreaterThan(0);

    const cueBadges = document.querySelectorAll('[data-authority-short-label]');
    expect(cueBadges.length).toBe(cueElements.length);

    const allowed = new Set(['live_repo', 'live_capture', 'derived_summary', 'static_scaffold', 'system_signal']);
    const shortLabelByTier: Record<string, string> = {
      live_repo: 'Repo',
      live_capture: 'Live',
      derived_summary: 'Derived',
      static_scaffold: 'Mock',
      system_signal: 'Signal',
    };

    cueElements.forEach((el) => {
      const tier = el.getAttribute('data-authority-tier');
      const label = el.getAttribute('data-authority-label');

      expect(tier).toBeTruthy();
      expect(label).toBeTruthy();
      expect(allowed.has(tier as string)).toBe(true);
      if (label === null) {
        throw new Error('Expected data-authority-label attribute to be present');
      }
      const expectedShortLabel = shortLabelByTier[tier as keyof typeof shortLabelByTier];
      if (expectedShortLabel === undefined) {
        throw new Error(`Unknown authority tier: ${tier}`);
      }
      const cue = el.querySelector('[data-authority-short-label]');
      expect(cue).toBeTruthy();
      if (label && label.length > 0) {
        expect(cue).toHaveTextContent(label);
      } else {
        expect(cue).toHaveTextContent(expectedShortLabel);
      }
    });
  });
});
