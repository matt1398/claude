import React from 'react';
import { Wrench } from 'lucide-react';
import type { LinkedToolItem as LinkedToolItemType } from '../../../types/groups';

interface LinkedToolItemProps {
  linkedTool: LinkedToolItemType;
  onClick: () => void;
  isExpanded: boolean;
}

/**
 * Formats duration in milliseconds to a human-readable string.
 * Examples: "123ms", "1.2s", "45.3s"
 */
function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '...';

  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Gets icon color based on tool result state.
 */
function getIconColor(linkedTool: LinkedToolItemType): string {
  if (linkedTool.isOrphaned) return 'text-amber-400';
  if (linkedTool.result?.isError) return 'text-red-400';
  return 'text-green-400';
}

/**
 * Gets status indicator for one-liner.
 */
function getStatusIndicator(linkedTool: LinkedToolItemType): string {
  if (linkedTool.isOrphaned) return '?';
  if (linkedTool.result?.isError) return 'x';
  return 'ok';
}

/**
 * Gets border color for expanded content.
 */
function getBorderColor(linkedTool: LinkedToolItemType): string {
  if (linkedTool.isOrphaned) return 'border-amber-500';
  if (linkedTool.result?.isError) return 'border-red-500';
  return 'border-green-500';
}

export const LinkedToolItem: React.FC<LinkedToolItemProps> = ({ linkedTool, onClick, isExpanded }) => {
  const iconColor = getIconColor(linkedTool);
  const statusIndicator = getStatusIndicator(linkedTool);
  const borderColor = getBorderColor(linkedTool);

  // Format input for display
  const formatInput = (input: unknown): string => {
    if (typeof input === 'string') {
      return input;
    }
    return JSON.stringify(input, null, 2);
  };

  // Truncate input preview for one-liner
  const inputPreview = linkedTool.inputPreview.length > 40
    ? linkedTool.inputPreview.slice(0, 40) + '...'
    : linkedTool.inputPreview;

  return (
    <div>
      {/* Collapsed: simple one-line row */}
      <div
        onClick={onClick}
        className="flex items-center gap-2 px-2 py-1 hover:bg-claude-dark-surface/50 cursor-pointer rounded"
      >
        <Wrench className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
        <span className="text-sm text-claude-dark-text truncate">
          {linkedTool.name}: {inputPreview}
        </span>
        <span className="text-xs text-claude-dark-text-secondary flex-shrink-0">
          ({statusIndicator} {formatDuration(linkedTool.durationMs)})
        </span>
      </div>

      {/* Expanded: full content below */}
      {isExpanded && (
        <div className={`border-l-2 ${borderColor} pl-3 ml-3 mt-1 mb-2 space-y-2`}>
          {/* Full input */}
          <div className="text-xs">
            <span className="font-medium text-claude-dark-text-secondary block mb-1">Input:</span>
            <pre className="bg-black/30 p-2 rounded overflow-x-auto text-xs text-claude-dark-text">
              {formatInput(linkedTool.input)}
            </pre>
          </div>

          {/* Full output */}
          {!linkedTool.isOrphaned && linkedTool.result && (
            <div className="text-xs">
              <span className="font-medium text-claude-dark-text-secondary block mb-1">Output:</span>
              {linkedTool.result.isError ? (
                <pre className="bg-black/30 p-2 rounded overflow-x-auto text-xs text-red-300">
                  {typeof linkedTool.result.content === 'string'
                    ? linkedTool.result.content
                    : JSON.stringify(linkedTool.result.content, null, 2)}
                </pre>
              ) : typeof linkedTool.result.content === 'string' ? (
                <pre className="bg-black/30 p-2 rounded overflow-x-auto text-xs whitespace-pre-wrap text-claude-dark-text">
                  {linkedTool.result.content}
                </pre>
              ) : (
                <pre className="bg-black/30 p-2 rounded overflow-x-auto text-xs text-claude-dark-text">
                  {JSON.stringify(linkedTool.result.content, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Timing info */}
          <div className="text-xs text-claude-dark-text-secondary space-y-0.5">
            <div>Started: {linkedTool.startTime.toLocaleTimeString()}</div>
            {linkedTool.endTime && (
              <div>Completed: {linkedTool.endTime.toLocaleTimeString()}</div>
            )}
            <div>Duration: {formatDuration(linkedTool.durationMs)}</div>
          </div>

          {/* Orphaned indicator */}
          {linkedTool.isOrphaned && (
            <div className="text-xs text-amber-400 italic">
              No result received
            </div>
          )}
        </div>
      )}
    </div>
  );
};
