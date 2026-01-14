/**
 * DateGroupedSessions - Sessions organized by date categories.
 * Groups sessions into Today, Yesterday, Previous 7 Days, and Older.
 */

import { useMemo } from 'react';
import { useStore } from '../../store';
import { SessionItem } from './SessionItem';
import { groupSessionsByDate, getNonEmptyCategories } from '../../utils/dateGrouping';
import { MessageSquareOff, Calendar } from 'lucide-react';
import type { DateCategory } from '../../types/tabs';

export function DateGroupedSessions() {
  const {
    sessions,
    selectedSessionId,
    selectedProjectId,
    sessionsLoading,
    sessionsError,
  } = useStore();

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

  if (!selectedProjectId) {
    return (
      <div className="p-4">
        <div className="text-claude-dark-text-secondary text-sm text-center py-8">
          <p>Select a project to view sessions</p>
        </div>
      </div>
    );
  }

  if (sessionsLoading) {
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
      <div className="px-4 py-2 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-claude-dark-text-secondary" />
        <h2 className="text-xs uppercase tracking-wider text-claude-dark-text-secondary">Sessions</h2>
        <span className="text-xs text-claude-dark-text-secondary/60">({sessions.length})</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {nonEmptyCategories.map((category: DateCategory) => (
          <div key={category} className="mb-2">
            {/* Category header */}
            <div className="px-4 py-1.5 text-xs font-medium text-claude-dark-text-secondary/70 sticky top-0 bg-claude-dark-bg/95 backdrop-blur-sm">
              {category}
            </div>

            {/* Sessions in this category */}
            {groupedSessions[category].map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={selectedSessionId === session.id}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
