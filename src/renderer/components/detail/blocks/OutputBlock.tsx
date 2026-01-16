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
    <div
      className="rounded-lg shadow-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--code-bg)',
        border: '1px solid var(--code-border)',
      }}
    >
      {/* Header - matches CodeBlockViewer style */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          backgroundColor: 'var(--code-header-bg)',
          borderBottom: '1px solid var(--code-border)',
        }}
      >
        <MessageSquare size={16} className="flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <span className="font-medium text-sm" style={{ color: 'var(--color-text-secondary)' }}>Output</span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {!isExpanded && outputText ? (
          <div className="text-sm line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>
            {preview}
          </div>
        ) : outputText ? (
          <div
            className="text-sm whitespace-pre-wrap max-h-96 overflow-y-auto"
            style={{ color: 'var(--color-text)' }}
          >
            {outputText}
          </div>
        ) : null}
      </div>
    </div>
  );
};
