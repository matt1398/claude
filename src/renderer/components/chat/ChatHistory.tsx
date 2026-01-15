import { useEffect } from 'react';
import type { ChatItem, AIGroup } from '../../types/groups';
import { UserChatGroup } from './UserChatGroup';
import { AIChatGroup } from './AIChatGroup';
import { SystemChatGroup } from './SystemChatGroup';
import { CompactBoundary } from './CompactBoundary';
import { useStore } from '../../store';
import { useVisibleAIGroup } from '../../hooks/useVisibleAIGroup';

export function ChatHistory(): JSX.Element {
  const conversation = useStore((s) => s.conversation);
  const conversationLoading = useStore((s) => s.conversationLoading);
  const setVisibleAIGroup = useStore((s) => s.setVisibleAIGroup);
  const currentSearchIndex = useStore((s) => s.currentSearchIndex);

  const { registerAIGroupRef } = useVisibleAIGroup({
    onVisibleChange: (aiGroupId) => setVisibleAIGroup(aiGroupId),
    threshold: 0.5,
  });

  // Scroll to current search result when it changes
  useEffect(() => {
    if (currentSearchIndex < 0) return;

    // Small delay to ensure DOM has updated with highlighted content
    const timeoutId = setTimeout(() => {
      const currentResultElement = document.querySelector('[data-search-result="current"]');
      if (currentResultElement) {
        currentResultElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [currentSearchIndex]);

  // Loading state
  if (conversationLoading) {
    return (
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        <div className="space-y-8 w-full max-w-5xl px-6">
          {/* Loading skeleton */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-6 animate-pulse">
              {/* User message skeleton - right aligned */}
              <div className="flex justify-end">
                <div className="w-2/3 h-16 bg-blue-600/10 rounded-2xl rounded-br-sm"></div>
              </div>
              {/* AI response skeleton - left aligned with border accent */}
              <div className="pl-3 border-l-2 border-zinc-700/40">
                <div className="w-full h-24 bg-zinc-800/30 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!conversation || conversation.items.length === 0) {
    return (
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        <div className="text-center text-gray-400 space-y-2">
          <div className="text-6xl mb-4">💬</div>
          <div className="text-xl font-medium">No conversation history</div>
          <div className="text-sm">
            This session does not contain any messages yet.
          </div>
        </div>
      </div>
    );
  }

  // Render conversation as flat list of items
  const renderItem = (item: ChatItem): JSX.Element | null => {
    switch (item.type) {
      case 'user':
        return <UserChatGroup key={item.group.id} userGroup={item.group} />;
      case 'system':
        return <SystemChatGroup key={item.group.id} systemGroup={item.group} />;
      case 'ai':
        return (
          <div ref={registerAIGroupRef(item.group.id)} key={item.group.id}>
            <AIChatGroup aiGroup={item.group as AIGroup} />
          </div>
        );
      case 'compact':
        return <CompactBoundary key={item.group.id} compactGroup={item.group} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="space-y-6">
            {conversation.items.map(renderItem)}
          </div>
        </div>
      </div>
    </div>
  );
}
