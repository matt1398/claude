import type { ConversationTurn } from '../../types/groups';
import { UserChatGroup } from './UserChatGroup';
import { AIChatGroup } from './AIChatGroup';
import { useStore } from '../../store';
import { useVisibleAIGroup } from '../../hooks/useVisibleAIGroup';

export function ChatHistory(): JSX.Element {
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
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="space-y-8">
            {conversation.turns.map((turn: ConversationTurn) => (
              <div key={turn.id} className="space-y-6">
                {/* User message - right aligned */}
                <UserChatGroup userGroup={turn.userGroup} />

                {/* AI responses - left aligned with spacing */}
                <div className="space-y-4">
                  {turn.aiGroups.map((aiGroup) => (
                    <div ref={registerAIGroupRef(aiGroup.id)} key={aiGroup.id}>
                      <AIChatGroup aiGroup={aiGroup} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
