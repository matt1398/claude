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
  const statusBadgeStyle: React.CSSProperties = status === 'error'
    ? { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }
    : { backgroundColor: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)' };

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-2 transition-colors cursor-pointer text-left hover:opacity-80"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-overlay)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {/* Chevron icon */}
        <ChevronIcon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />

        {/* Summary text */}
        <span className="text-sm flex-1" style={{ color: 'var(--color-text-secondary)' }}>
          {summaryText}
        </span>

        {/* Status badge */}
        {showStatusBadge && (
          <span className="px-2 py-0.5 rounded text-xs" style={statusBadgeStyle}>
            {statusBadgeText}
          </span>
        )}

        {/* Duration */}
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {formatDuration(summary.totalDurationMs)}
        </span>

        {/* Token count */}
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {formatTokens(summary.totalTokens)} tokens
        </span>
      </button>

      {/* Thinking preview when collapsed */}
      {expansionLevel === 'collapsed' && summary.thinkingPreview && (
        <div className="px-3 pb-2 pl-9">
          <p className="text-sm italic truncate" style={{ color: 'var(--color-text-muted)' }}>
            {summary.thinkingPreview}
          </p>
        </div>
      )}
    </div>
  );
}
