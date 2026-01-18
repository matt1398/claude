import React from 'react';
import { MessageSquare, ChevronRight } from 'lucide-react';
import type { SemanticStep } from '../../../types/data';
import { MarkdownViewer } from './MarkdownViewer';
import { SearchHighlight } from '../SearchHighlight';
import { useStore } from '../../../store';

interface TextItemProps {
  step: SemanticStep;
  preview: string;
  onClick: () => void;
  isExpanded: boolean;
  aiGroupId: string;
}

export const TextItem: React.FC<TextItemProps> = ({ step, preview, onClick, isExpanded, aiGroupId }) => {
  const searchQuery = useStore((s) => s.searchQuery);
  const fullContent = step.content.outputText || preview;
  // Truncate preview to ~60 chars for collapsed one-liner
  const truncatedPreview = preview.length > 60 ? preview.slice(0, 60) + '...' : preview;

  return (
    <div>
      {/* Clickable Header */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-overlay)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>Output</span>
        <span style={{ color: 'var(--color-text-muted)' }}>·</span>
        <span className="truncate flex-1" style={{ color: 'var(--color-text-muted)' }}>{truncatedPreview}</span>
        <ChevronRight
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          style={{ color: 'var(--color-text-muted)' }}
        />
      </div>

      {/* Expanded Content - Card style matching CodeBlockViewer */}
      {isExpanded && (
        <div className="pl-4 ml-2 mt-1 mb-2">
          {searchQuery ? (
            <div
              className="rounded-lg shadow-sm overflow-hidden"
              style={{
                backgroundColor: 'var(--code-bg)',
                border: '1px solid var(--code-border)',
              }}
            >
              <div className="p-4 max-h-96 overflow-y-auto">
                <SearchHighlight
                  text={fullContent}
                  itemId={aiGroupId}
                  className="text-sm whitespace-pre-wrap"
                />
              </div>
            </div>
          ) : (
            <MarkdownViewer
              content={fullContent}
              maxHeight="max-h-96"
            />
          )}
        </div>
      )}
    </div>
  );
};
