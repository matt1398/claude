import React from 'react';
import type { AIGroupDisplayItem } from '../../types/groups';
import { ThinkingItem } from './items/ThinkingItem';
import { TextItem } from './items/TextItem';
import { LinkedToolItem } from './items/LinkedToolItem';
import { SubagentItem } from './items/SubagentItem';

interface DisplayItemListProps {
  items: AIGroupDisplayItem[];
  onItemClick: (item: AIGroupDisplayItem) => void;
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
export const DisplayItemList: React.FC<DisplayItemListProps> = ({ items, onItemClick }) => {
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
        const handleClick = () => onItemClick(item);

        switch (item.type) {
          case 'thinking': {
            // Create a synthetic SemanticStep for ThinkingItem
            const thinkingStep = {
              id: `thinking-${index}`,
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

            return (
              <ThinkingItem
                key={`thinking-${index}`}
                step={thinkingStep}
                preview={preview}
                onClick={handleClick}
              />
            );
          }

          case 'output': {
            // Create a synthetic SemanticStep for TextItem
            const textStep = {
              id: `output-${index}`,
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

            return (
              <TextItem
                key={`output-${index}`}
                step={textStep}
                preview={preview}
                onClick={handleClick}
              />
            );
          }

          case 'tool': {
            return (
              <LinkedToolItem
                key={`tool-${item.tool.id}`}
                linkedTool={item.tool}
                onClick={handleClick}
              />
            );
          }

          case 'subagent': {
            // Create a synthetic SemanticStep for SubagentItem
            const subagentStep = {
              id: item.subagent.id,
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

            return (
              <SubagentItem
                key={`subagent-${item.subagent.id}`}
                step={subagentStep}
                subagent={item.subagent}
                onClick={handleClick}
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
