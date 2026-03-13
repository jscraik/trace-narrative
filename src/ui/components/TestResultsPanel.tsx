import { CheckCircle, ChevronDown, ChevronUp, Clock, HelpCircle, Terminal, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { TestCase, TestRun } from '../../core/types';
import { useRepoFileExistence } from '../../hooks/useRepoFileExistence';

function TestCaseRow({ test, onFileClick }: { test: TestCase; onFileClick?: (path: string) => void }) {
  const filePath = test.filePath;
  const handleFileClick = () => {
    if (!filePath) return;
    onFileClick?.(filePath);
  };

  return (
    <div className="border-b border-border-subtle py-3 last:border-0">
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-red" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-text-secondary">{test.name}</div>
          {test.errorMessage && (
            <div className="mt-1 font-mono text-xs text-accent-red">{test.errorMessage}</div>
          )}
          {filePath ? (
            <button
              type="button"
              onClick={handleFileClick}
              className="mt-2 pill-file"
            >
              {filePath}
            </button>
          ) : null}
        </div>
        <div className="text-[0.6875rem] text-text-muted tabular-nums">
          {(test.durationMs / 1000).toFixed(2)}s
        </div>
      </div>
    </div>
  );
}

export function TestResultsPanel({
  testRun,
  onFileClick,
  className,
  selectedCommitSha,
  onImportJUnit,
  loading,
  repoRoot,
  changedFiles
}: {
  testRun?: TestRun;
  onFileClick?: (path: string) => void;
  className?: string;
  selectedCommitSha?: string | null;
  onImportJUnit?: () => void;
  loading?: boolean;
  repoRoot?: string;
  changedFiles?: string[];
}) {
  const [expanded, setExpanded] = useState(true);
  const panelId = "test-results-panel";

  const isRepoRelativePath = (p: string) => {
    if (p.startsWith('/')) return false;
    if (/^[A-Za-z]:[\\/]/.test(p)) return false;
    if (p.includes('..')) return false;
    return true;
  };

  const mentionedFiles = testRun
    ? Array.from(new Set(testRun.tests.map((t) => t.filePath).filter((p): p is string => Boolean(p)))).slice(0, 8)
    : [];
  const changedSet = new Set(changedFiles ?? []);
  const existsMap = useRepoFileExistence(repoRoot ?? '', mentionedFiles.filter((p) => isRepoRelativePath(p)));

  if (!testRun) {
    return (
      <div className={`card p-5 ${className || ''}`}>
        <div className="section-header">TEST RESULTS</div>
        <div className="mt-5 flex flex-col items-center text-center py-3">
          <div className="w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center mb-2">
            <Terminal className="w-4 h-4 text-text-muted" />
          </div>
          <p className="text-sm text-text-tertiary mb-1">
            {selectedCommitSha ? 'No test results for this commit yet' : 'Select a commit to view tests'}
          </p>
          <p className="text-xs text-text-muted">
            Narrative doesn’t fetch CI automatically. Import a JUnit XML file to attach results here.
          </p>
          {selectedCommitSha && onImportJUnit ? (
            <button
              type="button"
              onClick={onImportJUnit}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-primary text-text-secondary hover:bg-border-light transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
            >
              Import JUnit XML…
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const failedTests = testRun.tests.filter((t) => t.status === 'failed');
  const hasFailures = failedTests.length > 0;

  return (
    <div className={`card overflow-hidden ${className || ''}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-5 hover:bg-bg-tertiary transition duration-200 ease-out active:duration-75 active:scale-[0.99]"
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="section-header">TEST RESULTS</div>
            {hasFailures && (
              <span className="pill-test-failed">
                <XCircle className="h-3 w-3" />
                {failedTests.length} failed
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[0.6875rem] text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-accent-red" />
              {testRun.failed} failed
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-accent-green" />
              {testRun.passed} passed
            </span>
            <span className="flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-text-muted" />
              {testRun.skipped} skipped
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-text-muted" />
              {testRun.durationSec.toFixed(1)}s
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronUp className="h-4 w-4 text-text-muted" />
        )}
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-border-subtle px-5 pb-5">
          <div className="mt-4 text-[0.6875rem] text-text-muted">
            Imported JUnit XML
            {testRun.sourceBasename ? ` · ${testRun.sourceBasename}` : ''}
            {testRun.importedAtISO ? ` · ${new Date(testRun.importedAtISO).toLocaleString()}` : ''}
          </div>

          {mentionedFiles.length > 0 ? (
            <div className="mt-4">
              <div className="text-[0.625rem] uppercase tracking-wider text-text-muted">Mentioned files</div>
              <div className="mt-1 text-[0.6875rem] text-text-muted">
                From imported test results. Best-effort — may not be changed in this commit.
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {mentionedFiles.map((f) => {
                  const isRel = isRepoRelativePath(f);
                  const exists = isRel ? existsMap[f] : false;
                  const inCommit = changedSet.has(f);
                  const variantClass =
                    exists === false ? 'not-found' : inCommit ? '' : 'best-effort';
                  const title = !isRel
                    ? 'Mentioned, but the path is not repo-relative'
                    : exists === false
                      ? 'Mentioned, but file was not found in this repo'
                      : inCommit
                        ? 'Mentioned and changed in this commit'
                        : 'Mentioned, but not changed in this commit';
                  const clickable = isRel && exists !== false;
                  return clickable ? (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onFileClick?.(f)}
                      title={title}
                      className={`pill-file max-w-full truncate ${variantClass}`}
                    >
                      {f}
                    </button>
                  ) : (
                    <span key={f} title={title} className={`pill-file max-w-full truncate ${variantClass}`}>
                      {f}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {hasFailures ? (
            <div className="mt-4">
              <div className="mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-accent-red" />
                <span className="text-xs font-semibold text-accent-red uppercase tracking-wider">
                  Failed Tests
                </span>
              </div>
              <div className="rounded-lg border border-accent-red-light bg-accent-red-bg p-3">
                {failedTests.map((test) => (
                  <TestCaseRow key={test.id} test={test} onFileClick={onFileClick} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-accent-green-light bg-accent-green-bg px-4 py-3">
              <CheckCircle className="h-4 w-4 text-accent-green" />
              <span className="text-sm text-accent-green">All tests passed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
