/**
 * SessionItem - Individual session row in the session list.
 * Clicking opens the session in a new tab or focuses existing tab.
 */

import { format, formatDistanceToNow } from 'date-fns';
import { MessageSquare, Bot } from 'lucide-react';
import type { Session } from '../../types/data';
import { useStore } from '../../store';

interface SessionItemProps {
  session: Session;
  isActive?: boolean;
}

export function SessionItem({ session, isActive }: SessionItemProps) {
  const { openTab, activeProjectId, isSessionOpen, selectSession } = useStore();

  const isOpenInTab = isSessionOpen(session.id);

  const handleClick = () => {
    if (!activeProjectId) return;

    // Open in tab (or focus existing)
    openTab({
      type: 'session',
      sessionId: session.id,
      projectId: activeProjectId,
      label: session.firstMessage?.slice(0, 50) || 'Session',
    });

    // Also select the session to load its detail
    selectSession(session.id);
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full text-left px-4 py-3 transition-colors duration-150
        ${isActive
          ? 'bg-claude-dark-surface text-claude-dark-text'
          : 'text-claude-dark-text-secondary hover:bg-claude-dark-surface/50'
        }
        ${isOpenInTab && !isActive ? 'border-l-2 border-claude-dark-text-secondary/50' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-claude-dark-text-secondary/70 mb-1">
            {format(new Date(session.createdAt), 'MMM d, yyyy h:mm a')}
          </p>
          <p className={`text-sm line-clamp-2 ${isActive ? 'text-claude-dark-text' : 'text-claude-dark-text/80'}`}>
            {session.firstMessage || 'Empty session'}
          </p>
        </div>
        {session.hasSubagents && (
          <span className="text-xs text-claude-dark-text-secondary bg-claude-dark-border px-2 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
            <Bot className="w-3 h-3" />
            <span>Agents</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-claude-dark-text-secondary/60">
        <MessageSquare className="w-3 h-3" />
        <span>{session.messageCount} messages</span>
        <span>•</span>
        <span>{formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}</span>
      </div>
    </button>
  );
}
