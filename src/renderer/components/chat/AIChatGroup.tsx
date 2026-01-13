import { useState } from 'react';
import type { AIGroup, EnhancedAIGroup } from '../../types/groups';
import { enhanceAIGroup } from '../../utils/aiGroupEnhancer';
import { LastOutputDisplay } from './LastOutputDisplay';
import { CollapsedToggle } from './CollapsedToggle';
import { DisplayItemList } from './DisplayItemList';

interface AIChatGroupProps {
  aiGroup: AIGroup;
}

/**
 * AIChatGroup displays an AI response using the new structure.
 *
 * Features:
 * - LastOutputDisplay: Always visible last output (text or tool result)
 * - CollapsedToggle: Toggle for collapsed content (if hasToggleContent)
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
    <div className="mb-4">
      {/* Toggle at TOP */}
      {hasToggleContent && (
        <div className="mb-2">
          <CollapsedToggle
            summary={enhanced.itemsSummary}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />
        </div>
      )}

      {/* Items shown when expanded */}
      {hasToggleContent && isExpanded && (
        <div className="mb-2">
          <DisplayItemList
            items={enhanced.displayItems}
            onItemClick={handleItemClick}
            expandedItemId={expandedItemId}
          />
        </div>
      )}

      {/* Final output at BOTTOM - always visible */}
      <LastOutputDisplay lastOutput={enhanced.lastOutput} />
    </div>
  );
}
