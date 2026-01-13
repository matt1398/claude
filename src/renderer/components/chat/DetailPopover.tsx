import { useEffect, useRef } from 'react';
import { X, Brain, Terminal, CheckCircle, XCircle, Workflow } from 'lucide-react';
import { format } from 'date-fns';
import type { AIGroupDisplayItem } from '../../types/groups';

interface DetailPopoverProps {
  item: AIGroupDisplayItem | null;
  onClose: () => void;
}

/**
 * DetailPopover shows the full details of a single display item in a scrollable overlay.
 *
 * Features:
 * - Max height of 400px with scroll
 * - Click outside or X button to close
 * - Handles all 4 item types: thinking, text, linked-tool (tool), subagent
 * - Shows full content without truncation
 */
export function DetailPopover({ item, onClose }: DetailPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (item) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [item, onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (item) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={popoverRef}
        className="bg-claude-dark-surface border border-claude-dark-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[400px] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-claude-dark-border">
          <div className="flex items-center gap-2">
            {item.type === 'thinking' && (
              <>
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="font-medium text-claude-dark-text">Thinking</span>
              </>
            )}
            {item.type === 'output' && (
              <>
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-claude-dark-text">Output</span>
              </>
            )}
            {item.type === 'tool' && (
              <>
                {item.tool.result?.isError ? (
                  <XCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                <span className="font-medium text-claude-dark-text">Tool: {item.tool.name}</span>
              </>
            )}
            {item.type === 'subagent' && (
              <>
                <Workflow className="w-4 h-4 text-cyan-400" />
                <span className="font-medium text-claude-dark-text">Subagent</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-claude-dark-text-secondary hover:text-claude-dark-text transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (scrollable) */}
        <div className="overflow-y-auto p-4 flex-1">
          {item.type === 'thinking' && (
            <div>
              <div className="text-xs text-claude-dark-text-secondary mb-2">
                {format(item.timestamp, 'h:mm:ss a')}
              </div>
              <pre className="whitespace-pre-wrap text-sm text-purple-100 font-mono bg-purple-900/20 p-3 rounded border border-purple-800/40">
                {item.content}
              </pre>
            </div>
          )}

          {item.type === 'output' && (
            <div>
              <div className="text-xs text-claude-dark-text-secondary mb-2">
                {format(item.timestamp, 'h:mm:ss a')}
              </div>
              <div className="prose prose-sm prose-invert max-w-none">
                <div className="text-claude-dark-text whitespace-pre-wrap break-words">
                  {item.content}
                </div>
              </div>
            </div>
          )}

          {item.type === 'tool' && (
            <div className="space-y-4">
              {/* Tool call info */}
              <div>
                <div className="text-xs font-medium text-claude-dark-text-secondary mb-2">
                  Called at {format(item.tool.startTime, 'h:mm:ss a')}
                </div>
                <div className="text-xs font-medium text-claude-dark-text-secondary mb-1">Input:</div>
                <pre className="text-sm bg-gray-900/50 p-3 rounded overflow-x-auto text-claude-dark-text">
                  {JSON.stringify(item.tool.input, null, 2)}
                </pre>
              </div>

              {/* Tool result */}
              {item.tool.result && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs font-medium text-claude-dark-text-secondary">Result:</div>
                    {item.tool.endTime && (
                      <div className="text-xs text-claude-dark-text-secondary">
                        at {format(item.tool.endTime, 'h:mm:ss a')}
                      </div>
                    )}
                    {item.tool.durationMs !== undefined && (
                      <div className="text-xs text-claude-dark-text-secondary">
                        ({item.tool.durationMs}ms)
                      </div>
                    )}
                  </div>
                  <pre className={`text-sm p-3 rounded overflow-x-auto whitespace-pre-wrap ${
                    item.tool.result.isError
                      ? 'bg-red-900/20 border border-red-800/40 text-red-100'
                      : 'bg-green-900/20 border border-green-800/40 text-green-100'
                  }`}>
                    {typeof item.tool.result.content === 'string'
                      ? item.tool.result.content
                      : JSON.stringify(item.tool.result.content, null, 2)}
                  </pre>
                </div>
              )}

              {/* Orphaned indicator */}
              {item.tool.isOrphaned && (
                <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/40 rounded px-3 py-2">
                  No result received (orphaned tool call)
                </div>
              )}
            </div>
          )}

          {item.type === 'subagent' && (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-claude-dark-text-secondary mb-1">Type:</div>
                <div className="text-sm text-claude-dark-text">
                  {item.subagent.subagentType || 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-claude-dark-text-secondary mb-1">Description:</div>
                <div className="text-sm text-claude-dark-text whitespace-pre-wrap">
                  {item.subagent.description}
                </div>
              </div>
              {item.subagent.startTime && (
                <div>
                  <div className="text-xs font-medium text-claude-dark-text-secondary mb-1">Started:</div>
                  <div className="text-sm text-claude-dark-text">
                    {format(new Date(item.subagent.startTime), 'h:mm:ss a')}
                  </div>
                </div>
              )}
              {item.subagent.endTime && (
                <div>
                  <div className="text-xs font-medium text-claude-dark-text-secondary mb-1">Ended:</div>
                  <div className="text-sm text-claude-dark-text">
                    {format(new Date(item.subagent.endTime), 'h:mm:ss a')}
                  </div>
                </div>
              )}
              {item.subagent.durationMs !== undefined && (
                <div>
                  <div className="text-xs font-medium text-claude-dark-text-secondary mb-1">Duration:</div>
                  <div className="text-sm text-claude-dark-text">
                    {item.subagent.durationMs}ms
                  </div>
                </div>
              )}
              <div className="text-xs text-cyan-400 bg-cyan-900/20 border border-cyan-800/40 rounded px-3 py-2">
                Subagent ID: {item.subagent.id}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
