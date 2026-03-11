import { motion } from 'framer-motion';
import { AlertCircle, Bot, GitCommit } from 'lucide-react';
import type { DashboardEmptyReason } from '../../../core/types';
import { RepositoryPlaceholderCard } from '../RepositoryPlaceholderCard';

interface DashboardEmptyStateProps {
  reason: DashboardEmptyReason;
}

// =============================================================================
// EMPTY STATE CONFIGURATIONS
// =============================================================================
const EMPTY_STATES: Record<Exclude<DashboardEmptyReason, 'no-repo'>, EmptyStateConfig> = {
  'no-commits': {
    icon: <GitCommit className="w-16 h-16 text-text-muted" />,
    iconBackground: 'bg-bg-tertiary',
    title: 'No commits in this time range',
    message: 'There are no commits in the selected time period. Try a different range or create some commits!',
    primaryAction: {
      label: 'Select "All Time"',
      onClick: () => {/* Set time range to 'all' */ },
    },
    delight: 'Every commit tells a story.',
  },

  'no-ai': {
    icon: <Bot className="w-16 h-16 text-accent-blue" />,
    iconBackground: 'bg-accent-blue-bg',
    title: 'No AI contributions detected',
    message: 'Import Codex sessions first to establish a trustworthy baseline. Additional providers can be layered in after the Codex flow is stable.',
    primaryAction: {
      label: 'Import Sessions',
      onClick: () => {/* Navigate to import */ },
    },
    delight: 'Start your AI journey.',
  },

  'no-attribution': {
    icon: <AlertCircle className="w-16 h-16 text-accent-amber" />,
    iconBackground: 'bg-accent-amber-bg',
    title: 'No attribution data available',
    message: 'AI sessions exist but couldn\'t be linked to commits. Check your linking settings or try manual linking.',
    primaryAction: {
      label: 'Open Link Settings',
      onClick: () => {/* Open settings panel */ },
    },
    delight: 'Connecting the dots...',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================
export function DashboardEmptyState({ reason }: DashboardEmptyStateProps) {
  if (reason === 'no-repo') {
    return (
      <output className="dashboard-empty-state flex h-full min-h-[500px] items-center justify-center px-6 py-12">
        <RepositoryPlaceholderCard variant="dashboard" />
      </output>
    );
  }

  const config = EMPTY_STATES[reason];

  return (
    <motion.output
      className="dashboard-empty-state flex flex-col items-center justify-center min-h-[500px] px-6 py-12"
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
            "0 0 0 1px var(--border-subtle)",
            "0 0 0 3px var(--bg-subtle)",
            "0 0 0 1px var(--border-subtle)"
          ],
        }}
        transition={{
          duration: 4,
          ease: "easeInOut" as const,
          repeat: Infinity,
        }}
        whileHover={{
          scale: 1.05,
          boxShadow: "0 0 0 4px var(--accent-blue-light)",
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
