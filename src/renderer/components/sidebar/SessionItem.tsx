/**
 * SessionItem - Compact session row in the session list.
 * Shows title, git branch, message count, and time ago.
 */

import { formatDistanceToNowStrict } from 'date-fns';
import { GitBranch, MessageSquare } from 'lucide-react';
import type { Session } from '../../types/data';
import { useStore } from '../../store';

interface SessionItemProps {
  session: Session;
  isActive?: boolean;
}

/**
 * Format time distance in short form (e.g., "4m", "2h", "1d")
 */
function formatShortTime(date: Date): string {
  const distance = formatDistanceToNowStrict(date, { addSuffix: false });
  return distance
    .replace(' seconds', 's')
    .replace(' second', 's')
    .replace(' minutes', 'm')
    .replace(' minute', 'm')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd')
    .replace(' weeks', 'w')
    .replace(' week', 'w')
    .replace(' months', 'mo')
    .replace(' month', 'mo')
    .replace(' years', 'y')
    .replace(' year', 'y');
}

/**
 * Pulsing green dot indicator for ongoing sessions.
 */
function OngoingIndicator() {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0" title="Session in progress">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  );
}

export function SessionItem({ session, isActive }: SessionItemProps) {
  const { openTab, activeProjectId, isSessionOpen, selectSession } = useStore();

  const isOpenInTab = isSessionOpen(session.id);

  const handleClick = () => {
    if (!activeProjectId) return;

    openTab({
      type: 'session',
      sessionId: session.id,
      projectId: activeProjectId,
      label: session.firstMessage?.slice(0, 50) || 'Session',
    });

    selectSession(session.id);
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full text-left px-3 py-1.5 transition-colors duration-150
        ${isActive
          ? 'bg-claude-dark-surface text-claude-dark-text'
          : 'text-claude-dark-text-secondary hover:bg-claude-dark-surface/50'
        }
        ${isOpenInTab && !isActive ? 'border-l-2 border-claude-dark-text-secondary/50' : ''}
      `}
    >
      {/* First line: title + ongoing indicator */}
      <div className="flex items-center gap-1.5">
        {session.isOngoing && <OngoingIndicator />}
        <span className={`truncate text-sm leading-tight ${isActive ? 'text-claude-dark-text' : ''}`}>
          {session.firstMessage || 'Untitled'}
        </span>
      </div>

      {/* Second line: git branch + message count + time */}
      <div className="flex items-center gap-2 mt-0.5 text-xs text-claude-dark-text-secondary/60">
        {session.gitBranch && (
          <span className="flex items-center gap-0.5 truncate max-w-[120px]">
            <GitBranch className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{session.gitBranch}</span>
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <MessageSquare className="w-3 h-3" />
          {session.messageCount}
        </span>
        <span>·</span>
        <span className="tabular-nums">{formatShortTime(new Date(session.createdAt))}</span>
      </div>
    </button>
  );
}
