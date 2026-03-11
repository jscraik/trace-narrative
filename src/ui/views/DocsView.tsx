import { useEffect, useState } from 'react';
import { indexRepo } from '../../core/repo/indexer';
import type { RepoState } from '../../hooks/useRepoLoader';
import { DocsOverviewPanel } from '../components/DocsOverviewPanel';
import {
  DEV_FALLBACK_REPO_PATH,
  applyDocsAutoloadError,
  applyDocsAutoloadSuccess,
} from './docsAutoLoad';

type TauriRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: { invoke?: unknown };
  __TAURI_IPC__?: unknown;
};

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const tauriWindow = window as TauriRuntimeWindow;
  return Boolean(tauriWindow.__TAURI_INTERNALS__?.invoke || tauriWindow.__TAURI_IPC__);
}

export function DocsView(props: {
  repoState: RepoState;
  setRepoState: React.Dispatch<React.SetStateAction<RepoState>>;
  onClose: () => void;
}) {
  const { repoState, setRepoState, onClose } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  useEffect(() => {
    if (repoState.status === 'ready' || repoState.status === 'loading') {
      return;
    }
    if (hasAttemptedLoad) return;

    const loadCurrentDir = async () => {
      setHasAttemptedLoad(true);

      const isTauri = isTauriRuntime();
      if (!isTauri) {
        setRepoState((prev) => (prev.status === 'idle' ? prev : { status: 'idle' }));
        return;
      }

      if (!import.meta.env.DEV) {
        return;
      }

      setIsLoading(true);
      try {
        const defaultPath = DEV_FALLBACK_REPO_PATH;

        setRepoState({ status: 'loading', path: defaultPath });

        const { model, repo } = await indexRepo(defaultPath, 60);
        setRepoState((prev) => applyDocsAutoloadSuccess(prev, defaultPath, model, repo));
      } catch (error) {
        console.error('[DocsView] Failed to auto-load repo:', error);
        setRepoState((prev) => applyDocsAutoloadError(prev, error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadCurrentDir();
  }, [hasAttemptedLoad, repoState.status, setRepoState]);

  if (repoState.status === 'loading' || isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-tertiary p-6">
        <div className="rounded-2xl border border-border-light bg-bg-secondary px-6 py-5 text-center text-text-tertiary shadow-sm">
          <div className="text-sm font-medium text-text-secondary">Loading repository...</div>
        </div>
      </div>
    );
  }

  const isTauri = isTauriRuntime();
  if (!isTauri && repoState.status === 'idle') {
    return (
      <div className="flex h-full items-center justify-center bg-bg-tertiary p-6">
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border-light bg-bg-secondary px-8 py-10 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-amber-bg text-accent-amber">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>Desktop app required warning</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium text-text-primary">Desktop App Required</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              The Docs view needs access to your local file system to generate documentation. Please open Trace
              Narrative in the desktop app to use this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-bg-tertiary p-6">
      <DocsOverviewPanel repoRoot={repoState.status === 'ready' ? repoState.repo.root : ''} onClose={onClose} />
    </div>
  );
}
