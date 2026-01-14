import { useState } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import type { AIGroup, EnhancedAIGroup } from '../../types/groups';
import { enhanceAIGroup } from '../../utils/aiGroupEnhancer';
import { LastOutputDisplay } from './LastOutputDisplay';
import { DisplayItemList } from './DisplayItemList';

interface AIChatGroupProps {
  aiGroup: AIGroup;
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
export function AIChatGroup({ aiGroup }: AIChatGroupProps) {
  // Enhance the AI group to get display-ready data
  const enhanced: EnhancedAIGroup = enhanceAIGroup(aiGroup);

  // Local state for expansion
  const [isExpanded, setIsExpanded] = useState(false);

  // Local state for inline item expansion
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Determine if there's content to toggle
  const hasToggleContent = enhanced.displayItems.length > 0;

  // Handle item click - toggle inline expansion
  const handleItemClick = (itemId: string) => {
    setExpandedItemId(prev => prev === itemId ? null : itemId);
  };

  return (
    <div className="mb-4 border border-zinc-700/50 bg-zinc-900/50 rounded-lg overflow-hidden border-l-2 border-l-zinc-600">
      {/* Clickable Header */}
      {hasToggleContent && (
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 text-xs">
            <Bot className="w-4 h-4 text-zinc-400" />
            <span className="font-medium text-zinc-300">Claude</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-500">{enhanced.itemsSummary}</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      )}

      {/* Expandable Content */}
      {hasToggleContent && isExpanded && (
        <div className="border-t border-zinc-800 p-4">
          <DisplayItemList
            items={enhanced.displayItems}
            onItemClick={handleItemClick}
            expandedItemId={expandedItemId}
          />
        </div>
      )}

      {/* Always-visible Output */}
      <div className={`${hasToggleContent ? 'border-t border-zinc-800' : ''} p-4`}>
        <LastOutputDisplay lastOutput={enhanced.lastOutput} />
      </div>
    </div>
  );
}
