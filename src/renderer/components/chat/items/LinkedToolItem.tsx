import React from 'react';
import { Wrench, CheckCircle, XCircle } from 'lucide-react';
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
  if (ms === undefined) return 'Pending...';

  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Gets the appropriate styling based on tool result state.
 */
function getToolStyles(linkedTool: LinkedToolItemType): {
  borderColor: string;
  bgColor: string;
  textColor: string;
  iconColor: string;
} {
  if (linkedTool.isOrphaned) {
    // Orphaned (no result) - yellow/amber
    return {
      borderColor: 'border-amber-800/40',
      bgColor: 'bg-amber-900/20 hover:bg-amber-900/30',
      textColor: 'text-amber-300',
      iconColor: 'text-amber-400',
    };
  }

  if (linkedTool.result?.isError) {
    // Error - red
    return {
      borderColor: 'border-red-800/40',
      bgColor: 'bg-red-900/20 hover:bg-red-900/30',
      textColor: 'text-red-300',
      iconColor: 'text-red-400',
    };
  }

  // Success - green
  return {
    borderColor: 'border-green-800/40',
    bgColor: 'bg-green-900/20 hover:bg-green-900/30',
    textColor: 'text-green-300',
    iconColor: 'text-green-400',
  };
}

/**
 * Gets the appropriate status icon based on tool result state.
 */
function getStatusIcon(linkedTool: LinkedToolItemType) {
  if (linkedTool.isOrphaned) {
    return null;
  }

  if (linkedTool.result?.isError) {
    return <XCircle size={12} className="text-red-400" />;
  }

  return <CheckCircle size={12} className="text-green-400" />;
}

export const LinkedToolItem: React.FC<LinkedToolItemProps> = ({ linkedTool, onClick, isExpanded }) => {
  const styles = getToolStyles(linkedTool);
  const statusIcon = getStatusIcon(linkedTool);

  // Format input for display
  const formatInput = (input: unknown): string => {
    if (typeof input === 'string') {
      return input;
    }
    return JSON.stringify(input, null, 2);
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${styles.borderColor} ${styles.bgColor} ${styles.textColor} transition-colors cursor-pointer`}
    >
      <Wrench size={16} className={`mt-0.5 flex-shrink-0 ${styles.iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-xs">Tool</span>
          {statusIcon}
          <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">
            {linkedTool.name}
          </code>
          <span className="text-xs opacity-60">
            {formatDuration(linkedTool.durationMs)}
          </span>
        </div>

        {isExpanded ? (
          <>
            {/* Full input */}
            <div className="text-xs mb-3">
              <span className="font-medium block mb-1">Input:</span>
              <pre className="bg-black/30 p-2 rounded overflow-x-auto text-xs">
                {formatInput(linkedTool.input)}
              </pre>
            </div>

            {/* Full output */}
            {!linkedTool.isOrphaned && linkedTool.result && (
              <div className="text-xs mb-2">
                <span className="font-medium block mb-1">Output:</span>
                {linkedTool.result.isError ? (
                  <pre className="bg-black/30 p-2 rounded overflow-x-auto text-xs text-red-300">
                    {typeof linkedTool.result.content === 'string'
                      ? linkedTool.result.content
                      : JSON.stringify(linkedTool.result.content, null, 2)}
                  </pre>
                ) : typeof linkedTool.result.content === 'string' ? (
                  <pre className="bg-black/30 p-2 rounded overflow-x-auto text-xs whitespace-pre-wrap">
                    {linkedTool.result.content}
                  </pre>
                ) : (
                  <pre className="bg-black/30 p-2 rounded overflow-x-auto text-xs">
                    {JSON.stringify(linkedTool.result.content, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Timing info */}
            <div className="text-xs opacity-70 space-y-0.5">
              <div>Started: {linkedTool.startTime.toLocaleTimeString()}</div>
              {linkedTool.endTime && (
                <div>Completed: {linkedTool.endTime.toLocaleTimeString()}</div>
              )}
              <div>Duration: {formatDuration(linkedTool.durationMs)}</div>
            </div>

            {/* Orphaned indicator */}
            {linkedTool.isOrphaned && (
              <div className="text-xs opacity-60 mt-2 italic">
                No result received
              </div>
            )}
          </>
        ) : (
          <>
            {/* Input preview */}
            <div className="text-xs opacity-80 mb-1">
              <span className="font-medium">Input:</span>{' '}
              <span className="font-mono">{linkedTool.inputPreview}</span>
            </div>

            {/* Output preview (if available) */}
            {linkedTool.outputPreview && (
              <div className="text-xs opacity-80">
                <span className="font-medium">Output:</span>{' '}
                <span className="font-mono line-clamp-1">{linkedTool.outputPreview}</span>
              </div>
            )}

            {/* Orphaned indicator */}
            {linkedTool.isOrphaned && (
              <div className="text-xs opacity-60 mt-1 italic">
                No result received
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
