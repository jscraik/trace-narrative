import { motion } from 'framer-motion';
import { AlertCircle, CircleDot, ShieldCheck, GitCommit, Bot, FolderGit2 } from 'lucide-react';
import type { DashboardEmptyReason } from '../../../core/types';
import { RepositoryPlaceholderCard } from '../RepositoryPlaceholderCard';
import { ActivityBarChart, MiniBarChart } from '../charts';

interface DashboardEmptyStateProps {
  reason: DashboardEmptyReason;
  onOpenRepo?: () => void;
}

// =============================================================================
// MOCK DATA FOR EMPTY PREVIEW
// =============================================================================

const MOCK_ACTIVITY = Array.from({ length: 30 }).map((_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  // Create a realistic-looking fake curve
  let value = Math.floor(Math.sin(i / 3) * 5 + 8);
  if (value < 0) value = 0;
  if (i > 25) value += 12; // spike at the end
  return {
    date: date.toISOString().split('T')[0],
    value,
  };
});

const MOCK_TOOLS = [
  { label: 'Codex Edit', value: 8420, tone: 'violet' as const },
  { label: 'Claude Composer', value: 3150, tone: 'violet' as const },
  { label: 'Terminal', value: 1200, tone: 'violet' as const },
];

const MOCK_SIGNALS = [
  { label: 'Commits moved', value: '142', tone: 'blue', detail: '+12 vs previous window' },
  { label: 'Attributed lines', value: '12.4K', tone: 'violet', detail: '84% AI-linked evidence.' },
  { label: 'Top tool lane', value: 'Codex Edit', tone: 'green', detail: '8,420 lines in the current window.' },
  { label: 'Trust posture', value: 'Ready', tone: 'green', detail: 'Capture is healthy.' },
] as const;

const TONE_DOT = {
  blue: 'bg-accent-blue',
  green: 'bg-accent-green',
  amber: 'bg-accent-amber',
  violet: 'bg-accent-violet',
} as const;

const TONE_VALUE = {
  blue: 'text-accent-blue',
  green: 'text-accent-green',
  amber: 'text-accent-amber',
  violet: 'text-accent-violet',
} as const;

// =============================================================================
// EMPTY STATE CONFIGURATIONS (Non-Repo)
// =============================================================================
const EMPTY_STATES: Record<Exclude<DashboardEmptyReason, 'no-repo'>, EmptyStateConfig> = {
  'no-commits': {
    icon: <GitCommit className="h-16 w-16 text-text-muted" />,
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
    icon: <Bot className="h-16 w-16 text-accent-blue" />,
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
    icon: <AlertCircle className="h-16 w-16 text-accent-amber" />,
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

export function DashboardEmptyState({ reason, onOpenRepo }: DashboardEmptyStateProps) {
  if (reason === 'no-repo') {
    return (
      <div className="relative flex h-full min-h-[31.25rem] flex-col overflow-hidden">
        {/* The Mock Background layer — visually identical to the real dashboard but dimmed */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.15] grayscale filter transition-opacity duration-1000">
          <div className="mx-auto flex h-full max-w-[100rem] flex-col gap-5 overflow-hidden px-6 py-5">
            {/* Row 1 */}
            <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
              <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]">
                    Narrative Brief
                  </span>
                  <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]">
                    main
                  </span>
                  <span className="rounded-full border border-border-light bg-bg-primary px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]">
                    84% AI
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">
                  What moved, what is risky, and where to inspect next.
                </h2>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-3 py-2 text-sm">
                    <CircleDot className="h-3.5 w-3.5 shrink-0" />
                    <span>src/core/attribution.ts</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border-light bg-bg-primary px-3 py-2 text-sm">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Trust is healthy — proceed to repo</span>
                  </div>
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em]">Change pulse</p>
                    <h3 className="mt-0.5 text-sm font-semibold">Commits per day · last 30 days</h3>
                  </div>
                </div>
                <ActivityBarChart data={MOCK_ACTIVITY} height={134} tone="violet" unit=" commits" label="Mock Activity" />
              </article>
            </section>

            {/* Row 2: Signals */}
            <div className="glass-panel flex flex-wrap divide-x divide-border-subtle overflow-hidden rounded-2xl">
              {MOCK_SIGNALS.map((s) => (
                <div key={s.label} className="flex min-w-32 flex-1 items-center gap-3 px-4 py-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[s.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-base font-semibold leading-tight tracking-tight ${TONE_VALUE[s.tone]}`}>
                      {s.value}
                    </div>
                    <div className="truncate text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                      {s.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row 3 */}
            <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <article className="rounded-[1.75rem] border border-border-subtle bg-bg-secondary p-4">
                <div className="mb-3">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em]">Tool distribution</p>
                  <h3 className="mt-0.5 text-sm font-semibold">Line attribution by tool · top 3</h3>
                </div>
                <MiniBarChart data={MOCK_TOOLS} height={78} unit=" lines" label="Mock Tool Distribution" />
              </article>

              <article className="rounded-[1.5rem] border border-border-subtle bg-bg-secondary p-4">
                <div className="mb-3">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em]">Next lanes</p>
                  <h3 className="mt-1 text-base font-semibold">Keep Codex asks inside proof</h3>
                </div>
                <div className="mt-3 grid gap-2.5">
                  <div className="flex w-full items-start gap-3 rounded-[1.1rem] border border-border-light bg-bg-primary p-3">
                    <FolderGit2 className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Open repo evidence</p>
                      <p className="mt-0.5 text-xs text-text-secondary">Start with the highest-signal file.</p>
                    </div>
                  </div>
                  <div className="flex w-full items-start gap-3 rounded-[1.1rem] border border-border-light bg-bg-primary p-3">
                    <ShieldCheck className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Resolve trust posture</p>
                      <p className="mt-0.5 text-xs text-text-secondary">Trust Center stays green.</p>
                    </div>
                  </div>
                </div>
              </article>
            </section>
          </div>
        </div>

        {/* Foreground Overlay — center the CTA */}
        <div className="relative z-10 flex flex-1 items-center justify-center bg-bg-page/40 p-6 backdrop-blur-sm">
          <RepositoryPlaceholderCard variant="dashboard" onOpenRepo={onOpenRepo} />
        </div>
      </div>
    );
  }

  const config = EMPTY_STATES[reason];

  return (
    <motion.output
      className="dashboard-empty-state flex min-h-[31.25rem] flex-col items-center justify-center px-6 py-12"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      {/* Icon Container */}
      <motion.div
        className={`
          icon-container mb-6 flex h-24 w-24 items-center justify-center
          rounded-2xl border border-border-subtle shadow-card glass-shell
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
        <p className="mb-6 leading-relaxed text-base text-text-secondary">
          {config.message}
        </p>

        {/* Actions */}
        <div className="actions flex items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-surface-strong px-6 py-2.5 font-medium text-text-inverted shadow-lg shadow-bg-page/10 transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:scale-105 hover:bg-surface-strong-hover active:scale-[0.98] active:duration-75"
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
