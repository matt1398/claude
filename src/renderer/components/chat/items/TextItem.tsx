import React from 'react';
import { MessageSquare } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';

interface TextItemProps {
  step: SemanticStep;
  preview: string;
  onClick: () => void;
  isExpanded: boolean;
}

export const TextItem: React.FC<TextItemProps> = ({ step, preview, onClick, isExpanded }) => {
  const fullContent = step.content.outputText || preview;
  // Truncate preview to ~60 chars for collapsed one-liner
  const truncatedPreview = preview.length > 60 ? preview.slice(0, 60) + '...' : preview;

  return (
    <div>
      {/* Collapsed: simple one-line row */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 px-2 py-1 hover:bg-claude-dark-surface/50 cursor-pointer rounded"
      >
        <MessageSquare className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />
        <span className="text-sm text-claude-dark-text-secondary truncate">
          "{truncatedPreview}"
        </span>
      </div>

      {/* Expanded: full content below */}
      {isExpanded && (
        <div className="border-l-2 border-claude-dark-border pl-3 ml-3 mt-1 mb-2">
          <div className="text-xs text-claude-dark-text whitespace-pre-wrap">
            {fullContent}
          </div>
        </div>
      )}
    </div>
  );
};
