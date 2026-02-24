import { describe, expect, it, vi } from 'vitest';
import {
  trackNarrativeEvent,
  trackQualityRenderDecision,
} from '../narrativeTelemetry';

describe('narrativeTelemetry', () => {
  it('dispatches base narrative telemetry events with schema version', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('fallback_used', {
      branch: 'feature/header',
      detailLevel: 'diff',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe('narrative:telemetry');
    expect(event.detail.schemaVersion).toBe('v1');
    expect(event.detail.event).toBe('fallback_used');
    expect(event.detail.payload.detailLevel).toBe('diff');

    dispatchSpy.mockRestore();
  });

  it('dispatches quality render decision events with bounded payload and budget check', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackQualityRenderDecision({
      branch: 'feature/header',
      source: 'git',
      headerKind: 'full',
      repoStatus: 'ready',
      transition: 'state_change',
      reasonCode: 'ready',
      durationMs: 2.3456,
      budgetMs: 1,
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.event).toBe('ui.quality.render_decision');
    expect(event.detail.payload.schemaVersion).toBe('v1');
    expect(event.detail.payload.reasonCode).toBe('ready');
    expect(event.detail.payload.durationMs).toBe(2.346);
    expect(event.detail.payload.budgetMs).toBe(1);
    expect(event.detail.payload.overBudget).toBe(true);

    dispatchSpy.mockRestore();
  });

  it('dispatches feedback events with typed payload fields', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('feedback_submitted', {
      branch: 'feature/narrative-loop',
      feedbackType: 'highlight_key',
      feedbackTargetKind: 'highlight',
      feedbackActorRole: 'reviewer',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.event).toBe('feedback_submitted');
    expect(event.detail.payload.feedbackType).toBe('highlight_key');
    expect(event.detail.payload.feedbackTargetKind).toBe('highlight');
    expect(event.detail.payload.feedbackActorRole).toBe('reviewer');

    dispatchSpy.mockRestore();
  });
});
