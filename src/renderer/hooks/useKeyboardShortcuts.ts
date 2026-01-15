/**
 * useKeyboardShortcuts - Global keyboard shortcut handler
 * Handles app-wide keyboard shortcuts for tab management and navigation.
 */

import { useEffect } from 'react';
import { useStore } from '../store';

export function useKeyboardShortcuts() {
  const {
    openTabs,
    activeTabId,
    openDashboard,
    closeTab,
    setActiveTab,
    showSearch,
    getActiveTab,
    selectedProjectId,
    selectedSessionId,
    fetchSessionDetail,
  } = useStore();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Check if Cmd (macOS) or Ctrl (Windows/Linux) is pressed
      const isMod = event.metaKey || event.ctrlKey;

      // Ctrl+Tab / Ctrl+Shift+Tab: Switch tabs (universal shortcut)
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.id === activeTabId);

        if (event.shiftKey) {
          // Ctrl+Shift+Tab: Previous tab (with wrap-around)
          if (currentIndex > 0) {
            setActiveTab(openTabs[currentIndex - 1].id);
          } else if (openTabs.length > 0) {
            // Wrap to last tab
            setActiveTab(openTabs[openTabs.length - 1].id);
          }
        } else {
          // Ctrl+Tab: Next tab (with wrap-around)
          if (currentIndex !== -1 && currentIndex < openTabs.length - 1) {
            setActiveTab(openTabs[currentIndex + 1].id);
          } else if (openTabs.length > 0) {
            // Wrap to first tab
            setActiveTab(openTabs[0].id);
          }
        }
        return;
      }

      if (!isMod) return;

      // Cmd+T: New tab (Dashboard)
      if (event.key === 't') {
        event.preventDefault();
        openDashboard();
        return;
      }

      // Cmd+W: Close current tab
      if (event.key === 'w') {
        event.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
        return;
      }

      // Cmd+[1-9]: Switch to tab by index
      const numKey = parseInt(event.key);
      if (numKey >= 1 && numKey <= 9) {
        event.preventDefault();
        const targetTab = openTabs[numKey - 1];
        if (targetTab) {
          setActiveTab(targetTab.id);
        }
        return;
      }

      // Cmd+Shift+]: Next tab
      if (event.key === ']' && event.shiftKey) {
        event.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.id === activeTabId);
        if (currentIndex !== -1 && currentIndex < openTabs.length - 1) {
          setActiveTab(openTabs[currentIndex + 1].id);
        }
        return;
      }

      // Cmd+Shift+[: Previous tab
      if (event.key === '[' && event.shiftKey) {
        event.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.id === activeTabId);
        if (currentIndex > 0) {
          setActiveTab(openTabs[currentIndex - 1].id);
        }
        return;
      }

      // Cmd+Option+Right: Next tab (browser-style)
      if (event.key === 'ArrowRight' && event.altKey) {
        event.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.id === activeTabId);
        if (currentIndex !== -1 && currentIndex < openTabs.length - 1) {
          setActiveTab(openTabs[currentIndex + 1].id);
        }
        return;
      }

      // Cmd+Option+Left: Previous tab (browser-style)
      if (event.key === 'ArrowLeft' && event.altKey) {
        event.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.id === activeTabId);
        if (currentIndex > 0) {
          setActiveTab(openTabs[currentIndex - 1].id);
        }
        return;
      }

      // Cmd+K: Search (placeholder for future implementation)
      if (event.key === 'k') {
        event.preventDefault();
        console.log('Search shortcut triggered (not yet implemented)');
        return;
      }

      // Cmd+F: Find in session
      if (event.key === 'f') {
        event.preventDefault();
        const activeTab = getActiveTab();
        // Only enable search in session views, not dashboard
        if (activeTab?.type === 'session') {
          showSearch();
        }
        return;
      }

      // Cmd+O: Open project (placeholder for future implementation)
      if (event.key === 'o') {
        event.preventDefault();
        console.log('Open project shortcut triggered (not yet implemented)');
        return;
      }

      // Cmd+R: Refresh current session
      if (event.key === 'r') {
        event.preventDefault();
        if (selectedProjectId && selectedSessionId) {
          fetchSessionDetail(selectedProjectId, selectedSessionId);
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, activeTabId, openDashboard, closeTab, setActiveTab, showSearch, getActiveTab, selectedProjectId, selectedSessionId, fetchSessionDetail]);
}
