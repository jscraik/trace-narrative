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
    branchName,
    repoId,
    narrative,
    isMountedRef,
    activeBranchScopeRef,
    handleOpenEvidence,
  } = input;

  const [askWhyState, setAskWhyState] = useState<AskWhyState>({ kind: 'idle' });
  const askWhyRequestVersionRef = useRef(0);

  // Reset on branch change (keep version counter monotonic via global counter)
  useEffect(() => {
    setAskWhyState({ kind: 'idle' });
  }, [branchScopeKey]);

  const handleSubmitAskWhy = useCallback(async (question: string) => {
    if (!question.trim()) return;

    const requestVersion = ++globalAskWhyVersionCounter;
    askWhyRequestVersionRef.current = requestVersion;
    const branchScopeAtRequest = branchScopeKey;

    setAskWhyState({ kind: 'loading', queryId: `pending-${requestVersion}` });

    const askWhyInput = {
      question,
      branchId: branchName ?? 'unknown',
      repoId: repoId ?? undefined,
    };

    try {
      const result = await composeAskWhyAnswer(askWhyInput, narrative);

      // Stale-guard: drop response if branch changed or newer request in flight
      if (!isMountedRef.current) return;
      if (activeBranchScopeRef.current !== branchScopeAtRequest) return;
      if (askWhyRequestVersionRef.current !== requestVersion) return;

      if (result.kind === 'error') {
        setAskWhyState({
          kind: 'error',
          queryId: result.queryId,
          errorType: result.errorType,
          message: result.message,
        });
        trackAskWhyError({ queryId: result.queryId, errorType: result.errorType });
        return;
      }

      setAskWhyState({ kind: 'ready', answer: result.answer });

      trackAskWhySubmitted({
        queryId: result.answer.queryId,
        branchId: askWhyInput.branchId,
        questionHash: result.answer.questionHash,
      });
      trackAskWhyAnswerViewed({
        queryId: result.answer.queryId,
        confidence: result.answer.confidenceBand,
        citationCount: result.answer.citations.length,
        fallbackUsed: result.answer.fallbackUsed,
      });
      if (result.answer.fallbackUsed && result.answer.fallbackReasonCode) {
        trackAskWhyFallbackUsed({
          queryId: result.answer.queryId,
          reasonCode: result.answer.fallbackReasonCode,
        });
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      if (activeBranchScopeRef.current !== branchScopeAtRequest) return;
      if (askWhyRequestVersionRef.current !== requestVersion) return;

      const errorMessage = error instanceof Error ? error.message : String(error);
      setAskWhyState({
        kind: 'error',
        queryId: `error-${requestVersion}`,
        errorType: 'internal',
        message: errorMessage,
      });
    }
  }, [branchScopeKey, branchName, repoId, narrative, isMountedRef, activeBranchScopeRef]);

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
        citationType: citation.type,
        citationId: citation.id,
      });
    }

    handleOpenEvidence(link);
  }, [activeBranchScopeRef, branchScopeKey, handleOpenEvidence, askWhyState]);

  return {
    askWhyState,
    handleSubmitAskWhy,
    handleOpenAskWhyCitation,
  };
}
