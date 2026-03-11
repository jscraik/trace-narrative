/**
 * Sidebar.test.tsx
 *
 * Validates the canonical mode-to-label mapping and sidebar grouping contract.
 *
 * Phase 4 — Verification and hardening layer:
 * - Every Mode in the sidebar maps to a unique deterministic human label.
 * - Anchor modes (dashboard, repo, docs) are present.
 * - All CockpitMode values are represented.
 * - No legacy aliases appear in primary labels.
 * - Section group labels match the ViewSection contract.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Mode } from '../../../core/types';
import { Sidebar } from '../Sidebar';

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
 * Cockpit modes and their canonical sidebar labels.
 * Each label must appear at least once as a nav button in the sidebar.
 */
const COCKPIT_MODES_TO_LABELS: Array<[Mode, string]> = [
  ['live', 'Live Capture'],
  ['sessions', 'Sessions'],
  ['transcripts', 'Transcript Lens'],
  ['tools', 'Tool Pulse'],
  ['costs', 'Cost Watch'],
  ['timeline', 'Causal Timeline'],
  ['repo-pulse', 'Workspace Pulse'],
  ['work-graph', 'Story Map'],
  ['diffs', 'Diff Review'],
  ['snapshots', 'Checkpoints'],
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
  ['assistant', 'Codex Copilot'],
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

  describe('cockpit mode canonical labels — nav button presence', () => {
    it.each(COCKPIT_MODES_TO_LABELS)(
      'cockpit mode "%s" has a nav button with label "%s"',
      (mode, label) => {
        renderSidebar(mode as Mode);
        const buttons = navButtonLabels();
        const match = buttons.find((t) => t.includes(label));
        expect(match, `Expected nav button containing "${label}" for mode "${mode}"`).toBeTruthy();
      },
    );
  });

  describe('routing completeness', () => {
    it('every expected mode label appears as a nav button in a single render', () => {
      renderSidebar('dashboard');
      const buttons = navButtonLabels();
      const allExpectedLabels = [
        ...ANCHOR_MODES_TO_LABELS.map(([, label]) => label),
        ...COCKPIT_MODES_TO_LABELS.map(([, label]) => label),
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
