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
    <div className="flex justify-end">
      <div className="max-w-[85%] space-y-2">
        {/* Header - right aligned */}
        <div className="flex items-center justify-end gap-2 text-xs text-zinc-400">
          {/* Command badges */}
          {hasCommands && (
            <div className="flex flex-wrap gap-2">
              {content.commands.map((cmd, idx) => (
                <CommandBadge key={idx} command={cmd.name} args={cmd.args} />
              ))}
            </div>
          )}
          <span>{format(timestamp, 'h:mm:ss a')}</span>
          <span>·</span>
          <span className="font-medium text-zinc-300">You</span>
          <User className="w-3.5 h-3.5 text-zinc-400" />
        </div>

        {/* Content - subtle bubble style */}
        {textContent && (
          <div className="bg-blue-600/15 rounded-2xl rounded-br-sm px-4 py-3">
            <div className="text-zinc-100 text-sm whitespace-pre-wrap break-words">
              {displayText}
            </div>
            {isLongContent && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-zinc-400 hover:text-zinc-300 mt-2 underline"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Images indicator */}
        {hasImages && (
          <div className="text-xs text-zinc-400 text-right">
            {content.images.length} image{content.images.length > 1 ? 's' : ''} attached
          </div>
        )}
      </div>
    </div>
  );
}
