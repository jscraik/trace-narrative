import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopNav } from '../TopNav';

describe('TopNav', () => {
  it('renders only anchor navigation tabs (Repo, Narrative, Docs)', () => {
    render(
      <TopNav
        mode="dashboard"
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
      />
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByText('Repo')).toBeInTheDocument();
    expect(screen.getByText('Narrative')).toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
    
    // Assistant mode should not be a tab
    expect(screen.queryByText('Story Copilot')).not.toBeInTheDocument();
  });

  it('supports arrow key navigation between anchor tabs', () => {
    const onModeChange = vi.fn();
    render(
      <TopNav
        mode="dashboard"
        onModeChange={onModeChange}
        onOpenRepo={vi.fn()}
      />
    );

    const tablist = screen.getByRole('tablist');
    
    // ArrowRight from Cockpit -> Docs
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onModeChange).toHaveBeenCalledWith('docs');

    // ArrowLeft from Cockpit -> Repo
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onModeChange).toHaveBeenCalledWith('repo');
    
    // Home -> Repo
    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(onModeChange).toHaveBeenCalledWith('repo');

    // End -> Docs
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onModeChange).toHaveBeenCalledWith('docs');
  });

  it('highlights the active anchor tab even if current mode is a cockpit mode', () => {
    // Cockpit-adjacent modes should keep the Narrative anchor tab active.
    render(
      <TopNav
        mode="assistant"
        onModeChange={vi.fn()}
        onOpenRepo={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: 'Narrative' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Repo' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Docs' })).toHaveAttribute('aria-selected', 'false');
  });

  it('maps non-anchor cockpit modes to Narrative tab and keyboard routing', () => {
    const onModeChange = vi.fn();
    render(
      <TopNav
        mode="live"
        onModeChange={onModeChange}
        onOpenRepo={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: 'Narrative' })).toHaveAttribute('aria-selected', 'true');

    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onModeChange).toHaveBeenCalledWith('docs');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onModeChange).toHaveBeenCalledWith('repo');
  });
});
