import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, BookOpen, GitBranch, Link2 } from 'lucide-react';

type PlaceholderVariant = 'repo' | 'dashboard' | 'docs';

export function RepositoryPlaceholderCard({
  className = '',
  variant = 'repo',
  onOpenRepo,
}: {
  className?: string;
  variant?: PlaceholderVariant;
  onOpenRepo?: () => void;
}) {
  const animations = {
    breathingDuration: 4,
    entryDelay: 0.1,
    waitingDuration: 2,
    cardYOffset: 10,
  };

  const ANIMATION = {
    card: {
      initial: { opacity: 0, y: animations.cardYOffset },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, ease: "easeOut" as const }
    },
    breathingIcon: {
      animate: {
        boxShadow: [
          "0 0 0 1px var(--border-subtle)",
          "0 0 0 2px var(--accent-amber-light)",
          "0 0 0 1px var(--border-subtle)"
        ],
        backgroundColor: [
          "var(--secondary)",
          "var(--bg-subtle)",
          "var(--secondary)"
        ],
      },
      transition: {
        duration: animations.breathingDuration,
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
      transition: { duration: 0.3, delay: 0.4 + (index * animations.entryDelay) }
    })
  };

  const isDashboard = variant === 'dashboard';
  const isDocs = variant === 'docs';

  let title = 'No repository loaded';
  if (isDashboard) title = 'No dashboard loaded';
  if (isDocs) title = 'No documentation loaded';

  let message =
    'Open a repository to see your timeline, docs, and linked AI sessions in one place.';
  if (isDashboard) {
    message = 'Open a repository to see contribution metrics, trends, and developer insights.';
  } else if (isDocs) {
    message = 'Documentation will render once a repository with a .narrative directory is loaded.';
  }

  const quickActions = isDashboard
    ? [
      {
        title: 'Explore Trends',
        detail: 'Commit velocity, test health, and activity patterns',
      },
      {
        title: 'Trace AI Work',
        detail: 'Session attribution from Claude/Codex/Cursor',
      },
    ]
    : isDocs
      ? [
        {
          title: 'Browse Guides',
          detail: 'Render markdown docs from your repository',
        },
        {
          title: 'Keep Context',
          detail: 'Surface narrative plans, decisions, and references',
        },
      ]
      : [
        {
          title: 'Explore History',
          detail: 'Commit timeline + changed files + context',
        },
        {
          title: 'Link Sessions',
          detail: 'Connect Claude/Codex/Cursor activity to commits',
        },
      ];

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
          boxShadow: "0 0 0 3px var(--accent-amber-light)",
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
        {quickActions.map((action, index) => (
          <motion.div
            key={action.title}
            className="rounded-lg border border-border-subtle bg-bg-subtle p-4"
            {...ANIMATION.gridItem(index)}
          >
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Link2 className="h-3.5 w-3.5 text-text-tertiary" />
              {action.title}
            </div>
            <div className="text-text-tertiary">{action.detail}</div>
          </motion.div>
        ))}
      </div>

      {onOpenRepo && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="mt-6"
        >
          <button
            type="button"
            onClick={onOpenRepo}
            className="inline-flex items-center gap-2 rounded-xl border border-accent-amber-light bg-accent-amber-bg px-5 py-2.5 text-sm font-semibold text-accent-amber transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:bg-accent-amber-light hover:scale-105 active:scale-95 active:duration-75"
          >
            Open a repository
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      <motion.p
        className="mt-6 text-xs italic text-text-tertiary"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: animations.waitingDuration, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        Waiting for repository context…
      </motion.p>
    </motion.div>
  );
}
