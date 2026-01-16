import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { User } from 'lucide-react';
import type { UserGroup } from '../../types/groups';
import { HighlightedText } from './HighlightedText';
import { SearchHighlight } from './SearchHighlight';
import { useStore } from '../../store';

interface UserChatGroupProps {
  userGroup: UserGroup;
}

/**
 * UserChatGroup displays a user's input message.
 * Features:
 * - Right-aligned bubble layout with subtle blue styling
 * - Header with user icon, label, and timestamp
 * - Displays text content with inline highlighted mentions (@paths, /commands)
 * - Toggle for long content (>500 chars)
 * - Shows image count indicator
 */
export function UserChatGroup({ userGroup }: UserChatGroupProps) {
  const { content, timestamp, id: groupId } = userGroup;
  const [isExpanded, setIsExpanded] = useState(false);

  // Get projectPath from store for path validation in HighlightedText
  const sessionDetail = useStore((s) => s.sessionDetail);
  const projectPath = sessionDetail?.session?.projectPath;

  // Get search state for highlighting
  const searchQuery = useStore((s) => s.searchQuery);

  const hasImages = content.images.length > 0;
  // Use rawText to preserve /commands inline (HighlightedText will highlight them)
  const textContent = content.rawText || content.text || '';
  const isLongContent = textContent.length > 500;

  // Auto-expand when search matches content in the truncated portion
  useEffect(() => {
    if (searchQuery && isLongContent) {
      const lowerText = textContent.toLowerCase();
      const lowerQuery = searchQuery.toLowerCase();
      const matchIndex = lowerText.indexOf(lowerQuery);
      // If match is in the truncated portion (after char 500), expand
      if (matchIndex >= 500) {
        setIsExpanded(true);
      }
    }
  }, [searchQuery, textContent, isLongContent]);

  // Determine display text
  const displayText = isLongContent && !isExpanded
    ? textContent.slice(0, 500) + '...'
    : textContent;

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] space-y-2">
        {/* Header - right aligned */}
        <div
          className="flex items-center justify-end gap-2 text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span>{format(timestamp, 'h:mm:ss a')}</span>
          <span>·</span>
          <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>You</span>
          <User className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
        </div>

        {/* Content - theme-aware bubble style */}
        {textContent && (
          <div
            className="rounded-2xl rounded-br-sm px-4 py-3"
            style={{
              backgroundColor: 'var(--chat-user-bg)',
              border: '1px solid var(--chat-user-border)',
            }}
          >
            <div
              className="text-sm whitespace-pre-wrap break-words"
              style={{ color: 'var(--chat-user-text)' }}
            >
              {searchQuery ? (
                <SearchHighlight text={displayText} itemId={groupId} />
              ) : (
                <HighlightedText text={displayText} projectPath={projectPath} variant="user-bubble" />
              )}
            </div>
            {isLongContent && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs mt-2 underline hover:opacity-80"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Images indicator */}
        {hasImages && (
          <div className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>
            {content.images.length} image{content.images.length > 1 ? 's' : ''} attached
          </div>
        )}
      </div>
    </div>
  );
}
