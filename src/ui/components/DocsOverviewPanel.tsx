import { motion } from 'framer-motion';
import { BookOpen, ChevronRight, FileText, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import {
  ensureNarrativeDirs,
  listNarrativeFiles,
  readNarrativeFile,
  writeNarrativeFile,
} from '../../core/tauri/narrativeFs';
import { MermaidDiagram } from './MermaidDiagram';
import { RepositoryPlaceholderCard } from './RepositoryPlaceholderCard';

interface DocFile {
  name: string;
  path: string;
  title: string;
}

interface DocsOverviewPanelProps {
  repoRoot: string;
  onClose?: () => void;
}

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitle(content: string, filename: string): string {
  // Look for # Title
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  // Fallback to filename without extension
  return filename.replace(/\.md$/i, '').replace(/-/g, ' ');
}

/**
 * Component to render markdown documentation files from .narrative/
 * with Mermaid diagram support.
 * 
 * Syncs with the opened repo - scans .narrative/ for .md files
 * and renders them with live Mermaid diagrams.
 */
export function DocsOverviewPanel({ repoRoot, onClose }: DocsOverviewPanelProps) {
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocFile | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string>('');
  const docsRequestVersionRef = useRef(0);
  const contentRequestVersionRef = useRef(0);
  const previousRepoRootRef = useRef(repoRoot);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (previousRepoRootRef.current === repoRoot) return;
    previousRepoRootRef.current = repoRoot;
    setDocs([]);
    setSelectedDoc(null);
    setContent('');
    setLoading(false);
  }, [repoRoot]);

  // List available documentation files from .narrative/
  const refreshDocs = useCallback(async () => {
    const requestVersion = docsRequestVersionRef.current + 1;
    docsRequestVersionRef.current = requestVersion;

    if (!repoRoot) {
      if (docsRequestVersionRef.current !== requestVersion) return;
      setDocs([]);
      return;
    }

    try {
      // Call Tauri to list files in .narrative/ using the wrapper
      const files = await listNarrativeFiles(repoRoot, '');

      // Filter to .md files and load their content to get titles
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      const docList: DocFile[] = await Promise.all(
        mdFiles.map(async (filename) => {
          try {
            const content = await readNarrativeFile(repoRoot, filename);
            return {
              name: filename,
              path: filename,
              title: extractTitle(content, filename),
            };
          } catch {
            // If we can't read it, just use the filename
            return {
              name: filename,
              path: filename,
              title: extractTitle('', filename),
            };
          }
        })
      );

      if (docsRequestVersionRef.current !== requestVersion) return;
      if (!isMountedRef.current) return;
      setDocs(docList);
      setError('');
    } catch (err) {
      if (docsRequestVersionRef.current !== requestVersion) return;
      if (!isMountedRef.current) return;
      console.error('Failed to list docs:', err);
      // Don't show error for empty/no directory - just empty list
      setDocs([]);
      setError('');
    }
  }, [repoRoot]);

  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  // Load selected document content
  useEffect(() => {
    const requestVersion = contentRequestVersionRef.current + 1;
    contentRequestVersionRef.current = requestVersion;

    if (!selectedDoc || !repoRoot) {
      setContent('');
      setLoading(false);
      return;
    }

    const loadDoc = async () => {
      setLoading(true);
      try {
        const fileContent = await readNarrativeFile(repoRoot, selectedDoc.path);
        if (contentRequestVersionRef.current !== requestVersion) return;
        if (!isMountedRef.current) return;
        setContent(fileContent);
        setError('');
      } catch (err) {
        if (contentRequestVersionRef.current !== requestVersion) return;
        if (!isMountedRef.current) return;
        console.error('Failed to load doc:', err);
        setContent(`# Error\n\nFailed to load ${selectedDoc.name}`);
        setError(String(err));
      } finally {
        if (contentRequestVersionRef.current === requestVersion && isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    void loadDoc();
  }, [selectedDoc, repoRoot]);

  // Custom components for ReactMarkdown
  const components: Components = {
    code({ className, children, ...rest }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match?.[1] || '';

      if (language === 'mermaid') {
        return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
      }

      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    },
  };

  // Document list view
  return (
    <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 motion-page-enter">
      {!repoRoot ? (
        <div className="flex flex-1 items-center justify-center p-3">
          <RepositoryPlaceholderCard className="max-w-2xl" variant="docs" />
        </div>
      ) : (
        <>
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-accent-blue" />
              <h2 className="text-sm font-semibold text-text-primary">Documentation</h2>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="btn-tertiary-soft p-1.5 rounded-lg text-text-muted"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {selectedDoc ? (
            <div className="card p-4 flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-light">
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="btn-tertiary-soft p-1.5 rounded-lg text-text-tertiary"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{selectedDoc.title}</h3>
                  <p className="text-xs text-text-tertiary">{selectedDoc.name}</p>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-sm text-text-tertiary">Loading...</div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]} components={components}>
                      {content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ) : docs.length === 0 ? (
            <motion.div
              className="card glass-shell shadow-card p-8 flex flex-1 flex-col items-center justify-center text-center text-text-secondary"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <motion.div
                className="mb-6 inline-flex rounded-2xl border border-border-subtle bg-bg-secondary p-4 shadow-sm"
                animate={{
                  boxShadow: [
                    "0 0 0 0.0625rem var(--border-subtle)",
                    "0 0 0 0.1875rem var(--bg-subtle)",
                    "0 0 0 0.0625rem var(--border-subtle)"
                  ],
                }}
                transition={{
                  duration: 4,
                  ease: "easeInOut" as const,
                  repeat: Infinity,
                }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 0 0 0.25rem var(--accent-blue-light)",
                  transition: { duration: 0.2 }
                }}
              >
                <FileText className="h-12 w-12 text-text-muted opacity-80" />
              </motion.div>

              <h3 className="mb-2 text-lg font-semibold text-text-primary">No Narrative docs found</h3>

              <p className="text-sm text-text-secondary max-w-[42ch] leading-relaxed mb-6">
                Narrative renders markdown files inside <span className="font-mono text-xs bg-bg-subtle px-1.5 py-0.5 rounded border border-border-light">.narrative/</span>.
                Mermaid diagrams render from fenced <span className="font-mono text-xs bg-bg-subtle px-1.5 py-0.5 rounded border border-border-light">```mermaid</span> blocks.
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  className="btn-secondary-soft inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:scale-105 active:scale-[0.98] transition"
                  onClick={async () => {
                    try {
                      await ensureNarrativeDirs(repoRoot);
                      const rel = 'docs/overview.md';
                      const starter = [
                        '# Narrative Documentation',
                        '',
                        '## System overview',
                        '',
                        '```mermaid',
                        'flowchart TD',
                        '  A[Auto-ingest] --> B[Sessions]',
                        '  A --> C[Traces]',
                        '  B --> D[Story Anchors]',
                        '  C --> D',
                        '```',
                        '',
                        '## Notes',
                        '',
                        '- Place docs in `.narrative/` so they can be shared alongside narratives.',
                        ''
                      ].join('\n');
                      await writeNarrativeFile(repoRoot, rel, starter);
                      await refreshDocs();
                    } catch (e) {
                      console.error('Failed to create starter doc:', e);
                    }
                  }}
                >
                  <FileText className="w-4 h-4" />
                  Create starter doc
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="card p-4 flex-1 space-y-2 overflow-y-auto">
              {docs.map((doc) => (
                <button
                  key={doc.path}
                  type="button"
                  onClick={() => setSelectedDoc(doc)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border-light hover:border-accent-blue-light hover:bg-accent-blue-bg transition-colors text-left group"
                >
                  <FileText className="w-5 h-5 text-text-muted group-hover:text-accent-blue" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-secondary group-hover:text-accent-blue truncate">
                      {doc.title}
                    </p>
                    <p className="text-xs text-text-muted truncate">{doc.name}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-blue" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
