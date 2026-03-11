import { useCallback, useEffect, useRef } from 'react';
import type { BranchViewModel } from '../core/types';
import { listSnapshots, autoCaptureIfNeeded } from '../core/repo/snapshots';

export function useSnapshots(params: {
  repoRoot: string;
  setRepoState: (updater: (prev: BranchViewModel) => BranchViewModel) => void;
}) {
  const { repoRoot, setRepoState } = params;
  const isMountedRef = useRef(true);
  const latestRepoRootRef = useRef(repoRoot);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestRepoRootRef.current = repoRoot;
  }, [repoRoot]);

  const refreshSnapshots = useCallback(async () => {
    if (!repoRoot) return;
    const requestRepoRoot = repoRoot;

    try {
      // Background auto-capture check
      const { dirtyFiles, dirtyChurnLines } = await autoCaptureIfNeeded(requestRepoRoot);
      if (!isMountedRef.current || latestRepoRootRef.current !== requestRepoRoot) return;

      const snapshots = await listSnapshots(requestRepoRoot);
      if (!isMountedRef.current) return;
      if (latestRepoRootRef.current !== requestRepoRoot) return;

      setRepoState((prev) => {
        if (latestRepoRootRef.current !== requestRepoRoot) return prev;
        if (prev.meta?.repoPath && prev.meta.repoPath !== requestRepoRoot) return prev;

        const oldSnapshots = prev.snapshots || [];
        const oldDirtyFiles = [...(prev.dirtyFiles ?? [])].sort();
        const nextDirtyFiles = [...dirtyFiles].sort();
        const dirtyChurnUnchanged = (prev.dirtyChurnLines ?? 0) === dirtyChurnLines;
        const dirtyFilesUnchanged = oldDirtyFiles.length === nextDirtyFiles.length
          && oldDirtyFiles.every((file, index) => file === nextDirtyFiles[index]);

        if (dirtyFilesUnchanged && dirtyChurnUnchanged && oldSnapshots.length === snapshots.length) {
          const oldIds = oldSnapshots.map(s => s.id).join(',');
          const newIds = snapshots.map(s => s.id).join(',');
          if (oldIds === newIds) return prev;
        }
        
        return {
          ...prev,
          snapshots,
          dirtyFiles,
          dirtyChurnLines,
        };
      });
    } catch (e) {
      console.warn('[useSnapshots] Failed to refresh snapshots:', e);
    }
  }, [repoRoot, setRepoState]);

  useEffect(() => {
    if (!repoRoot) return;
    
    // Initial load
    refreshSnapshots();
    
    // Background refresh every 10 seconds
    const interval = setInterval(refreshSnapshots, 10000);
    
    return () => clearInterval(interval);
  }, [repoRoot, refreshSnapshots]);

  return {
    refreshSnapshots
  };
}
