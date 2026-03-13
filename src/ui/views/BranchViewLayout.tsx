import { motion, useReducedMotion } from 'framer-motion';
import type { ComponentProps } from 'react';
import type { BranchHeaderViewModel, BranchViewModel, FileChange } from '../../core/types';
import { BranchNarrativePanel } from '../components/BranchNarrativePanel';
import { BranchHeader } from '../components/BranchHeader';
import { BranchSummaryBar } from '../components/BranchSummaryBar';
import { Breadcrumb } from '../components/Breadcrumb';
import { CaptureActivityStrip } from '../components/CaptureActivityStrip';
import { DecisionArchaeologyPanel } from '../components/DecisionArchaeologyPanel';
import { FilesChanged } from '../components/FilesChanged';
import { ImportErrorBanner } from '../components/ImportErrorBanner';
import { IngestToast } from '../components/IngestToast';
import { IntentList } from '../components/IntentList';
import { NarrativeGovernancePanel } from '../components/NarrativeGovernancePanel';
import { NeedsAttentionList } from '../components/NeedsAttentionList';
import { RightPanelTabs } from '../components/RightPanelTabs';
import { SkeletonFiles } from '../components/Skeleton';
import { Timeline } from '../components/Timeline';
import type { CaptureReliabilityStatus } from '../../core/tauri/ingestConfig';
import type { Mode } from '../../core/types';
import { PANEL } from './branchView.constants';
import { RepoEvidenceOverview } from './RepoEvidenceOverview';

interface BranchViewLayoutProps {
  isExitingFilteredView?: boolean;
  ingestToast?: { id: string; message: string } | null;
  stage: number;
  model: BranchViewModel;
  headerViewModel: BranchHeaderViewModel;
  onClearFilter?: () => void;
  narrativePanelProps: ComponentProps<typeof BranchNarrativePanel>;
  governanceProps: ComponentProps<typeof NarrativeGovernancePanel>;
  archaeologyProps: ComponentProps<typeof DecisionArchaeologyPanel>;
  captureActivityProps?: ComponentProps<typeof CaptureActivityStrip> | null;
  ingestIssuesProps?: ComponentProps<typeof NeedsAttentionList> | null;
  selectedNode: BranchViewModel['timeline'][number] | null;
  loadingFiles: boolean;
  files: FileChange[];
  selectedNodeId: string | null;
  actionError?: string | null;
  onDismissActionError?: () => void;
  rightPanelProps: ComponentProps<typeof RightPanelTabs>;
  timelineProps: ComponentProps<typeof Timeline>;
  captureReliabilityStatus?: CaptureReliabilityStatus | null;
  onModeChange?: (mode: Mode) => void;
}

