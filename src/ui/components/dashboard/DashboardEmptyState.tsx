import { motion } from 'framer-motion';
import { AlertCircle, Bot, GitCommit } from 'lucide-react';
import type { DashboardEmptyReason } from '../../../core/types';
import { RepositoryPlaceholderCard } from '../RepositoryPlaceholderCard';

interface DashboardEmptyStateProps {
  reason: DashboardEmptyReason;
  onOpenRepo?: () => void;
}

// =============================================================================
// EMPTY STATE CONFIGURATIONS
// =============================================================================
const EMPTY_STATES: Record<Exclude<DashboardEmptyReason, 'no-repo'>, EmptyStateConfig> = {
  'no-commits': {
    icon: <GitCommit className="w-16 h-16 text-text-muted" />,
    iconBackground: 'bg-bg-tertiary',
    title: 'No commits in this narrative window',
    message: 'There are no commits in the selected time period. Try a broader window so the narrative brief has evidence to work with.',
    primaryAction: {
      label: 'Select "All Time"',
      onClick: () => {/* Set time range to 'all' */ },
    },
    delight: 'Every branch story starts with a commit.',
  },

  'no-ai': {
    icon: <Bot className="w-16 h-16 text-accent-blue" />,
    iconBackground: 'bg-accent-blue-bg',
    title: 'No Codex session evidence detected',
    message: 'Import Codex sessions first to establish a trustworthy baseline. Additional providers can be layered in after the Codex flow is stable.',
    primaryAction: {
      label: 'Import Sessions',
      onClick: () => {/* Navigate to import */ },
    },
    delight: 'Trust starts with captured evidence.',
  },

  'no-attribution': {
    icon: <AlertCircle className="w-16 h-16 text-accent-amber" />,
    iconBackground: 'bg-accent-amber-bg',
    title: 'No attribution evidence available',
    message: 'Sessions exist but couldn\'t be linked to commits. Check your linking settings or use Repo Evidence to verify the joins manually.',
    primaryAction: {
      label: 'Open Link Settings',
      onClick: () => {/* Open settings panel */ },
    },
    delight: 'Connecting the evidence trail...',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================
const EMPTY_PREVIEW_ROWS = [
  { title: 'Narrative brief ready when repo is loaded', meta: 'Awaiting repo', state: 'Preview' },
  { title: 'Session evidence lane will hydrate from Codex imports', meta: 'Codex-first', state: 'Queued' },
  { title: 'Trust Center requires capture posture + evidence joins', meta: 'Fail-closed', state: 'Guarded' },
  { title: 'Repo Evidence will become the deep-read verification lane', meta: 'Next move', state: 'Primary' },
];

export function DashboardEmptyState({ reason, onOpenRepo }: DashboardEmptyStateProps) {
  if (reason === 'no-repo') {
    return (
      <output className="dashboard-empty-state flex h-full min-h-[31.25rem] items-center justify-center px-6 py-8">
        <div className="w-full max-w-6xl rounded-3xl border border-border-subtle bg-bg-secondary/70 p-5 shadow-card backdrop-blur-sm">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-border-subtle bg-bg-primary/55 p-4">
              <RepositoryPlaceholderCard variant="dashboard" onOpenRepo={onOpenRepo} className="max-w-none" />
            </div>

            <section className="rounded-2xl border border-border-subtle bg-bg-primary/45 p-4">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Narrative preview
              </p>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">
                This shell will populate as soon as repo evidence is loaded.
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Keeping this area dense and legible helps the app feel intentional before the first import, while staying honest about what is real versus staged.
              </p>

              <div className="mt-4 space-y-2">
                {EMPTY_PREVIEW_ROWS.map((row) => (
                  <div key={row.title} className="flex items-start justify-between gap-3 rounded-xl border border-border-light bg-bg-secondary/80 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{row.title}</p>
                      <p className="mt-0.5 text-xs text-text-tertiary">{row.meta}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-border-light bg-bg-primary px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {row.state}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </output>
    );
  }

  const config = EMPTY_STATES[reason];

  return (
    <motion.output
      className="dashboard-empty-state flex flex-col items-center justify-center min-h-[31.25rem] px-6 py-12"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      {/* Icon Container */}
      <motion.div
        className={`
          icon-container flex items-center justify-center w-24 h-24
          rounded-2xl mb-6 glass-shell border border-border-subtle shadow-card
          ${config.iconBackground}
        `}
        aria-hidden="true"
        animate={{
          boxShadow: [
            "0 0 0 0.0625rem var(--border-subtle)",
            "0 0 0 0.1875rem var(--bg-subtle)",
            "0 0 0 0.0625rem var(--border-subtle)"
          ],
        }}
        transition={{
          duration: 4,
          ease: "easeInOut" as const,
          repeat: Infinity,
        }}
        whileHover={{
          scale: 1.05,
          boxShadow: "0 0 0 0.25rem var(--accent-blue-light)",
          transition: { duration: 0.2 }
        }}
      >
        {config.icon}
      </motion.div>

      {/* Content */}
      <motion.div
        className="content max-w-md text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h2 className="mb-3 text-2xl font-semibold text-text-primary">
          {config.title}
        </h2>
        <p className="mb-6 text-base text-text-secondary leading-relaxed">
          {config.message}
        </p>

        {/* Actions */}
        <div className="actions flex items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-surface-strong px-6 py-2.5 font-medium text-text-inverted transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:bg-surface-strong-hover hover:scale-105 shadow-lg shadow-bg-page/10"
            onClick={config.primaryAction.onClick}
          >
            {config.primaryAction.label}
          </button>
        </div>

        {/* Delight Message */}
        <motion.p
          className="delight mt-8 text-sm italic text-text-muted"
          aria-hidden="true"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          {config.delight}
        </motion.p>
      </motion.div>
    </motion.output>
  );
}

// =============================================================================
// TYPES
// =============================================================================
interface EmptyStateConfig {
  icon: React.ReactNode;
  iconBackground: string;
  title: string;
  message: string;
  primaryAction: {
    label: string;
    onClick: () => void;
  };
  delight: string;
}
