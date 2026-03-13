import clsx from 'clsx';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import type {
  NarrativeSurfaceViewModel,
  SurfaceAction,
  SurfaceProvenanceNodeState,
  SurfaceTone,
} from './narrativeSurfaceData';
import { AuthorityCue } from './narrativeSurfaceSections';

const toneClasses: Record<SurfaceTone, { border: string; bg: string; text: string }> = {
  blue: {
    border: 'border-accent-blue-light',
    bg: 'bg-accent-blue/10',
    text: 'text-accent-blue',
  },
  violet: {
    border: 'border-accent-violet-light',
    bg: 'bg-accent-violet/10',
    text: 'text-accent-violet',
  },
  green: {
    border: 'border-accent-green-light',
    bg: 'bg-accent-green-bg',
    text: 'text-accent-green',
  },
  amber: {
    border: 'border-accent-amber-light',
    bg: 'bg-accent-amber-bg',
    text: 'text-accent-amber',
  },
  red: {
    border: 'border-accent-red-light',
    bg: 'bg-accent-red-bg',
    text: 'text-accent-red',
  },
  slate: {
    border: 'border-border-light',
    bg: 'bg-bg-primary',
    text: 'text-text-secondary',
  },
};

const provenanceStateClasses: Record<SurfaceProvenanceNodeState, string> = {
  observed: 'border-accent-blue-light bg-accent-blue/10 text-accent-blue',
  linked: 'border-accent-green-light bg-accent-green-bg text-accent-green',
  derived: 'border-accent-violet-light bg-accent-violet/10 text-accent-violet',
  review: 'border-accent-red-light bg-accent-red-bg text-accent-red',
};

function handleActionKeyDown(
  event: KeyboardEvent<HTMLElement>,
  action: SurfaceAction | undefined,
  onAction: ((action: SurfaceAction) => void) | undefined,
) {
  if (!action) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onAction?.(action);
}

export function ProvenanceSection({
  provenance,
  onAction,
}: {
  provenance: NonNullable<NarrativeSurfaceViewModel['provenance']>;
  onAction?: (action: SurfaceAction) => void;
}) {
  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{provenance.eyebrow}</p>
            <h3 className="mt-1 text-lg font-semibold text-text-primary">{provenance.title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{provenance.summary}</p>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-bg-primary/70 p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
              How to read it
            </p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Observed facts land first, evidence joins come next, derived claims stay explicit, and the final node tells the operator whether to inspect or pause.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['observed', 'linked', 'derived', 'review'] as SurfaceProvenanceNodeState[]).map((state) => (
                <span
                  key={state}
                  className={clsx(
                    'rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]',
                    provenanceStateClasses[state],
                  )}
                >
                  {state === 'review' ? 'Verify' : state}
                </span>
              ))}
            </div>
          </div>
        </div>

        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label={provenance.title}>
          {provenance.nodes.map((node, index) => {
            const tone = toneClasses[node.tone];
            return (
              <li key={`${node.eyebrow}-${node.title}`} className="relative">
                {index > 0 && (
                  <div className="mb-2 flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    <ArrowRight className="h-3 w-3" />
                    {node.edgeLabel ?? 'flows into'}
                  </div>
                )}
                <article
                  onClick={() => node.action && onAction?.(node.action)}
                  onKeyDown={(event) => handleActionKeyDown(event, node.action, onAction)}
                  role={node.action ? 'button' : undefined}
                  tabIndex={node.action ? 0 : undefined}
                  className={clsx(
                    'h-full rounded-2xl border p-4 transition duration-200',
                    tone.border,
                    tone.bg,
                    node.action && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
                  )}
                  data-authority-tier={node.authorityTier}
                  data-authority-label={node.authorityLabel}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={clsx('text-[0.6875rem] font-semibold uppercase tracking-[0.18em]', tone.text)}>
                        {node.eyebrow}
                      </p>
                      <h4 className="mt-2 text-base font-semibold text-text-primary">{node.title}</h4>
                    </div>
                    <span
                      className={clsx(
                        'rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em]',
                        provenanceStateClasses[node.state],
                      )}
                    >
                      {node.state === 'review' ? 'Verify' : node.state}
                    </span>
                  </div>
                  <div className="mt-3">
                    <AuthorityCue authorityTier={node.authorityTier} authorityLabel={node.authorityLabel} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{node.detail}</p>
                  {node.action && (
                    <div className="mt-3 flex items-center gap-1 text-[0.625rem] font-medium text-accent-violet">
                      <ArrowUpRight className="h-3 w-3" />
                      Follow this evidence step
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="mt-5 text-sm leading-6 text-text-secondary">{provenance.footnote}</p>
    </section>
  );
}
