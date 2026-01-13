import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';

interface ToolResultBlockProps {
  step: SemanticStep;
  isExpanded: boolean;
}

export const ToolResultBlock: React.FC<ToolResultBlockProps> = ({ step, isExpanded }) => {
  const isError = step.content.isError || false;
  const resultContent = step.content.toolResultContent || '';
  const Icon = isError ? XCircle : CheckCircle;

  const bgColor = isError ? 'bg-red-900/20' : 'bg-green-900/20';
  const borderColor = isError ? 'border-red-800/40' : 'border-green-800/40';
  const textColor = isError ? 'text-red-300' : 'text-green-300';

  return (
    <div className={`rounded-lg border ${bgColor} ${borderColor} ${textColor}`}>
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">
            Tool Result {isError && <span className="text-red-400">(Error)</span>}
          </div>
          {step.content.toolName && (
            <code className="text-xs bg-gray-900/50 px-1.5 py-0.5 rounded mt-1 inline-block opacity-80">
              {step.content.toolName}
            </code>
          )}
        </div>
      </div>

      {isExpanded && resultContent && (
        <div className="px-3 py-2 border-t border-gray-700/30">
          <div className="text-xs opacity-80 font-medium mb-1">Result:</div>
          <pre className="text-xs bg-gray-900/50 p-2 rounded overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
            {resultContent}
          </pre>
        </div>
      )}
    </div>
  );
};
