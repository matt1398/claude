/**
 * TabbedLayout - Main layout with project-centric sidebar and tabbed content area.
 * Replaces ThreePanelLayout with a more flexible tab-based interface.
 *
 * Layout structure:
 * - Sidebar (280px): Project dropdown + date-grouped sessions
 * - Main content: Tab bar + content area (dashboard or session detail)
 */

import { useEffect } from 'react';
import { useStore } from '../../store';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { DashboardView } from '../dashboard/DashboardView';
import { MiddlePanel } from './MiddlePanel';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

export function TabbedLayout() {
  const {
    openTabs,
    activeTabId,
    getActiveTab,
    selectedSessionId,
    fetchSessionDetail,
    sessionDetailError,
    sessionDetailLoading,
    closeTab,
  } = useStore();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  const activeTab = getActiveTab();
  const showDashboard = !activeTabId || activeTab?.type === 'dashboard';

  // Determine if we should show session content
  // A session tab must have both projectId and sessionId
  const showSessionContent = activeTab?.type === 'session' &&
    activeTab.projectId &&
    activeTab.sessionId;

  // Load session detail when switching to a session tab
  useEffect(() => {
    if (activeTab?.type === 'session' && activeTab.projectId && activeTab.sessionId) {
      // Only fetch if different from currently selected
      if (selectedSessionId !== activeTab.sessionId) {
        fetchSessionDetail(activeTab.projectId, activeTab.sessionId);
      }
    }
  }, [activeTabId, activeTab?.sessionId, activeTab?.projectId, selectedSessionId, fetchSessionDetail]);

  return (
    <div className="flex h-screen bg-claude-dark-bg text-claude-dark-text">
      {/* Sidebar - Project dropdown + Sessions (280px) */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar - only show if there are tabs */}
        {openTabs.length > 0 && <TabBar />}

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {showDashboard ? (
            <DashboardView />
          ) : showSessionContent ? (
            sessionDetailError ? (
              // Error state for session loading failure (e.g., deleted file)
              <div className="flex-1 flex items-center justify-center bg-claude-dark-bg">
                <div className="text-center p-8">
                  <AlertCircle className="w-12 h-12 text-red-500/70 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-claude-dark-text mb-2">
                    Failed to load session
                  </h3>
                  <p className="text-sm text-claude-dark-text-secondary mb-4 max-w-md">
                    {sessionDetailError}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        if (activeTab?.projectId && activeTab?.sessionId) {
                          fetchSessionDetail(activeTab.projectId, activeTab.sessionId);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-claude-dark-surface border border-claude-dark-border rounded-md hover:bg-claude-dark-border transition-colors text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </button>
                    <button
                      onClick={() => activeTabId && closeTab(activeTabId)}
                      className="px-4 py-2 text-claude-dark-text-secondary hover:text-claude-dark-text transition-colors text-sm"
                    >
                      Close tab
                    </button>
                  </div>
                </div>
              </div>
            ) : sessionDetailLoading ? (
              // Loading state
              <div className="flex-1 flex items-center justify-center bg-claude-dark-bg">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-claude-dark-text-secondary border-t-claude-dark-text rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm text-claude-dark-text-secondary">Loading session...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Middle Panel - Chat History (Full Width) */}
                <div className="flex-1 flex flex-col bg-claude-dark-surface overflow-hidden min-w-0">
                  <MiddlePanel />
                </div>
              </>
            )
          ) : (
            // Fallback to dashboard if tab state is invalid
            <DashboardView />
          )}
        </div>
      </div>
    </div>
  );
}
