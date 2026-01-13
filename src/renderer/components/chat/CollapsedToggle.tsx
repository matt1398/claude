import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsedToggleProps {
  /** Number of items to show in the summary */
  itemCount: number;
  /** Whether the list is currently expanded */
  isExpanded: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
}

/**
 * CollapsedToggle shows a button that displays item count and expansion state.
 *
 * Features:
 * - Shows "N items" or "1 item" text
 * - Chevron icon indicating expanded/collapsed state
 * - Collapsed by default (controlled by parent)
 * - Clicking toggles the expansion
 */
export function CollapsedToggle({ itemCount, isExpanded, onToggle }: CollapsedToggleProps) {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const itemText = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 px-3 py-2 w-full hover:bg-claude-dark-surface/50 transition-colors rounded text-left border border-claude-dark-border"
    >
      <ChevronIcon className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
      <span className="text-sm text-claude-dark-text-secondary">
        {itemText}
      </span>
    </button>
  );
}
