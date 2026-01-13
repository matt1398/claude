import React from 'react';
import { Bot, Clock, Code } from 'lucide-react';
import type { SemanticStep, Subagent } from '../../../types/data';

interface SubagentItemProps {
  step: SemanticStep;
  subagent: Subagent;
  onClick: () => void;
  isExpanded: boolean;
}

/**
 * Formats duration in milliseconds to a human-readable string.
 * Examples: "123ms", "1.2s", "45.3s", "2m 15s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Formats token count for display.
 * Examples: "1.2k", "234", "12.5k"
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Formats a timestamp for display.
 * Examples: "2:34 PM", "10:05 AM"
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const SubagentItem: React.FC<SubagentItemProps> = ({ step, subagent, onClick, isExpanded }) => {
  const description = subagent.description || step.content.subagentDescription || 'Subagent';
  const subagentType = subagent.subagentType || 'Task';
  const totalTokens = subagent.metrics.totalTokens || 0;
  const inputTokens = subagent.metrics.inputTokens || 0;
  const outputTokens = subagent.metrics.outputTokens || 0;

  // Truncate description for one-liner
  const truncatedDesc = description.length > 50 ? description.slice(0, 50) + '...' : description;

  return (
    <div>
      {/* Collapsed: simple one-line row */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 px-2 py-1 hover:bg-blue-900/30 cursor-pointer rounded"
      >
        <Bot className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="text-sm text-blue-300 truncate">
          {subagentType}: {truncatedDesc}
        </span>
        <span className="text-xs text-blue-300/60 flex-shrink-0">
          (ok {formatDuration(subagent.durationMs)})
        </span>
      </div>

      {/* Expanded: full content below */}
      {isExpanded && (
        <div className="border-l-2 border-blue-500 pl-3 ml-3 mt-1 mb-2 space-y-2">
          {/* Full description */}
          <div className="text-xs text-blue-200/90 whitespace-pre-wrap">
            {description}
          </div>

          {/* Detailed metrics */}
          <div className="space-y-2 text-xs text-blue-200/80">
            {/* Duration */}
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-blue-400" />
              <span className="font-medium">Duration:</span>
              <span>{formatDuration(subagent.durationMs)}</span>
            </div>

            {/* Tokens breakdown */}
            <div className="flex items-center gap-2">
              <Code size={14} className="text-blue-400" />
              <span className="font-medium">Tokens:</span>
              <span>{formatTokens(totalTokens)} total</span>
              <span className="opacity-70">
                ({formatTokens(inputTokens)} in / {formatTokens(outputTokens)} out)
              </span>
            </div>

            {/* Messages */}
            {subagent.messages.length > 0 && (
              <div className="flex items-center gap-2">
                <Code size={14} className="text-blue-400" />
                <span className="font-medium">Messages:</span>
                <span>{subagent.messages.length} message{subagent.messages.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Timing */}
            <div className="text-claude-dark-text-secondary space-y-0.5 mt-2">
              <div>Started: {formatTimestamp(subagent.startTime)}</div>
              <div>Ended: {formatTimestamp(subagent.endTime)}</div>
            </div>

            {/* Subagent ID */}
            {subagent.id && (
              <div className="text-claude-dark-text-secondary mt-2">
                <span className="font-medium">ID:</span>{' '}
                <code className="text-xs bg-black/30 px-1 py-0.5 rounded">{subagent.id}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
