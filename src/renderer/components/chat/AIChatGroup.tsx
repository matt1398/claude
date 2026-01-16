import { useState, useEffect, useMemo } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import type { AIGroup, EnhancedAIGroup, AIGroupDisplayItem } from '../../types/groups';
import { enhanceAIGroup } from '../../utils/aiGroupEnhancer';
import { LastOutputDisplay } from './LastOutputDisplay';
import { DisplayItemList } from './DisplayItemList';
import { ClaudeMdBadge } from './ClaudeMdBadge';
import { getModelColorClass } from '../../../shared/utils/modelParser';
import { TokenUsageDisplay } from '../common/TokenUsageDisplay';
import { useStore } from '../../store';

interface AIChatGroupProps {
  aiGroup: AIGroup;
  /** Tool use ID to highlight for error deep linking */
  highlightToolUseId?: string;
}

/**
 * Checks if a tool ID exists within the display items (including nested subagents).
 */
function containsToolUseId(items: AIGroupDisplayItem[], toolUseId: string): boolean {
  for (const item of items) {
    if (item.type === 'tool' && item.tool.id === toolUseId) {
      return true;
    }
    // Check nested subagent messages for the tool ID
    if (item.type === 'subagent' && item.subagent.messages) {
      for (const msg of item.subagent.messages) {
        if (msg.toolCalls?.some(tc => tc.id === toolUseId)) {
          return true;
        }
        if (msg.toolResults?.some(tr => tr.toolUseId === toolUseId)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * AIChatGroup displays an AI response using a clean, minimal card-based design.
 *
 * Features:
 * - Card container with subtle zinc styling
 * - Clickable header with Bot icon, "Claude" label, and items summary
 * - LastOutputDisplay: Always visible last output (text or tool result)
 * - DisplayItemList: Shows items when expanded with inline expansion support
 * - Manages local expansion state and inline item expansion
 */
export function AIChatGroup({ aiGroup, highlightToolUseId }: AIChatGroupProps) {
  // Get CLAUDE.md stats from store for this group
  const sessionClaudeMdStats = useStore((s) => s.sessionClaudeMdStats);
  const claudeMdStats = sessionClaudeMdStats?.get(aiGroup.id);

  // Enhance the AI group to get display-ready data
  const enhanced: EnhancedAIGroup = enhanceAIGroup(aiGroup, claudeMdStats);

  // Check if this group should be expanded for search results
  const searchExpandedAIGroupIds = useStore((s) => s.searchExpandedAIGroupIds);
  const searchExpandedSubagentIds = useStore((s) => s.searchExpandedSubagentIds);
  const searchCurrentDisplayItemId = useStore((s) => s.searchCurrentDisplayItemId);
  const shouldExpandForSearch = searchExpandedAIGroupIds.has(aiGroup.id);

  // Check if this group contains the highlighted error tool
  const containsHighlightedError = useMemo(() => {
    if (!highlightToolUseId) return false;
    return containsToolUseId(enhanced.displayItems, highlightToolUseId);
  }, [enhanced.displayItems, highlightToolUseId]);

  // Get the LAST assistant message's usage (represents current context window snapshot)
  // This is the correct metric to display - not the summed values across all messages
  const lastUsage = useMemo(() => {
    const responses = aiGroup.responses || [];
    // Find the last assistant message with usage data
    for (let i = responses.length - 1; i >= 0; i--) {
      const msg = responses[i];
      if (msg.type === 'assistant' && msg.usage) {
        return msg.usage;
      }
    }
    return null;
  }, [aiGroup.responses]);

  // Local state for expansion - auto-expand if contains error or search result
  const [isExpanded, setIsExpanded] = useState(containsHighlightedError || shouldExpandForSearch);

  // Helper function to find the item ID containing the highlighted tool
  const findHighlightedItemId = (toolUseId: string): string | null => {
    for (let i = 0; i < enhanced.displayItems.length; i++) {
      const item = enhanced.displayItems[i];
      if (item.type === 'tool' && item.tool.id === toolUseId) {
        return `tool-${item.tool.id}-${i}`;
      }
      // For subagents, expand the subagent item
      if (item.type === 'subagent' && item.subagent.messages) {
        for (const msg of item.subagent.messages) {
          if (msg.toolCalls?.some(tc => tc.id === toolUseId) ||
              msg.toolResults?.some(tr => tr.toolUseId === toolUseId)) {
            return `subagent-${item.subagent.id}-${i}`;
          }
        }
      }
    }
    return null;
  };

  // Local state for inline item expansion - allows multiple items to be expanded
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(() => {
    // Auto-expand the errored item if present
    if (highlightToolUseId && containsHighlightedError) {
      const itemId = findHighlightedItemId(highlightToolUseId);
      if (itemId) {
        return new Set([itemId]);
      }
    }
    return new Set();
  });

  // Effect to auto-expand when highlightToolUseId changes
  useEffect(() => {
    if (highlightToolUseId && containsHighlightedError) {
      setIsExpanded(true);
      // Find and expand the item containing the error
      const itemId = findHighlightedItemId(highlightToolUseId);
      if (itemId) {
        setExpandedItemIds(prev => new Set([...prev, itemId]));
      }
    }
  }, [highlightToolUseId, containsHighlightedError]);

  // Effect to auto-expand when search navigates to this group
  useEffect(() => {
    if (shouldExpandForSearch) {
      setIsExpanded(true);

      // Expand the specific display item containing the search result
      if (searchCurrentDisplayItemId) {
        setExpandedItemIds(prev => new Set([...prev, searchCurrentDisplayItemId]));
      }

      // If any subagents in this group need their trace expanded for search, expand them
      for (let i = 0; i < enhanced.displayItems.length; i++) {
        const item = enhanced.displayItems[i];
        if (item.type === 'subagent' && searchExpandedSubagentIds.has(item.subagent.id)) {
          const subagentItemId = `subagent-${item.subagent.id}-${i}`;
          setExpandedItemIds(prev => new Set([...prev, subagentItemId]));
        }
      }
    }
  }, [shouldExpandForSearch, searchCurrentDisplayItemId, searchExpandedSubagentIds, enhanced.displayItems]);

  // Determine if there's content to toggle
  const hasToggleContent = enhanced.displayItems.length > 0;

  // Handle item click - toggle inline expansion (add/remove from Set)
  const handleItemClick = (itemId: string) => {
    setExpandedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  return (
    <div
      className="pl-3 border-l-2 space-y-3"
      style={{ borderColor: 'var(--chat-ai-border)' }}
    >
      {/* Clickable Header */}
      {hasToggleContent && (
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Bot className="w-4 h-4" style={{ color: 'var(--chat-ai-icon)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Claude</span>

          {/* Main agent model */}
          {enhanced.mainModel && (
            <span className={`text-xs ${getModelColorClass(enhanced.mainModel.family)}`}>
              {enhanced.mainModel.name}
            </span>
          )}

          {/* Subagent models if different */}
          {enhanced.subagentModels.length > 0 && (
            <>
              <span style={{ color: 'var(--color-text-muted)' }}>→</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {enhanced.subagentModels.map((m, i) => (
                  <span key={m.name}>
                    {i > 0 && ', '}
                    <span className={getModelColorClass(m.family)}>{m.name}</span>
                  </span>
                ))}
              </span>
            </>
          )}

          {/* CLAUDE.md injection badge */}
          {enhanced.claudeMdStats && enhanced.claudeMdStats.newCount > 0 && (
            <ClaudeMdBadge stats={enhanced.claudeMdStats} />
          )}

          {/* Token usage - show last assistant message's usage (context window snapshot) */}
          {lastUsage && (
            <TokenUsageDisplay
              inputTokens={lastUsage.input_tokens}
              outputTokens={lastUsage.output_tokens}
              cacheReadTokens={lastUsage.cache_read_input_tokens || 0}
              cacheCreationTokens={lastUsage.cache_creation_input_tokens || 0}
              modelName={enhanced.mainModel?.name}
              modelFamily={enhanced.mainModel?.family}
              size="sm"
              claudeMdStats={enhanced.claudeMdStats || undefined}
            />
          )}

          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>·</span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{enhanced.itemsSummary}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform group-hover:opacity-80 ${isExpanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--color-text-muted)' }}
          />
        </div>
      )}

      {/* Expandable Content */}
      {hasToggleContent && isExpanded && (
        <div className="pl-2 py-2">
          <DisplayItemList
            items={enhanced.displayItems}
            onItemClick={handleItemClick}
            expandedItemIds={expandedItemIds}
            aiGroupId={aiGroup.id}
            highlightToolUseId={highlightToolUseId}
            forceExpandContent={shouldExpandForSearch}
          />
        </div>
      )}

      {/* Always-visible Output */}
      <div>
        <LastOutputDisplay lastOutput={enhanced.lastOutput} aiGroupId={aiGroup.id} />
      </div>
    </div>
  );
}
