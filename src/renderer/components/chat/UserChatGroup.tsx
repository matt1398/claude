import { useState } from 'react';
import { format } from 'date-fns';
import { User } from 'lucide-react';
import type { UserGroup } from '../../types/groups';
import { CommandBadge } from './CommandBadge';

interface UserChatGroupProps {
  userGroup: UserGroup;
}

/**
 * UserChatGroup displays a user's input message as an Event Card.
 * Features:
 * - Full-width card layout with subtle styling
 * - Header with user icon, label, and timestamp
 * - Displays text content with optional toggle for long content (>500 chars)
 * - Shows command badges in header area
 * - Shows image count indicator
 */
export function UserChatGroup({ userGroup }: UserChatGroupProps) {
  const { content, timestamp } = userGroup;
  const [isExpanded, setIsExpanded] = useState(false);

  const hasImages = content.images.length > 0;
  const hasCommands = content.commands.length > 0;
  const textContent = content.text || '';
  const isLongContent = textContent.length > 500;

  // Determine display text
  const displayText = isLongContent && !isExpanded
    ? textContent.slice(0, 500) + '...'
    : textContent;

  return (
    <div className="border border-zinc-700/50 bg-zinc-800/30 rounded-lg p-4 space-y-2 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-300">User</span>
          <span>·</span>
          <span>{format(timestamp, 'h:mm:ss a')}</span>
        </div>
        {/* Command badges */}
        {hasCommands && (
          <div className="flex flex-wrap gap-2">
            {content.commands.map((cmd, idx) => (
              <CommandBadge key={idx} command={cmd.name} args={cmd.args} />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {textContent && (
        <div>
          <div className="text-zinc-100 text-sm whitespace-pre-wrap break-words">
            {displayText}
          </div>
          {isLongContent && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-zinc-400 hover:text-zinc-300 mt-1 underline"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Images indicator */}
      {hasImages && (
        <div className="text-xs text-zinc-400">
          {content.images.length} image{content.images.length > 1 ? 's' : ''} attached
        </div>
      )}
    </div>
  );
}
