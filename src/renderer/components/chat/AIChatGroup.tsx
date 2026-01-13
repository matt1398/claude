import { useState } from 'react';
import type { AIGroup, EnhancedAIGroup, AIGroupDisplayItem } from '../../types/groups';
import { enhanceAIGroup } from '../../utils/aiGroupEnhancer';
import { LastOutputDisplay } from './LastOutputDisplay';
import { CollapsedToggle } from './CollapsedToggle';
import { DisplayItemList } from './DisplayItemList';
import { DetailPopover } from './DetailPopover';

interface AIChatGroupProps {
  aiGroup: AIGroup;
}

/**
 * AIChatGroup displays an AI response using the new structure.
 *
 * Features:
 * - LastOutputDisplay: Always visible last output (text or tool result)
 * - CollapsedToggle: Toggle for collapsed content (if hasToggleContent)
 * - DisplayItemList: Shows items when expanded
 * - DetailPopover: Shows full details when an item is clicked
 * - Manages local expansion state and active detail item
 */
export function AIChatGroup({ aiGroup }: AIChatGroupProps) {
  // Enhance the AI group to get display-ready data
  const enhanced: EnhancedAIGroup = enhanceAIGroup(aiGroup);

  // Local state for expansion
  const [isExpanded, setIsExpanded] = useState(false);

  // Local state for detail popover
  const [activeDetailItem, setActiveDetailItem] = useState<AIGroupDisplayItem | null>(null);

  // Determine if there's content to toggle
  const hasToggleContent = enhanced.displayItems.length > 0;

  // Handle item click - show detail popover
  const handleItemClick = (item: AIGroupDisplayItem) => {
    setActiveDetailItem(item);
  };

  // Close detail popover
  const handleCloseDetail = () => {
    setActiveDetailItem(null);
  };

  return (
    <div className="mb-4">
      {/* Last Output - always visible */}
      <div className="mb-2">
        <LastOutputDisplay lastOutput={enhanced.lastOutput} />
      </div>

      {/* Collapsed Toggle - show if there are items to display */}
      {hasToggleContent && (
        <div className="mb-2">
          <CollapsedToggle
            itemCount={enhanced.displayItems.length}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />
        </div>
      )}

      {/* Display Items - show when expanded */}
      {hasToggleContent && isExpanded && (
        <div>
          <DisplayItemList items={enhanced.displayItems} onItemClick={handleItemClick} />
        </div>
      )}

      {/* Detail Popover - show when item is clicked */}
      <DetailPopover item={activeDetailItem} onClose={handleCloseDetail} />
    </div>
  );
}
