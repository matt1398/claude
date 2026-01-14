import React, { useState, useMemo } from 'react';
import { Bot, ChevronRight, ChevronDown } from 'lucide-react';
import type { SemanticStep, Process, ContentBlock } from '../../../types/data';
import type { AIGroupDisplayItem } from '../../../types/groups';
import { ThinkingItem } from './ThinkingItem';
import { TextItem } from './TextItem';
import { LinkedToolItem } from './LinkedToolItem';
import { buildDisplayItemsFromMessages, buildSummary, truncateText } from '../../../utils/aiGroupEnhancer';

interface SubagentItemProps {
  step: SemanticStep;
  subagent: Process;
  onClick: () => void;
  isExpanded: boolean;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Formats duration in milliseconds to a human-readable string.
 * Examples: "123ms", "1.2s", "45.3s", "2m 15s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Formats token count for display.
 * Examples: "1.2k", "234", "12.5k"
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}


// =============================================================================
// Execution Trace Component (renders items inside expanded subagent)
// =============================================================================

interface ExecutionTraceProps {
  items: AIGroupDisplayItem[];
}

const ExecutionTrace: React.FC<ExecutionTraceProps> = ({ items }) => {
  // Local state for inline item expansion
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const handleItemClick = (itemId: string) => {
    setExpandedItemId(prev => prev === itemId ? null : itemId);
  };

  if (!items || items.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-zinc-500 italic">
        No execution items to display
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        switch (item.type) {
          case 'thinking': {
            const itemId = `subagent-thinking-${index}`;
            const thinkingStep = {
              id: itemId,
              type: 'thinking' as const,
              startTime: item.timestamp,
              endTime: item.timestamp,
              durationMs: 0,
              content: {
                thinkingText: item.content,
              },
              context: 'subagent' as const,
            };

            const preview = truncateText(item.content, 150);
            const isExpanded = expandedItemId === itemId;

            return (
              <ThinkingItem
                key={itemId}
                step={thinkingStep}
                preview={preview}
                onClick={() => handleItemClick(itemId)}
                isExpanded={isExpanded}
              />
            );
          }

          case 'output': {
            const itemId = `subagent-output-${index}`;
            const textStep = {
              id: itemId,
              type: 'output' as const,
              startTime: item.timestamp,
              endTime: item.timestamp,
              durationMs: 0,
              content: {
                outputText: item.content,
              },
              context: 'subagent' as const,
            };

            const preview = truncateText(item.content, 150);
            const isExpanded = expandedItemId === itemId;

            return (
              <TextItem
                key={itemId}
                step={textStep}
                preview={preview}
                onClick={() => handleItemClick(itemId)}
                isExpanded={isExpanded}
              />
            );
          }

          case 'tool': {
            const itemId = `subagent-tool-${item.tool.id}`;
            const isExpanded = expandedItemId === itemId;

            return (
              <LinkedToolItem
                key={itemId}
                linkedTool={item.tool}
                onClick={() => handleItemClick(itemId)}
                isExpanded={isExpanded}
              />
            );
          }

          case 'subagent': {
            // Nested subagents - shouldn't happen typically but handle gracefully
            return (
              <div key={`nested-subagent-${index}`} className="px-2 py-1 text-xs text-zinc-500 italic">
                Nested subagent: {item.subagent.description || item.subagent.id}
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const SubagentItem: React.FC<SubagentItemProps> = ({ step, subagent, onClick, isExpanded }) => {
  const description = subagent.description || step.content.subagentDescription || 'Subagent';
  const subagentType = subagent.subagentType || 'Task';
  const totalTokens = subagent.metrics.totalTokens || 0;

  // Truncate description for one-liner
  const truncatedDesc = description.length > 50 ? description.slice(0, 50) + '...' : description;

  // Extract display items from subagent messages using the shared function
  // Note: Subagents don't have nested subagents, so we pass an empty array
  const displayItems = useMemo(() => {
    if (!isExpanded || !subagent.messages || subagent.messages.length === 0) {
      return [];
    }
    return buildDisplayItemsFromMessages(subagent.messages, []);
  }, [isExpanded, subagent.messages]);

  // Build summary for header using the shared function
  const itemsSummary = useMemo(() => {
    if (!isExpanded) {
      // Quick summary without full extraction
      const toolCount = subagent.messages?.filter(m =>
        m.type === 'assistant' && Array.isArray(m.content) &&
        (m.content as ContentBlock[]).some(b => b.type === 'tool_use')
      ).length || 0;
      return toolCount > 0 ? `${toolCount} tool calls` : '';
    }
    return buildSummary(displayItems);
  }, [isExpanded, displayItems, subagent.messages]);

  // State to control trace visibility (separate from isExpanded which controls header)
  const [showTrace, setShowTrace] = useState(false);

  return (
    <div>
      {/* Clickable Header */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-800/50 rounded cursor-pointer"
      >
        <Bot className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        <span className="font-medium text-zinc-300">{subagentType}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500 truncate flex-1">{truncatedDesc}</span>
        <span className="text-zinc-600 text-xs flex-shrink-0">{formatDuration(subagent.durationMs)}</span>
        <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-l-2 border-zinc-600 pl-4 ml-2 mt-1 mb-2">
          {/* Full description */}
          <div className="text-zinc-300 text-sm whitespace-pre-wrap mb-3">
            {description}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-zinc-500">Type:</span>{' '}
              <span className="text-zinc-300">{subagentType}</span>
            </div>
            <div>
              <span className="text-zinc-500">Duration:</span>{' '}
              <span className="text-zinc-300">{formatDuration(subagent.durationMs)}</span>
            </div>
            <div>
              <span className="text-zinc-500">Tokens:</span>{' '}
              <span className="text-zinc-300">{formatTokens(totalTokens)}</span>
            </div>
            <div>
              <span className="text-zinc-500">ID:</span>{' '}
              <span className="text-zinc-300 font-mono">{subagent.id || 'N/A'}</span>
            </div>
          </div>

          {/* Execution Trace Toggle */}
          {displayItems.length > 0 && (
            <div className="mt-3">
              <div
                onClick={() => setShowTrace(!showTrace)}
                className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 hover:text-zinc-300 mb-2"
              >
                {showTrace ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>Execution trace</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500">{itemsSummary}</span>
              </div>

              {/* Execution trace content */}
              {showTrace && (
                <div className="pl-2 border-l border-zinc-700 bg-zinc-900/30 rounded-r py-2">
                  <ExecutionTrace items={displayItems} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
