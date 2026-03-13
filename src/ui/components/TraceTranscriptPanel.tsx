import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { SessionExcerpt, SessionMessageRole } from '../../core/types';
import { MessageCard, roleSummary } from './TraceTranscriptMessage';

function EmptyState() {
  return (
    <div className="card p-5 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-header">CONVERSATION</div>
          <div className="section-subheader">Session context</div>
        </div>
      </div>
      <div className="mt-6 flex flex-col items-center text-center py-4">
        <div className="w-12 h-12 rounded-full bg-bg-primary flex items-center justify-center mb-3">
          <Sparkles className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm text-text-tertiary mb-1">No conversation loaded</p>
        <p className="max-w-[17.5rem] text-xs text-text-muted">
          Import a session to see the full conversation including thinking, planning, and tool calls.
        </p>
      </div>
    </div>
  );
}

function StatsBar({ stats }: { stats: Record<SessionMessageRole, number> }) {
  const items = [
    { count: stats.user, label: 'user', color: 'text-text-secondary' },
    { count: stats.assistant, label: 'assistant', color: 'text-text-secondary' },
    { count: stats.thinking, label: 'thinking', color: 'text-accent-amber' },
    { count: stats.plan, label: 'plan', color: 'text-accent-violet' },
    { count: stats.tool_call, label: 'tools', color: 'text-accent-green' },
  ].filter(item => item.count > 0);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem]">
      {items.map(({ count, label, color }) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`font-semibold ${color}`}>{count}</span>
          <span className="text-text-muted">{label}</span>
        </span>
      ))}
    </div>
  );
}

export function TraceTranscriptPanel({
  excerpt,
  selectedFile,
  onFileClick
}: {
  excerpt?: SessionExcerpt;
  selectedFile?: string | null;
  onFileClick?: (path: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [pendingScrollToEnd, setPendingScrollToEnd] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = excerpt?.messages ?? [];
  const stats = useMemo(() => roleSummary(messages), [messages]);
  const visibleMessages = showAll ? messages : messages.slice(0, 8);
  const hiddenCount = messages.length - visibleMessages.length;

  useEffect(() => {
    if (!pendingScrollToEnd) return;
    const shouldReduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'end' });
    setPendingScrollToEnd(false);
  }, [pendingScrollToEnd]);

  const handleJumpToLatest = () => {
    setShowAll(true);
    setPendingScrollToEnd(true);
  };

  if (!excerpt || messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="section-header">CONVERSATION</div>
          <div className="section-subheader mt-0.5">
            {excerpt.tool} · {messages.length} messages
          </div>
        </div>
        <StatsBar stats={stats} />
      </div>

      {/* Messages */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {visibleMessages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              selectedFile={selectedFile}
              onFileClick={onFileClick}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Show more/less */}
      {hiddenCount > 0 && (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-primary text-text-secondary text-xs font-medium hover:bg-border-light transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105"
          >
            {showAll ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Show {hiddenCount} more messages</>
            )}
          </button>
          {!showAll ? (
            <button
              type="button"
              onClick={handleJumpToLatest}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border-light text-xs font-medium text-text-secondary hover:bg-bg-tertiary transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105"
            >
              Jump to latest
            </button>
          ) : null}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
