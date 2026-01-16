import React, { useState, useMemo } from 'react';
import { Bot, ChevronRight, ChevronDown, Code } from 'lucide-react';
import type { SemanticStep, Process, ContentBlock } from '../../../types/data';
import type { AIGroupDisplayItem } from '../../../types/groups';
import { ThinkingItem } from './ThinkingItem';
import { TextItem } from './TextItem';
import { LinkedToolItem } from './LinkedToolItem';
import { MarkdownViewer } from './MarkdownViewer';
import { buildDisplayItemsFromMessages, buildSummary, truncateText } from '../../../utils/aiGroupEnhancer';
import { parseModelString, getModelColorClass } from '../../../../shared/utils/modelParser';

interface SubagentItemProps {
  step: SemanticStep;
  subagent: Process;
  onClick: () => void;
  isExpanded: boolean;
  aiGroupId: string;
  /** Tool use ID to highlight for error deep linking */
  highlightToolUseId?: string;
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
  aiGroupId: string;
  /** Tool use ID to highlight for error deep linking */
  highlightToolUseId?: string;
}

const ExecutionTrace: React.FC<ExecutionTraceProps> = ({ items, aiGroupId, highlightToolUseId }) => {
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
                aiGroupId={aiGroupId}
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
                aiGroupId={aiGroupId}
              />
            );
          }

          case 'tool': {
            const itemId = `subagent-tool-${item.tool.id}`;
            const isExpanded = expandedItemId === itemId;
            // Check if this tool should be highlighted
            const isHighlighted = highlightToolUseId === item.tool.id;

            return (
              <LinkedToolItem
                key={itemId}
                linkedTool={item.tool}
                onClick={() => handleItemClick(itemId)}
                isExpanded={isExpanded}
                isHighlighted={isHighlighted}
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

export const SubagentItem: React.FC<SubagentItemProps> = ({ step, subagent, onClick, isExpanded, aiGroupId, highlightToolUseId }) => {
  const description = subagent.description || step.content.subagentDescription || 'Subagent';
  const subagentType = subagent.subagentType || 'Task';
  const totalTokens = subagent.metrics.totalTokens || 0;

  // Truncate description for one-liner
  const truncatedDesc = description.length > 50 ? description.slice(0, 50) + '...' : description;

  // Check if this subagent contains the highlighted error tool (independent of isExpanded)
  // This needs to be computed BEFORE displayItems to allow proper auto-expansion
  const containsHighlightedError = useMemo(() => {
    if (!highlightToolUseId || !subagent.messages) return false;
    // Check messages directly without needing full displayItems
    for (const msg of subagent.messages) {
      if (msg.toolCalls?.some(tc => tc.id === highlightToolUseId)) {
        return true;
      }
      if (msg.toolResults?.some(tr => tr.toolUseId === highlightToolUseId)) {
        return true;
      }
    }
    return false;
  }, [highlightToolUseId, subagent.messages]);

  // Extract display items from subagent messages using the shared function
  // Note: Subagents don't have nested subagents, so we pass an empty array
  // Build items if expanded OR if we need to show the highlighted error
  const displayItems = useMemo(() => {
    if ((!isExpanded && !containsHighlightedError) || !subagent.messages || subagent.messages.length === 0) {
      return [];
    }
    return buildDisplayItemsFromMessages(subagent.messages, []);
  }, [isExpanded, containsHighlightedError, subagent.messages]);

  // Build summary for header using the shared function
  const itemsSummary = useMemo(() => {
    if (!isExpanded && !containsHighlightedError) {
      // Quick summary without full extraction
      const toolCount = subagent.messages?.filter(m =>
        m.type === 'assistant' && Array.isArray(m.content) &&
        (m.content as ContentBlock[]).some(b => b.type === 'tool_use')
      ).length || 0;
      return toolCount > 0 ? `${toolCount} tool calls` : '';
    }
    return buildSummary(displayItems);
  }, [isExpanded, containsHighlightedError, displayItems, subagent.messages]);

  // Extract model info from first assistant message
  const modelInfo = useMemo(() => {
    const assistantMsg = subagent.messages?.find(
      m => m.type === 'assistant' && m.model && m.model !== '<synthetic>'
    );
    if (!assistantMsg?.model) return null;
    return parseModelString(assistantMsg.model);
  }, [subagent.messages]);

  // State to control trace visibility (separate from isExpanded which controls header)
  // Auto-show if this subagent contains the highlighted error
  const [showTrace, setShowTrace] = useState(containsHighlightedError);

  // Effect to auto-show trace when highlightToolUseId changes
  React.useEffect(() => {
    if (containsHighlightedError) {
      setShowTrace(true);
    }
  }, [containsHighlightedError]);

  return (
    <div>
      {/* Clickable Header */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-800/50 rounded cursor-pointer border-l-4 border-blue-500/60 bg-zinc-900/30"
      >
        <Bot className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span className="inline-block px-2 py-0.5 rounded-full bg-zinc-800 text-xs font-medium text-cyan-300">{subagentType}</span>
        {modelInfo && (
          <span className={`text-xs ${getModelColorClass(modelInfo.family)}`}>
            {modelInfo.name}
          </span>
        )}
        <span className="text-zinc-600">→</span>
        <span className="text-zinc-500 truncate flex-1">{truncatedDesc}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 flex-shrink-0"></span>
        <span className="text-zinc-600 text-xs flex-shrink-0">{formatDuration(subagent.durationMs)}</span>
        <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-l-2 border-zinc-600 pl-4 ml-2 mt-1 mb-2">
          {/* Full description with markdown support */}
          <div className="mb-3">
            <MarkdownViewer
              content={description}
              maxHeight="max-h-64"
            />
          </div>

          {/* Metrics card */}
          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50 mb-3">
            <div className="text-xs text-zinc-500 mb-2 font-medium">Metrics</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
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
              {modelInfo && (
                <div>
                  <span className="text-zinc-500">Model:</span>{' '}
                  <span className={getModelColorClass(modelInfo.family)}>{modelInfo.name}</span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">ID:</span>{' '}
                <span className="text-zinc-300 font-mono">{subagent.id || 'N/A'}</span>
              </div>
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
                <Code className="w-3.5 h-3.5 text-zinc-500" />
                <span>Execution trace</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500">{itemsSummary}</span>
              </div>

              {/* Execution trace content */}
              {showTrace && (
                <div className="pl-2 bg-zinc-900/50 border border-zinc-800/40 rounded-lg py-2">
                  <ExecutionTrace items={displayItems} aiGroupId={aiGroupId} highlightToolUseId={highlightToolUseId} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
