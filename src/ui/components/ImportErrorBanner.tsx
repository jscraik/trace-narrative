import { AlertCircle, FileJson, HelpCircle, X } from 'lucide-react';

interface ImportErrorBannerProps {
  error: string;
  onDismiss?: () => void;
}

/**
 * Maps error messages to helpful documentation and recovery actions.
 * This provides context-aware help for common import failures.
 */
function getErrorHelp(error: string): {
  title: string;
  description: string;
  actions: Array<{ label: string; href?: string; action?: () => void }>;
} | null {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('no readable messages found in the kimi context log')) {
    return {
      title: 'Kimi Log Format Issue',
      description: 'The file was read successfully, but we could not find any messages in the expected format. Kimi logs should be JSON Lines (.jsonl) with records containing role and content fields.',
      actions: [
        {
          label: 'View Kimi Log Format Guide',
          href: 'https://docs.narrative.dev/kimi-log-format'
        },
        {
          label: 'Try importing as Generic JSON',
          action: () => {
            // This would trigger the generic JSON import flow
            // For now, we just log - the user can manually retry
            console.log('User chose to retry as generic JSON');
          }
        }
      ]
    };
  }

  if (lowerError.includes('json') && lowerError.includes('parse')) {
    return {
      title: 'Invalid JSON Format',
      description: 'The file could not be parsed as JSON. Please ensure the file contains valid JSON with proper syntax.',
      actions: [
        {
          label: 'Validate JSON Online',
          href: 'https://jsonlint.com/'
        }
      ]
    };
  }

  if (lowerError.includes('file') || lowerError.includes('not found')) {
    return {
      title: 'File Access Error',
      description: 'Could not read the selected file. Please ensure the file exists and you have permission to access it.',
      actions: []
    };
  }

  return null;
}

export function ImportErrorBanner({ error, onDismiss }: ImportErrorBannerProps) {
  const help = getErrorHelp(error);

  return (
    <div className="rounded-xl border border-accent-error-warm-light bg-accent-error-warm-bg p-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-accent-red mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {help ? (
            <>
              <div className="mb-1 font-semibold text-accent-red">{help.title}</div>
              <div className="mb-3 leading-relaxed text-text-secondary">{help.description}</div>

              {help.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {help.actions.map((action) => {
                    const actionKey = `${action.label}-${action.href ?? 'action'}`;
                    return (
                      action.href ? (
                        <a
                          key={actionKey}
                          href={action.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary border border-accent-red-light text-accent-red text-xs font-medium hover:bg-accent-red-light transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-[0.98] hover:scale-105"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          {action.label}
                        </a>
                      ) : (
                        <button
                          key={actionKey}
                          type="button"
                          onClick={action.action}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary border border-accent-red-light text-accent-red text-xs font-medium hover:bg-accent-red-light transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-[0.98] hover:scale-105"
                        >
                          <FileJson className="w-3.5 h-3.5" />
                          {action.label}
                        </button>
                      )
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-text-secondary">{error}</div>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-accent-red/70 transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-[0.98] hover:text-accent-red hover:scale-110"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
