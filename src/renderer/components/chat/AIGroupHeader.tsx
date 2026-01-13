import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AIGroupSummary, AIGroupExpansionLevel, AIGroupStatus } from '../../types/groups';

interface AIGroupHeaderProps {
  summary: AIGroupSummary;
  expansionLevel: AIGroupExpansionLevel;
  status: AIGroupStatus;
  onClick: () => void;
}

/**
 * Formats duration in milliseconds to a human-readable string.
 * Examples: "1.2s", "45.3s", "2m 15s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Formats token count to a human-readable string.
 * Examples: "1.2k", "45", "123.4k"
 */
function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens}`;
  }

  const k = tokens / 1000;
  return `${k.toFixed(1)}k`;
}

export function AIGroupHeader({ summary, expansionLevel, status, onClick }: AIGroupHeaderProps) {
  const isExpanded = expansionLevel !== 'collapsed';
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  // Build summary text
  let summaryText = `${summary.toolCallCount} tool call${summary.toolCallCount !== 1 ? 's' : ''}, ${summary.outputMessageCount} message${summary.outputMessageCount !== 1 ? 's' : ''}`;
  if (summary.subagentCount > 0) {
    summaryText += `, ${summary.subagentCount} subagent${summary.subagentCount !== 1 ? 's' : ''}`;
  }

  // Determine status badge
  const showStatusBadge = status === 'interrupted' || status === 'error';
  const statusBadgeText = status === 'interrupted' ? 'Interrupted' : 'Error';
  const statusBadgeColor = status === 'error' ? 'bg-red-600' : 'bg-yellow-600';

  return (
    <div className="border-b border-claude-dark-border">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-claude-dark-surface/50 transition-colors cursor-pointer text-left"
      >
        {/* Chevron icon */}
        <ChevronIcon className="w-4 h-4 text-claude-dark-text-secondary flex-shrink-0" />

        {/* Summary text */}
        <span className="text-sm text-claude-dark-text-secondary flex-1">
          {summaryText}
        </span>

        {/* Status badge */}
        {showStatusBadge && (
          <span className={`px-2 py-0.5 rounded text-xs text-white ${statusBadgeColor}`}>
            {statusBadgeText}
          </span>
        )}

        {/* Duration */}
        <span className="text-sm text-claude-dark-text-secondary">
          {formatDuration(summary.totalDurationMs)}
        </span>

        {/* Token count */}
        <span className="text-sm text-claude-dark-text-secondary">
          {formatTokens(summary.totalTokens)} tokens
        </span>
      </button>

      {/* Thinking preview when collapsed */}
      {expansionLevel === 'collapsed' && summary.thinkingPreview && (
        <div className="px-3 pb-2 pl-9">
          <p className="text-sm italic text-claude-dark-text-secondary/70 truncate">
            {summary.thinkingPreview}
          </p>
        </div>
      )}
    </div>
  );
}
