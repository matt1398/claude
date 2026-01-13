import React from 'react';
import { Bot, Zap } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';

interface SubagentBlockProps {
  step: SemanticStep;
  isExpanded: boolean;
  onSubagentClick?: (id: string, desc: string) => void;
}

export const SubagentBlock: React.FC<SubagentBlockProps> = ({
  step,
  isExpanded,
  onSubagentClick
}) => {
  const subagentId = step.content.subagentId || '';
  const description = step.content.subagentDescription || 'Subagent';
  const isClickable = !!onSubagentClick && !!subagentId;

  const handleClick = () => {
    if (isClickable) {
      onSubagentClick(subagentId, description);
    }
  };

  return (
    <div
      className={`rounded-lg border bg-blue-900/20 border-blue-800/40 text-blue-300 ${
        isClickable ? 'cursor-pointer hover:bg-blue-900/30 transition-colors' : ''
      }`}
      onClick={isClickable ? handleClick : undefined}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Bot size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">Subagent</span>
            {step.isParallel && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-700/30">
                <Zap size={10} />
                parallel
              </span>
            )}
            {isClickable && (
              <span className="text-xs text-blue-400" title="Click to view details">
                🔍 Click to view
              </span>
            )}
          </div>
          {description && (
            <div className="text-xs text-blue-200/80 mt-1 line-clamp-2">
              {description}
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 py-2 border-t border-blue-800/30 space-y-2">
          {subagentId && (
            <div>
              <span className="text-xs text-blue-200/60 font-medium">Agent ID:</span>{' '}
              <code className="text-xs bg-blue-950/50 px-1.5 py-0.5 rounded">
                {subagentId}
              </code>
            </div>
          )}

          {description && (
            <div>
              <div className="text-xs text-blue-200/60 font-medium mb-1">Description:</div>
              <p className="text-xs text-blue-100">{description}</p>
            </div>
          )}

          <div className="flex gap-4 text-xs text-blue-200/80">
            {step.durationMs !== undefined && (
              <span>
                <span className="font-medium">Duration:</span> {step.durationMs}ms
              </span>
            )}
            {step.tokens && (
              <span>
                <span className="font-medium">Tokens:</span>{' '}
                {step.tokens.input.toLocaleString()} in / {step.tokens.output.toLocaleString()} out
                {step.tokens.cached && step.tokens.cached > 0 && (
                  <span> ({step.tokens.cached.toLocaleString()} cached)</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
