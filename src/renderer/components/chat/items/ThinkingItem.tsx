import React from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';
import { MarkdownViewer } from './MarkdownViewer';

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
      {/* Clickable Header */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-800/50 rounded cursor-pointer"
      >
        <Brain className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        <span className="font-medium text-zinc-300">Thinking</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500 truncate flex-1">{truncatedPreview}</span>
        <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="pl-4 ml-2 mt-1 mb-2">
          <MarkdownViewer
            content={fullContent}
            maxHeight="max-h-96"
          />
        </div>
      )}
    </div>
  );
};
