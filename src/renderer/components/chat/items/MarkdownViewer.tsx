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
    <div
      className={`rounded-lg shadow-sm overflow-hidden ${className}`}
      style={{
        backgroundColor: 'var(--code-bg)',
        border: '1px solid var(--code-border)',
      }}
    >
      {/* Optional header - matches CodeBlockViewer style */}
      {label && (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            backgroundColor: 'var(--code-header-bg)',
            borderBottom: '1px solid var(--code-border)',
          }}
        >
          <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {label}
          </span>
        </div>
      )}

      {/* Markdown content with scroll */}
      <div className={`overflow-y-auto overflow-x-auto ${maxHeight}`}>
        <div className="p-4 prose-container">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Headings
              h1: ({ children }) => (
                <h1
                  className="text-xl font-semibold mt-4 mb-2 first:mt-0"
                  style={{ color: 'var(--prose-heading)' }}
                >
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2
                  className="text-lg font-semibold mt-4 mb-2 first:mt-0"
                  style={{ color: 'var(--prose-heading)' }}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  className="text-base font-semibold mt-3 mb-2 first:mt-0"
                  style={{ color: 'var(--prose-heading)' }}
                >
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4
                  className="text-sm font-semibold mt-3 mb-1 first:mt-0"
                  style={{ color: 'var(--prose-heading)' }}
                >
                  {children}
                </h4>
              ),

              // Paragraphs
              p: ({ children }) => (
                <p
                  className="text-sm leading-relaxed my-2 first:mt-0 last:mb-0"
                  style={{ color: 'var(--prose-body)' }}
                >
                  {children}
                </p>
              ),

              // Links
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="no-underline hover:underline"
                  style={{ color: 'var(--prose-link)' }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),

              // Strong/Bold
              strong: ({ children }) => (
                <strong className="font-semibold" style={{ color: 'var(--prose-heading)' }}>
                  {children}
                </strong>
              ),

              // Emphasis/Italic
              em: ({ children }) => (
                <em className="italic" style={{ color: 'var(--prose-body)' }}>
                  {children}
                </em>
              ),

              // Inline code
              code: ({ className, children }) => {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <code className="block font-mono text-xs" style={{ color: 'var(--color-text)' }}>
                      {children}
                    </code>
                  );
                }
                return (
                  <code
                    className="px-1.5 py-0.5 rounded font-mono text-xs"
                    style={{
                      backgroundColor: 'var(--prose-code-bg)',
                      color: 'var(--prose-code-text)',
                    }}
                  >
                    {children}
                  </code>
                );
              },

              // Code blocks
              pre: ({ children }) => (
                <pre
                  className="rounded-lg overflow-x-auto my-3 p-3 text-xs leading-relaxed"
                  style={{
                    backgroundColor: 'var(--prose-pre-bg)',
                    border: '1px solid var(--prose-pre-border)',
                  }}
                >
                  {children}
                </pre>
              ),

              // Blockquotes
              blockquote: ({ children }) => (
                <blockquote
                  className="border-l-4 pl-4 my-3 italic"
                  style={{
                    borderColor: 'var(--prose-blockquote-border)',
                    color: 'var(--prose-muted)',
                  }}
                >
                  {children}
                </blockquote>
              ),

              // Lists
              ul: ({ children }) => (
                <ul className="list-disc pl-5 my-2 space-y-1" style={{ color: 'var(--prose-body)' }}>
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 my-2 space-y-1" style={{ color: 'var(--prose-body)' }}>
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-sm" style={{ color: 'var(--prose-body)' }}>
                  {children}
                </li>
              ),

              // Tables
              table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                  <table
                    className="min-w-full border-collapse text-sm"
                    style={{ borderColor: 'var(--prose-table-border)' }}
                  >
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead style={{ backgroundColor: 'var(--prose-table-header-bg)' }}>
                  {children}
                </thead>
              ),
              th: ({ children }) => (
                <th
                  className="px-3 py-2 text-left font-semibold"
                  style={{
                    border: '1px solid var(--prose-table-border)',
                    color: 'var(--prose-heading)',
                  }}
                >
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td
                  className="px-3 py-2"
                  style={{
                    border: '1px solid var(--prose-table-border)',
                    color: 'var(--prose-body)',
                  }}
                >
                  {children}
                </td>
              ),

              // Horizontal rule
              hr: () => (
                <hr className="my-4" style={{ borderColor: 'var(--prose-table-border)' }} />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