export function BranchViewLayout({
  isExitingFilteredView,
  ingestToast,
  stage,
  model,
  headerViewModel,
  onClearFilter,
  narrativePanelProps,
  governanceProps,
  archaeologyProps,
  captureActivityProps,
  ingestIssuesProps,
  selectedNode,
  loadingFiles,
  files,
  selectedNodeId,
  actionError,
  onDismissActionError,
  rightPanelProps,
  timelineProps,
  captureReliabilityStatus,
  onModeChange,
}: BranchViewLayoutProps) {
  const shouldReduceMotion = useReducedMotion();
  const initialY = shouldReduceMotion ? 0 : PANEL.initialY;
  const finalY = shouldReduceMotion ? 0 : PANEL.finalY;

  return (
    <div className={`flex h-full flex-col motion-page-enter ${isExitingFilteredView ? 'animate-out fade-out slide-out-to-top-2 motion-page-exit fill-mode-forwards' : ''}`}>
      <IngestToast toast={ingestToast ?? null} />
      <div className="flex-1 overflow-hidden bg-bg-secondary">
        <div className="flex h-full flex-col overflow-y-auto bg-bg-tertiary">
          <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5 p-6 lg:flex-1 lg:overflow-hidden lg:p-8">
            <RepoEvidenceOverview
              model={model}
              captureReliabilityStatus={captureReliabilityStatus}
              onModeChange={onModeChange}
            />

            <div className="flex flex-col gap-5 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:overflow-hidden">
              {/* Left column */}
              <div className="flex flex-col gap-5 lg:col-span-7 lg:overflow-y-auto lg:pr-1">
                <motion.div
                  initial={{ opacity: 0, y: initialY }}
                  animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? finalY : initialY }}
                  transition={PANEL.spring}
                >
                  <BranchSummaryBar model={model} />
                </motion.div>

                <motion.div
                  layout
                  layoutId="branch-header"
                  initial={{ opacity: 0, y: initialY }}
                  animate={{ opacity: stage >= 2 ? 1 : 0, y: stage >= 2 ? finalY : initialY }}
                  transition={PANEL.spring}
                >
                  <BranchHeader viewModel={headerViewModel} onClearFilter={onClearFilter} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: initialY }}
                  animate={{ opacity: stage >= 3 ? 1 : 0, y: stage >= 3 ? finalY : initialY }}
                  transition={PANEL.spring}
                >
                  <BranchNarrativePanel {...narrativePanelProps} />
                </motion.div>

                <motion.details
                  className="group"
                  initial={{ opacity: 0, y: initialY }}
                  animate={{ opacity: stage >= 4 ? 1 : 0, y: stage >= 4 ? finalY : initialY }}
                  transition={PANEL.spring}
                >
                  <summary className="cursor-pointer list-none select-none py-2 text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary">
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-bg-primary transition-colors group-open:bg-bg-hover">
                        <svg className="h-3 w-3 transition-transform group-open:rotate-90" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <title>Toggle details panel</title>
                          <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      Show details
                    </span>
                  </summary>
                  <div className="flex flex-col gap-5 pt-3">
                    <NarrativeGovernancePanel {...governanceProps} />
                    <DecisionArchaeologyPanel {...archaeologyProps} />
                    {captureActivityProps ? <CaptureActivityStrip {...captureActivityProps} /> : null}
                  </div>
                </motion.details>

                {ingestIssuesProps ? <NeedsAttentionList {...ingestIssuesProps} /> : null}

                <motion.div
                  initial={{ opacity: 0, y: initialY }}
                  animate={{ opacity: stage >= 5 ? 1 : 0, y: stage >= 5 ? finalY : initialY }}
                  transition={PANEL.spring}
                >
                  <IntentList items={model.intent} />
                </motion.div>

                {/* Breadcrumb navigation */}
                {selectedNode && (
                  <div className="flex items-center gap-2 px-1">
                    <Breadcrumb
                      segments={[
                        { label: model.meta?.branchName || 'main', icon: 'branch' },
                        { label: selectedNode.label || selectedNode.id.slice(0, 8), icon: 'commit' },
                      ]}
                    />
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: initialY }}
                  animate={{ opacity: stage >= 6 ? 1 : 0, y: stage >= 6 ? finalY : initialY }}
                  transition={PANEL.spring}
                >
                  {loadingFiles ? (
                    <div className="card p-5">
                      <div className="section-header">Files changed</div>
                      <div className="section-subheader mt-0.5">loading…</div>
                      <div className="mt-4">
                        <SkeletonFiles count={5} />
                      </div>
                    </div>
                  ) : (
                    <FilesChanged
                      files={files}
                      title="Files changed"
                      traceByFile={selectedNodeId ? model.traceSummaries?.byFileByCommit[selectedNodeId] : undefined}
                    />
                  )}
                </motion.div>

                {actionError && (
                  <ImportErrorBanner
                    error={actionError}
                    onDismiss={onDismissActionError}
                  />
                )}
              </div>

              {/* Right column - Tabbed interface */}
              <motion.div
                className="flex flex-col min-w-0 lg:col-span-5 lg:overflow-hidden"
                initial={{ opacity: 0, y: initialY }}
                animate={{ opacity: stage >= 7 ? 1 : 0, y: stage >= 7 ? finalY : initialY }}
                transition={PANEL.spring}
              >
                <RightPanelTabs {...rightPanelProps} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        layout
        layoutId="timeline-view"
        initial={{ opacity: 0, y: initialY }}
        animate={{ opacity: stage >= 8 ? 1 : 0, y: stage >= 8 ? finalY : initialY }}
        transition={PANEL.spring}
      >
        <Timeline {...timelineProps} />
      </motion.div>
    </div>
  );
}
