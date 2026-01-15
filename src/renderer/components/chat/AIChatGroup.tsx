import { useState } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import type { AIGroup, EnhancedAIGroup } from '../../types/groups';
import { enhanceAIGroup } from '../../utils/aiGroupEnhancer';
import { LastOutputDisplay } from './LastOutputDisplay';
import { DisplayItemList } from './DisplayItemList';
import { getModelColorClass } from '../../../shared/utils/modelParser';

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

  // Local state for inline item expansion - allows multiple items to be expanded
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

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
    <div className="pl-3 border-l-2 border-zinc-700/60 space-y-3">
      {/* Clickable Header */}
      {hasToggleContent && (
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Bot className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400">Claude</span>

          {/* Main agent model */}
          {enhanced.mainModel && (
            <span className={`text-xs ${getModelColorClass(enhanced.mainModel.family)}`}>
              {enhanced.mainModel.name}
            </span>
          )}

          {/* Subagent models if different */}
          {enhanced.subagentModels.length > 0 && (
            <>
              <span className="text-zinc-600">→</span>
              <span className="text-xs text-zinc-500">
                {enhanced.subagentModels.map((m, i) => (
                  <span key={m.name}>
                    {i > 0 && ', '}
                    <span className={getModelColorClass(m.family)}>{m.name}</span>
                  </span>
                ))}
              </span>
            </>
          )}

          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-zinc-500">{enhanced.itemsSummary}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-500 transition-transform group-hover:text-zinc-400 ${isExpanded ? 'rotate-180' : ''}`}
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
