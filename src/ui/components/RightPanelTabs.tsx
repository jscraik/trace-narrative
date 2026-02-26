import { useEffect, useState } from 'react';
import { DiffDock } from './right-panel-tabs/DiffDock';
import { RightPanelTabBar } from './right-panel-tabs/RightPanelTabBar';
import { RightPanelTabPanels } from './right-panel-tabs/RightPanelTabPanels';
import type { RightPanelTabsProps, TabId } from './right-panel-tabs/types';

export type { RightPanelTabsProps } from './right-panel-tabs/types';

export function RightPanelTabs(props: RightPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('session');
  const [diffExpanded, setDiffExpanded] = useState(false);
  const [diffPip, setDiffPip] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const {
    sessionExcerpts,
    selectedCommitId,
    testRun,
    selectedCommitSha,
    selectedFile,
    diffText,
    loadingDiff,
    traceRanges,
  } = props;

  const hasSessionContent = Boolean(sessionExcerpts && sessionExcerpts.length > 0);
  const hasAttributionContent = Boolean(props.traceSummary || props.traceStatus);
  const hasAtlasContent = true;
  const hasTestContent = Boolean(testRun) || Boolean(selectedCommitSha);

  useEffect(() => {
    if (!sessionExcerpts || sessionExcerpts.length === 0) {
      setSelectedSessionId(null);
      return;
    }

    if (selectedCommitId) {
      const linked = sessionExcerpts.find((session) => session.linkedCommitSha === selectedCommitId);
      if (linked && linked.id !== selectedSessionId) {
        setSelectedSessionId(linked.id);
        return;
      }
    }

    if (!selectedSessionId || !sessionExcerpts.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(sessionExcerpts[0]?.id ?? null);
    }
  }, [selectedCommitId, selectedSessionId, sessionExcerpts]);

  return (
    <div className="relative flex flex-col h-full gap-4">
      <RightPanelTabBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        hasSessionContent={hasSessionContent}
        hasAttributionContent={hasAttributionContent}
        hasAtlasContent={hasAtlasContent}
        hasTestContent={hasTestContent}
      />

      <RightPanelTabPanels
        {...props}
        activeTab={activeTab}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        hasAttributionContent={hasAttributionContent}
        onOpenAttribution={() => setActiveTab('attribution')}
      />

      <DiffDock
        selectedFile={selectedFile}
        diffExpanded={diffExpanded}
        diffPip={diffPip}
        diffText={diffText}
        loadingDiff={loadingDiff}
        traceRanges={traceRanges}
        onToggleExpanded={() => setDiffExpanded((value) => !value)}
        onTogglePip={() => {
          setDiffPip((value) => !value);
          setDiffExpanded(true);
        }}
        onDock={() => setDiffPip(false)}
      />
    </div>
  );
}
