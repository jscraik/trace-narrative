import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Link2,
  Link2Off,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { SessionExcerpt } from '../../../core/types';
import { Dialog } from '../Dialog';
import { formatDuration } from './sessionExcerpts.utils';

export function ExpandableHighlight({ text, id }: { text: string; id: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 120;
  const needsExpansion = text.length > limit;
  const displayText = expanded || !needsExpansion ? text : `${text.slice(0, limit).trim()}…`;

  return (
    <li className="text-xs text-text-secondary">
      <span id={`${id}-text`}>{displayText}</span>
      {needsExpansion ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="ml-1 text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium inline-flex items-center gap-0.5"
          aria-expanded={expanded}
          aria-controls={`${id}-text`}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Read more
            </>
          )}
        </button>
      ) : null}
    </li>
  );
}

export function ToolPill(props: {
  tool: string;
  durationMin?: number;
  agentName?: string;
  redactionCount?: number;
}) {
  const { tool, durationMin, agentName, redactionCount } = props;

  return (
    <div className="flex items-center gap-2 text-[11px] text-text-muted">
      <span className="px-2 py-1 bg-bg-primary rounded-md font-mono text-text-tertiary">{tool}</span>
      {agentName ? <span className="text-text-tertiary">· {agentName}</span> : null}
      {typeof durationMin === 'number' ? <span>{formatDuration(durationMin)}</span> : null}
      {typeof redactionCount === 'number' && redactionCount > 0 ? (
        <span className="rounded bg-accent-amber-bg px-1.5 py-0.5 text-accent-amber">Redacted {redactionCount}</span>
      ) : null}
    </div>
  );
}

export function LinkStatus(props: {
  excerpt: SessionExcerpt;
  onUnlink?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const { excerpt, onUnlink, onClick, isSelected } = props;

  if (!excerpt.linkedCommitSha) {
    return (
      <div
        className="flex items-center gap-2 text-[11px] text-text-tertiary"
        title="Session imported successfully, but no confident commit match has been linked yet."
      >
        <Link2Off className="w-3 h-3" />
        <span>Imported · awaiting link</span>
      </div>
    );
  }

  const shortSha = excerpt.linkedCommitSha.slice(0, 8);
  const confidencePercent = excerpt.linkConfidence ? Math.round(excerpt.linkConfidence * 100) : 0;

  return (
    <div className="flex items-center gap-2 text-[11px] text-text-muted">
      <Link2 className="w-3 h-3" />
      <button
        type="button"
        onClick={onClick}
        aria-label={`View commit ${shortSha} in timeline`}
        className={`text-text-secondary hover:text-accent-blue transition-colors ${isSelected ? 'text-accent-blue font-semibold' : ''}`}
        title="Click to view this commit in the timeline"
      >
        Linked to <span className="font-mono">{shortSha}</span>
      </button>
      <span
        className="px-1.5 py-0.5 bg-bg-primary rounded text-text-tertiary cursor-help"
        title={`Link confidence: ${confidencePercent}% — Estimated match quality between session activity and commit changes. Higher values indicate stronger correlation.`}
      >
        {confidencePercent}%
      </span>
      {excerpt.autoLinked ? (
        <span className="rounded bg-accent-green-bg px-1.5 py-0.5 text-accent-green">Auto</span>
      ) : null}
      {onUnlink ? (
        <button
          type="button"
          onClick={onUnlink}
          aria-label="Unlink session from commit"
          className="rounded bg-accent-red-bg px-1.5 py-0.5 text-accent-red transition-colors hover:bg-accent-red-light"
          title="Unlink this session from the commit"
        >
          Unlink
        </button>
      ) : null}
    </div>
  );
}

export function FilePill(props: {
  file: string;
  onClick?: () => void;
  isSelected?: boolean;
  variant?: 'default' | 'best-effort' | 'not-found';
  title?: string;
}) {
  const { file, onClick, isSelected, variant, title } = props;

  const variantClass = variant === 'not-found' ? 'not-found' : variant === 'best-effort' ? 'best-effort' : '';

  const icon = (() => {
    if (variant === 'default') return <CheckCircle2 className="w-3 h-3 text-accent-green shrink-0" aria-hidden="true" />;
    if (variant === 'best-effort') return <HelpCircle className="w-3 h-3 text-accent-amber shrink-0" aria-hidden="true" />;
    if (variant === 'not-found') return <XCircle className="w-3 h-3 text-accent-red shrink-0" aria-hidden="true" />;
    return null;
  })();

  const content = (
    <>
      {icon}
      <span className="truncate">{file}</span>
    </>
  );

  const classes = `pill-file max-w-full truncate inline-flex items-center gap-1.5 ${variantClass} ${isSelected ? 'selected' : ''}`;

  if (!onClick) {
    return (
      <span title={title ?? file} className={classes}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isSelected ? `View file ${file} (selected)` : `View file ${file}`}
      aria-pressed={isSelected}
      title={title ?? file}
      className={classes}
    >
      {content}
    </button>
  );
}

export function UnlinkConfirmDialog(props: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { isOpen, onClose, onConfirm } = props;

  return (
    <Dialog
      title="Unlink session from commit?"
      message="This will remove the association between the AI session and the commit. The session will remain imported but will show as 'Imported · awaiting link'."
      confirmLabel="Unlink"
      cancelLabel="Cancel"
      variant="destructive"
      open={isOpen}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

export function SessionLinkPipeline({ excerpt }: { excerpt: SessionExcerpt }) {
  const isLinked = Boolean(excerpt.linkedCommitSha);
  const needsReview = Boolean(excerpt.needsReview);
  const activeStep = isLinked ? (needsReview ? 2 : 3) : 2;

  const steps = [
    { id: 1, label: 'Imported' },
    { id: 2, label: 'Matching' },
    { id: 3, label: needsReview ? 'Needs review' : 'Linked' },
  ] as const;

  return (
    <div className="mt-1 w-full max-w-[220px]" title="Session link lifecycle">
      <div className="flex items-center gap-1.5">
        {steps.map((step, index) => {
          const complete = step.id < activeStep;
          const active = step.id === activeStep;
          const dotClass = complete ? 'bg-accent-green border-accent-green' : active ? 'bg-accent-amber border-accent-amber animate-pulse' : 'bg-bg-tertiary border-border-light';

          return (
            <div key={step.id} className="flex min-w-0 items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full border ${dotClass}`} />
              <span className={`text-[10px] leading-4 ${active ? 'text-text-secondary font-semibold' : 'text-text-muted'}`}>
                {step.label}
              </span>
              {index < steps.length - 1 ? <span className="h-px w-3 bg-border-light" aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
