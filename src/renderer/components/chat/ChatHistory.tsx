import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GitBranch } from 'lucide-react';
import type { ChatItem, AIGroup } from '../../types/groups';
import { UserChatGroup } from './UserChatGroup';
import { AIChatGroup } from './AIChatGroup';
import { SystemChatGroup } from './SystemChatGroup';
import { CompactBoundary } from './CompactBoundary';
import { SessionClaudeMdPanel } from './SessionClaudeMdPanel';
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

/**
 * Find the chat item (any type) that contains or is closest to the given timestamp.
 * Returns the item's group ID and type.
 */
function findChatItemByTimestamp(items: ChatItem[], targetTimestamp: number): { groupId: string; type: 'user' | 'system' | 'ai' | 'compact' } | null {
  if (items.length === 0) return null;

  let bestMatch: { groupId: string; type: 'user' | 'system' | 'ai' | 'compact' } | null = null;
  let bestTimeDiff = Infinity;

  for (const item of items) {
    let itemTimestamp: number;

    if (item.type === 'user') {
      itemTimestamp = item.group.timestamp.getTime();
    } else if (item.type === 'system') {
      itemTimestamp = item.group.timestamp.getTime();
    } else if (item.type === 'ai') {
      const startMs = item.group.startTime.getTime();
      const endMs = item.group.endTime.getTime();
      // Check if timestamp is within this AI group's time range
      if (targetTimestamp >= startMs && targetTimestamp <= endMs) {
        return { groupId: item.group.id, type: 'ai' };
      }
      itemTimestamp = startMs;
    } else if (item.type === 'compact') {
      itemTimestamp = item.group.timestamp.getTime();
    } else {
      continue;
    }

    const timeDiff = Math.abs(targetTimestamp - itemTimestamp);
    if (timeDiff < bestTimeDiff) {
      bestTimeDiff = timeDiff;
      bestMatch = { groupId: item.group.id, type: item.type };
    }
  }

  return bestMatch;
}

