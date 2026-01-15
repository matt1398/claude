import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface MarkdownViewerProps {
  content: string;
  maxHeight?: string; // e.g., "max-h-64" or "max-h-96"
  className?: string;
  label?: string; // Optional label like "Thinking", "Output", etc.
}

// =============================================================================
// Component
// =============================================================================

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  maxHeight = 'max-h-96',
  className = '',
  label
}) => {
  return (
    <div className={`rounded-lg border border-zinc-700/30 bg-zinc-900/50 overflow-hidden ${className}`}>
      {/* Optional header */}
      {label && (
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 border-b border-zinc-700/30">
          <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <span className="text-sm text-zinc-300 font-medium">{label}</span>
        </div>
      )}

      {/* Markdown content with scroll */}
      <div className={`overflow-y-auto overflow-x-auto ${maxHeight}`}>
        <div className="p-4 prose prose-invert prose-sm max-w-none
                       prose-headings:text-zinc-200 prose-headings:font-semibold
                       prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                       prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-2
                       prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                       prose-strong:text-zinc-200 prose-strong:font-semibold
                       prose-code:text-amber-400 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                       prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700 prose-pre:rounded-lg prose-pre:overflow-x-auto
                       prose-pre:text-xs prose-pre:leading-relaxed prose-pre:my-3
                       prose-blockquote:border-l-4 prose-blockquote:border-zinc-600 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-zinc-400
                       prose-ul:text-zinc-300 prose-ul:my-2 prose-ol:text-zinc-300 prose-ol:my-2
                       prose-li:text-zinc-300 prose-li:marker:text-zinc-500 prose-li:my-1
                       prose-table:text-zinc-300 prose-table:border-collapse prose-table:my-3
                       prose-th:border prose-th:border-zinc-700 prose-th:bg-zinc-800 prose-th:px-3 prose-th:py-2 prose-th:text-left
                       prose-td:border prose-td:border-zinc-700 prose-td:px-3 prose-td:py-2
                       prose-hr:border-zinc-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
