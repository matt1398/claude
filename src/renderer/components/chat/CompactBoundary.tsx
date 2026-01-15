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
        className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-900/40 bg-amber-950/20 hover:bg-amber-950/30 hover:border-amber-800/60 transition-all duration-200 cursor-pointer"
        aria-expanded={isExpanded}
        aria-label="Toggle compacted content"
      >
        {/* Icon Stack */}
        <div className="flex items-center gap-2 text-amber-600/70 group-hover:text-amber-500 transition-colors">
          <ChevronRight
            size={16}
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
          <Layers size={16} />
        </div>

        {/* Label */}
        <span className="text-sm font-medium text-amber-400/90 group-hover:text-amber-300 transition-colors">
          Compacted
        </span>

        {/* Timestamp */}
        <span className="text-xs text-amber-600/60 group-hover:text-amber-500/80 transition-colors ml-auto">
          {format(timestamp, 'h:mm:ss a')}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 border border-zinc-800/50 rounded-lg bg-zinc-950/30 overflow-hidden">
          {/* Content Container with Max Height & Scroll */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            <div className="p-4 space-y-3">
              {/* Content Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Compacted Content
                </span>
                <span className="text-xs text-zinc-600">
                  {format(timestamp, 'MMM d, yyyy · h:mm:ss a')}
                </span>
              </div>

              {/* Compacted Data Display */}
              <div className="text-sm text-zinc-400 space-y-3">
                {/* Compact Summary Content */}
                {compactContent ? (
                  <div className="bg-zinc-900/50 rounded px-4 py-3 border border-amber-900/20">
                    <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {compactContent}
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-900/50 rounded px-3 py-2 border border-zinc-800/30">
                    <div className="flex items-start gap-2">
                      <Layers size={14} className="text-zinc-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-zinc-500 leading-relaxed">
                        <p className="font-medium text-zinc-400 mb-1">Conversation Compacted</p>
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
                  <div className="bg-zinc-900/30 rounded px-3 py-2">
                    <span className="text-zinc-600">Compact ID</span>
                    <p className="text-zinc-400 font-mono mt-1 truncate">{compactGroup.id}</p>
                  </div>
                  <div className="bg-zinc-900/30 rounded px-3 py-2">
                    <span className="text-zinc-600">Timestamp</span>
                    <p className="text-zinc-400 font-mono mt-1">
                      {format(compactGroup.timestamp, 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbar Styles - Inline for simplicity */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #525252;
        }
      `}</style>
    </div>
  );
}
