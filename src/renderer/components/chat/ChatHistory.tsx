import type { ConversationTurn } from '../../types/groups';
import { UserMessageBubble } from './UserMessageBubble';
import { AIGroupContainer } from './AIGroupContainer';
import { useStore } from '../../store';
import { useVisibleAIGroup } from '../../hooks/useVisibleAIGroup';

interface ChatHistoryProps {
  onSubagentClick?: (subagentId: string, description: string) => void;
}

export function ChatHistory({ onSubagentClick }: ChatHistoryProps) {
  const conversation = useStore((s) => s.conversation);
  const conversationLoading = useStore((s) => s.conversationLoading);
  const setVisibleAIGroup = useStore((s) => s.setVisibleAIGroup);

  const { registerAIGroupRef } = useVisibleAIGroup({
    onVisibleChange: (aiGroupId) => setVisibleAIGroup(aiGroupId),
    threshold: 0.5,
  });

  // Loading state
  if (conversationLoading) {
    return (
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        <div className="space-y-4 w-full max-w-4xl px-6">
          {/* Loading skeleton */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="ml-auto w-3/4 h-20 bg-blue-600/10 rounded-2xl rounded-br-sm"></div>
              <div className="w-full h-32 bg-claude-dark-surface rounded-2xl rounded-tl-sm"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!conversation || conversation.turns.length === 0) {
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

  // Render conversation
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex flex-col gap-4">
            {conversation.turns.map((turn: ConversationTurn) => (
              <div key={turn.id} className="flex flex-col gap-4">
                {/* User message */}
                <UserMessageBubble userGroup={turn.userGroup} />

                {/* AI responses */}
                {turn.aiGroups.map((aiGroup) => (
                  <div ref={registerAIGroupRef(aiGroup.id)} key={aiGroup.id}>
                    <AIGroupContainer
                      aiGroup={aiGroup}
                      onSubagentClick={onSubagentClick}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
