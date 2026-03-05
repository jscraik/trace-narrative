import { useCallback, useEffect, useRef, useState } from 'react';
import { composeAskWhyAnswer } from '../../../core/narrative/causalRecall';
import {
  trackAskWhyAnswerViewed,
  trackAskWhyError,
  trackAskWhyEvidenceOpened,
  trackAskWhyFallbackUsed,
  trackAskWhySubmitted,
} from '../../../core/telemetry/narrativeTelemetry';
import type {
  AskWhyCitation,
  AskWhyState,
  BranchNarrative,
  NarrativeEvidenceLink,
} from '../../../core/types';

// Global monotonic counter ensures version uniqueness across all branch switches
// This prevents A→B→A scenarios where stale responses could reuse the same version number
let globalAskWhyVersionCounter = 0;

export type UseBranchAskWhyStateInput = {
  branchScopeKey: string;
  branchScope: string;
  branchName: string | undefined;
  repoId: number | null;
  narrative: BranchNarrative;
  isMountedRef: React.MutableRefObject<boolean>;
  activeBranchScopeRef: React.MutableRefObject<string | null>;
  handleOpenEvidence: (link: NarrativeEvidenceLink) => void;
};

export type UseBranchAskWhyStateOutput = {
  askWhyState: AskWhyState;
  handleSubmitAskWhy: (question: string) => Promise<void>;
  handleOpenAskWhyCitation: (citation: AskWhyCitation) => void;
};

export function useBranchAskWhyState(
  input: UseBranchAskWhyStateInput
): UseBranchAskWhyStateOutput {
  const {
    branchScopeKey,
    branchScope,
    branchName,
    repoId,
    narrative,
    isMountedRef,
    activeBranchScopeRef,
    handleOpenEvidence,
  } = input;

  const [askWhyState, setAskWhyState] = useState<AskWhyState>({ kind: 'idle' });
  const askWhyRequestVersionRef = useRef(0);
  const askWhyStartedAtByVersionRef = useRef(new Map<number, number>());

  // Reset on branch change (keep version counter monotonic via global counter)
  // biome-ignore lint/correctness/useExhaustiveDependencies: branchScopeKey intentionally triggers reset
  useEffect(() => {
    setAskWhyState({ kind: 'idle' });
  }, [branchScopeKey]);

  const handleSubmitAskWhy = useCallback(async (question: string) => {
    if (!question.trim()) return;

    const requestVersion = ++globalAskWhyVersionCounter;
    askWhyRequestVersionRef.current = requestVersion;
    const branchScopeAtRequest = branchScopeKey;
    const queryId = `pending-${requestVersion}`;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    askWhyStartedAtByVersionRef.current.set(requestVersion, startedAt);

    setAskWhyState({ kind: 'loading', queryId });

    const askWhyInput = {
      question,
      branchId: branchName ?? 'unknown',
      repoId: repoId ?? undefined,
    };

    try {
      const result = await composeAskWhyAnswer(askWhyInput, narrative);

      // Stale-guard: drop response if branch changed or newer request in flight
      if (!isMountedRef.current) {
        trackAskWhyError({ queryId, errorType: 'stale_ignored', branchScope, eventOutcome: 'stale_ignored' });
        return;
      }
      if (activeBranchScopeRef.current !== branchScopeAtRequest) {
        trackAskWhyError({ queryId, errorType: 'stale_ignored', branchScope, eventOutcome: 'stale_ignored' });
        return;
      }
      if (askWhyRequestVersionRef.current !== requestVersion) {
        trackAskWhyError({ queryId, errorType: 'stale_ignored', branchScope, eventOutcome: 'stale_ignored' });
        return;
      }

      if (result.kind === 'error') {
        setAskWhyState({
          kind: 'error',
          queryId: result.queryId,
          errorType: result.errorType,
          message: result.message,
        });
        trackAskWhyError({ queryId: result.queryId, errorType: result.errorType, branchScope });
        return;
      }

      setAskWhyState({ kind: 'ready', answer: result.answer });
      const startedAtForVersion = askWhyStartedAtByVersionRef.current.get(requestVersion);
      const elapsedMs =
        startedAtForVersion === undefined
          ? undefined
          : (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAtForVersion;

      trackAskWhySubmitted({
        queryId: result.answer.queryId,
        branchId: askWhyInput.branchId,
        questionHash: result.answer.questionHash,
        branchScope,
        funnelSessionId: `${branchScope}:${result.answer.queryId}`,
      });
      trackAskWhyAnswerViewed({
        queryId: result.answer.queryId,
        branchScope,
        confidence: result.answer.confidenceBand,
        citationCount: result.answer.citations.length,
        fallbackUsed: result.answer.fallbackUsed,
        funnelSessionId: `${branchScope}:${result.answer.queryId}`,
        flowLatencyMs: elapsedMs,
      });
      if (result.answer.fallbackUsed && result.answer.fallbackReasonCode) {
        trackAskWhyFallbackUsed({
          queryId: result.answer.queryId,
          reasonCode: result.answer.fallbackReasonCode,
          branchScope,
          funnelSessionId: `${branchScope}:${result.answer.queryId}`,
        });
      }
    } catch (error) {
      if (!isMountedRef.current) {
        trackAskWhyError({ queryId, errorType: 'stale_ignored', branchScope, eventOutcome: 'stale_ignored' });
        return;
      }
      if (activeBranchScopeRef.current !== branchScopeAtRequest) {
        trackAskWhyError({ queryId, errorType: 'stale_ignored', branchScope, eventOutcome: 'stale_ignored' });
        return;
      }
      if (askWhyRequestVersionRef.current !== requestVersion) {
        trackAskWhyError({ queryId, errorType: 'stale_ignored', branchScope, eventOutcome: 'stale_ignored' });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      setAskWhyState({
        kind: 'error',
        queryId,
        errorType: 'internal',
        message: errorMessage,
      });
      trackAskWhyError({ queryId, errorType: 'internal', branchScope, eventOutcome: 'failed' });
    } finally {
      askWhyStartedAtByVersionRef.current.delete(requestVersion);
    }
  }, [branchScope, branchScopeKey, branchName, repoId, narrative, isMountedRef, activeBranchScopeRef]);

  const handleOpenAskWhyCitation = useCallback((citation: AskWhyCitation) => {
    if (activeBranchScopeRef.current !== branchScopeKey) return;

    const link: NarrativeEvidenceLink = {
      id: citation.id,
      kind: citation.type,
      label: citation.label,
      commitSha: citation.commitSha,
      filePath: citation.filePath,
      sessionId: citation.sessionId,
    };

    if (askWhyState.kind === 'ready') {
      trackAskWhyEvidenceOpened({
        queryId: askWhyState.answer.queryId,
        branchScope,
        citationType: citation.type,
        citationId: citation.id,
        funnelSessionId: `${branchScope}:${askWhyState.answer.queryId}`,
      });
    }

    handleOpenEvidence(link);
  }, [activeBranchScopeRef, branchScope, branchScopeKey, handleOpenEvidence, askWhyState]);

  return {
    askWhyState,
    handleSubmitAskWhy,
    handleOpenAskWhyCitation,
  };
}
