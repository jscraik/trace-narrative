import { useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import type { BranchViewModel } from '../core/types';
import { basename } from './basename';
import { readTextFile, writeNarrativeFile, ensureNarrativeDirs } from '../core/tauri/narrativeFs';
import { sha256Hex } from '../core/security/hash';
import { isoStampForFile } from './isoStampForFile';
import { parseJUnitXml } from '../core/repo/junit';
import { saveTestRun } from '../core/repo/testRuns';

export interface UseTestImportProps {
  repoRoot: string;
  repoId: number;
  setRepoState: (updater: (prev: BranchViewModel) => BranchViewModel) => void;
  setActionError: (error: string | null) => void;
}

export interface UseTestImportReturn {
  importJUnitForCommit: (commitSha: string) => Promise<void>;
}

function testBadgeForRun(run: { passed: number; failed: number }): { label: string; status: 'passed' | 'failed' } {
  if (run.failed > 0) return { label: `${run.failed} failed`, status: 'failed' };
  return { label: `${run.passed} passed`, status: 'passed' };
}

export function useTestImport({
  repoRoot,
  repoId,
  setRepoState,
  setActionError,
}: UseTestImportProps): UseTestImportReturn {
  const repoIdRef = useRef(repoId);
  const repoRootRef = useRef(repoRoot);
  const requestVersionRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    repoIdRef.current = repoId;
    repoRootRef.current = repoRoot;
    requestVersionRef.current += 1;
  }, [repoId, repoRoot]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isActiveRequest = useCallback((expectedRepoId: number, expectedRepoRoot: string, requestVersion: number) =>
    isMountedRef.current &&
    repoIdRef.current === expectedRepoId &&
    repoRootRef.current === expectedRepoRoot &&
    requestVersionRef.current === requestVersion, []);

  const importJUnitForCommit = useCallback(
    async (commitSha: string) => {
      const expectedRepoId = repoIdRef.current;
      const expectedRepoRoot = repoRootRef.current;
      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      const isStaleRequest = () => !isActiveRequest(expectedRepoId, expectedRepoRoot, requestVersion);

      if (!isMountedRef.current) return;
      setActionError(null);

      try {
        const selected = await open({
          multiple: false,
          title: 'Import JUnit XML',
          filters: [{ name: 'JUnit XML', extensions: ['xml'] }],
        });

        if (!selected || Array.isArray(selected)) return;

        if (!isActiveRequest(expectedRepoId, expectedRepoRoot, requestVersion)) return;

        await ensureNarrativeDirs(expectedRepoRoot);

        const raw = await readTextFile(selected);
        if (!isActiveRequest(expectedRepoId, expectedRepoRoot, requestVersion)) return;

        const sha = await sha256Hex(raw);
        if (!isActiveRequest(expectedRepoId, expectedRepoRoot, requestVersion)) return;

        const parsed = parseJUnitXml(raw);

        const importedAtISO = new Date().toISOString();
        const sourceBasename = basename(selected);
        const rel = `tests/imported/${isoStampForFile()}_${sha.slice(0, 8)}_junit.xml`;

        // Strict provenance: if we cannot store the raw copy in `.narrative/`, fail import.
        await writeNarrativeFile(expectedRepoRoot, rel, raw);
        if (!isActiveRequest(expectedRepoId, expectedRepoRoot, requestVersion)) return;

        const saved = await saveTestRun({
          repoId: expectedRepoId,
          commitSha,
          format: 'junit',
          importedAtISO,
          sourceBasename,
          rawRelPath: rel,
          durationSec: parsed.durationSec,
          passed: parsed.passed,
          failed: parsed.failed,
          skipped: parsed.skipped,
          cases: parsed.cases,
        });
        if (isStaleRequest()) return;
        if (!isMountedRef.current) return;

        const badge = testBadgeForRun(saved);

        // Update timeline badge + testRunId for immediate UI feedback.
        if (!isMountedRef.current) return;
        setRepoState((prev) => {
          const timeline = prev.timeline.map((n) => {
            if (n.id !== commitSha) return n;
            const existing = n.badges?.filter((b) => b.type !== 'test') ?? [];
            return {
              ...n,
              testRunId: saved.id,
              badges: [...existing, { type: 'test' as const, label: badge.label, status: badge.status }],
            };
          });
          return { ...prev, timeline };
        });
      } catch (e: unknown) {
        if (isStaleRequest()) return;
        if (!isMountedRef.current) return;
        setActionError(e instanceof Error ? e.message : String(e));
      }
    },
    [isActiveRequest, setActionError, setRepoState]
  );

  return { importJUnitForCommit };
}
