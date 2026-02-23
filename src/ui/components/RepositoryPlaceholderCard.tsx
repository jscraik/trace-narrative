import { motion } from 'framer-motion';
import { BarChart3, BookOpen, GitBranch, Link2 } from 'lucide-react';
import { useDialKit } from 'dialkit';

type PlaceholderVariant = 'repo' | 'dashboard' | 'docs';

export function RepositoryPlaceholderCard({
  className = '',
  variant = 'repo',
}: {
  className?: string;
  variant?: PlaceholderVariant;
}) {
  const tune = useDialKit('Placeholder Card', {
    animations: {
      breathingDuration: [4, 1, 20, 0.5],
      entryDelay: [0.1, 0, 1, 0.05],
      waitingDuration: [2, 0.5, 10, 0.5],
      cardYOffset: [10, 0, 50, 1],
    }
  });

  const ANIMATION = {
    card: {
      initial: { opacity: 0, y: tune.animations.cardYOffset },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, ease: "easeOut" as const }
    },
    breathingIcon: {
      animate: {
        boxShadow: [
          "0 0 0 1px var(--border-subtle)",
          "0 0 0 2px var(--accent-blue-light)",
          "0 0 0 1px var(--border-subtle)"
        ],
        backgroundColor: [
          "var(--secondary)",
          "var(--bg-subtle)",
          "var(--secondary)"
        ],
      },
      transition: {
        duration: tune.animations.breathingDuration,
        ease: "easeInOut" as const,
        repeat: Infinity,
      }
    },
    content: {
      initial: { opacity: 0, y: 5 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.3, delay: 0.2 }
    },
    gridItem: (index: number) => ({
      initial: { opacity: 0, x: -5 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.3, delay: 0.4 + (index * tune.animations.entryDelay) }
    })
  };

  const isDashboard = variant === 'dashboard';
  const isDocs = variant === 'docs';

  let title = 'No Repository Loaded';
  if (isDashboard) title = 'No Dashboard Loaded';
  if (isDocs) title = 'No Documentation Loaded';

  let message =
    'Narrative will display timeline, docs, and linked sessions as soon as a repository is available.';
  if (isDashboard) {
    message = 'Load a repository to see contribution metrics, trends, and developer insights.';
  } else if (isDocs) {
    message = 'Narrative will render markdown documentation from the .narrative directory once a repository is loaded.';
  }

  return (
    <motion.div
      className={`glass-shell w-full max-w-xl rounded-2xl p-8 shadow-card text-left ${className}`.trim()}
      initial={ANIMATION.card.initial}
      animate={ANIMATION.card.animate}
      transition={ANIMATION.card.transition}
    >
      <motion.div
        className="mb-6 inline-flex items-center justify-center rounded-2xl border border-border-subtle bg-bg-secondary p-5"
        animate={ANIMATION.breathingIcon.animate}
        transition={ANIMATION.breathingIcon.transition}
        whileHover={{
          scale: 1.05,
          boxShadow: "0 0 0 3px var(--accent-blue-light)",
          transition: { duration: 0.2 }
        }}
      >
        {isDashboard ? (
          <BarChart3 className="h-10 w-10 text-text-secondary" />
        ) : isDocs ? (
          <BookOpen className="h-10 w-10 text-text-secondary" />
        ) : (
          <GitBranch className="h-10 w-10 text-text-secondary" />
        )}
      </motion.div>

      <motion.div
        initial={ANIMATION.content.initial}
        animate={ANIMATION.content.animate}
        transition={ANIMATION.content.transition}
      >
        <h3 className="mb-2 text-lg font-semibold text-text-primary">{title}</h3>
        <p className="max-w-md text-sm leading-relaxed text-text-secondary">
          {message}
        </p>
      </motion.div>

      <div className="mt-8 grid grid-cols-1 gap-4 text-left text-xs sm:grid-cols-2">
        <motion.div
          className="rounded-lg border border-border-subtle bg-bg-subtle p-4"
          {...ANIMATION.gridItem(0)}
        >
          <div className="mb-1 text-sm font-semibold text-text-primary">Explore History</div>
          <div className="text-text-tertiary">Commit timeline + changed files + context</div>
        </motion.div>

        <motion.div
          className="rounded-lg border border-border-subtle bg-bg-subtle p-4"
          {...ANIMATION.gridItem(1)}
        >
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Link2 className="h-3.5 w-3.5 text-text-tertiary" />
            Link Sessions
          </div>
          <div className="text-text-tertiary">Claude/Codex/Cursor session attribution</div>
        </motion.div>
      </div>

      <motion.p
        className="mt-6 text-xs italic text-text-tertiary"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: tune.animations.waitingDuration, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        Waiting for repository context…
      </motion.p>
    </motion.div>
  );
}
