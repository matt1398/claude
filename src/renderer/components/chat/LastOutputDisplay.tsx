import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIGroupLastOutput } from '../../types/groups';
import { SearchHighlight } from './SearchHighlight';
import { useStore } from '../../store';

interface LastOutputDisplayProps {
  lastOutput: AIGroupLastOutput | null;
  aiGroupId: string;
}

/**
 * Inline markdown components for rendering prose content without a container.
 * Theme-aware styling using CSS variables.
 */
const markdownComponents: Components = {
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
      className="rounded-lg overflow-x-auto my-3 p-3 text-xs leading-relaxed font-mono"
      style={{
        backgroundColor: 'var(--prose-pre-bg)',
        border: '1px solid var(--prose-pre-border)',
        color: 'var(--color-text)',
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
};

/**
 * LastOutputDisplay shows the always-visible last text output OR last tool result.
 * This is what the user sees as "the answer" from the AI.
 *
 * Features:
 * - Shows text output with elegant prose styling
 * - Shows tool result with tool name and icon
 * - Handles error states for tool results
 * - Shows timestamp
 * - Expandable for long content
 */
export function LastOutputDisplay({ lastOutput, aiGroupId }: LastOutputDisplayProps) {
  const searchQuery = useStore((s) => s.searchQuery);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand when search matches hidden content
  useEffect(() => {
    if (searchQuery && lastOutput?.type === 'text' && lastOutput.text) {
      const isLong = lastOutput.text.length > 500;
      if (isLong) {
        const lowerText = lastOutput.text.toLowerCase();
        const lowerQuery = searchQuery.toLowerCase();
        const matchIndex = lowerText.indexOf(lowerQuery);
        if (matchIndex >= 500) {
          setIsExpanded(true);
        }
      }
    }
  }, [searchQuery, lastOutput]);

  if (!lastOutput) {
    return null;
  }

  const { type, timestamp } = lastOutput;

  // Render text output
  if (type === 'text' && lastOutput.text) {
    const textContent = lastOutput.text || '';
    const isLongContent = textContent.length > 500;
    const displayText = isLongContent && !isExpanded
      ? textContent.slice(0, 500) + '...'
      : textContent;

    return (
      <div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--code-bg)',
          border: '1px solid var(--code-border)',
        }}
      >
        {/* Header with timestamp */}
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs"
          style={{
            backgroundColor: 'var(--code-header-bg)',
            borderBottom: '1px solid var(--code-border)',
          }}
        >
          <Clock className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {format(timestamp, 'h:mm:ss a')}
          </span>
        </div>

        {/* Content */}
        <div className={`px-4 py-3 overflow-y-auto ${isExpanded ? '' : 'max-h-96'}`}>
          {searchQuery ? (
            <div style={{ color: 'var(--prose-body)' }}>
              <SearchHighlight text={displayText} itemId={aiGroupId} />
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {displayText}
            </ReactMarkdown>
          )}
        </div>

        {/* Show more/less button */}
        {isLongContent && (
          <div
            className="px-4 py-2"
            style={{ borderTop: '1px solid var(--code-border)' }}
          >
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--prose-link)' }}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Render tool result
  if (type === 'tool_result' && lastOutput.toolResult) {
    const isError = lastOutput.isError || false;
    const Icon = isError ? XCircle : CheckCircle;

    return (
      <div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: isError ? 'var(--tool-result-error-bg)' : 'var(--tool-result-success-bg)',
          border: `1px solid ${isError ? 'var(--tool-result-error-border)' : 'var(--tool-result-success-border)'}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{
            borderBottom: `1px solid ${isError ? 'var(--tool-result-error-border)' : 'var(--tool-result-success-border)'}`,
          }}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: isError ? 'var(--tool-result-error-text)' : 'var(--tool-result-success-text)' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {format(timestamp, 'h:mm:ss a')}
          </span>
          {lastOutput.toolName && (
            <code
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--tag-bg)',
                color: 'var(--tag-text)',
                border: '1px solid var(--tag-border)',
              }}
            >
              {lastOutput.toolName}
            </code>
          )}
          {isError && (
            <span className="text-xs font-medium" style={{ color: 'var(--tool-result-error-text)' }}>
              Error
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <pre
            className="text-sm whitespace-pre-wrap break-words font-mono max-h-96 overflow-y-auto"
            style={{ color: 'var(--color-text)' }}
          >
            {searchQuery ? (
              <SearchHighlight text={lastOutput.toolResult} itemId={aiGroupId} />
            ) : (
              lastOutput.toolResult
            )}
          </pre>
        </div>
      </div>
    );
  }

  // Render interruption as a simple horizontal banner
  if (type === 'interruption') {
    return (
      <div
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg"
        style={{
          backgroundColor: 'var(--warning-bg, rgba(245, 158, 11, 0.1))',
          border: '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))',
        }}
      >
        <AlertTriangle
          className="w-4 h-4 flex-shrink-0"
          style={{ color: 'var(--warning-text, #f59e0b)' }}
        />
        <span
          className="text-sm"
          style={{ color: 'var(--warning-text, #f59e0b)' }}
        >
          Request interrupted by user
        </span>
      </div>
    );
  }

  return null;
}
