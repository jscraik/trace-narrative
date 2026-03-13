import { Activity, MessageSquare, Search, Settings, TestTube } from 'lucide-react';
import { Fragment, type KeyboardEvent } from 'react';
import { TAB_ACTIVE_STYLES, TABS, type TabId } from './types';

interface RightPanelTabBarProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  hasSessionContent: boolean;
  hasAttributionContent: boolean;
  hasAtlasContent: boolean;
  hasTestContent: boolean;
}

const ICONS = {
  message: MessageSquare,
  activity: Activity,
  search: Search,
  tests: TestTube,
  settings: Settings,
} as const;

export function RightPanelTabBar({
  activeTab,
  onChangeTab,
  hasSessionContent,
  hasAttributionContent,
  hasAtlasContent,
  hasTestContent,
}: RightPanelTabBarProps) {
  const tabIds = TABS.map((tab) => tab.id);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabIds.indexOf(activeTab);
    if (currentIndex === -1) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % tabIds.length;
        onChangeTab(tabIds[nextIndex]);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault();
        const nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
        onChangeTab(tabIds[nextIndex]);
        break;
      }
      case 'Home':
        event.preventDefault();
        onChangeTab(tabIds[0]);
        break;
      case 'End':
        event.preventDefault();
        onChangeTab(tabIds[tabIds.length - 1]);
        break;
      default:
        break;
    }
  };

  return (
    <div className="card p-2">
      <div className="flex items-center gap-1" role="tablist" aria-label="Right panel tabs" onKeyDown={handleTabKeyDown}>
        {TABS.map((tab, index) => {
          const Icon = ICONS[tab.iconName];
          const isActive = activeTab === tab.id;
          const hasContent =
            (tab.id === 'session' && hasSessionContent) ||
            (tab.id === 'attribution' && hasAttributionContent) ||
            (tab.id === 'atlas' && hasAtlasContent) ||
            (tab.id === 'tests' && hasTestContent) ||
            tab.id === 'settings';
          const prevTab = index > 0 ? TABS[index - 1] : null;
          const needsSeparator = prevTab && prevTab.category !== tab.category;

          return (
            <Fragment key={tab.id}>
              {needsSeparator ? (
                <div className="w-px h-5 bg-border-light mx-1" aria-hidden="true" />
              ) : null}
              <button
                id={`tab-${tab.id}`}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`
                  min-w-0 flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 border
                  text-[0.625rem] leading-4 font-medium whitespace-nowrap
                  transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:scale-[0.98] hover:scale-105
                  ${isActive
                    ? TAB_ACTIVE_STYLES[tab.id]
                    : 'border-border-subtle bg-bg-primary text-text-secondary hover:bg-bg-secondary hover:border-border-light'}
                  ${!hasContent && tab.id !== 'settings' ? 'opacity-60' : ''}
                `}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                title={tab.label}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{tab.shortLabel}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
