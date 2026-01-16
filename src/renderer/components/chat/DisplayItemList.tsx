import React from 'react';
import type { AIGroupDisplayItem } from '../../types/groups';
import { ThinkingItem } from './items/ThinkingItem';
import { TextItem } from './items/TextItem';
import { LinkedToolItem } from './items/LinkedToolItem';
import { SubagentItem } from './items/SubagentItem';

interface DisplayItemListProps {
  items: AIGroupDisplayItem[];
  onItemClick: (itemId: string) => void;
  expandedItemIds: Set<string>;
  aiGroupId: string;
  /** Tool use ID to highlight for error deep linking */
  highlightToolUseId?: string;
  /** Force expand all nested content (code blocks, diffs) for search results */
  forceExpandContent?: boolean;
}

/**
 * Truncates text to a maximum length and adds ellipsis if needed.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Renders a flat list of AIGroupDisplayItem[] into the appropriate components.
 *
 * This component maps each display item to its corresponding component based on type:
 * - thinking -> ThinkingItem
 * - output -> TextItem
 * - tool -> LinkedToolItem
 * - subagent -> SubagentItem
 *
 * The list is completely flat with no nested toggles or hierarchies.
 */
export const DisplayItemList: React.FC<DisplayItemListProps> = ({ items, onItemClick, expandedItemIds, aiGroupId, highlightToolUseId, forceExpandContent }) => {
  if (!items || items.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-claude-dark-text-secondary italic">
        No items to display
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        switch (item.type) {
          case 'thinking': {
            // Create a synthetic SemanticStep for ThinkingItem
            const itemId = `thinking-${index}`;
            const thinkingStep = {
              id: itemId,
              type: 'thinking' as const,
              startTime: item.timestamp,
              endTime: item.timestamp,
              durationMs: 0,
              content: {
                thinkingText: item.content,
              },
              context: 'main' as const,
            };

            const preview = truncateText(item.content, 150);
            const handleClick = () => onItemClick(itemId);
            const isExpanded = expandedItemIds.has(itemId);

            return (
              <ThinkingItem
                key={itemId}
                step={thinkingStep}
                preview={preview}
                onClick={handleClick}
                isExpanded={isExpanded}
                aiGroupId={aiGroupId}
              />
            );
          }

          case 'output': {
            // Create a synthetic SemanticStep for TextItem
            const itemId = `output-${index}`;
            const textStep = {
              id: itemId,
              type: 'output' as const,
              startTime: item.timestamp,
              endTime: item.timestamp,
              durationMs: 0,
              content: {
                outputText: item.content,
              },
              context: 'main' as const,
            };

            const preview = truncateText(item.content, 150);
            const handleClick = () => onItemClick(itemId);
            const isExpanded = expandedItemIds.has(itemId);

            return (
              <TextItem
                key={itemId}
                step={textStep}
                preview={preview}
                onClick={handleClick}
                isExpanded={isExpanded}
                aiGroupId={aiGroupId}
              />
            );
          }

          case 'tool': {
            // Use index to ensure uniqueness within this list
            const itemId = `tool-${item.tool.id}-${index}`;
            const handleClick = () => onItemClick(itemId);
            const isExpanded = expandedItemIds.has(itemId);
            // Check if this tool should be highlighted
            const isHighlighted = highlightToolUseId === item.tool.id;

            return (
              <LinkedToolItem
                key={itemId}
                linkedTool={item.tool}
                onClick={handleClick}
                isExpanded={isExpanded}
                isHighlighted={isHighlighted}
                forceExpandContent={forceExpandContent}
              />
            );
          }

          case 'subagent': {
            // Create a synthetic SemanticStep for SubagentItem
            // Use index to ensure uniqueness within this list
            const itemId = `subagent-${item.subagent.id}-${index}`;
            const subagentStep = {
              id: itemId,
              type: 'subagent' as const,
              startTime: item.subagent.startTime,
              endTime: item.subagent.endTime,
              durationMs: item.subagent.durationMs,
              content: {
                subagentId: item.subagent.id,
                subagentDescription: item.subagent.description,
              },
              isParallel: item.subagent.isParallel,
              context: 'main' as const,
            };

            const handleClick = () => onItemClick(itemId);
            const isExpanded = expandedItemIds.has(itemId);

            return (
              <SubagentItem
                key={itemId}
                step={subagentStep}
                subagent={item.subagent}
                onClick={handleClick}
                isExpanded={isExpanded}
                aiGroupId={aiGroupId}
                highlightToolUseId={highlightToolUseId}
              />
            );
          }

          default:
            // Exhaustive type check - TypeScript will error if we miss a case
            return null;
        }
      })}
    </div>
  );
};
