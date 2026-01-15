/**
 * TabBar - Displays open tabs with close buttons and new tab button.
 * Supports tab switching, closing, and horizontal scrolling on overflow.
 */

import { X, Plus, LayoutDashboard, FileText, RefreshCw } from 'lucide-react';
import { useStore } from '../../store';

export function TabBar() {
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    openDashboard,
    fetchSessionDetail,
  } = useStore();

  // Get the active tab
  const activeTab = openTabs.find(tab => tab.id === activeTabId);

  // Handle refresh for active session tab
  const handleRefresh = async () => {
    if (activeTab?.type === 'session' && activeTab.projectId && activeTab.sessionId) {
      await fetchSessionDetail(activeTab.projectId, activeTab.sessionId);
    }
  };

  return (
    <div className="h-10 flex items-center border-b border-claude-dark-border bg-claude-dark-bg px-2">
      {/* Tab list with horizontal scroll and new tab button */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {openTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = tab.type === 'dashboard' ? LayoutDashboard : FileText;

          return (
            <div
              key={tab.id}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer
                group min-w-0 max-w-[200px] flex-shrink-0
                ${isActive
                  ? 'bg-claude-dark-surface text-claude-dark-text'
                  : 'text-claude-dark-text-secondary hover:bg-claude-dark-surface/50 hover:text-claude-dark-text'
                }
              `}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm truncate">{tab.label}</span>
              <button
                className="w-4 h-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-claude-dark-border transition-opacity flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title="Close tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* Refresh button - show only for session tabs */}
        {activeTab?.type === 'session' && (
          <button
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-claude-dark-surface text-claude-dark-text-secondary hover:text-claude-dark-text transition-colors flex-shrink-0"
            onClick={handleRefresh}
            title="Refresh Session (Cmd+R)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* New tab button - right after last tab */}
        <button
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-claude-dark-surface text-claude-dark-text-secondary hover:text-claude-dark-text transition-colors flex-shrink-0"
          onClick={openDashboard}
          title="New tab (Dashboard)"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
