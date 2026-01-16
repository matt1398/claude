/**
 * NotificationCard - Displays a single notification/error item in the notifications list.
 * Shows unread indicator, project name, relative time, error message, and view session button.
 */

import { formatDistanceToNow } from 'date-fns';
import type { DetectedError } from '../../types/data';

interface NotificationCardProps {
  error: DetectedError;
  onViewSession: (error: DetectedError) => void;
  onMarkRead: (id: string) => void;
}

/**
 * Truncates a string to a maximum length, adding ellipsis if truncated.
 */
function truncateMessage(message: string, maxLength: number = 200): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength).trim() + '...';
}

export function NotificationCard({
  error,
  onViewSession,
  onMarkRead,
}: NotificationCardProps) {
  const isUnread = !error.isRead;
  const projectName = error.context?.projectName || 'Unknown Project';
  const relativeTime = formatDistanceToNow(new Date(error.timestamp), {
    addSuffix: true,
  });
  const truncatedMessage = truncateMessage(error.message);

  const handleCardClick = () => {
    if (isUnread) {
      onMarkRead(error.id);
    }
  };

  const handleViewSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewSession(error);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        px-4 py-3 border-b border-claude-dark-border cursor-pointer
        transition-colors duration-150
        bg-claude-dark-surface hover:bg-claude-dark-surface/80
      `}
    >
      {/* Header row: unread indicator, project name, relative time */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* Unread indicator */}
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-claude-dark-text truncate">
            Error in {projectName}
          </span>
        </div>
        <span className="text-xs text-claude-dark-text-secondary flex-shrink-0 ml-2">
          {relativeTime}
        </span>
      </div>

      {/* Error message */}
      <p className="text-sm text-claude-dark-text-secondary mb-2 break-words">
        {truncatedMessage}
      </p>

      {/* View Session button */}
      <button
        onClick={handleViewSession}
        className="
          text-xs text-blue-400 hover:text-blue-300
          transition-colors duration-150
        "
      >
        View Session
      </button>
    </div>
  );
}
