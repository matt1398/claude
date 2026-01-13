import React from 'react';
import { Bot, Zap, Clock, Code } from 'lucide-react';
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

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-2 px-3 py-2 rounded-lg border border-blue-800/40 bg-blue-900/20 text-blue-300 hover:bg-blue-900/30 transition-colors cursor-pointer"
    >
      <Bot size={16} className="mt-0.5 flex-shrink-0 text-blue-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-xs">Subagent</span>

          {/* Subagent type badge */}
          <span className="text-xs bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-700/30">
            {subagentType}
          </span>

          {/* Parallel indicator */}
          {step.isParallel && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-700/30">
              <Zap size={10} />
              parallel
            </span>
          )}

          {/* Timestamp */}
          <span className="text-xs text-blue-300/60">
            {formatTimestamp(subagent.startTime)}
          </span>
        </div>

        {isExpanded ? (
          <>
            {/* Full description */}
            <div className="text-xs text-blue-200/90 mb-3 whitespace-pre-wrap">
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
              <div className="opacity-70 space-y-0.5 mt-2">
                <div>Started: {formatTimestamp(subagent.startTime)}</div>
                <div>Ended: {formatTimestamp(subagent.endTime)}</div>
              </div>

              {/* Subagent ID */}
              {subagent.id && (
                <div className="opacity-70 mt-2">
                  <span className="font-medium">ID:</span>{' '}
                  <code className="text-xs bg-black/30 px-1 py-0.5 rounded">{subagent.id}</code>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Description */}
            <p className="text-xs text-blue-200/80 mb-2 line-clamp-2">
              {description}
            </p>

            {/* Metrics row */}
            <div className="flex items-center gap-3 text-xs text-blue-200/70">
              {/* Duration */}
              <div className="inline-flex items-center gap-1">
                <Clock size={12} />
                <span>{formatDuration(subagent.durationMs)}</span>
              </div>

              {/* Tokens */}
              <div className="inline-flex items-center gap-1">
                <Code size={12} />
                <span>{formatTokens(totalTokens)} tokens</span>
              </div>

              {/* Message count */}
              {subagent.messages.length > 0 && (
                <div className="text-xs opacity-70">
                  {subagent.messages.length} msg{subagent.messages.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Click indicator */}
            <div className="text-xs text-blue-400/70 mt-1 italic">
              Click to view details
            </div>
          </>
        )}
      </div>
    </div>
  );
};
