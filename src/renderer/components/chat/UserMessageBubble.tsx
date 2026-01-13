import type { UserGroup } from '../../types/groups';
import { CommandBadge } from './CommandBadge';
import { format } from 'date-fns';

interface UserMessageBubbleProps {
  userGroup: UserGroup;
}

export function UserMessageBubble({ userGroup }: UserMessageBubbleProps) {
  const { content, timestamp } = userGroup;
  const hasImages = content.images.length > 0;

  return (
    <div className="ml-auto max-w-[80%] bg-blue-600/20 border border-blue-500/30 rounded-2xl rounded-br-sm px-4 py-3">
      {/* Timestamp */}
      <div className="text-xs text-gray-400 mb-2">
        {format(timestamp, 'h:mm:ss a')}
      </div>

      {/* Text content */}
      {content.text && (
        <div className="text-gray-100 whitespace-pre-wrap break-words mb-2">
          {content.text}
        </div>
      )}

      {/* Command badges */}
      {content.commands.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {content.commands.map((cmd, idx) => (
            <CommandBadge key={idx} command={cmd.name} args={cmd.args} />
          ))}
        </div>
      )}

      {/* Images placeholder */}
      {hasImages && (
        <div className="text-xs text-gray-400 mt-2">
          {content.images.length} image{content.images.length > 1 ? 's' : ''} attached
        </div>
      )}
    </div>
  );
}
