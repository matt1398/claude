import React from 'react';
import { Brain } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';

interface ThinkingItemProps {
  step: SemanticStep;
  preview: string;
  onClick: () => void;
}

/**
 * Formats a timestamp for display.
 * Examples: "2:34 PM", "10:05 AM"
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const ThinkingItem: React.FC<ThinkingItemProps> = ({ step, preview, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-2 px-3 py-2 rounded-lg border border-purple-800/40 bg-purple-900/20 text-purple-300 hover:bg-purple-900/30 transition-colors cursor-pointer"
    >
      <Brain size={16} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-xs">Thinking</span>
          <span className="text-xs text-purple-300/60">
            {formatTimestamp(step.startTime)}
          </span>
        </div>
        <p className="text-xs text-purple-200/80 line-clamp-2 italic">
          {preview}
        </p>
      </div>
    </div>
  );
};
