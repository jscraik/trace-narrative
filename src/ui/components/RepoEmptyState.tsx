import type { Dispatch, SetStateAction } from 'react';
import { NearbyGridDemo } from '../../core/demo/nearbyGridDemo';
import type { RepoIndex } from '../../core/repo/indexer';
import type { RepoState } from '../../hooks/useRepoLoader';
import { RepositoryPlaceholderCard } from './RepositoryPlaceholderCard';

export function RepoEmptyState({
  setRepoState,
}: {
  setRepoState?: Dispatch<SetStateAction<RepoState>>;
}) {
  const handleLoadMock = () => {
    if (!setRepoState) return;
    const repo: RepoIndex = {
      repoId: 999,
      root: '/mock/repo',
      branch: 'main',
      headSha: '0000000',
    };

    setRepoState({
      status: 'ready',
      path: '/mock/repo', // Mock path
      model: NearbyGridDemo,
      repo,
    });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-tertiary relative group">
      <RepositoryPlaceholderCard />

      {import.meta.env.DEV && setRepoState && (
        <button
          type="button"
          onClick={handleLoadMock}
          className="absolute bottom-4 right-4 text-xs text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105"
        >
          [dev] Load Mock Data
        </button>
      )}
    </div>
  );
}
