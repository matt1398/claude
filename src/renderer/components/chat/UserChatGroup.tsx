import { useState } from 'react';
import { format } from 'date-fns';
import type { UserGroup } from '../../types/groups';
import { CommandBadge } from './CommandBadge';

interface UserChatGroupProps {
  userGroup: UserGroup;
}

/**
 * UserChatGroup displays a user's input message.
 * Features:
 * - Shows timestamp
 * - Displays text content with optional toggle for long content (>500 chars)
 * - Shows command badges
 * - Shows image count
 * - Chat bubble styling aligned to right
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
    <div className="flex justify-end mb-4">
      <div className="max-w-[80%] bg-blue-600/20 border border-blue-500/30 rounded-2xl rounded-br-sm px-4 py-3">
        {/* Timestamp */}
        <div className="text-xs text-gray-400 mb-2">
          {format(timestamp, 'h:mm:ss a')}
        </div>

        {/* Text content */}
        {textContent && (
          <div className="mb-2">
            <div className="text-gray-100 whitespace-pre-wrap break-words">
              {displayText}
            </div>
            {isLongContent && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1 underline"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Command badges */}
        {hasCommands && (
          <div className="flex flex-wrap gap-2 mb-2">
            {content.commands.map((cmd, idx) => (
              <CommandBadge key={idx} command={cmd.name} args={cmd.args} />
            ))}
          </div>
        )}

        {/* Images indicator */}
        {hasImages && (
          <div className="text-xs text-gray-400">
            {content.images.length} image{content.images.length > 1 ? 's' : ''} attached
          </div>
        )}
      </div>
    </div>
  );
}
