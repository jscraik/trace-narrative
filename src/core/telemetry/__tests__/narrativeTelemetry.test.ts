import { describe, expect, it, vi } from 'vitest';
import {
  createTelemetryBranchScope,
  setNarrativeTelemetryRuntimeConfig,
  trackNarrativeEvent,
  trackQualityRenderDecision,
  trackDashboardEvent,
} from '../narrativeTelemetry';

describe('narrativeTelemetry', () => {
  it('dispatches base narrative telemetry events with schema version', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('fallback_used', {
      attemptId: 'r1:b1:n1',
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

  it('suppresses telemetry dispatch when consent is revoked', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    setNarrativeTelemetryRuntimeConfig({ consentGranted: false });

    trackNarrativeEvent('fallback_used', {
      attemptId: 'r1:b1:n2',
      branch: 'feature/header',
      detailLevel: 'diff',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(0);

    setNarrativeTelemetryRuntimeConfig({ consentGranted: true });
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

  it('drops payloads that include absolute branch scope paths', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('narrative_viewed', {
      branchScope: '/Users/jamiecraik/dev/secret-repo',
      branch: 'feature/header',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(0);
    dispatchSpy.mockRestore();
  });


  it('supports recall-lane evidence telemetry fields', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('evidence_opened', {
      attemptId: 'r1:b2:n1',
      branch: 'feature/recall-lane',
      detailLevel: 'summary',
      source: 'recall_lane',
      evidenceKind: 'commit',
      confidence: 0.91,
      recallLaneItemId: 'recall:123',
      recallLaneConfidenceBand: 'high',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.payload.source).toBe('recall_lane');
    expect(event.detail.payload.recallLaneItemId).toBe('recall:123');
    expect(event.detail.payload.recallLaneConfidenceBand).toBe('high');

    dispatchSpy.mockRestore();
  });

  it('deduplicates rapid duplicate terminal events', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('evidence_opened', {
      attemptId: 'r1:b123:n3',
      itemId: 'commit:abc',
      branchScope: 'r1:b123',
      eventOutcome: 'success',
      funnelStep: 'evidence_requested',
    });
    trackNarrativeEvent('evidence_opened', {
      attemptId: 'r1:b123:n3',
      itemId: 'commit:abc',
      branchScope: 'r1:b123',
      eventOutcome: 'success',
      funnelStep: 'evidence_requested',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
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

  it('drops first-win flow events that omit attemptId', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('evidence_opened', {
      branchScope: 'r1:b333',
      itemId: 'commit:def',
      eventOutcome: 'success',
      funnelStep: 'evidence_ready',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(0);
    dispatchSpy.mockRestore();
  });

  it('dispatches first_win_completed only with valid completion payload', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('first_win_completed', {
      attemptId: 'r1:b9:n7',
      branchScope: 'r1:b9',
      itemId: 'commit:abc',
      eventOutcome: 'success',
      funnelStep: 'evidence_ready',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    dispatchSpy.mockRestore();
  });

  it('drops invalid first_win_completed payloads', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackNarrativeEvent('first_win_completed', {
      attemptId: 'r1:b9:n8',
      branchScope: 'r1:b9',
      itemId: 'commit:abc',
      eventOutcome: 'success',
      funnelStep: 'evidence_requested',
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(0);
    dispatchSpy.mockRestore();
  });

  it('creates a stable pseudonymized branch scope', () => {
    const branchScope = createTelemetryBranchScope(42, 'feature/refactor');
    const repeatScope = createTelemetryBranchScope(42, 'feature/refactor');

    expect(branchScope).toBe(repeatScope);
    expect(branchScope).toMatch(/^r42:b[a-z0-9]+$/);
  });

  it('dispatches dashboard telemetry with canonical envelope and hashed string repo_id', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackDashboardEvent({
      event: 'permission_denied',
      payload: { repo_id: '/absolute/path/to/repo' },
      envelopeOverrides: { mode: 'dashboard' },
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;

    expect(event.detail.event).toBe('permission_denied');
    expect(event.detail.mode).toBe('dashboard');
    expect(event.detail.payload.repo_id).not.toBe('/absolute/path/to/repo');
    expect(event.detail.ts_iso8601).toBeDefined();

    dispatchSpy.mockRestore();
  });
});
