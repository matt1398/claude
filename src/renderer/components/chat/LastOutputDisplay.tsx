import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIGroupLastOutput } from '../../types/groups';
import { SearchHighlight } from './SearchHighlight';
import { useStore } from '../../store';

interface LastOutputDisplayProps {
  lastOutput: AIGroupLastOutput | null;
  aiGroupId: string;
}

/**
 * LastOutputDisplay shows the always-visible last text output OR last tool result.
 * This is what the user sees as "the answer" from the AI.
 *
 * Features:
 * - Shows text output with prose styling
 * - Shows tool result with tool name and icon
 * - Handles error states for tool results
 * - Shows timestamp
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
        className="rounded-lg px-4 py-3"
        style={{
          backgroundColor: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          {format(timestamp, 'h:mm:ss a')}
        </div>
        <div className="prose prose-sm max-w-none" style={{ color: 'var(--prose-body)' }}>
          {searchQuery ? (
            <SearchHighlight text={displayText} itemId={aiGroupId} />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayText}
            </ReactMarkdown>
          )}
        </div>
        {isLongContent && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs mt-2 underline hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
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
        className="rounded-lg px-4 py-3"
        style={{
          backgroundColor: isError ? 'var(--tool-result-error-bg)' : 'var(--tool-result-success-bg)',
          border: `1px solid ${isError ? 'var(--tool-result-error-border)' : 'var(--tool-result-success-border)'}`,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
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
            <span className="text-xs" style={{ color: 'var(--tool-result-error-text)' }}>(Error)</span>
          )}
        </div>
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
    );
  }

  return null;
}
