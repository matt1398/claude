import React from 'react';
import { Terminal } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';

interface TextItemProps {
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

export const TextItem: React.FC<TextItemProps> = ({ step, preview, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-2 px-3 py-2 rounded-lg border border-claude-dark-border bg-claude-dark-surface text-claude-dark-text hover:bg-gray-700/50 transition-colors cursor-pointer"
    >
      <Terminal size={16} className="mt-0.5 flex-shrink-0 text-claude-dark-text-secondary" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-xs text-claude-dark-text-secondary">Output</span>
          <span className="text-xs text-claude-dark-text-secondary/60">
            {formatTimestamp(step.startTime)}
          </span>
        </div>
        <p className="text-xs text-claude-dark-text line-clamp-2">
          {preview}
        </p>
      </div>
    </div>
  );
};