export function ChatHistory(): JSX.Element {
  const conversation = useStore((s) => s.conversation);
  const conversationLoading = useStore((s) => s.conversationLoading);
  const setVisibleAIGroup = useStore((s) => s.setVisibleAIGroup);
  const currentSearchIndex = useStore((s) => s.currentSearchIndex);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const clearTabDeepLink = useStore((s) => s.clearTabDeepLink);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const sessionClaudeMdStats = useStore((s) => s.sessionClaudeMdStats);
  const sessionDetail = useStore((s) => s.sessionDetail);

  // State for CLAUDE.md panel visibility
  const [showClaudeMdPanel, setShowClaudeMdPanel] = useState(false);

  // Get current tab to access deep link props
  const currentTab = activeTabId ? openTabs.find(t => t.id === activeTabId) : null;
  const scrollToLine = currentTab?.scrollToLine;
  const highlightErrorId = currentTab?.highlightErrorId;
  const errorTimestamp = currentTab?.errorTimestamp;
  const highlightToolUseId = currentTab?.highlightToolUseId;
  const searchContext = currentTab?.searchContext;

  // Compute all accumulated CLAUDE.md injections (from the last AI group's stats)
  const allInjections = useMemo(() => {
    if (!sessionClaudeMdStats) return [];
    const statsArray = Array.from(sessionClaudeMdStats.values());
    const lastStats = statsArray[statsArray.length - 1];
    return lastStats?.accumulatedInjections || [];
  }, [sessionClaudeMdStats]);

  // State for highlighted AI group
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);

  // State for search highlight (temporarily activates search highlighting)
  const [searchHighlightQuery, setSearchHighlightQuery] = useState<string | null>(null);

  // Track whether we've processed the current deep link
  const processedDeepLinkRef = useRef<string | null>(null);

  // Track whether we've processed the current search context
  const processedSearchContextRef = useRef<string | null>(null);

  // Refs map for AI groups (for scrolling)
  const aiGroupRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Refs map for all chat items (for scrolling to search results)
  const chatItemRefs = useRef<Map<string, HTMLElement>>(new Map());

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
      processedSearchContextRef.current = null;
    }
  }, [conversation?.sessionId]);

  // Effect to handle search context navigation from Command Palette
  useEffect(() => {
    if (!searchContext) return;
    if (!conversation || !conversation.items.length) return;

    // Create a unique key for this search context
    const searchContextKey = `${searchContext.query}-${searchContext.messageTimestamp}-${searchContext.matchedText}`;

    // Skip if we've already processed this search context
    if (processedSearchContextRef.current === searchContextKey) return;
    processedSearchContextRef.current = searchContextKey;

    // Find the chat item containing the search result
    const targetItem = findChatItemByTimestamp(conversation.items, searchContext.messageTimestamp);

    if (targetItem) {
      // Set the search query to activate highlighting
      setSearchQuery(searchContext.query);
      setSearchHighlightQuery(searchContext.query);

      // If it's an AI group, set it as highlighted for the ring effect
      if (targetItem.type === 'ai') {
        setHighlightedGroupId(targetItem.groupId);
      }

      // Scroll to the target after a delay to allow React to render with highlighting
      const scrollTimer = setTimeout(() => {
        // First try to find the specific highlighted element
        const highlightedElement = document.querySelector('[data-search-result="current"]');
        if (highlightedElement) {
          highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Fallback: scroll to the chat item
          const itemElement = chatItemRefs.current.get(targetItem.groupId) ||
                             aiGroupRefs.current.get(targetItem.groupId);
          if (itemElement) {
            itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 200);

      // Clear the search highlight and ring effect after 3 seconds
      const clearTimer = setTimeout(() => {
        setSearchHighlightQuery(null);
        setHighlightedGroupId(null);
        // Clear search query to remove highlighting
        setSearchQuery('');
        // Clear the deep link props from the tab
        if (activeTabId) {
          clearTabDeepLink(activeTabId);
        }
      }, 3000);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [searchContext, conversation, setSearchQuery, activeTabId, clearTabDeepLink]);

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

  // Register ref for user/system chat items
  const registerChatItemRef = useCallback((groupId: string) => {
    return (el: HTMLElement | null) => {
      if (el) {
        chatItemRefs.current.set(groupId, el);
      } else {
        chatItemRefs.current.delete(groupId);
      }
    };
  }, []);

  // Determine highlight style based on source (search vs error)
  const isSearchHighlight = searchHighlightQuery !== null;

  // Render conversation as flat list of items
  const renderItem = (item: ChatItem): JSX.Element | null => {
    switch (item.type) {
      case 'user': {
        const isHighlighted = highlightedGroupId === item.group.id;
        return (
          <div
            ref={registerChatItemRef(item.group.id)}
            key={item.group.id}
            className={`rounded-lg transition-all duration-[3000ms] ease-out ${
              isHighlighted
                ? isSearchHighlight
                  ? 'ring-2 ring-yellow-500/30 bg-yellow-500/5'
                  : 'ring-2 ring-red-500/30 bg-red-500/5'
                : 'ring-0 bg-transparent'
            }`}
          >
            <UserChatGroup userGroup={item.group} />
          </div>
        );
      }
      case 'system': {
        const isHighlighted = highlightedGroupId === item.group.id;
        return (
          <div
            ref={registerChatItemRef(item.group.id)}
            key={item.group.id}
            className={`rounded-lg transition-all duration-[3000ms] ease-out ${
              isHighlighted
                ? isSearchHighlight
                  ? 'ring-2 ring-yellow-500/30 bg-yellow-500/5'
                  : 'ring-2 ring-red-500/30 bg-red-500/5'
                : 'ring-0 bg-transparent'
            }`}
          >
            <SystemChatGroup systemGroup={item.group} />
          </div>
        );
      }
      case 'ai': {
        const isHighlighted = highlightedGroupId === item.group.id;
        // Only pass highlightToolUseId if this is the highlighted group (for errors)
        const toolUseIdForGroup = isHighlighted && !isSearchHighlight ? highlightToolUseId : undefined;
        return (
          <div
            ref={registerAIGroupRefCombined(item.group.id)}
            key={item.group.id}
            className={`rounded-lg transition-all duration-[3000ms] ease-out ${
              isHighlighted
                ? isSearchHighlight
                  ? 'ring-2 ring-yellow-500/30 bg-yellow-500/5'
                  : 'ring-2 ring-red-500/30 bg-red-500/5'
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

  // Get gitBranch from session
  const gitBranch = sessionDetail?.session?.gitBranch;

  // Show header if there's gitBranch or CLAUDE.md injections
  const showHeader = gitBranch || allInjections.length > 0;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header with git branch and CLAUDE.md toggle button */}
      {showHeader && (
        <div className="flex items-center justify-between px-6 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {/* Git branch display */}
          {gitBranch ? (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <GitBranch className="w-3.5 h-3.5" />
              <span className="font-mono">{gitBranch}</span>
            </div>
          ) : (
            <div />
          )}

          {/* CLAUDE.md toggle button */}
          {allInjections.length > 0 && (
            <button
              onClick={() => setShowClaudeMdPanel(!showClaudeMdPanel)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-opacity-80 transition-colors"
              style={{
                backgroundColor: showClaudeMdPanel ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                color: showClaudeMdPanel ? 'var(--color-text-on-accent, white)' : 'var(--color-text-secondary)',
              }}
            >
              CLAUDE.md ({allInjections.length})
            </button>
          )}
        </div>
      )}

      {/* Main content area with optional sidebar */}
      <div className="flex-1 overflow-hidden flex">
        {/* Chat content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="space-y-6">
              {conversation.items.map(renderItem)}
            </div>
          </div>
        </div>

        {/* CLAUDE.md panel sidebar */}
        {showClaudeMdPanel && allInjections.length > 0 && (
          <div className="w-80 flex-shrink-0">
            <SessionClaudeMdPanel
              injections={allInjections}
              onClose={() => setShowClaudeMdPanel(false)}
              projectRoot={sessionDetail?.session?.projectPath}
            />
          </div>
        )}
      </div>
    </div>
  );
}
