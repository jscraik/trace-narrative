import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fileExists } from '../core/tauri/narrativeFs';

/**
 * Best-effort existence checks for repo-relative paths.
 *
 * Notes:
 * - Used only for UI hints; failures degrade to "unknown".
 * - Caches results per component instance.
 */
export function useRepoFileExistence(repoRoot: string, paths: string[]) {
  const unique = useMemo(() => Array.from(new Set(paths)).slice(0, 50), [paths]);
  const [existsMap, setExistsMap] = useState<Record<string, boolean>>({});
  const previousRepoRootRef = useRef(repoRoot);
  const FAILED_PATH_TTL_MS = 5_000;
  const failedPathsRef = useRef(new Map<string, number>());

  const canRetryFailedPath = useCallback((path: string, now: number) => {
    const retryAfter = failedPathsRef.current.get(path);
    if (retryAfter === undefined) return true;
    return now >= retryAfter;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const repoChanged = previousRepoRootRef.current !== repoRoot;
    const currentExistsMap = repoChanged ? {} : existsMap;
    if (repoChanged) {
      previousRepoRootRef.current = repoRoot;
      failedPathsRef.current.clear();
      setExistsMap({});
    }

    async function run() {
      if (!repoRoot) return;
      const now = Date.now();

      for (const p of unique) {
        if (p in currentExistsMap) continue;
        if (!canRetryFailedPath(p, now)) continue;
        try {
          const ok = await fileExists(repoRoot, p);
          if (cancelled) return;
          setExistsMap((prev) => (p in prev ? prev : { ...prev, [p]: ok }));
          if (!ok) {
            failedPathsRef.current.delete(p);
          }
        } catch {
          // Unknown -> don't set; UI will treat as "best-effort/unknown"
          if (cancelled) return;
          failedPathsRef.current.set(p, now + FAILED_PATH_TTL_MS);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [repoRoot, unique, existsMap, canRetryFailedPath]);

  return existsMap;
}
