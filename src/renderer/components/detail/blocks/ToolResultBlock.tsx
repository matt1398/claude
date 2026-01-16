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

  // Theme-aware styling based on error state
  const containerStyle: React.CSSProperties = isError
    ? {
        backgroundColor: 'var(--tool-result-error-bg)',
        border: '1px solid var(--tool-result-error-border)',
        color: 'var(--tool-result-error-text)',
      }
    : {
        backgroundColor: 'var(--tool-result-success-bg)',
        border: '1px solid var(--tool-result-success-border)',
        color: 'var(--tool-result-success-text)',
      };

  return (
    <div className="rounded-lg" style={containerStyle}>
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">
            Tool Result {isError && <span style={{ color: 'var(--badge-error-bg)' }}>(Error)</span>}
          </div>
          {step.content.toolName && (
            <code
              className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
              style={{ backgroundColor: 'var(--code-bg)', opacity: 0.8 }}
            >
              {step.content.toolName}
            </code>
          )}
        </div>
      </div>

      {isExpanded && resultContent && (
        <div
          className="px-3 py-2"
          style={{ borderTop: '1px solid var(--output-content-border)' }}
        >
          <div className="text-xs font-medium mb-1" style={{ opacity: 0.8 }}>Result:</div>
          <pre
            className="text-xs p-2 rounded overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap"
            style={{ backgroundColor: 'var(--code-bg)' }}
          >
            {resultContent}
          </pre>
        </div>
      )}
    </div>
  );
};
