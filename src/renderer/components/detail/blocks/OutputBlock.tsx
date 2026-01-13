import React from 'react';
import { MessageSquare } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';

interface OutputBlockProps {
  step: SemanticStep;
  isExpanded: boolean;
}

export const OutputBlock: React.FC<OutputBlockProps> = ({ step, isExpanded }) => {
  const outputText = step.content.outputText || '';
  const preview = outputText.length > 150
    ? `${outputText.slice(0, 150)}...`
    : outputText;

  return (
    <div className="rounded-lg border bg-gray-800/30 border-gray-700 text-gray-200">
      <div className="flex items-start gap-2 px-3 py-2">
        <MessageSquare size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1">Output</div>
          {!isExpanded && outputText && (
            <div className="text-xs text-gray-400 line-clamp-3">
              {preview}
            </div>
          )}
        </div>
      </div>

      {isExpanded && outputText && (
        <div className="px-3 py-2 border-t border-gray-700/50">
          <div className="prose prose-invert prose-sm max-w-none">
            <div className="text-xs text-gray-200 whitespace-pre-wrap max-h-96 overflow-y-auto">
              {outputText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
