/**
 * NotificationsView - Main view for the notifications tab showing all error notifications.
 * Displays error notifications with filtering, actions, and deep linking to sessions.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../../store';
import { NotificationCard } from './NotificationCard';
import { Bell, CheckCheck, Trash2, Filter, AlertCircle, Loader2 } from 'lucide-react';
import type { DetectedError } from '../../types/data';

// Virtual list constants
const NOTIFICATION_HEIGHT = 120;
const OVERSCAN = 5;

type FilterOption = 'all' | string; // 'all' or projectId

export function NotificationsView() {
  const {
    notifications,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    navigateToError,
  } = useStore();

  const parentRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notifications on mount
  useEffect(() => {
    const loadNotifications = async () => {
      setIsLoading(true);
      try {
        await fetchNotifications();
      } finally {
        setIsLoading(false);
      }
    };
    loadNotifications();
  }, [fetchNotifications]);

  // Get unique projects for filter dropdown
  const projectOptions = useMemo(() => {
    const projectMap = new Map<string, string>();
    notifications.forEach((notif) => {
      if (!projectMap.has(notif.projectId)) {
        projectMap.set(notif.projectId, notif.context.projectName);
      }
    });
    return Array.from(projectMap.entries());
  }, [notifications]);

  // Filter and sort notifications by project (most recent first)
  const filteredNotifications = useMemo(() => {
    const filtered = filter === 'all'
      ? notifications
      : notifications.filter((notif) => notif.projectId === filter);
    // Sort by timestamp descending (most recent first)
    return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  }, [notifications, filter]);

  // Estimate item size
  const estimateSize = useCallback(() => NOTIFICATION_HEIGHT, []);

  // Set up virtualizer
  const rowVirtualizer = useVirtualizer({
    count: filteredNotifications.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: OVERSCAN,
  });

  // Handle mark all read
  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
  };

  // Handle clear all with confirmation
  const handleClearAll = async () => {
    if (showClearConfirm) {
      await clearNotifications();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  // Handle view session click
  const handleViewSession = (error: DetectedError) => {
    navigateToError(error);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-claude-dark-bg">
        <div className="max-w-3xl mx-auto p-6">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-claude-dark-text-secondary animate-spin mr-3" />
            <span className="text-claude-dark-text-secondary">Loading notifications...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-claude-dark-bg">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-claude-dark-border">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-claude-dark-text" />
              <h1 className="text-lg font-semibold text-claude-dark-text">Notifications</h1>
              {notifications.length > 0 && (
                <span className="text-sm text-claude-dark-text-secondary">
                  ({filteredNotifications.length})
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-claude-dark-text-secondary hover:text-claude-dark-text hover:bg-claude-dark-surface rounded-md transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {projectOptions.length > 1 && (
        <div className="flex-shrink-0 border-b border-claude-dark-border">
          <div className="max-w-3xl mx-auto px-6 py-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-claude-dark-text-secondary" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-claude-dark-surface border border-claude-dark-border rounded-md px-3 py-1.5 text-sm text-claude-dark-text focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Projects</option>
                {projectOptions.map(([projectId, projectName]) => (
                  <option key={projectId} value={projectId}>
                    {projectName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Notifications list */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="max-w-3xl mx-auto px-6">
            <div className="flex flex-col items-center justify-center py-16 text-claude-dark-text-secondary">
              <AlertCircle className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-lg mb-2">No notifications yet</p>
              <p className="text-sm opacity-70">
                Error notifications from your Claude Code sessions will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6">
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const notification = filteredNotifications[virtualRow.index];
                if (!notification) return null;

                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <NotificationCard
                      error={notification}
                      onViewSession={() => handleViewSession(notification)}
                      onMarkRead={markNotificationRead}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Clear All button */}
      {notifications.length > 0 && (
        <div className="flex-shrink-0 border-t border-claude-dark-border">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="flex justify-center">
              <button
                onClick={handleClearAll}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                  showClearConfirm
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'text-claude-dark-text-secondary hover:text-claude-dark-text hover:bg-claude-dark-surface'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {showClearConfirm ? 'Click again to confirm' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
