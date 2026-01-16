import { format } from 'date-fns';
import { ChevronRight, Layers } from 'lucide-react';
import { useState } from 'react';
import type { CompactGroup } from '../../types/groups';

interface CompactBoundaryProps {
  compactGroup: CompactGroup;
}

/**
 * CompactBoundary displays an interactive, collapsible marker indicating where
 * the conversation was compacted.
 *
 * Features:
 * - Minimalist design with subtle border and hover states
 * - Click to expand/collapse compacted content
 * - Scrollable content area with enforced max-height
 * - Linear/Notion-inspired aesthetics
 */
export function CompactBoundary({ compactGroup }: CompactBoundaryProps) {
  const { timestamp, message } = compactGroup;
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract content from message
  const getCompactContent = (): string => {
    if (!message || !message.content) return '';

    if (typeof message.content === 'string') {
      return message.content;
    }

    // If it's an array of content blocks, extract text
    if (Array.isArray(message.content)) {
      return message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n\n');
    }

    return '';
  };

  const compactContent = getCompactContent();

  return (
    <div className="my-6">
      {/* Collapsible Header - Amber/orange accent for distinction */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer"
        style={{
          backgroundColor: 'var(--tool-call-bg)',
          border: '1px solid var(--tool-call-border)',
        }}
        aria-expanded={isExpanded}
        aria-label="Toggle compacted content"
      >
        {/* Icon Stack */}
        <div className="flex items-center gap-2 transition-colors" style={{ color: 'var(--tool-call-text)' }}>
          <ChevronRight
            size={16}
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
          <Layers size={16} />
        </div>

        {/* Label */}
        <span className="text-sm font-medium transition-colors" style={{ color: 'var(--tool-call-text)' }}>
          Compacted
        </span>

        {/* Timestamp */}
        <span className="text-xs transition-colors ml-auto" style={{ color: 'var(--color-text-muted)' }}>
          {format(timestamp, 'h:mm:ss a')}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          className="mt-2 rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--code-bg)',
            border: '1px solid var(--code-border)',
          }}
        >
          {/* Content Container with Max Height & Scroll */}
          <div className="max-h-64 overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* Content Header */}
              <div
                className="flex items-center justify-between pb-2"
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
              >
                <span
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Compacted Content
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {format(timestamp, 'MMM d, yyyy · h:mm:ss a')}
                </span>
              </div>

              {/* Compacted Data Display */}
              <div className="space-y-3">
                {/* Compact Summary Content */}
                {compactContent ? (
                  <div
                    className="rounded px-4 py-3"
                    style={{
                      backgroundColor: 'var(--color-surface-raised)',
                      border: '1px solid var(--tool-call-border)',
                    }}
                  >
                    <div
                      className="text-xs leading-relaxed whitespace-pre-wrap font-sans"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {compactContent}
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded px-3 py-2"
                    style={{
                      backgroundColor: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <Layers size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                      <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                        <p className="font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                          Conversation Compacted
                        </p>
                        <p>
                          Previous messages were summarized to save context. The full conversation
                          history is preserved in the session file.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className="rounded px-3 py-2"
                    style={{ backgroundColor: 'var(--color-surface-raised)' }}
                  >
                    <span style={{ color: 'var(--color-text-muted)' }}>Compact ID</span>
                    <p className="font-mono mt-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {compactGroup.id}
                    </p>
                  </div>
                  <div
                    className="rounded px-3 py-2"
                    style={{ backgroundColor: 'var(--color-surface-raised)' }}
                  >
                    <span style={{ color: 'var(--color-text-muted)' }}>Timestamp</span>
                    <p className="font-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {format(compactGroup.timestamp, 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
