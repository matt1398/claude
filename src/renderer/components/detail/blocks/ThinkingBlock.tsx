import React from 'react';
import { Brain } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';

interface ThinkingBlockProps {
  step: SemanticStep;
  isExpanded: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ step, isExpanded }) => {
  const thinkingText = step.content.thinkingText || '';
  const preview = thinkingText.length > 100
    ? `${thinkingText.slice(0, 100)}...`
    : thinkingText;

  return (
    <div className="rounded-lg border bg-purple-900/20 border-purple-800/40 text-purple-300">
      <div className="flex items-start gap-2 px-3 py-2">
        <Brain size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1">Thinking</div>
          {!isExpanded && thinkingText && (
            <div className="text-xs text-purple-200/80 line-clamp-2">
              {preview}
            </div>
          )}
        </div>
      </div>

      {isExpanded && thinkingText && (
        <div className="px-3 py-2 border-t border-purple-800/30">
          <pre className="whitespace-pre-wrap text-xs text-purple-100 font-mono max-h-96 overflow-y-auto">
            {thinkingText}
          </pre>
        </div>
      )}
    </div>
  );
};
