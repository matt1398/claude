import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { ChunkView } from './ChunkView';
import { SubagentDetailModal } from './SubagentDetailModal';
import { ErrorHighlight } from './ErrorHighlight';
import type { EnhancedChunk, Chunk } from '../../types/data';

/**
 * Find the chunk index that contains or is closest to the given error timestamp.
 *
 * Strategy:
 * 1. Find chunks whose time range contains the error timestamp
 * 2. If no exact match, find the chunk closest in time (before or after)
 * 3. Fall back to last chunk if nothing else works
 */
function findChunkByTimestamp(chunks: (Chunk | EnhancedChunk)[], errorTimestamp: number): number {
  if (chunks.length === 0) return -1;

  let bestIndex = chunks.length - 1; // Default to last chunk
  let bestTimeDiff = Infinity;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkStartMs = chunk.startTime.getTime();
    const chunkEndMs = chunk.endTime.getTime();

    // Check if error timestamp is within this chunk's time range
    if (errorTimestamp >= chunkStartMs && errorTimestamp <= chunkEndMs) {
      return i; // Exact match found
    }

    // Track closest chunk for fallback
    const startDiff = Math.abs(errorTimestamp - chunkStartMs);
    const endDiff = Math.abs(errorTimestamp - chunkEndMs);
    const minDiff = Math.min(startDiff, endDiff);

    if (minDiff < bestTimeDiff) {
      bestTimeDiff = minDiff;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export const SessionDetail: React.FC = () => {
  const {
    sessionDetail,
    selectedSessionId,
    selectedProjectId,
    sessionDetailLoading,
    sessionDetailError,
    drillDownSubagent,
    openTabs,
    activeTabId,
    clearTabDeepLink
  } = useStore();

  // Get current tab to access deep link props
  const currentTab = activeTabId ? openTabs.find(t => t.id === activeTabId) : null;
  const scrollToLine = currentTab?.scrollToLine;
  const highlightErrorId = currentTab?.highlightErrorId;
  const errorTimestamp = currentTab?.errorTimestamp;

  // Container ref for scrolling
  const containerRef = useRef<HTMLDivElement>(null);

  // State for highlighted chunk
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<number | null>(null);

  // Track whether we've processed the current deep link to avoid re-scrolling
  const processedDeepLinkRef = useRef<string | null>(null);

  // Handler to clear highlight after animation completes
  const handleHighlightEnd = useCallback(() => {
    setHighlightedChunkIndex(null);
    // Clear the deep link props from the tab
    if (activeTabId) {
      clearTabDeepLink(activeTabId);
    }
  }, [activeTabId, clearTabDeepLink]);

  // Calculate target chunk index based on error timestamp or line number
  const targetChunkIndex = useMemo(() => {
    if (!sessionDetail || !sessionDetail.chunks.length) return null;
    if (!scrollToLine && !highlightErrorId && !errorTimestamp) return null;

    // Primary strategy: Use error timestamp for accurate chunk matching
    if (errorTimestamp && errorTimestamp > 0) {
      return findChunkByTimestamp(sessionDetail.chunks, errorTimestamp);
    }

    // Fallback strategy: Use line number heuristic
    if (scrollToLine && scrollToLine > 0) {
      // Estimate: each chunk represents roughly 10-50 lines of JSONL
      // Use a simple heuristic: later lines mean later chunks
      const estimatedChunkIndex = Math.min(
        Math.floor(scrollToLine / 30),
        sessionDetail.chunks.length - 1
      );
      return Math.max(0, estimatedChunkIndex);
    }

    // Last resort: use last chunk (errors typically occur at the end)
    return sessionDetail.chunks.length - 1;
  }, [sessionDetail, scrollToLine, highlightErrorId, errorTimestamp]);

  // Effect to handle deep linking: scroll to and highlight error location
  useEffect(() => {
    // Only process if we have a target chunk
    if (targetChunkIndex === null || targetChunkIndex < 0) return;
    if (!sessionDetail || !sessionDetail.chunks.length) return;

    // Create a unique key for this deep link request
    const deepLinkKey = `${highlightErrorId || ''}-${scrollToLine || ''}-${errorTimestamp || ''}`;

    // Skip if we've already processed this deep link
    if (processedDeepLinkRef.current === deepLinkKey) return;
    processedDeepLinkRef.current = deepLinkKey;

    // Set the highlight (this will trigger forceExpand on the chunk)
    setHighlightedChunkIndex(targetChunkIndex);

    // Scroll to the target chunk after a delay to allow:
    // 1. React to re-render with the highlight
    // 2. ChunkView to expand (if forceExpand is triggered)
    // Using a longer delay ensures the DOM has updated
    const scrollTimer = setTimeout(() => {
      const chunkElement = containerRef.current?.querySelector(
        `[data-chunk-index="${targetChunkIndex}"]`
      );
      if (chunkElement) {
        chunkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100); // 100ms delay allows for expansion animation to start

    return () => clearTimeout(scrollTimer);
  }, [sessionDetail, targetChunkIndex, scrollToLine, highlightErrorId, errorTimestamp]);

  // Reset processed deep link when session changes
  useEffect(() => {
    processedDeepLinkRef.current = null;
    setHighlightedChunkIndex(null);
  }, [selectedSessionId]);

  // Handler for subagent drill-down
  const handleSubagentClick = (subagentId: string, description: string) => {
    if (selectedProjectId && selectedSessionId) {
      drillDownSubagent(selectedProjectId, selectedSessionId, subagentId, description);
    }
  };

  if (!selectedSessionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <svg 
            className="w-16 h-16 mx-auto mb-4 text-gray-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
          <p className="text-lg mb-2">Select a session to view details</p>
          <p className="text-sm text-gray-500">
            Choose a session from the sidebar to see its execution timeline
          </p>
        </div>
      </div>
    );
  }

  if (sessionDetailLoading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-32 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessionDetailError) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          <h3 className="font-semibold mb-2 text-lg">Error loading session</h3>
          <p>{sessionDetailError}</p>
        </div>
      </div>
    );
  }

  if (!sessionDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-lg mb-2">Unable to load session</p>
          <p className="text-sm text-gray-500">
            The session data could not be retrieved. Please try selecting another session.
          </p>
        </div>
      </div>
    );
  }

  const { session, chunks, metrics } = sessionDetail;

  const formatTokens = (inputTokens: number, outputTokens: number, cacheReadTokens?: number) => {
    const total = inputTokens + outputTokens;
    const cached = cacheReadTokens || 0;
    return `${total.toLocaleString()} tokens${cached > 0 ? ` (${cached.toLocaleString()} cached)` : ''}`;
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      <div className="p-6 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 mb-2">
              Session Detail
            </h1>
            <p className="text-sm text-gray-400">
              {session.firstMessage}
            </p>
          </div>
          <button
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Debug JSON
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Total Duration</p>
            <p className="text-lg font-semibold text-gray-200">
              {(metrics.durationMs / 1000).toFixed(2)}s
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Chunks</p>
            <p className="text-lg font-semibold text-gray-200">
              {chunks.length}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Token Usage</p>
            <p className="text-lg font-semibold text-gray-200">
              {formatTokens(metrics.inputTokens, metrics.outputTokens, metrics.cacheReadTokens)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {chunks.map((chunk, index) => {
          const isTargetChunk = highlightedChunkIndex === index;
          return (
            <div key={chunk.id} data-chunk-index={index}>
              <ErrorHighlight
                isHighlighted={isTargetChunk}
                onHighlightEnd={handleHighlightEnd}
              >
                <ChunkView
                  chunk={chunk}
                  index={index}
                  onSubagentClick={handleSubagentClick}
                  forceExpand={isTargetChunk}
                />
              </ErrorHighlight>
            </div>
          );
        })}
      </div>

      {/* Subagent Drill-Down Modal */}
      <SubagentDetailModal />
    </div>
  );
};
