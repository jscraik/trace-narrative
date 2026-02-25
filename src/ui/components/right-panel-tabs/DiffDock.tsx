import { ChevronDown, FileCode, Minimize2, PictureInPicture2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { TraceRange } from '../../../core/types';
import { DiffViewer } from '../DiffViewer';

export interface DiffDockProps {
  selectedFile: string | null;
  diffExpanded: boolean;
  diffPip: boolean;
  diffText: string | null;
  loadingDiff: boolean;
  traceRanges: TraceRange[];
  onToggleExpanded: () => void;
  onTogglePip: () => void;
  onDock: () => void;
}

export function DiffDock({
  selectedFile,
  diffExpanded,
  diffPip,
  diffText,
  loadingDiff,
  traceRanges,
  onToggleExpanded,
  onTogglePip,
  onDock,
}: DiffDockProps) {
  const pipDialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!diffExpanded || !diffPip) return;
    const dialogEl = pipDialogRef.current;
    if (!dialogEl) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const focusableSelector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    const getFocusableElements = () =>
      Array.from(dialogEl.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );

    const initialFocusTarget = getFocusableElements()[0] ?? dialogEl;
    initialFocusTarget.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDock();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogEl.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const isShiftTab = event.shiftKey;

      if (isShiftTab && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!isShiftTab && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialogEl.addEventListener('keydown', handleKeyDown);
    return () => {
      dialogEl.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus();
      }
    };
  }, [diffExpanded, diffPip, onDock]);

  return (
    <>
      <div className="card flex-none overflow-hidden">
        <div className="w-full flex items-center gap-2 px-2 py-2 bg-bg-secondary text-xs font-medium text-text-secondary">
          <button
            type="button"
            onClick={onToggleExpanded}
            title="Toggle diff panel"
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-2 py-1 transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-[0.98] hover:bg-bg-hover outline-none focus-visible:ring-1 focus-visible:ring-accent-blue/30"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileCode className="w-3.5 h-3.5" />
              <span className="truncate">{selectedFile ? selectedFile.split('/').pop() : 'Diff'}</span>
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${diffExpanded ? '' : '-rotate-90'}`} />
          </button>
          <button
            type="button"
            className="btn-secondary-soft inline-flex items-center rounded-md px-1.5 py-1 text-[10px] text-text-tertiary"
            onClick={onTogglePip}
            title={diffPip ? 'Dock diff panel' : 'Pop out diff panel'}
            aria-label={diffPip ? 'Dock diff panel' : 'Pop out diff panel'}
          >
            {diffPip ? <Minimize2 className="h-3 w-3" /> : <PictureInPicture2 className="h-3 w-3" />}
          </button>
        </div>
        {diffExpanded && !diffPip && (
          <div className="max-h-[400px] overflow-auto border-t border-border-light">
            <DiffViewer
              diffText={diffText}
              loading={loadingDiff}
              traceRanges={traceRanges}
            />
          </div>
        )}
      </div>

      {diffExpanded && diffPip && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/25 p-4">
          <div
            ref={pipDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="diff-dock-dialog-title"
            tabIndex={-1}
            className="h-[min(70vh,680px)] w-[min(92vw,860px)] sm:h-[min(74vh,740px)] sm:w-[min(94vw,940px)] xl:h-[min(78vh,820px)] xl:w-[min(96vw,1080px)] overflow-hidden rounded-xl border border-border-light bg-bg-secondary shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 text-xs text-text-secondary">
              <span id="diff-dock-dialog-title" className="min-w-0 truncate font-medium">
                {selectedFile ? selectedFile.split('/').pop() : 'Diff'}
              </span>
              <button
                type="button"
                className="btn-secondary-soft inline-flex items-center rounded-md px-2 py-1 text-[10px]"
                onClick={onDock}
                aria-label="Close diff dialog and dock panel"
              >
                Dock
              </button>
            </div>
            <div className="h-[calc(100%-37px)] overflow-auto">
              <DiffViewer
                diffText={diffText}
                loading={loadingDiff}
                traceRanges={traceRanges}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
