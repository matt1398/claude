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
    <div
      className="rounded-lg"
      style={{
        backgroundColor: 'var(--thinking-bg)',
        border: '1px solid var(--thinking-border)',
        color: 'var(--thinking-text)',
      }}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Brain size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1">Thinking</div>
          {!isExpanded && thinkingText && (
            <div className="text-xs line-clamp-2" style={{ color: 'var(--thinking-text-muted)' }}>
              {preview}
            </div>
          )}
        </div>
      </div>

      {isExpanded && thinkingText && (
        <div
          className="px-3 py-2"
          style={{ borderTop: '1px solid var(--thinking-content-border)' }}
        >
          <pre
            className="whitespace-pre-wrap text-xs font-mono max-h-96 overflow-y-auto"
            style={{ color: 'var(--thinking-content-text)' }}
          >
            {thinkingText}
          </pre>
        </div>
      )}
    </div>
  );
};
