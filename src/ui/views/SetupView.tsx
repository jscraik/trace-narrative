import clsx from 'clsx';
import { SurfaceHeader } from '../components/SurfaceHeader';
import { FileCode, CheckCircle2, AlertCircle, ShieldAlert, ScrollText, DatabaseZap, ShieldCheck } from 'lucide-react';

import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import type { RepoState } from '../../hooks/useRepoLoader';
import {
  buildNarrativeSurfaceViewModel,
  type SurfaceAction,
} from './narrativeSurfaceData';
import { CompactKpiStrip } from './narrativeSurfaceSections';

interface SetupViewProps {
  repoState: RepoState;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  autoIngestEnabled?: boolean;
  onModeChange: (mode: Mode) => void;
  onOpenRepo: () => void;
  onImportSession?: () => void;
  onAction?: (action: SurfaceAction) => void;
}

function getRepoPath(repoState: RepoState): string {
  if (repoState.status === 'ready') return repoState.repo.root;
  if (repoState.status !== 'idle') return repoState.path ?? '~/dev/trace-narrative';
  return '~/dev/trace-narrative';
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-4 rounded-[1.75rem] border border-border-subtle bg-bg-secondary/80 p-5">
      <div className="flex items-center gap-3 border-b border-border-light pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-primary border border-border-light text-text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </article>
  );
}

function ConfigFileRow({ name, path, lines, type }: { name: string; path: string; lines: number; type: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-transparent p-3 hover:border-border-subtle hover:bg-bg-primary/50 transition">
      <div className="flex items-center gap-3">
        <FileCode className="h-5 w-5 text-text-muted" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">{name}</span>
          <span className="text-xs text-text-muted">{path}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-bg-primary px-2 py-0.5 text-xs font-medium text-text-secondary border border-border-light">
          {type}
        </span>
        <span className="text-xs text-text-muted">{lines} lines</span>
      </div>
    </div>
  );
}

function McpServerRow({ name, status, version, uptime }: { name: string; status: 'green' | 'amber' | 'red'; version: string; uptime: string }) {
  const statusColors = {
    green: 'bg-accent-green/20 text-accent-green border-accent-green/20',
    amber: 'bg-accent-amber-bg text-accent-amber border-accent-amber-light',
    red: 'bg-accent-red-bg text-accent-red border-accent-red-light',
  };

  const StatusIcon = status === 'green' ? CheckCircle2 : AlertCircle;

  return (
    <div className="flex items-center justify-between rounded-xl border border-transparent p-3 hover:border-border-subtle hover:bg-bg-primary/50 transition">
      <div className="flex items-center gap-3">
        <div className={clsx("flex h-6 w-6 items-center justify-center rounded-full border", statusColors[status])}>
          <StatusIcon className="h-3 w-3" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">{name}</span>
          <span className="text-xs text-text-muted">v{version}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-text-muted">Uptime</span>
          <span className="text-xs font-medium text-text-secondary">{uptime}</span>
        </div>
      </div>
    </div>
  );
}

function PermissionsBadge({ count, label, severity }: { count: number; label: string; severity: 'info' | 'warning' | 'critical' }) {
  const severityStyles = {
    info: 'bg-bg-primary border-border-light text-text-secondary',
    warning: 'bg-accent-amber-bg border-accent-amber-light text-accent-amber',
    critical: 'bg-accent-red-bg border-accent-red-light text-accent-red',
  };

  return (
    <div className={clsx("flex items-center justify-between rounded-xl border p-4", severityStyles[severity])}>
      <div className="flex items-center gap-3">
        {severity === 'critical' ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">{count}</span>
        {severity !== 'info' && (
          <button type="button" className="rounded-lg bg-bg-primary border border-border-light px-3 py-1.5 text-xs font-medium hover:bg-bg-secondary transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-[0.98]">
            Review
          </button>
        )}
      </div>
    </div>
  );
}

export function SetupView({
  repoState,
  captureReliabilityStatus,
  autoIngestEnabled,
  onOpenRepo,
  onImportSession,
}: SetupViewProps) {
  const viewModel = buildNarrativeSurfaceViewModel('setup', repoState, captureReliabilityStatus, autoIngestEnabled);
  const repoPath = getRepoPath(repoState);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <SurfaceHeader
        title={viewModel.title}
        category='Integrations'
        repoPath={repoPath}
        trustState={viewModel.trustState}
        onOpenRepo={onOpenRepo}
        onImportSession={onImportSession}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <CompactKpiStrip metrics={viewModel.metrics} />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-2 flex flex-col gap-6">
              <Section title="Config Files" icon={ScrollText}>
                <ConfigFileRow name="CLAUDE.md" path=".claude/CLAUDE.md" lines={142} type="Claude Protocol" />
                <ConfigFileRow name="AGENTS.md" path="AGENTS.md" lines={89} type="Global Standard" />
                <ConfigFileRow name="GEMINI.md" path=".gemini/GEMINI.md" lines={34} type="Gemini Spec" />
                <ConfigFileRow name="project.rules" path=".codex/project.rules" lines={215} type="Codex Rules" />
              </Section>

              <Section title="MCP Servers" icon={DatabaseZap}>
                <McpServerRow name="Filesystem MCP" status="green" version="1.2.0" uptime="4d 12h" />
                <McpServerRow name="Codex Local Memory" status="green" version="0.9.4" uptime="4d 12h" />
                <McpServerRow name="GitHub MCP" status="amber" version="2.1.0" uptime="Restarts: 2" />
                <McpServerRow name="Stitch Design System" status="red" version="0.0.0" uptime="Offline" />
              </Section>
            </div>

            <div className="flex flex-col gap-6">
              <Section title="Permissions" icon={ShieldCheck}>
                <div className="flex flex-col gap-3">
                  <PermissionsBadge count={2} label="Pending Reviews" severity="warning" />
                  <PermissionsBadge count={1} label="Revoked Access" severity="critical" />
                  <PermissionsBadge count={14} label="Active Grants" severity="info" />
                  
                  <div className="mt-4 rounded-xl border border-border-light bg-bg-primary p-4">
                    <h3 className="text-sm font-medium text-text-primary">Global Context Access</h3>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">Codex agents have limited auto-approval for non-destructive filesystem reads in this workspace.</p>
                  </div>
                </div>
              </Section>
            </div>
          </div>

          <section className="rounded-3xl border border-border-subtle bg-bg-secondary px-5 py-4">
            <p className="text-sm leading-6 text-text-secondary">{viewModel.footerNote}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
