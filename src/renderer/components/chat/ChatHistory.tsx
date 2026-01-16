import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { ChatItem, AIGroup } from '../../types/groups';
import { UserChatGroup } from './UserChatGroup';
import { AIChatGroup } from './AIChatGroup';
import { SystemChatGroup } from './SystemChatGroup';
import { CompactBoundary } from './CompactBoundary';
import { useStore } from '../../store';
import { useVisibleAIGroup } from '../../hooks/useVisibleAIGroup';

/**
 * Find the AI group that contains or is closest to the given error timestamp.
 */
function findAIGroupByTimestamp(items: ChatItem[], errorTimestamp: number): string | null {
  if (items.length === 0) return null;

  let bestGroupId: string | null = null;
  let bestTimeDiff = Infinity;

  for (const item of items) {
    if (item.type !== 'ai') continue;

    const group = item.group;
    const startMs = group.startTime.getTime();
    const endMs = group.endTime.getTime();

    // Check if error timestamp is within this group's time range
    if (errorTimestamp >= startMs && errorTimestamp <= endMs) {
      return group.id; // Exact match
    }

    // Track closest group for fallback
    const startDiff = Math.abs(errorTimestamp - startMs);
    const endDiff = Math.abs(errorTimestamp - endMs);
    const minDiff = Math.min(startDiff, endDiff);

    if (minDiff < bestTimeDiff) {
      bestTimeDiff = minDiff;
      bestGroupId = group.id;
    }
  }

  return bestGroupId;
}

export function ChatHistory(): JSX.Element {
  const conversation = useStore((s) => s.conversation);
  const conversationLoading = useStore((s) => s.conversationLoading);
  const setVisibleAIGroup = useStore((s) => s.setVisibleAIGroup);
  const currentSearchIndex = useStore((s) => s.currentSearchIndex);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const clearTabDeepLink = useStore((s) => s.clearTabDeepLink);

  // Get current tab to access deep link props
  const currentTab = activeTabId ? openTabs.find(t => t.id === activeTabId) : null;
  const scrollToLine = currentTab?.scrollToLine;
  const highlightErrorId = currentTab?.highlightErrorId;
  const errorTimestamp = currentTab?.errorTimestamp;
  const highlightToolUseId = currentTab?.highlightToolUseId;

  // State for highlighted AI group
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);

  // Track whether we've processed the current deep link
  const processedDeepLinkRef = useRef<string | null>(null);

  // Refs map for AI groups (for scrolling)
  const aiGroupRefs = useRef<Map<string, HTMLElement>>(new Map());

  const { registerAIGroupRef } = useVisibleAIGroup({
    onVisibleChange: (aiGroupId) => setVisibleAIGroup(aiGroupId),
    threshold: 0.5,
  });

  // Callback to register AI group refs (combines with visibility hook)
  const registerAIGroupRefCombined = useCallback((groupId: string) => {
    const visibilityRef = registerAIGroupRef(groupId);
    return (el: HTMLElement | null) => {
      // Call visibility ref
      if (typeof visibilityRef === 'function') {
        visibilityRef(el);
      }
      // Store ref for scrolling
      if (el) {
        aiGroupRefs.current.set(groupId, el);
      } else {
        aiGroupRefs.current.delete(groupId);
      }
    };
  }, [registerAIGroupRef]);

  // Handler to clear highlight after animation completes
  const handleHighlightEnd = useCallback(() => {
    setHighlightedGroupId(null);
    // Clear the deep link props from the tab
    if (activeTabId) {
      clearTabDeepLink(activeTabId);
    }
  }, [activeTabId, clearTabDeepLink]);

  // Calculate target AI group ID based on error timestamp
  const targetGroupId = useMemo(() => {
    if (!conversation || !conversation.items.length) return null;
    if (!scrollToLine && !highlightErrorId && !errorTimestamp) return null;

    // Primary strategy: Use error timestamp for accurate group matching
    if (errorTimestamp && errorTimestamp > 0) {
      return findAIGroupByTimestamp(conversation.items, errorTimestamp);
    }

    // Fallback: Return the last AI group (errors typically occur at the end)
    const aiItems = conversation.items.filter(item => item.type === 'ai');
    if (aiItems.length > 0) {
      const lastGroup = aiItems[aiItems.length - 1].group as AIGroup;
      return lastGroup.id;
    }

    return null;
  }, [conversation, scrollToLine, highlightErrorId, errorTimestamp]);

  // Effect to handle deep linking: scroll to and highlight error location
  useEffect(() => {
    // Only process if we have a target group
    if (!targetGroupId) return;
    if (!conversation || !conversation.items.length) return;

    // Create a unique key for this deep link request
    const deepLinkKey = `${highlightErrorId || ''}-${scrollToLine || ''}-${errorTimestamp || ''}`;

    // Skip if we've already processed this deep link
    if (processedDeepLinkRef.current === deepLinkKey) return;
    processedDeepLinkRef.current = deepLinkKey;

    // Set the highlight
    setHighlightedGroupId(targetGroupId);

    // Scroll to the target group after a delay to allow React to render
    const scrollTimer = setTimeout(() => {
      const element = aiGroupRefs.current.get(targetGroupId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    // Clear highlight after animation (3 seconds)
    const highlightTimer = setTimeout(() => {
      handleHighlightEnd();
    }, 3000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(highlightTimer);
    };
  }, [conversation, targetGroupId, scrollToLine, highlightErrorId, errorTimestamp, handleHighlightEnd]);

  // Reset processed deep link when conversation changes (new session loaded)
  useEffect(() => {
    if (conversation) {
      // Only reset if conversation is for a different session
      processedDeepLinkRef.current = null;
    }
  }, [conversation?.sessionId]);

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
      case 'ai': {
        const isHighlighted = highlightedGroupId === item.group.id;
        // Only pass highlightToolUseId if this is the highlighted group
        const toolUseIdForGroup = isHighlighted ? highlightToolUseId : undefined;
        return (
          <div
            ref={registerAIGroupRefCombined(item.group.id)}
            key={item.group.id}
            className={`rounded-lg transition-all duration-[3000ms] ease-out ${
              isHighlighted
                ? 'ring-2 ring-red-500/30 bg-red-500/5'
                : 'ring-0 bg-transparent'
            }`}
          >
            <AIChatGroup aiGroup={item.group as AIGroup} highlightToolUseId={toolUseIdForGroup} />
          </div>
        );
      }
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
