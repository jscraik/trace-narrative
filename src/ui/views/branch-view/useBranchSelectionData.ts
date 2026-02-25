import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileChange, TraceRange } from '../../../core/types';

interface UseBranchSelectionDataParams {
  requestContextKey: string;
  selectedNodeId: string | null;
  selectedFile: string | null;
  selectedCommitSha: string | null;
  loadFilesForNode: (nodeId: string) => Promise<FileChange[]>;
  loadDiffForFile: (nodeId: string, filePath: string) => Promise<string>;
  loadTraceRangesForFile: (nodeId: string, filePath: string) => Promise<TraceRange[]>;
  selectFile: (path: string | null) => void;
  setActionError: (error: string | null) => void;
}

export function useBranchSelectionData({
  requestContextKey,
  selectedNodeId,
  selectedFile,
  selectedCommitSha,
  loadFilesForNode,
  loadDiffForFile,
  loadTraceRangesForFile,
  selectFile,
  setActionError,
}: UseBranchSelectionDataParams) {
  const [files, setFiles] = useState<FileChange[]>([]);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [traceRanges, setTraceRanges] = useState<TraceRange[]>([]);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [traceRequestedForSelection, setTraceRequestedForSelection] = useState(false);
  const requestContextVersionRef = useRef(0);
  const activeRequestIdentityRef = useRef('');

  useEffect(() => {
    requestContextVersionRef.current += 1;
    activeRequestIdentityRef.current = requestContextKey;
  }, [requestContextKey]);

  const createRequestGuard = useCallback(() => {
    const requestVersion = requestContextVersionRef.current;
    const requestIdentity = activeRequestIdentityRef.current;
    let cancelled = false;

    return {
      isActive: () =>
        !cancelled &&
        requestContextVersionRef.current === requestVersion &&
        activeRequestIdentityRef.current === requestIdentity,
      cancel: () => {
        cancelled = true;
      },
    };
  }, []);

  useEffect(() => {
    if (!selectedNodeId) {
      setFiles([]);
      selectFile(null);
      setLoadingFiles(false);
      return;
    }
    const guard = createRequestGuard();

    setLoadingFiles(true);

    loadFilesForNode(selectedNodeId)
      .then((nextFiles) => {
        if (!guard.isActive()) return;

        setFiles(nextFiles);
        if (!selectedFile && nextFiles[0]?.path) {
          selectFile(nextFiles[0].path);
        }
      })
      .catch((e: unknown) => {
        if (!guard.isActive()) return;

        const message = e instanceof Error ? e.message : String(e);
        setActionError(`Unable to load files for selected node: ${message}`);
        setFiles([]);
        selectFile(null);
      })
      .finally(() => {
        if (!guard.isActive()) return;
        setLoadingFiles(false);
      });

    return guard.cancel;
  }, [createRequestGuard, loadFilesForNode, selectFile, selectedFile, selectedNodeId, setActionError]);

  useEffect(() => {
    if (!selectedNodeId || !selectedFile) {
      setLoadingDiff(false);
      setDiffText(null);
      return;
    }
    const guard = createRequestGuard();

    setLoadingDiff(true);

    loadDiffForFile(selectedNodeId, selectedFile)
      .then((nextDiff) => {
        if (!guard.isActive()) return;
        setDiffText(nextDiff || '(no diff)');
      })
      .catch((e: unknown) => {
        if (!guard.isActive()) return;

        const message = e instanceof Error ? e.message : String(e);
        setActionError(`Unable to load diff for selected file: ${message}`);
        setDiffText(null);
      })
      .finally(() => {
        if (!guard.isActive()) return;
        setLoadingDiff(false);
      });

    return guard.cancel;
  }, [createRequestGuard, loadDiffForFile, selectedFile, selectedNodeId, setActionError]);

  useEffect(() => {
    if (!selectedNodeId || !selectedFile || !selectedCommitSha) {
      setTraceRequestedForSelection(false);
      setTraceRanges([]);
      setLoadingTrace(false);
      return;
    }
    const guard = createRequestGuard();

    setTraceRequestedForSelection(true);
    setLoadingTrace(true);
    loadTraceRangesForFile(selectedNodeId, selectedFile)
      .then((ranges) => {
        if (!guard.isActive()) return;
        setTraceRanges(ranges);
      })
      .catch((e: unknown) => {
        if (!guard.isActive()) return;

        const message = e instanceof Error ? e.message : String(e);
        setActionError(`Unable to load trace ranges for selected file: ${message}`);
        setTraceRanges([]);
      })
      .finally(() => {
        if (!guard.isActive()) return;
        setLoadingTrace(false);
      });

    return guard.cancel;
  }, [createRequestGuard, loadTraceRangesForFile, selectedCommitSha, selectedFile, selectedNodeId, setActionError]);

  return {
    files,
    diffText,
    loadingFiles,
    loadingDiff,
    traceRanges,
    loadingTrace,
    traceRequestedForSelection,
    setFiles,
  };
}
