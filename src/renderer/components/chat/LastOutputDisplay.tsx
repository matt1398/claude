import { CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIGroupLastOutput } from '../../types/groups';

interface LastOutputDisplayProps {
  lastOutput: AIGroupLastOutput | null;
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
export function LastOutputDisplay({ lastOutput }: LastOutputDisplayProps) {
  if (!lastOutput) {
    return null;
  }

  const { type, timestamp } = lastOutput;

  // Render text output
  if (type === 'text' && lastOutput.text) {
    return (
      <div className="bg-claude-dark-surface border border-claude-dark-border rounded-lg px-4 py-3">
        <div className="text-xs text-claude-dark-text-secondary mb-2">
          {format(timestamp, 'h:mm:ss a')}
        </div>
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {lastOutput.text}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  // Render tool result
  if (type === 'tool_result' && lastOutput.toolResult) {
    const isError = lastOutput.isError || false;
    const Icon = isError ? XCircle : CheckCircle;
    const iconColor = isError ? 'text-red-400' : 'text-green-400';
    const bgColor = isError ? 'bg-red-900/20' : 'bg-green-900/20';
    const borderColor = isError ? 'border-red-800/40' : 'border-green-800/40';

    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg px-4 py-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className="text-xs text-claude-dark-text-secondary">
            {format(timestamp, 'h:mm:ss a')}
          </span>
          {lastOutput.toolName && (
            <code className="text-xs bg-gray-900/50 px-1.5 py-0.5 rounded text-claude-dark-text">
              {lastOutput.toolName}
            </code>
          )}
          {isError && (
            <span className="text-xs text-red-400">(Error)</span>
          )}
        </div>
        <pre className="text-sm text-claude-dark-text whitespace-pre-wrap break-words font-mono max-h-96 overflow-y-auto">
          {lastOutput.toolResult}
        </pre>
      </div>
    );
  }

  return null;
}
