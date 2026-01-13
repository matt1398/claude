import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsedToggleProps {
  /** Number of items to show in the summary (deprecated, use summary prop) */
  itemCount?: number;
  /** Human-readable summary of items (e.g., "2 thinking, 4 tool calls, 3 subagents") */
  summary?: string;
  /** Whether the list is currently expanded */
  isExpanded: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
}

/**
 * CollapsedToggle shows a button that displays item summary and expansion state.
 *
 * Features:
 * - Shows item summary or fallback to "N items" text
 * - Chevron icon indicating expanded/collapsed state
 * - Collapsed by default (controlled by parent)
 * - Clicking toggles the expansion
 */
export function CollapsedToggle({ itemCount, summary, isExpanded, onToggle }: CollapsedToggleProps) {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  // Use summary if provided, otherwise fallback to itemCount
  let displayText: string;
  if (summary) {
    displayText = summary;
  } else if (itemCount !== undefined) {
    displayText = itemCount === 1 ? '1 item' : `${itemCount} items`;
  } else {
    displayText = 'No items';
  }

  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 px-3 py-2 w-full hover:bg-claude-dark-surface/50 transition-colors rounded text-left border border-claude-dark-border"
    >
      <ChevronIcon className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
      <span className="text-sm text-claude-dark-text-secondary">
        {displayText}
      </span>
    </button>
  );
}
