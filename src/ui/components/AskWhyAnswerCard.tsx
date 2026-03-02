import type {
  AskWhyAnswerPayload,
  AskWhyCitation,
  AskWhyState,
} from '../../core/types';

type AskWhyAnswerCardProps = {
  state: AskWhyState;
  onSubmit: (question: string) => void;
  onOpenCitation: (citation: AskWhyCitation) => void;
  onOpenRawDiff: () => void;
  disabled?: boolean;
};

function confidenceBandStyle(band: AskWhyAnswerPayload['confidenceBand']): string {
  if (band === 'high') return 'text-accent-green';
  if (band === 'medium') return 'text-accent-amber';
  return 'text-text-muted';
}

function citationTypeLabel(type: AskWhyCitation['type']): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function SubmitButton({ disabled, loading }: { disabled?: boolean; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="rounded-md border border-border-subtle bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-light hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? 'Asking...' : 'Ask'}
    </button>
  );
}

function CitationButton({ citation, onClick }: { citation: AskWhyCitation; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-border-subtle bg-bg-primary px-2 py-0.5 text-[11px] text-text-secondary transition-colors hover:border-border-light hover:bg-bg-secondary"
    >
      <span className="font-medium text-text-primary">{citation.label}</span>
      <span className="ml-1.5 uppercase tracking-wide text-text-muted">{citationTypeLabel(citation.type)}</span>
    </button>
  );
}

export function AskWhyAnswerCard({ state, onSubmit, onOpenCitation, onOpenRawDiff, disabled }: AskWhyAnswerCardProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('question') as HTMLInputElement;
    const question = input?.value?.trim();
    if (question) {
      onSubmit(question);
    }
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-primary p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Ask Why</div>

      <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
        <input
          type="text"
          name="question"
          placeholder="Why was this branch created?"
          disabled={disabled || state.kind === 'loading'}
          className="flex-1 rounded-md border border-border-subtle bg-bg-secondary px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-blue focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Ask a why question about this branch"
        />
        <SubmitButton disabled={disabled} loading={state.kind === 'loading'} />
      </form>

      {state.kind === 'loading' && (
        <p className="mt-2 text-xs text-text-tertiary" aria-live="polite">
          Analyzing branch context...
        </p>
      )}

      {state.kind === 'error' && (
        <div className="mt-2 rounded-md border border-accent-red-light bg-accent-red-bg px-2.5 py-2 text-xs text-accent-red" aria-live="polite">
          {state.message ?? `Error: ${state.errorType}`}
        </div>
      )}

      {state.kind === 'ready' && state.answer && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-text-secondary">Answer</span>
            <span className={`text-[11px] font-medium uppercase ${confidenceBandStyle(state.answer.confidenceBand)}`}>
              {state.answer.confidenceBand} {(state.answer.confidence * 100).toFixed(0)}%
            </span>
          </div>

          <p className="text-sm leading-relaxed text-text-primary">{state.answer.answerParagraph}</p>

          {state.answer.citations.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-text-muted">Citations:</span>
              {state.answer.citations.map((citation) => (
                <CitationButton
                  key={citation.id}
                  citation={citation}
                  onClick={() => onOpenCitation(citation)}
                />
              ))}
            </div>
          )}

          {state.answer.fallbackUsed && (
            <div className="rounded-md border border-accent-amber-light bg-accent-amber-bg px-2.5 py-2 text-xs text-accent-amber">
              <p>Low confidence in this answer. Consider reviewing raw evidence directly.</p>
              <button
                type="button"
                onClick={onOpenRawDiff}
                className="mt-1.5 underline hover:no-underline"
              >
                Open raw diff
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
