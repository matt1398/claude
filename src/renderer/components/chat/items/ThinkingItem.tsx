import React from 'react';
import { Brain } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';

interface ThinkingItemProps {
  step: SemanticStep;
  preview: string;
  onClick: () => void;
  isExpanded: boolean;
}

export const ThinkingItem: React.FC<ThinkingItemProps> = ({ step, preview, onClick, isExpanded }) => {
  const fullContent = step.content.thinkingText || preview;
  // Truncate preview to ~60 chars for collapsed one-liner
  const truncatedPreview = preview.length > 60 ? preview.slice(0, 60) + '...' : preview;

  return (
    <div>
      {/* Collapsed: simple one-line row */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 px-2 py-1 hover:bg-purple-900/30 cursor-pointer rounded"
      >
        <Brain className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <span className="text-sm text-purple-300 truncate">
          Thinking: "{truncatedPreview}"
        </span>
      </div>

      {/* Expanded: full content below */}
      {isExpanded && (
        <div className="border-l-2 border-purple-500 pl-3 ml-3 mt-1 mb-2">
          <div className="text-xs text-purple-200/90 whitespace-pre-wrap">
            {fullContent}
          </div>
        </div>
      )}
    </div>
  );
};
