import React from 'react';
import { Bot, ChevronRight } from 'lucide-react';
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

export const SubagentItem: React.FC<SubagentItemProps> = ({ step, subagent, onClick, isExpanded }) => {
  const description = subagent.description || step.content.subagentDescription || 'Subagent';
  const subagentType = subagent.subagentType || 'Task';
  const totalTokens = subagent.metrics.totalTokens || 0;

  // Truncate description for one-liner
  const truncatedDesc = description.length > 50 ? description.slice(0, 50) + '...' : description;

  return (
    <div>
      {/* Clickable Header */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-800/50 rounded cursor-pointer"
      >
        <Bot className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        <span className="font-medium text-zinc-300">{subagentType}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500 truncate flex-1">{truncatedDesc}</span>
        <span className="text-zinc-600 text-xs flex-shrink-0">{formatDuration(subagent.durationMs)}</span>
        <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-l-2 border-zinc-600 pl-4 ml-2 mt-1 mb-2">
          {/* Full description */}
          <div className="text-zinc-300 text-sm whitespace-pre-wrap mb-3">
            {description}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-zinc-500">Type:</span>{' '}
              <span className="text-zinc-300">{subagentType}</span>
            </div>
            <div>
              <span className="text-zinc-500">Duration:</span>{' '}
              <span className="text-zinc-300">{formatDuration(subagent.durationMs)}</span>
            </div>
            <div>
              <span className="text-zinc-500">Tokens:</span>{' '}
              <span className="text-zinc-300">{formatTokens(totalTokens)}</span>
            </div>
            <div>
              <span className="text-zinc-500">ID:</span>{' '}
              <span className="text-zinc-300 font-mono">{subagent.id || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
