/**
 * DateGroupedSessions - Sessions organized by date categories with virtual scrolling.
 * Uses @tanstack/react-virtual for efficient DOM rendering with infinite scroll.
 */

import { useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../../store';
import { SessionItem } from './SessionItem';
import { groupSessionsByDate, getNonEmptyCategories } from '../../utils/dateGrouping';
import { MessageSquareOff, Calendar, Loader2 } from 'lucide-react';
import type { DateCategory } from '../../types/tabs';
import type { Session } from '../../types/data';

// Virtual list item types
type VirtualItem =
  | { type: 'header'; category: DateCategory; id: string }
  | { type: 'session'; session: Session; id: string }
  | { type: 'loader'; id: string };

// Item height constants
const HEADER_HEIGHT = 28;
const SESSION_HEIGHT = 44;
const LOADER_HEIGHT = 36;
const OVERSCAN = 5;

export function DateGroupedSessions() {
  const {
    sessions,
    selectedSessionId,
    selectedProjectId,
    sessionsLoading,
    sessionsError,
    sessionsHasMore,
    sessionsLoadingMore,
    sessionsTotalCount,
    fetchSessionsMore,
  } = useStore();

  const parentRef = useRef<HTMLDivElement>(null);

  // Group sessions by date - memoized for performance
  const groupedSessions = useMemo(
    () => groupSessionsByDate(sessions),
    [sessions]
  );

  // Get non-empty categories in display order
  const nonEmptyCategories = useMemo(
    () => getNonEmptyCategories(groupedSessions),
    [groupedSessions]
  );

  // Flatten sessions with date headers into virtual list items
  const virtualItems = useMemo((): VirtualItem[] => {
    const items: VirtualItem[] = [];

    for (const category of nonEmptyCategories) {
      // Add header item
      items.push({
        type: 'header',
        category,
        id: `header-${category}`,
      });

      // Add session items
      for (const session of groupedSessions[category]) {
        items.push({
          type: 'session',
          session,
          id: `session-${session.id}`,
        });
      }
    }

    // Add loader item if there are more sessions to load
    if (sessionsHasMore) {
      items.push({
        type: 'loader',
        id: 'loader',
      });
    }

    return items;
  }, [nonEmptyCategories, groupedSessions, sessionsHasMore]);

  // Estimate item size based on type
  const estimateSize = useCallback((index: number) => {
    const item = virtualItems[index];
    if (!item) return SESSION_HEIGHT;

    switch (item.type) {
      case 'header':
        return HEADER_HEIGHT;
      case 'loader':
        return LOADER_HEIGHT;
      case 'session':
      default:
        return SESSION_HEIGHT;
    }
  }, [virtualItems]);

  // Set up virtualizer
  const rowVirtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: OVERSCAN,
  });

  // Load more when scrolling near end
  useEffect(() => {
    const virtualRows = rowVirtualizer.getVirtualItems();
    if (virtualRows.length === 0) return;

    const lastItem = virtualRows[virtualRows.length - 1];
    if (!lastItem) return;

    // If we're within 3 items of the end and there's more to load, fetch more
    if (
      lastItem.index >= virtualItems.length - 3 &&
      sessionsHasMore &&
      !sessionsLoadingMore &&
      !sessionsLoading
    ) {
      fetchSessionsMore();
    }
  }, [
    rowVirtualizer.getVirtualItems(),
    virtualItems.length,
    sessionsHasMore,
    sessionsLoadingMore,
    sessionsLoading,
    fetchSessionsMore,
  ]);

  if (!selectedProjectId) {
    return (
      <div className="p-4">
        <div className="text-claude-dark-text-secondary text-sm text-center py-8">
          <p>Select a project to view sessions</p>
        </div>
      </div>
    );
  }

  if (sessionsLoading && sessions.length === 0) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-claude-dark-surface rounded w-1/4 mb-3"></div>
              <div className="h-4 bg-claude-dark-surface rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-claude-dark-surface/50 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessionsError) {
    return (
      <div className="p-4">
        <div className="bg-claude-dark-surface border border-claude-dark-border rounded-lg p-3 text-claude-dark-text-secondary text-sm">
          <p className="font-semibold mb-1 text-claude-dark-text">Error loading sessions</p>
          <p>{sessionsError}</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4">
        <div className="text-claude-dark-text-secondary text-sm text-center py-8">
          <MessageSquareOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="mb-2">No sessions found</p>
          <p className="text-xs opacity-70">
            This project has no sessions yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 mt-2 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-claude-dark-text-secondary" />
        <h2 className="text-xs uppercase tracking-wider text-claude-dark-text-secondary">Sessions</h2>
        <span className="text-xs text-claude-dark-text-secondary/60">
          ({sessions.length}{sessionsTotalCount > sessions.length ? ` of ${sessionsTotalCount}` : ''})
        </span>
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = virtualItems[virtualRow.index];
            if (!item) return null;

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
                {item.type === 'header' ? (
                  <div className="px-4 py-1.5 text-xs font-medium text-claude-dark-text-secondary/70 sticky top-0 bg-claude-dark-bg/95 backdrop-blur-sm h-full flex items-center">
                    {item.category}
                  </div>
                ) : item.type === 'loader' ? (
                  <div className="flex items-center justify-center h-full text-claude-dark-text-secondary">
                    {sessionsLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span className="text-xs">Loading more sessions...</span>
                      </>
                    ) : (
                      <span className="text-xs opacity-50">Scroll to load more</span>
                    )}
                  </div>
                ) : (
                  <SessionItem
                    session={item.session}
                    isActive={selectedSessionId === item.session.id}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
