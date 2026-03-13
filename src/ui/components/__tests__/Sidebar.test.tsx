/**
 * Sidebar.test.tsx
 *
 * Validates the canonical mode-to-label mapping and sidebar grouping contract.
 *
 * Phase 4 — Verification and hardening layer:
 * - Every Mode in the sidebar maps to a unique deterministic human label.
 * - Anchor modes (dashboard, repo, docs) are present.
 * - All SurfaceMode values are represented.
 * - No legacy aliases appear in primary labels.
 * - Section group labels match the ViewSection contract.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Mode } from '../../../core/types';
import { Sidebar } from '../Sidebar';

vi.mock('@design-studio/tokens', () => ({
  useTheme: () => ({ colorScheme: 'dark', theme: 'system' })
}));

// ---------------------------------------------------------------------------
// Human-visible labels for each mode (as rendered in the Sidebar nav)
// ---------------------------------------------------------------------------

/**
 * Anchor modes and their canonical sidebar labels.
 * "Narrative" is also the name of the first ViewSection header, so we scope
 * assertions to nav buttons using getAllByRole where ambiguity exists.
 */
const ANCHOR_MODES_TO_LABELS: Array<[Mode, string]> = [
  ['dashboard', 'Narrative Brief'],   // button label; section header is also "Narrative"
  ['repo', 'Repo Evidence'],
  ['docs', 'Docs'],
];

/**
 * Shared surface modes and their canonical sidebar labels.
 * Each label must appear at least once as a nav button in the sidebar.
 */
const SURFACE_MODES_TO_LABELS: Array<[Mode, string]> = [
  ['live', 'Live Capture'],
  ['sessions', 'Sessions'],
  ['transcripts', 'Transcript Lens'],
  ['tools', 'Tool Pulse'],
  ['costs', 'Cost Watch'],
  ['timeline', 'Causal Timeline'],
  ['repo-pulse', 'Workspace Pulse'],
  ['work-graph', 'Story Map'],
  ['diffs', 'Diff Review'],
  ['snapshots', 'Snapshots'],
  ['worktrees', 'Worktrees'],
  ['attribution', 'Attribution Lens'],
  ['skills', 'Codex Skills'],
  ['agents', 'Agent Roles'],
  ['memory', 'Memory Graph'],
  ['hooks', 'Hooks'],
  ['setup', 'Setup'],
  ['ports', 'Ports'],
  ['hygiene', 'Hygiene'],
  ['deps', 'Dependency Watch'],
  ['env', 'Env Hygiene'],
  ['status', 'Trust Center'],
  ['settings', 'Settings'],
];

const EXPECTED_SECTION_HEADERS = ['Narrative', 'Evidence', 'Workspace', 'Integrations', 'Health', 'Configure'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSidebar(activeMode: Mode = 'dashboard') {
  render(
    <Sidebar
      mode={activeMode}
      onModeChange={vi.fn()}
      onOpenRepo={vi.fn()}
      onImportSession={vi.fn()}
    />,
  );
}

function toggleFullMap() {
  const toggle = screen.getByRole('button', { name: /show full map/i });
  fireEvent.click(toggle);
}

/**
 * Returns all nav buttons inside the <aside> element.
 * Using closest('aside') anchors queries to the sidebar and avoids
 * false positives from section labels that share text with nav items.
 */
function getNavButtons(): HTMLElement[] {
  const sidebar = document.querySelector('aside');
  if (!sidebar) throw new Error('Sidebar <aside> element not found');
  return Array.from(sidebar.querySelectorAll('button[type="button"]'));
}

function navButtonLabels(): string[] {
  return getNavButtons().map((btn) => btn.textContent?.trim() ?? '');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  describe('section group labels', () => {
    it('renders all required section headings matching the ViewSection contract', () => {
      renderSidebar();
      for (const section of EXPECTED_SECTION_HEADERS) {
        // getAllByText handles the "Narrative" duplication (section + nav button)
        const elements = screen.getAllByText(section);
        expect(elements.length).toBeGreaterThan(0);
      }
    });
  });

  describe('anchor mode canonical labels — nav button presence', () => {
    it.each(ANCHOR_MODES_TO_LABELS)(
      'anchor mode "%s" has a nav button with label "%s"',
      (mode, label) => {
        renderSidebar(mode as Mode);
        const buttons = navButtonLabels();
        const match = buttons.find((t) => t.includes(label));
        expect(match, `Expected nav button containing "${label}" for mode "${mode}"`).toBeTruthy();
      },
    );
  });

  describe('surface mode canonical labels — nav button presence', () => {
    it.each(SURFACE_MODES_TO_LABELS)(
      'surface mode "%s" has a nav button with label "%s"',
      (mode, label) => {
        renderSidebar(mode as Mode);
        const buttons = navButtonLabels();
        const match = buttons.find((t) => t.includes(label));
        expect(match, `Expected nav button containing "${label}" for mode "${mode}"`).toBeTruthy();
      },
    );
  });

  describe('routing completeness', () => {
    it('every non-demoted mode label appears once full map is enabled', () => {
      renderSidebar('dashboard');
      toggleFullMap();
      const buttons = navButtonLabels();
      const allExpectedLabels = [
        ...ANCHOR_MODES_TO_LABELS.filter(([mode]) => mode !== 'docs').map(([, label]) => label),
        ...SURFACE_MODES_TO_LABELS.map(([, label]) => label),
      ];
      for (const label of allExpectedLabels) {
        const present = buttons.some((t) => t.includes(label));
        expect(present, `Expected nav button containing "${label}"`).toBe(true);
      }
    });
  });

  describe('canonical naming — no legacy aliases in sidebar text', () => {
    const FORBIDDEN_ALIASES = ['Firefly', 'firefly', 'Readout', 'readout'];

    it.each(FORBIDDEN_ALIASES)('sidebar text does not contain legacy alias "%s"', (alias) => {
      renderSidebar();
      const sidebar = document.querySelector('aside');
      expect(sidebar?.textContent).not.toContain(alias);
    });
  });

  describe('primary-first sidebar behavior', () => {
    it('hides non-primary labels until full map is enabled', () => {
      renderSidebar('dashboard');
      expect(screen.queryByRole('tab', { name: /story map/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /sessions/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /tool pulse/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /dependency watch/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /^docs$/i })).toBeNull();
    });

    it('reveals non-primary labels after enabling full map', () => {
      renderSidebar('dashboard');
      toggleFullMap();
      expect(screen.getByRole('tab', { name: /story map/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /sessions/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tool pulse/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /dependency watch/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /^docs$/i })).toBeNull();
    });

    it('keeps docs hidden from the map until docs is the active mode', () => {
      renderSidebar('dashboard');
      toggleFullMap();
      expect(screen.queryByRole('tab', { name: /^docs$/i })).toBeNull();
    });

    it('still shows docs when the docs route is already active', () => {
      renderSidebar('docs');
      expect(screen.getByRole('tab', { name: /^docs$/i })).toBeInTheDocument();
      toggleFullMap();
      expect(screen.getByRole('tab', { name: /^docs$/i })).toBeInTheDocument();
    });
  });

  describe('active mode highlight', () => {
    it('the nav button for the active mode is not disabled', () => {
      renderSidebar('live');
      const buttons = getNavButtons();
      const liveButton = buttons.find((btn) => btn.textContent?.includes('Live Capture'));
      expect(liveButton).toBeTruthy();
      expect(liveButton).not.toBeDisabled();
    });
  });
});
