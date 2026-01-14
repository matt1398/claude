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
import { RightPanel } from './RightPanel';

export function TabbedLayout() {
  const {
    openTabs,
    activeTabId,
    getActiveTab,
    selectedSessionId,
    fetchSessionDetail,
  } = useStore();

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
            <>
              {/* Middle Panel - Chat History */}
              <div className="flex-1 flex flex-col bg-claude-dark-surface border-r border-claude-dark-border overflow-hidden min-w-0">
                <MiddlePanel />
              </div>

              {/* Right Panel - Gantt Chart (400px) */}
              <div className="w-[400px] flex-shrink-0 bg-claude-dark-bg flex flex-col overflow-hidden">
                <RightPanel />
              </div>
            </>
          ) : (
            // Fallback to dashboard if tab state is invalid
            <DashboardView />
          )}
        </div>
      </div>
    </div>
  );
}
