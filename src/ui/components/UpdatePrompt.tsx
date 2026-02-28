import { AlertCircle, CheckCircle, Download, Loader2, RefreshCw, X } from 'lucide-react';
import type { UpdateStatus } from '../../hooks/useUpdater';

export interface UpdatePromptProps {
  status: UpdateStatus;
  onUpdate: () => void;
  onClose?: () => void;
  /**
   * @deprecated Use onClose instead.
   */
  onDismiss?: () => void;
  onCheckAgain?: () => void;
}

const normalizeVersionLabel = (raw: string): string =>
  raw.trim().replace(/^v\s+/i, 'v').trim();

/**
 * Update notification component that displays update status
 * and allows users to download/install updates.
 */
export function UpdatePrompt({ status, onUpdate, onClose, onDismiss, onCheckAgain }: UpdatePromptProps) {
  const handleClose = onClose ?? onDismiss;
  // Don't show anything if no update or checking (silent)
  if (status.type === 'no_update' || status.type === 'checking') {
    return null;
  }

  /**
 * Maps technical errors to user-friendly messages
 */
  function getUserFriendlyError(error: string): { title: string; message: string; isWebMode?: boolean } {
    const lowerError = error.toLowerCase();

    // Tauri API unavailable (running in browser mode)
    if (lowerError.includes('cannot read properties of undefined') && lowerError.includes('invoke')) {
      return {
        title: 'Desktop Features Unavailable',
        message: 'Auto-updates are only available in the desktop app. Please download the latest version from our releases page.',
        isWebMode: true,
      };
    }

    // Network errors
    if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('connection')) {
      return {
        title: 'Connection Issue',
        message: 'Unable to check for updates. Please check your internet connection and try again.',
      };
    }

    // Server errors
    if (lowerError.includes('500') || lowerError.includes('502') || lowerError.includes('503')) {
      return {
        title: 'Server Error',
        message: 'Our update server is temporarily unavailable. Please try again later.',
      };
    }

    // Default error
    return {
      title: 'Update Error',
      message: 'Something went wrong while checking for updates. Please try again.',
    };
  }

  // Error state
  if (status.type === 'error') {
    const { title, message, isWebMode } = getUserFriendlyError(status.error);

    return (
      <div className="fixed top-4 right-4 z-50 w-80 animate-in slide-in-from-right fade-in duration-300">
        <div className="rounded-xl border border-accent-red-light bg-bg-secondary shadow-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-accent-red mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-text-primary text-sm">{title}</div>
              <p className="text-xs text-text-secondary mt-1">{message}</p>
              <div className="flex gap-2 mt-3">
                {onCheckAgain && !isWebMode && (
                  <button
                    type="button"
                    onClick={onCheckAgain}
                    className="inline-flex items-center gap-1 rounded-md border border-border-light bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Try Again
                  </button>
                )}
                {isWebMode && (
                  <a
                    href="https://github.com/jscraik/firefly-narrative/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent-blue hover:text-accent-blue/80 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Download App
                  </a>
                )}
              </div>
            </div>
            {handleClose ? (
              <button
                type="button"
                onClick={handleClose}
                className="text-text-tertiary hover:text-text-secondary transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Downloading state
  if (status.type === 'downloading') {
    return (
      <div className="fixed top-4 right-4 z-50 w-80 animate-in slide-in-from-right fade-in duration-300">
        <div className="rounded-xl border border-accent-blue-light bg-accent-blue-bg shadow-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-accent-blue motion-safe:animate-spin shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-text-primary text-sm">Downloading Update</div>
              <div className="mt-2 h-1.5 bg-accent-blue-light rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-blue transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <div className="text-xs text-text-tertiary mt-1">{status.progress}%</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ready to install state
  if (status.type === 'ready') {
    return (
      <div className="fixed top-4 right-4 z-50 w-80 animate-in slide-in-from-right fade-in duration-300">
        <div className="rounded-xl border border-accent-green-light bg-accent-green-bg shadow-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-accent-green mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-text-primary text-sm">Update Ready</div>
              <p className="text-xs text-text-tertiary mt-1">
                The update has been downloaded. Restart the app to apply changes.
              </p>
            </div>
            {handleClose ? (
              <button
                type="button"
                onClick={handleClose}
                className="text-text-tertiary hover:text-text-secondary transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Available update state (default)
  if (status.type === 'available') {
    const version = normalizeVersionLabel(status.update.version);
    const currentVersion = status.update.currentVersion
      ? normalizeVersionLabel(status.update.currentVersion)
      : null;

    return (
      <div className="fixed top-4 right-4 z-50 w-80 animate-in slide-in-from-right fade-in duration-300">
        <div className="rounded-xl border border-border-light bg-bg-secondary shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-blue">
              <Download className="h-5 w-5 text-text-inverted" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-text-primary text-sm">
                Update Available
              </div>
              <p className="text-xs text-text-tertiary mt-0.5">
                Version <span className="font-medium text-text-secondary">{version}</span> is now available.
                {currentVersion && (
                  <span className="text-text-muted"> (Current: {currentVersion})</span>
                )}
              </p>

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={onUpdate}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue text-text-inverted text-xs font-medium hover:opacity-90 transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download & Install
                </button>
                {handleClose ? (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3 py-1.5 rounded-lg border border-border-light text-text-secondary text-xs font-medium hover:bg-bg-tertiary transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-95 hover:scale-105"
                  >
                    Later
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Small update indicator for the status bar or header.
 * Shows a dot/badge when updates are available.
 */
export interface UpdateIndicatorProps {
  status: UpdateStatus | null;
  onClick: () => void;
}

export function UpdateIndicator({
  status,
  onClick
}: UpdateIndicatorProps) {
  if (!status) return null;

  if (status.type === 'available') {
    const version = normalizeVersionLabel(status.update.version);

    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent-amber-bg px-2 py-1 text-xs font-medium text-accent-amber transition-colors hover:bg-accent-amber-light motion-safe:animate-pulse"
        title={`Update available: ${version}`}
      >
        <Download className="w-3 h-3" />
        Update
      </button>
    );
  }

  if (status.type === 'ready') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent-green-bg px-2 py-1 text-xs font-medium text-accent-green transition-colors hover:bg-accent-green-light"
        title="Update ready to install"
      >
        <CheckCircle className="w-3 h-3" />
        Restart to Update
      </button>
    );
  }

  return null;
}
